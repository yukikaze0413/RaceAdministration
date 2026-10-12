"use strict";
const { read, save } = require("./state");
function related(s, uid) {
  if (
    Object.hasOwn(s.collaborators, uid) ||
    s.registrations.some((r) => r.userId === uid) ||
    Object.keys(s.requests).some((k) => JSON.parse(k)[0] === uid)
  )
    return true;
  if (!s.runtime) return false;
  if (s.runtime.roster.some((r) => r.userId === uid)) return true;
  return s.runtime.units.some((u) => {
    if (u.rankingDecision?.actorId === uid) return true;
    return u.rounds.some((round) =>
      round.matches.some(
        (m) =>
          m.decision?.actorId === uid ||
          m.submissions.some((x) => x.actorId === uid),
      ),
    );
  });
}
function deletionRows(db, uid) {
  return db
    .prepare(
      "SELECT a.*,t.ownerId FROM operations_aggregates a JOIN tournaments t ON t.id=a.tournamentId ORDER BY tournamentId",
    )
    .all()
    .filter((r) => r.ownerId === uid || related(JSON.parse(r.data), uid));
}
function cleanup(db, uid) {
  const rows = deletionRows(db, uid);
  for (const row of rows) {
    if (row.ownerId === uid) {
      db.prepare("DELETE FROM operations_aggregates WHERE tournamentId=?").run(
        row.tournamentId,
      );
      continue;
    }
    const s = read(db, row.tournamentId);
    delete s.collaborators[uid];
    s.registrations = s.registrations.filter((r) => r.userId !== uid);
    for (const key of Object.keys(s.requests))
      if (JSON.parse(key)[0] === uid) delete s.requests[key];
    if (s.runtime) {
      for (const r of s.runtime.roster)
        if (r.userId === uid) {
          r.userId = null;
          r.name = "已注销参赛者";
        }
      for (const u of s.runtime.units) {
        if (u.rankingDecision?.actorId === uid)
          u.rankingDecision.actorId = null;
        for (const round of u.rounds)
          for (const m of round.matches) {
            m.submissions = m.submissions.filter((x) => x.actorId !== uid);
            if (m.decision?.actorId === uid) m.decision.actorId = null;
          }
      }
    }
    s.version++;
    save(db, row.tournamentId, s);
  }
}
module.exports = { deletionRows, cleanup };
