"use strict";

// This solver is pure: callers prepare outside a SQLite transaction and bind
// the returned complete matching to the original input version/hash.
function pairSwiss(
  input,
  { first = false, threshold = false, nodeBudget = 250000 } = {},
) {
  const rows = [...input].sort((a, b) => a.initialSeed - b.initialSeed);
  const abs = (n) => (n < 0n ? -n : n);
  const value = (r) => BigInt(r.points ?? 0);
  const cost = (a, b) =>
    threshold
      ? BigInt(Math.abs(a.wins - b.wins) + Math.abs(a.losses - b.losses))
      : abs(value(a) - value(b));
  const legal = (a, b) =>
    !(a.opponents ?? []).includes(b.entrantId) &&
    !(b.opponents ?? []).includes(a.entrantId);
  let nodes = 0,
    exhausted = false;
  const byes =
    rows.length % 2
      ? rows
          .filter((r) => !r.byeCount)
          .sort((a, b) => {
            const diff = threshold
              ? BigInt(a.wins - a.losses - b.wins + b.losses)
              : value(a) - value(b);
            return (
              (diff < 0n ? -1 : diff > 0n ? 1 : 0) ||
              b.initialSeed - a.initialSeed
            );
          })
      : [null];
  for (const bye of byes) {
    const remaining = rows.filter((r) => r !== bye);
    if (first) {
      const half = remaining.length / 2;
      const pairs = remaining
        .slice(0, half)
        .map((r, i) => [r, remaining[i + half]]);
      if (pairs.every(([a, b]) => legal(a, b)))
        return {
          status: "ready",
          pairs: pairs.map((p) => p.map((r) => r.entrantId)),
          bye: bye?.entrantId ?? null,
          cost: "0",
          nodes,
        };
      // A first-round table is a hard rule, never silently replace it.
      return { status: "unsat", pairs: [], bye: null, nodes };
    }
    // A zero-cost complete matching proves the nonnegative global optimum.
    // Search only those edges first, in the same seed lexicographic order;
    // otherwise DFS can spend its budget improving unnecessary floats.
    // Odd score/record buckets cannot have a zero-cost perfect matching.
    const buckets = new Map();
    for (const row of remaining) {
      const key = threshold
        ? JSON.stringify([row.wins, row.losses])
        : value(row).toString();
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    function zeroMatching(left) {
      if (++nodes > nodeBudget) {
        exhausted = true;
        return null;
      }
      if (!left.length) return [];
      const a = left[0];
      for (let i = 1; i < left.length; i++) {
        const b = left[i];
        if (!legal(a, b) || cost(a, b) !== 0n) continue;
        const tail = zeroMatching(left.filter((r) => r !== a && r !== b));
        if (tail) return [[a.entrantId, b.entrantId], ...tail];
        if (exhausted) return null;
      }
      return null;
    }
    if ([...buckets.values()].every((size) => size % 2 === 0)) {
      const zero = zeroMatching(remaining);
      if (exhausted)
        return { status: "solver-limit", pairs: [], bye: null, nodes };
      if (zero)
        return {
          status: "ready",
          pairs: zero,
          bye: bye?.entrantId ?? null,
          cost: "0",
          nodes,
        };
    }
    let best = null,
      bestCost = null;
    function bound(left) {
      let sum = 0n;
      for (const a of left) {
        let minimum = null;
        for (const b of left)
          if (a !== b && legal(a, b)) {
            const c = cost(a, b);
            if (minimum === null || c < minimum) minimum = c;
          }
        if (minimum === null) return null;
        sum += minimum;
      }
      return sum / 2n;
    }
    function visit(left, pairs, current) {
      if (++nodes > nodeBudget) {
        exhausted = true;
        return;
      }
      if (!left.length) {
        if (bestCost === null || current < bestCost) {
          bestCost = current;
          best = pairs;
        }
        return;
      }
      const lower = bound(left);
      if (lower === null || (bestCost !== null && current + lower >= bestCost))
        return;
      const a = left[0];
      // DFS seed order chooses the first matching among equal minimum costs.
      for (let i = 1; i < left.length; i++) {
        const b = left[i];
        if (!legal(a, b)) continue;
        visit(
          left.filter((r) => r !== a && r !== b),
          [...pairs, [a.entrantId, b.entrantId]],
          current + cost(a, b),
        );
        if (exhausted) return;
      }
    }
    visit(remaining, [], 0n);
    if (exhausted)
      return { status: "solver-limit", pairs: [], bye: null, nodes };
    if (best)
      return {
        status: "ready",
        pairs: best,
        bye: bye?.entrantId ?? null,
        cost: bestCost.toString(),
        nodes,
      };
  }
  return { status: "unsat", pairs: [], bye: null, nodes };
}
module.exports = { pairSwiss };
