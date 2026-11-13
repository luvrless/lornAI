/**
 * Argon2id (RFC 9106, version 0x13) and BLAKE2b, pure TypeScript.
 * 64-bit words are stored as little-endian (lo, hi) uint32 pairs.
 * Verified against the `cryptography` package and the RFC test vector
 * (see tests/argon2.test.ts).
 */

// ------------------------------------------------------------------ BLAKE2b

const IV = new Uint32Array([
  0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
  0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
]);
const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

class Blake2b {
  private h = new Uint32Array(16);
  private b = new Uint8Array(128);
  private c = 0; // bytes in buffer
  private t = 0; // total bytes (fits in 2^53)
  private v = new Uint32Array(32);
  private m = new Uint32Array(32);

  constructor(private outlen: number) {
    if (outlen < 1 || outlen > 64) throw new Error("bad blake2b outlen");
    this.h.set(IV);
    this.h[0] ^= 0x01010000 ^ outlen;
  }

  update(input: Uint8Array): this {
    for (let i = 0; i < input.length; i++) {
      if (this.c === 128) {
        this.t += 128;
        this.compress(false);
        this.c = 0;
      }
      this.b[this.c++] = input[i];
    }
    return this;
  }

  digest(): Uint8Array {
    this.t += this.c;
    while (this.c < 128) this.b[this.c++] = 0;
    this.compress(true);
    const out = new Uint8Array(this.outlen);
    for (let i = 0; i < this.outlen; i++) out[i] = this.h[i >> 2] >>> (8 * (i & 3));
    return out;
  }

  private compress(last: boolean) {
    const v = this.v, m = this.m, h = this.h, b = this.b;
    for (let i = 0; i < 16; i++) { v[i] = h[i]; v[i + 16] = IV[i]; }
    v[24] ^= this.t >>> 0;
    v[25] ^= Math.floor(this.t / 0x100000000);
    if (last) { v[28] = ~v[28]; v[29] = ~v[29]; }
    for (let i = 0; i < 32; i++) m[i] = b[4 * i] | (b[4 * i + 1] << 8) | (b[4 * i + 2] << 16) | (b[4 * i + 3] << 24);
    for (let r = 0; r < 12; r++) {
      const s = SIGMA[r % 10];
      this.g(0, 8, 16, 24, s[0], s[1]);
      this.g(2, 10, 18, 26, s[2], s[3]);
      this.g(4, 12, 20, 28, s[4], s[5]);
      this.g(6, 14, 22, 30, s[6], s[7]);
      this.g(0, 10, 20, 30, s[8], s[9]);
      this.g(2, 12, 22, 24, s[10], s[11]);
      this.g(4, 14, 16, 26, s[12], s[13]);
      this.g(6, 8, 18, 28, s[14], s[15]);
    }
    for (let i = 0; i < 16; i++) h[i] ^= v[i] ^ v[i + 16];
  }

  private add64(a: number, b0: number, b1: number) {
    const v = this.v;
    const lo = v[a] + b0;
    v[a + 1] = v[a + 1] + b1 + (lo >= 0x100000000 ? 1 : 0);
    v[a] = lo;
  }

  private g(a: number, b: number, c: number, d: number, x: number, y: number) {
    const v = this.v, m = this.m;
    this.add64(a, v[b], v[b + 1]);
    this.add64(a, m[2 * x], m[2 * x + 1]);
    let xl = v[d] ^ v[a], xh = v[d + 1] ^ v[a + 1];
    v[d] = xh; v[d + 1] = xl; // rotr 32
    this.add64(c, v[d], v[d + 1]);
    xl = v[b] ^ v[c]; xh = v[b + 1] ^ v[c + 1];
    v[b] = (xl >>> 24) | (xh << 8); v[b + 1] = (xh >>> 24) | (xl << 8); // rotr 24
    this.add64(a, v[b], v[b + 1]);
    this.add64(a, m[2 * y], m[2 * y + 1]);
    xl = v[d] ^ v[a]; xh = v[d + 1] ^ v[a + 1];
    v[d] = (xl >>> 16) | (xh << 16); v[d + 1] = (xh >>> 16) | (xl << 16); // rotr 16
    this.add64(c, v[d], v[d + 1]);
    xl = v[b] ^ v[c]; xh = v[b + 1] ^ v[c + 1];
    v[b] = (xh >>> 31) | (xl << 1); v[b + 1] = (xl >>> 31) | (xh << 1); // rotr 63
  }
}

export function blake2b(data: Uint8Array, outlen = 64): Uint8Array {
  return new Blake2b(outlen).update(data).digest();
}

