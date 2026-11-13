import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { argon2id } from "../server/lib/argon2-core.ts";
import { hashPassword, verifyPassword, needsRehash, closeHashPool } from "../server/lib/password.ts";

after(() => closeHashPool());

test("RFC 9106 Argon2id test vector", () => {
  const out = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), {
    memoryKiB: 32, passes: 3, parallelism: 4, hashLength: 32,
    secret: new Uint8Array(8).fill(3), ad: new Uint8Array(12).fill(4),
  });
  assert.equal(Buffer.from(out).toString("hex"), "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659");
});

test("PHC output verifies with Python cryptography reference", async () => {
  const phc = await hashPassword("Corrèct-horse 9");
  const [, , , params, salt, hash] = phc.split("$");
  const [m, t, p] = params.split(",").map((x) => Number(x.split("=")[1]));
  const py = `
import base64,sys
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
pad=lambda s: s+'='*(-len(s)%4)
s=base64.b64decode(pad(sys.argv[1])); h=base64.b64decode(pad(sys.argv[2]))
Argon2id(salt=s,length=len(h),iterations=${t},lanes=${p},memory_cost=${m}).verify(sys.argv[3].encode(),h)
print('ok')`;
  const out = execFileSync("python3", ["-c", py, salt, hash, "Corrèct-horse 9"]).toString().trim();
  assert.equal(out, "ok");
});

test("verify accepts right password, rejects wrong and malformed", async () => {
  const phc = await hashPassword("s3cret!");
  assert.ok(phc.startsWith("$argon2id$v=19$m=19456,t=2,p=1$"));
  assert.equal(await verifyPassword(phc, "s3cret!"), true);
  assert.equal(await verifyPassword(phc, "s3cret?"), false);
  assert.equal(await verifyPassword("$2b$10$notargon", "x"), false);
  assert.equal(needsRehash(phc), false);
  assert.equal(needsRehash("$argon2id$v=19$m=4096,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g"), true);
});

test("hashing does not block the event loop", async () => {
  let ticks = 0;
  const iv = setInterval(() => ticks++, 10);
  await hashPassword("block-check");
  clearInterval(iv);
  assert.ok(ticks >= 10, `event loop ticked only ${ticks} times`);
});
