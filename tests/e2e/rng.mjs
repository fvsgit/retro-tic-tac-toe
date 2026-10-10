export function mulberry32(seed) {
  let state = seed >>> 0;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInitSource(seed) {
  const numeric = Number(seed);
  if (!Number.isInteger(numeric)) {
    throw new Error(`seed must be an integer, got ${seed}`);
  }
  return `${mulberry32.toString()}\nMath.random = mulberry32(${numeric});`;
}
