"use strict";
const { createHash } = require("node:crypto");
const previousSchema = "canvas-v2";
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digestFields = new Set(["digest", "graphDigest", "wavePlanDigest"]);
function visit(value, callback) {
  if (!value || typeof value !== "object") return;
  callback(value);
  for (const child of Object.values(value)) visit(child, callback);
}
function rewrite(value, aliases) {
  if (Array.isArray(value))
    return value.map((child) => rewrite(child, aliases));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "schemaVersion" && child === previousSchema
        ? "canvas"
        : key === "planKey" &&
            typeof child === "string" &&
            child.startsWith("canvas-plan-v1/")
          ? child.replace("canvas-plan-v1/", "canvas-plan/")
          : digestFields.has(key) && aliases.has(child)
            ? aliases.get(child)
            : rewrite(child, aliases),
    ]),
  );
}
function migrateCanvasNaming(db) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version=5").get())
    return;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS canvas_name_digests(previous TEXT PRIMARY KEY,current TEXT NOT NULL)",
    );
    const documents = [];
    for (const row of db
      .prepare("SELECT id,graph,validation FROM planning_canvases")
      .all())
      documents.push({
        table: "planning_canvases",
        where: "id=?",
        keys: [row.id],
        values: {
          graph: JSON.parse(row.graph),
          ...(row.validation ? { validation: JSON.parse(row.validation) } : {}),
        },
      });
    for (const row of db
      .prepare("SELECT canvasId,data FROM planning_canvas_schedules")
      .all())
      documents.push({
        table: "planning_canvas_schedules",
        where: "canvasId=?",
        keys: [row.canvasId],
        values: { data: JSON.parse(row.data) },
      });
    for (const row of db
      .prepare("SELECT actorId,requestKey,result FROM canvas_requests")
      .all())
      documents.push({
        table: "canvas_requests",
        where: "actorId=? AND requestKey=?",
        keys: [row.actorId, row.requestKey],
        values: { result: JSON.parse(row.result) },
      });
    const aliases = new Map();
    const roots = documents.flatMap((document) =>
      Object.values(document.values),
    );
    for (const root of roots)
      visit(root, (value) => {
        if (
          value.schemaVersion === previousSchema &&
          Array.isArray(value.nodes) &&
          Array.isArray(value.edges)
        )
          aliases.set(digest(value), digest(rewrite(value, new Map())));
      });
    for (const root of roots)
      visit(root, (value) => {
        if (
          typeof value.plannerVersion === "string" &&
          typeof value.graphDigest === "string" &&
          Array.isArray(value.waves)
        )
          aliases.set(digest(value), digest(rewrite(value, aliases)));
      });
    for (const [previous, current] of aliases)
      if (previous !== current)
        db.prepare(
          "INSERT OR REPLACE INTO canvas_name_digests VALUES(?,?)",
        ).run(previous, current);
    for (const document of documents) {
      const fields = Object.keys(document.values);
      const values = fields.map((field) =>
        JSON.stringify(rewrite(document.values[field], aliases)),
      );
      db.prepare(
        `UPDATE ${document.table} SET ${fields.map((field) => field + "=?").join(",")} WHERE ${document.where}`,
      ).run(...values, ...document.keys);
    }
    db.prepare("INSERT INTO schema_migrations VALUES(5)").run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// 已确认请求保留原指纹；改名后的同一快照仍可用原键重试。
function matchesRenamedRequest(db, fingerprint, operation, id, body) {
  const previous = structuredClone(body);
  let changed = false;
  if (previous?.graph?.schemaVersion === "canvas") {
    previous.graph.schemaVersion = previousSchema;
    changed = true;
  }
  if (typeof previous?.wavePlanDigest === "string") {
    const alias = db
      .prepare(
        "SELECT previous FROM canvas_name_digests WHERE current=? ORDER BY previous LIMIT 1",
      )
      .get(previous.wavePlanDigest);
    if (alias) {
      previous.wavePlanDigest = alias.previous;
      changed = true;
    }
  }
  return changed && digest({ operation, id, body: previous }) === fingerprint;
}
module.exports = { migrateCanvasNaming, matchesRenamedRequest };
