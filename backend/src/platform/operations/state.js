"use strict";
const { transaction } = require("../storage/database");
const { reject } = require("../http/errors");
const { digest } = require("../../tournament-configuration/domain/canonical");
const { loginRequired } = require("../auth/sessions");
const permissions = [
  "metadata.edit",
  "structure.edit",
  "registrationSchema.edit",
  "registration.review",
  "results.edit",
  "rounds.confirm",
];
function read(db, tid) {
  const row = db
    .prepare("SELECT data FROM operations_aggregates WHERE tournamentId=?")
    .get(tid);
  return row
    ? JSON.parse(row.data)
    : {
        version: 0,
        collaborators: {},
        form: { fields: [], version: 0 },
        publishedForms: [],
        registrationOpen: false,
        registrations: [],
        rosterLocked: false,
        rules: {},
        runtime: null,
        layouts: {},
        requests: {},
      };
}
function can(db, tid, uid, action) {
  if (!uid) return false;
  const owner = db
    .prepare("SELECT ownerId FROM tournaments WHERE id=?")
    .get(tid)?.ownerId;
  if (owner === uid) return true;
  return (read(db, tid).collaborators[uid]?.permissions || []).includes(action);
}
function effective(db, tid, uid) {
  const result = Object.fromEntries(
    permissions.map((p) => [p, can(db, tid, uid, p)]),
  );
  result["collaborators.manage"] =
    !!uid &&
    db.prepare("SELECT ownerId FROM tournaments WHERE id=?").get(tid)
      ?.ownerId === uid;
  return {
    ...result,
    configure: result["structure.edit"],
    manage: Object.values(result).some(Boolean),
  };
}
function member(db, tid, uid) {
  if (!uid) return false;
  const s = read(db, tid);
  return (
    !!s.collaborators[uid] ||
    s.registrations.some(
      (r) => r.userId === uid && ["submitted", "approved"].includes(r.status),
    )
  );
}
function requirePermission(db, req, tid, action) {
  loginRequired(req);
  if (
    !can(db, tid, req.user.id, action) &&
    !(
      action === "collaborators.manage" &&
      effective(db, tid, req.user.id)[action]
    )
  )
    reject(403, "FORBIDDEN", "没有本赛事的这项操作权限。");
}
function save(db, tid, s) {
  db.prepare(
    "INSERT INTO operations_aggregates VALUES(?,?) ON CONFLICT(tournamentId) DO UPDATE SET data=excluded.data",
  ).run(tid, JSON.stringify(s));
}
function write(db, req, action, fn, { version = true, authorize } = {}) {
  const uid = loginRequired(req).id,
    tid = req.params.tid,
    key = req.get("Idempotency-Key");
  if (!key || key.length > 200)
    reject(422, "INVALID_INPUT", "需要有效请求键。");
  return transaction(db, () => {
    if (action) requirePermission(db, req, tid, action);
    const s = read(db, tid),
      fingerprint = digest({
        path: req.path,
        method: req.method,
        body: req.body,
      }),
      requestId = JSON.stringify([uid, key]);
    if (authorize) authorize(s, uid);
    if (s.requests[requestId]) {
      const old = s.requests[requestId];
      if (old.fingerprint !== fingerprint)
        reject(409, "IDEMPOTENCY_CONFLICT", "请求键已用于其他输入。");
      return old.result;
    }
    if (version && s.version !== req.body.expectedVersion)
      reject(409, "VERSION_CONFLICT", "赛事状态已变化，请重读后再操作。");
    const result = fn(s, uid);
    s.version++;
    require("../schedule/http").revalidate(db, tid, s);
    const out = result === undefined ? { version: s.version } : result;
    s.requests[requestId] = { fingerprint, result: out };
    save(db, tid, s);
    return out;
  });
}
function writePrepared(db, req, action, prepare) {
  const uid = loginRequired(req).id,
    tid = req.params.tid;
  const key = req.get("Idempotency-Key");
  if (!key || key.length > 200)
    reject(422, "INVALID_INPUT", "需要有效请求键。");
  if (action) requirePermission(db, req, tid, action);
  const before = read(db, tid);
  // Cached requests still go through the transactional current-role and
  // fingerprint checks, but do not re-run an already locked round's solver.
  if (before.requests[JSON.stringify([uid, key])])
    return write(db, req, action, () => {});
  if (before.version !== req.body.expectedVersion)
    reject(409, "VERSION_CONFLICT", "赛事状态已变化，请重读后再操作。");
  const inputHash = digest(before),
    prepared = structuredClone(before);
  const result = prepare(prepared, uid);
  return write(db, req, action, (current) => {
    if (digest(current) !== inputHash)
      reject(409, "INPUT_CHANGED", "计算期间输入已变化，请重新准备。");
    Object.assign(current, prepared);
    return result;
  });
}
module.exports = {
  read,
  save,
  write,
  writePrepared,
  can,
  member,
  effective,
  requirePermission,
  permissions,
};
