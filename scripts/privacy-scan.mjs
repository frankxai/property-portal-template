import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", ".next"]);
const riskyPatterns = [
  { label: "German IBAN", pattern: /DE\d{20}/i },
  { label: "secret assignment", pattern: /(api_key|secret|token|password)\s*=\s*['"]?[A-Za-z0-9_\-]{12,}/i },
  { label: "lockbox value", pattern: /(lockbox|alarm|zugangscode|schluesselcode)\s*[:=]\s*\S+/i }
];
const cardCandidatePattern = /\b(?:\d[ -]*?){13,19}\b/g;

function passesLuhn(candidate) {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
    } else if (/\.(md|json|mjs|js|ts|tsx|css|yml|yaml|txt|example)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = await walk(root);
const findings = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const risky of riskyPatterns) {
    if (risky.pattern.test(text)) {
      findings.push(`${path.relative(root, file)}: ${risky.label}`);
    }
  }
  const cardCandidates = text.match(cardCandidatePattern) ?? [];
  if (cardCandidates.some(passesLuhn)) {
    findings.push(`${path.relative(root, file)}: credit-card-like number`);
  }
}

if (findings.length > 0) {
  console.error("Privacy scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Privacy scan passed for ${files.length} file(s).`);
