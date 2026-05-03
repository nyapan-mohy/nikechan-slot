const UINT32_SIZE = 0x100000000;

export function normalizeSeed(seed = 0x12345678) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const raw = String(seed ?? "").trim();
  if (!raw) return 0x12345678;
  if (/^0x[0-9a-f]+$/i.test(raw)) return Number.parseInt(raw.slice(2), 16) >>> 0;
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10) >>> 0;

  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export class DeterministicRng {
  constructor(seed = 0x12345678) {
    this.state = normalizeSeed(seed);
  }

  nextUint32() {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  nextFloat() {
    return this.nextUint32() / UINT32_SIZE;
  }

  nextInt(maxExclusive) {
    const max = Math.floor(Number(maxExclusive));
    if (!Number.isFinite(max) || max <= 0) {
      throw new RangeError(`nextInt requires a positive maxExclusive, got ${maxExclusive}`);
    }
    return Math.floor(this.nextFloat() * max);
  }

  getState() {
    return this.state >>> 0;
  }

  setState(seed) {
    this.state = normalizeSeed(seed);
  }

  fork(salt = "fork") {
    return new DeterministicRng(this.getState() ^ normalizeSeed(salt));
  }
}

export function createRng(seed) {
  return new DeterministicRng(seed);
}

export function seedToHex(seed) {
  return `0x${normalizeSeed(seed).toString(16).toUpperCase().padStart(8, "0")}`;
}
