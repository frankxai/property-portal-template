import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { authenticateBrowserContext, createTestOwnerAuth } from "./test-owner-auth.mjs";

const port = Number(process.env.NOTIFICATION_VISUAL_QA_PORT ?? 3216);
const baseUrl = `http://127.0.0.1:${port}`;
const testOwner = createTestOwnerAuth(baseUrl);
const route = "/admin/notifications";
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const artifactDir = path.join(process.cwd(), "artifacts", "visual-qa");
const isWindows = process.platform === "win32";
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

async function browserPath() {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser path.
    }
  }
  throw new Error("No supported local Chrome or Edge executable found. Set PLAYWRIGHT_CHROME_PATH.");
}

const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), ...testOwner.env },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function stopServer() {
  if (server.exitCode !== null) return;
  if (isWindows && server.pid) {
    const killer = spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    await new Promise((resolve) => killer.once("exit", resolve));
  } else {
    server.kill("SIGTERM");
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`next start exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}${route}`);
      if (response.ok) return;
    } catch {
      // Keep polling.
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${baseUrl}.\n${serverOutput}`);
}

async function seedUrgentReceipt() {
  const response = await fetch(`${baseUrl}/api/support`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      propertySlug: "urban-haven-sample",
      category: "maintenance",
      urgency: "emergency",
      message: "Sample urgent support item for notification visual QA."
    })
  });
  if (!response.ok) throw new Error(`Notification visual seed returned ${response.status}`);
}

async function inspect(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Know what reached the owner, what failed, and what still needs acknowledgement." }).waitFor();
  await page.getByRole("button", { name: "Acknowledge" }).waitFor();

  const operationsMenu = page.locator(".nav-menu summary");
  await operationsMenu.click();
  const menuBox = await page.locator(".nav-menu-panel").boundingBox();
  if (!menuBox || menuBox.x < 0 || menuBox.y < 0 || menuBox.x + menuBox.width > viewport.width + 1 || menuBox.y + menuBox.height > viewport.height + 1) {
    throw new Error(`${name} operations menu escaped the viewport: ${JSON.stringify(menuBox)}`);
  }
  await operationsMenu.click();

  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const required = [".work-header", ".notification-grid", ".notification-card", ".notification-meta", ".proof-line"];
    const missing = required.filter((selector) => !document.querySelector(selector));
    const clippedText = [...document.querySelectorAll("h1, h2, h3, p, strong, button, dt, dd, code, .status")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none" && rect.width > 0 && (rect.right > root.clientWidth + 1 || rect.left < -1);
      })
      .map((element) => element.textContent?.trim().slice(0, 90))
      .filter(Boolean);
    return {
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      overflowPixels: Math.max(0, root.scrollWidth - root.clientWidth),
      missing,
      clippedText,
      operationsMenuInViewport: true
    };
  });

  const primaryNavigation = await page.locator(".nav-links").evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth
  }));
  layout.primaryNavigation = primaryNavigation;

  if (
    layout.overflowPixels > 1 ||
    layout.missing.length > 0 ||
    layout.clippedText.length > 0 ||
    (name === "mobile" && (primaryNavigation.scrollLeft !== 0 || primaryNavigation.scrollWidth > primaryNavigation.clientWidth + 1))
  ) {
    throw new Error(`${name} layout failed: ${JSON.stringify(layout)}`);
  }

  const screenshot = path.join(artifactDir, `notifications-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  return { name, screenshot, ...layout };
}

let browser;
try {
  await mkdir(artifactDir, { recursive: true });
  await waitForServer();
  await seedUrgentReceipt();
  browser = await chromium.launch({ executablePath: await browserPath(), headless: true });
  const context = await browser.newContext();
  await authenticateBrowserContext(context, baseUrl, testOwner.passcode);
  const page = await context.newPage();
  const evidence = [];
  evidence.push(await inspect(page, "desktop", { width: 1440, height: 1200 }));
  evidence.push(await inspect(page, "mobile", { width: 390, height: 844 }));
  console.log(JSON.stringify({ route, evidence }, null, 2));
} finally {
  await browser?.close();
  await stopServer();
}
