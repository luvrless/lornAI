import { parentPort } from "node:worker_threads";
import { argon2id } from "./argon2-core.ts";

parentPort!.on("message", (msg: { id: number; password: Uint8Array; salt: Uint8Array; m: number; t: number; p: number; len: number }) => {
  try {
    const hash = argon2id(msg.password, msg.salt, { memoryKiB: msg.m, passes: msg.t, parallelism: msg.p, hashLength: msg.len });
    parentPort!.postMessage({ id: msg.id, hash });
  } catch (e) {
    parentPort!.postMessage({ id: msg.id, error: (e as Error).message });
  }
});
