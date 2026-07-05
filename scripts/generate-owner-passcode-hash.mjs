import { createHash, randomBytes } from "node:crypto";

const passcode = process.argv[2];
if (!passcode) {
  console.error('Usage: npm run auth:hash -- "private owner passcode"');
  process.exit(1);
}

const secret = process.env.OWNER_PORTAL_SECRET || randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(`${passcode}:${secret}`).digest("hex");

console.log("Add these values to Vercel/Railway secret storage, not to Git:");
console.log(`OWNER_PORTAL_SECRET=${secret}`);
console.log(`OWNER_PORTAL_PASSCODE_HASH=${hash}`);