function le32(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

/** Argon2 variable-length hash H'. */
function hPrime(outlen: number, ...parts: Uint8Array[]): Uint8Array {
  if (outlen <= 64) {
    const h = new Blake2b(outlen).update(le32(outlen));
    for (const p of parts) h.update(p);
    return h.digest();
  }
  const out = new Uint8Array(outlen);
  const h = new Blake2b(64).update(le32(outlen));
  for (const p of parts) h.update(p);
  let v = h.digest();
  out.set(v.subarray(0, 32), 0);
  let pos = 32;
  const r = Math.ceil(outlen / 32) - 2;
  for (let i = 1; i < r; i++) {
    v = blake2b(v, 64);
    out.set(v.subarray(0, 32), pos);
    pos += 32;
  }
  v = blake2b(v, outlen - 32 * r);
  out.set(v, pos);
  return out;
}

// ------------------------------------------------------------------ Argon2 core

// fBlaMka on words at word-index a,b (each = 2 uint32): a + b + 2*lo(a)*lo(b)
function mul32(a: number, b: number, out: Uint32Array) {
  // full 64-bit product of two uint32 → out[0]=lo, out[1]=hi
  const a0 = a & 0xffff, a1 = a >>> 16, b0 = b & 0xffff, b1 = b >>> 16;
  const p00 = a0 * b0, p01 = a0 * b1, p10 = a1 * b0, p11 = a1 * b1;
  const mid = p01 + p10; // < 2^33
  const lo = p00 + (mid % 65536) * 65536;
  out[0] = lo;
  out[1] = p11 + Math.floor(mid / 65536) + Math.floor(lo / 0x100000000);
}

const T = new Uint32Array(2);

function gb(v: Uint32Array, a: number, b: number, c: number, d: number) {
  // a,b,c,d are uint32 indices of the low halves.
  let lo: number, xl: number, xh: number;
  // a = a + b + 2ab
  mul32(v[a], v[b], T);
  lo = v[a] + v[b] + 2 * T[0];
  v[a + 1] = v[a + 1] + v[b + 1] + 2 * T[1] + Math.floor(lo / 0x100000000);
  v[a] = lo;
  xl = v[d] ^ v[a]; xh = v[d + 1] ^ v[a + 1];
  v[d] = xh; v[d + 1] = xl;
  mul32(v[c], v[d], T);
  lo = v[c] + v[d] + 2 * T[0];
  v[c + 1] = v[c + 1] + v[d + 1] + 2 * T[1] + Math.floor(lo / 0x100000000);
  v[c] = lo;
  xl = v[b] ^ v[c]; xh = v[b + 1] ^ v[c + 1];
  v[b] = (xl >>> 24) | (xh << 8); v[b + 1] = (xh >>> 24) | (xl << 8);
  mul32(v[a], v[b], T);
  lo = v[a] + v[b] + 2 * T[0];
  v[a + 1] = v[a + 1] + v[b + 1] + 2 * T[1] + Math.floor(lo / 0x100000000);
  v[a] = lo;
  xl = v[d] ^ v[a]; xh = v[d + 1] ^ v[a + 1];
  v[d] = (xl >>> 16) | (xh << 16); v[d + 1] = (xh >>> 16) | (xl << 16);
  mul32(v[c], v[d], T);
  lo = v[c] + v[d] + 2 * T[0];
  v[c + 1] = v[c + 1] + v[d + 1] + 2 * T[1] + Math.floor(lo / 0x100000000);
  v[c] = lo;
  xl = v[b] ^ v[c]; xh = v[b + 1] ^ v[c + 1];
  v[b] = (xh >>> 31) | (xl << 1); v[b + 1] = (xl >>> 31) | (xh << 1);
}

/** Apply permutation P to 16 words given their word indices (into a 128-word block). */
function perm(v: Uint32Array, w: number[]) {
  const x = (i: number) => 2 * w[i];
  gb(v, x(0), x(4), x(8), x(12));
  gb(v, x(1), x(5), x(9), x(13));
  gb(v, x(2), x(6), x(10), x(14));
  gb(v, x(3), x(7), x(11), x(15));
  gb(v, x(0), x(5), x(10), x(15));
  gb(v, x(1), x(6), x(11), x(12));
  gb(v, x(2), x(7), x(8), x(13));
  gb(v, x(3), x(4), x(9), x(14));
}

const ROWS: number[][] = [];
const COLS: number[][] = [];
for (let i = 0; i < 8; i++) {
  ROWS.push(Array.from({ length: 16 }, (_, k) => 16 * i + k));
  const col: number[] = [];
  for (let k = 0; k < 8; k++) col.push(2 * i + 16 * k, 2 * i + 16 * k + 1);
  COLS.push(col);
}

const R = new Uint32Array(256);
const Q = new Uint32Array(256);

/**
 * out = G(X, Y) (xor=false) or out ^= G(X, Y) (xor=true).
 * Blocks are 256-uint32 views at given offsets into mem / other arrays.
 */
function compress(out: Uint32Array, oOff: number, x: Uint32Array, xOff: number, y: Uint32Array, yOff: number, xor: boolean) {
  for (let i = 0; i < 256; i++) R[i] = x[xOff + i] ^ y[yOff + i];
  Q.set(R);
  for (let i = 0; i < 8; i++) perm(Q, ROWS[i]);
  for (let i = 0; i < 8; i++) perm(Q, COLS[i]);
  if (xor) for (let i = 0; i < 256; i++) out[oOff + i] ^= Q[i] ^ R[i];
  else for (let i = 0; i < 256; i++) out[oOff + i] = Q[i] ^ R[i];
}

export interface Argon2Params {
  memoryKiB: number;
  passes: number;
  parallelism: number;
  hashLength: number;
  secret?: Uint8Array;
  ad?: Uint8Array;
}

const SYNC_POINTS = 4;
const TYPE_ID = 2; // Argon2id
const VERSION = 0x13;

export function argon2id(password: Uint8Array, salt: Uint8Array, p: Argon2Params): Uint8Array {
  const lanes = p.parallelism;
  const secret = p.secret ?? new Uint8Array(0);
  const ad = p.ad ?? new Uint8Array(0);
  if (salt.length < 8) throw new Error("salt too short");
  if (p.memoryKiB < 8 * lanes) throw new Error("memory too small");

  const h0 = new Blake2b(64)
    .update(le32(lanes)).update(le32(p.hashLength)).update(le32(p.memoryKiB)).update(le32(p.passes))
    .update(le32(VERSION)).update(le32(TYPE_ID))
    .update(le32(password.length)).update(password)
    .update(le32(salt.length)).update(salt)
    .update(le32(secret.length)).update(secret)
    .update(le32(ad.length)).update(ad)
    .digest();

  const segLen = Math.floor(p.memoryKiB / (SYNC_POINTS * lanes));
  const laneLen = segLen * SYNC_POINTS;
  const blocks = laneLen * lanes;
  const mem = new Uint32Array(blocks * 256);

  const loadBlock = (bytes: Uint8Array, idx: number) => {
    const o = idx * 256;
    for (let i = 0; i < 256; i++) {
      mem[o + i] = bytes[4 * i] | (bytes[4 * i + 1] << 8) | (bytes[4 * i + 2] << 16) | (bytes[4 * i + 3] << 24);
    }
  };
  for (let l = 0; l < lanes; l++) {
    loadBlock(hPrime(1024, h0, le32(0), le32(l)), l * laneLen);
    loadBlock(hPrime(1024, h0, le32(1), le32(l)), l * laneLen + 1);
  }

  const zero = new Uint32Array(256);
  const input = new Uint32Array(256);
  const addr = new Uint32Array(256);
  const nextAddresses = () => {
    input[12]++; // word 6 (counter), low half
    compress(addr, 0, zero, 0, input, 0, false);
    compress(addr, 0, zero, 0, addr, 0, false);
  };

  for (let pass = 0; pass < p.passes; pass++) {
    for (let slice = 0; slice < SYNC_POINTS; slice++) {
      // Lanes within a slice are independent; computed sequentially here.
      for (let lane = 0; lane < lanes; lane++) {
        const dataIndependent = pass === 0 && slice < 2;
        if (dataIndependent) {
          input.fill(0);
          input[0] = pass; input[2] = lane; input[4] = slice;
          input[6] = blocks; input[8] = p.passes; input[10] = TYPE_ID;
        }
        let start = 0;
        if (pass === 0 && slice === 0) {
          start = 2;
          if (dataIndependent) nextAddresses();
        }
        let cur = lane * laneLen + slice * segLen + start;
        let prev = cur % laneLen === 0 ? cur + laneLen - 1 : cur - 1;
        for (let i = start; i < segLen; i++, cur++, prev++) {
          if (cur % laneLen === 1) prev = cur - 1;
          let j1: number, j2: number;
          if (dataIndependent) {
            if (i % 128 === 0) nextAddresses();
            j1 = addr[2 * (i % 128)];
            j2 = addr[2 * (i % 128) + 1];
          } else {
            j1 = mem[prev * 256];
            j2 = mem[prev * 256 + 1];
          }
          let refLane = j2 % lanes;
          if (pass === 0 && slice === 0) refLane = lane;
          const sameLane = refLane === lane;
          let area: number;
          if (pass === 0) {
            area = sameLane ? slice * segLen + i - 1 : slice * segLen + (i === 0 ? -1 : 0);
          } else {
            area = sameLane ? laneLen - segLen + i - 1 : laneLen - segLen + (i === 0 ? -1 : 0);
          }
          // rel = area - 1 - ((area * ((j1*j1) >> 32)) >> 32), using exact arithmetic
          mul32(j1, j1, T);
          const x = T[1];
          mul32(area, x, T);
          const rel = area - 1 - T[1];
          const startPos = pass !== 0 && slice !== SYNC_POINTS - 1 ? (slice + 1) * segLen : 0;
          const refIdx = refLane * laneLen + ((startPos + rel) % laneLen);
          compress(mem, cur * 256, mem, prev * 256, mem, refIdx * 256, pass !== 0);
        }
      }
    }
  }

  const final = new Uint32Array(256);
  for (let l = 0; l < lanes; l++) {
    const o = (l * laneLen + laneLen - 1) * 256;
    for (let i = 0; i < 256; i++) final[i] ^= mem[o + i];
  }
  const fb = new Uint8Array(1024);
  for (let i = 0; i < 256; i++) {
    fb[4 * i] = final[i]; fb[4 * i + 1] = final[i] >>> 8; fb[4 * i + 2] = final[i] >>> 16; fb[4 * i + 3] = final[i] >>> 24;
  }
  return hPrime(p.hashLength, fb);
}
