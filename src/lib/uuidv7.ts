/** UUIDv7 generation — seeded (deterministic) and runtime (crypto-random). */

import { randomBytes } from "node:crypto";

function format(tsMs: number, randA: number, randHi: number, randLo: number): string {
  const tsBig = BigInt(tsMs) & 0xffffffffffffn; // clamp to 48 bits
  const hi =
    (tsBig << 16n) |
    0x7000n |
    BigInt(randA & 0x0fff);
  const lo =
    0x8000000000000000n |
    (BigInt(randHi & 0x3fffffff) << 32n) |
    BigInt(randLo >>> 0);
  const s = hi.toString(16).padStart(16, "0") + lo.toString(16).padStart(16, "0");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** UUIDv7 with crypto-random bits — for runtime use. */
export function uuidv7(): string {
  const buf = randomBytes(10);
  return format(
    Date.now(),
    buf.readUInt16BE(0) & 0x0fff,
    buf.readUInt32BE(2) & 0x3fffffff,
    buf.readUInt32BE(6),
  );
}

/** UUIDv7 with explicit inputs — for deterministic seed and archive data. */
export function uuidv7Seeded(
  tsMs: number,
  randA: number,
  randHi: number,
  randLo: number,
): string {
  return format(tsMs, randA, randHi, randLo);
}
