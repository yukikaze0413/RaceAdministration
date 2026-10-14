"use strict";
const G = require("./graph");
const alternatives = (seat) =>
  seat?.alternatives ??
  (seat?.candidates ?? (seat ? [seat.ref] : [])).map((ref) => ({
    ref,
    choices: seat?.choices ?? {},
  }));
const exclusive = (a, b) =>
  Object.keys(a.choices ?? {}).some(
    (k) => Object.hasOwn(b.choices ?? {}, k) && a.choices[k] !== b.choices[k],
  );
const conflict = (a, b) =>
  a.some((x) =>
    b.some((y) =>
      alternatives(x).some((p) =>
        alternatives(y).some((q) => p.ref === q.ref && !exclusive(p, q)),
      ),
    ),
  );
function units(g, r) {
  const by = new Map(g.nodes.map((n) => [n.id, n])),
    result = [],
    rounds = [],
    ends = new Map();
  for (const n of g.nodes) {
    if (n.kind === "match") {
      const m = r.values[n.id]?.match;
      if (m && !m.bye) {
        result.push({
          id: n.id,
          nodeId: n.id,
          graphId: n.parentId ?? "root",
          seats: [m.A, m.B].filter(Boolean),
          predecessorIds: [],
        });
        ends.set(n.id, n.id);
      }
    } else if (n.kind === "swiss") {
      const windows = r.values[n.id]?.windows ?? [];
      const edge = G.incoming(g, n, "collection"),
        end = edge && G.endpoint(g, edge.from, "output");
      const seats = end ? (r.values[end.node]?.[end.port]?.items ?? []) : [];
      windows.forEach((_, i) => {
        const id = n.id + ":round:" + (i + 1);
        rounds.push({ id, swissNodeId: n.id, number: i + 1 });
        result.push({
          id,
          nodeId: n.id,
          graphId: n.parentId ?? "root",
          seats,
          roundId: id,
          predecessorIds: i ? [n.id + ":round:" + i] : [],
        });
        ends.set(n.id, id);
      });
    }
  }
  const memo = new Map();
  function upstream(nodeId) {
    if (memo.has(nodeId)) return memo.get(nodeId);
    if (ends.has(nodeId)) return [ends.get(nodeId)];
    const n = by.get(nodeId);
    if (!n) return [];
    memo.set(nodeId, []);
    const deps = new Set();
    for (const e of g.edges)
      if (G.endpoint(g, e.to, "input").node === nodeId)
        for (const d of upstream(G.endpoint(g, e.from, "output").node))
          deps.add(d);
    const list = [...deps];
    memo.set(nodeId, list);
    return list;
  }
  for (const unit of result) {
    if (unit.roundId && !unit.roundId.endsWith(":round:1")) continue;
    const deps = new Set(unit.predecessorIds);
    for (const e of g.edges)
      if (G.endpoint(g, e.to, "input").node === unit.nodeId)
        for (const d of upstream(G.endpoint(g, e.from, "output").node))
          deps.add(d);
    const condition = by.get(unit.nodeId)?.params.condition;
    if (condition && ends.has(condition.matchKey))
      deps.add(ends.get(condition.matchKey));
    unit.predecessorIds = [...deps].sort();
  }
  return { units: result, rounds, conflict };
}
module.exports = { units, conflict, alternatives, exclusive };
