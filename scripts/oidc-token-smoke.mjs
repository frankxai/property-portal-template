import assert from "node:assert/strict";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyOidcIdToken } from "../lib/oidc-token.ts";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const { privateKey: attackerKey } = await generateKeyPair("RS256");
const jwk = { ...await exportJWK(publicKey), kid: "property-os-test", use: "sig", alg: "RS256" };
const server = createServer((request, response) => {
  if (request.url !== "/jwks") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify({ keys: [jwk] }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("OIDC token smoke server did not bind.");

const issuer = `http://127.0.0.1:${address.port}/issuer`;
const clientId = "property-os-smoke-client";
const config = {
  issuer,
  clientId,
  jwksUrl: `http://127.0.0.1:${address.port}/jwks`
};
const now = Math.floor(Date.now() / 1000);

function token({
  payload = {},
  signingKey = privateKey,
  tokenIssuer = issuer,
  audience = clientId,
  expiresAt = now + 300
} = {}) {
  return new SignJWT({
    email: "owner@example.test",
    email_verified: true,
    organization_id: "org-alpha",
    role: "owner",
    ...payload
  })
    .setProtectedHeader({ alg: "RS256", kid: "property-os-test" })
    .setIssuer(tokenIssuer)
    .setAudience(audience)
    .setSubject("subject-123")
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(signingKey);
}

try {
  const claims = await verifyOidcIdToken(await token(), config);
  assert.equal(claims.sub, "subject-123");

  await assert.rejects(async () => verifyOidcIdToken(await token({ signingKey: attackerKey }), config));
  await assert.rejects(async () => verifyOidcIdToken(await token({ tokenIssuer: `${issuer}/wrong` }), config));
  await assert.rejects(async () => verifyOidcIdToken(await token({ audience: "wrong-client" }), config));
  await assert.rejects(async () => verifyOidcIdToken(await token({ expiresAt: now - 60 }), config));
  await assert.rejects(async () => verifyOidcIdToken(await token({ audience: [clientId, "another-client"] }), config));
  await assert.rejects(async () => verifyOidcIdToken(await token({ payload: { azp: "wrong-client" } }), config));

  const multipleAudience = await verifyOidcIdToken(await token({
    audience: [clientId, "another-client"],
    payload: { azp: clientId }
  }), config);
  assert.equal(multipleAudience.azp, clientId);
  console.log("Signed OIDC ID-token validation smoke passed.");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
