"use strict";
function pool(inputs, mapping = {}) {
  const all = inputs.flat();
  if (new Set(all.map((x) => x.ref)).size !== all.length)
    throw new Error("重复席位");
  if (mapping.type === "seed-template") {
    if (mapping.values.length !== all.length)
      throw new Error("排序模板数量不匹配");
    mapping = Object.fromEntries(all.map((x, i) => [x.ref, mapping.values[i]]));
  }
  const positions = all
    .map((x, i) => (Object.hasOwn(mapping, x.ref) ? i : -1))
    .filter((i) => i >= 0);
  const ordered = positions
    .map((i) => all[i])
    .sort((a, b) => mapping[a.ref] - mapping[b.ref]);
  const result = all.slice();
  positions.forEach((i, j) => {
    result[i] = ordered[j];
  });
  return result;
}
function seedMap(items) {
  return Object.fromEntries(items.map((x, i) => [x.ref, i + 1]));
}
function shuffle(items, seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function select(items, mode, n, seed = 0) {
  if (!Number.isSafeInteger(n) || n < 1 || n > items.length)
    throw new Error("选择数量超出集合");
  return (mode === "random" ? shuffle(items, seed) : items).slice(0, n);
}
function template(n, mode, seed) {
  if (
    !Number.isSafeInteger(n) ||
    n < 1 ||
    n > 64 ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 4294967295
  )
    throw new Error("数量或随机数种子非法");
  const positions = Array.from({ length: n }, (_, i) => i + 1);
  return {
    type: "seed-template",
    algorithm: "mulberry32-v1",
    seed,
    values: mode === "reverse" ? positions.reverse() : shuffle(positions, seed),
  };
}
module.exports = { pool, seedMap, template, select };
