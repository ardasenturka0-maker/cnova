import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedMutationRequest } from "../src/lib/request-security";

test("mutation guard rejects cross-site browser requests and forged origins", () => {
  assert.equal(isTrustedMutationRequest(new Request("https://clinic.example/api/auth/mfa", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } })), false);
  assert.equal(isTrustedMutationRequest(new Request("https://clinic.example/api/auth/mfa", { headers: { origin: "https://evil.example" } })), false);
  assert.equal(isTrustedMutationRequest(new Request("https://clinic.example/api/auth/mfa", { headers: { origin: "https://clinic.example", "sec-fetch-site": "same-origin" } })), true);
  assert.equal(isTrustedMutationRequest(new Request("https://clinic.example/api/auth/mfa")), true);
});
