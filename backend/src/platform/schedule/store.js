"use strict";
function read(db, tid) {
  const row = db
    .prepare(
      "SELECT version,data FROM schedule_aggregates WHERE tournamentId=?",
    )
    .get(tid);
  return row
    ? { ...JSON.parse(row.data), version: row.version }
    : {
        version: 0,
        configurationId: null,
        structureDigest: null,
        planDigest: null,
        windows: [],
        resources: [],
        assignments: [],
        audit: [],
        requests: {},
        validation: { status: "pending", diagnostics: [] },
      };
}
function save(db, tid, value) {
  db.prepare(
    "INSERT INTO schedule_aggregates VALUES(?,?,?) ON CONFLICT(tournamentId) DO UPDATE SET version=excluded.version,data=excluded.data",
  ).run(tid, value.version, JSON.stringify(value));
}
function configurations(db, tid) {
  const row = db
    .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
    .get(tid);
  return row ? JSON.parse(row.data).configurations.map(([, c]) => c) : [];
}
function cleanup(db, uid) {
  const rows = db
    .prepare(
      "SELECT s.*,t.ownerId FROM schedule_aggregates s JOIN tournaments t ON t.id=s.tournamentId",
    )
    .all();
  for (const row of rows) {
    if (row.ownerId === uid) {
      db.prepare("DELETE FROM schedule_aggregates WHERE tournamentId=?").run(
        row.tournamentId,
      );
      continue;
    }
    const s = JSON.parse(row.data);
    let changed = false;
    for (const key of Object.keys(s.requests))
      if (JSON.parse(key)[0] === uid) {
        delete s.requests[key];
        changed = true;
      }
    for (const entry of s.audit)
      if (entry.actorId === uid) {
        entry.actorId = null;
        changed = true;
      }
    if (changed) save(db, row.tournamentId, s);
  }
}
function deletionRows(db, uid) {
  return db
    .prepare(
      "SELECT s.*,t.ownerId FROM schedule_aggregates s JOIN tournaments t ON t.id=s.tournamentId ORDER BY tournamentId",
    )
    .all()
    .filter((row) => {
      const s = JSON.parse(row.data);
      return (
        row.ownerId === uid ||
        s.audit.some((a) => a.actorId === uid) ||
        Object.keys(s.requests).some((k) => JSON.parse(k)[0] === uid)
      );
    });
}
module.exports = { read, save, configurations, cleanup, deletionRows };
