/**
 * QR Code generator (ISO/IEC 18004), byte mode, error correction level M,
 * versions 1–10 (up to 213 bytes — enough for any profile URL).
 * Returns a boolean matrix; `qrSvg` renders it.
 */

const DATA_CW = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
const EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS: number[][] = [[], [16], [28], [44], [32, 32], [43, 43], [27, 27, 27, 27], [31, 31, 31, 31], [38, 38, 39, 39], [36, 36, 36, 37, 37], [43, 43, 43, 43, 44]];
const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// GF(256) arithmetic, primitive polynomial 0x11D.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(n: number) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}

function rsRemainder(data: number[], n: number) {
  const gen = rsGenerator(n);
  const res = new Array(n).fill(0);
  for (const d of data) {
    const factor = d ^ res.shift()!;
    res.push(0);
    for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

function bch(value: number, poly: number, polyBits: number) {
  let v = value << (polyBits - 1);
  for (let i = 31 - Math.clz32(v); i >= polyBits - 1; i--) if (v & (1 << i)) v ^= poly << (i - (polyBits - 1));
  return v;
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  while (version <= 10 && 4 + (version < 10 ? 8 : 16) + bytes.length * 8 > DATA_CW[version] * 8) version++;
  if (version > 10) throw new Error("Text too long for QR (max ~213 bytes)");

  // ---- data bits
  const bits: number[] = [];
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = DATA_CW[version] * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  // ---- error correction + interleave
  const blocks: number[][] = [], ecs: number[][] = [];
  let off = 0;
  for (const len of BLOCKS[version]) {
    const blk = data.slice(off, off + len);
    off += len;
    blocks.push(blk);
    ecs.push(rsRemainder(blk, EC_PER_BLOCK[version]));
  }
  const codewords: number[] = [];
  const maxLen = Math.max(...BLOCKS[version]);
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) codewords.push(b[i]);
  for (let i = 0; i < EC_PER_BLOCK[version]; i++) for (const e of ecs) codewords.push(e[i]);

  // ---- function patterns
  const size = version * 4 + 17;
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { m[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = ALIGN[version];
  for (const ay of al) for (const ax of al) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Reserve format areas (written later) and the dark module.
  const drawFormat = (mask: number) => {
    const f = (((0b00 << 3) | mask) << 10 | bch((0b00 << 3) | mask, 0x537, 11)) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    const v = (version << 12) | bch(version, 0x1f25, 13);
    for (let i = 0; i < 18; i++) {
      const dark = ((v >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark); set(b, a, dark);
    }
  }

  // ---- place data (zig-zag)
  const allBits: number[] = [];
  for (const c of codewords) for (let i = 7; i >= 0; i--) allBits.push((c >>> i) & 1);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x]) { m[y][x] = k < allBits.length ? allBits[k] === 1 : false; k++; }
      }
    }
  }

  // ---- choose mask by penalty
  const MASKS = [
    (x: number, y: number) => (x + y) % 2 === 0, (_x: number, y: number) => y % 2 === 0, (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0, (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0, (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (mask: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x]; };
  const penalty = () => {
    let p = 0;
    const line = (get: (i: number, j: number) => boolean) => {
      for (let i = 0; i < size; i++) {
        let run = 1;
        for (let j = 1; j <= size; j++) {
          if (j < size && get(i, j) === get(i, j - 1)) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        for (let j = 0; j + 10 < size; j++) {
          const s = Array.from({ length: 11 }, (_, t) => get(i, j + t));
          const a = [true, false, true, true, true, false, true, false, false, false, false];
          if (a.every((v, t) => s[t] === v) || a.slice().reverse().every((v, t) => s[t] === v)) p += 40;
        }
      }
    };
    line((i, j) => m[i][j]); line((i, j) => m[j][i]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    const dark = m.flat().filter(Boolean).length;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = 0, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask); drawFormat(mask);
    const pen = penalty();
    if (pen < bestP) { bestP = pen; best = mask; }
    applyMask(mask);
  }
  applyMask(best); drawFormat(best);
  return m;
}

export function qrSvg(text: string, o: { dark?: string; light?: string; margin?: number; size?: number } = {}) {
  const m = qrMatrix(text);
  const margin = o.margin ?? 4, n = m.length + margin * 2;
  let d = "";
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + margin},${y + margin}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${o.size ?? n * 8}" height="${o.size ?? n * 8}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${o.light ?? "#ffffff"}"/><path d="${d}" fill="${o.dark ?? "#000000"}"/></svg>`;
}
