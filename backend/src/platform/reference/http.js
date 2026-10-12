"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { fields, reject } = require("../http/errors"),
  { loginRequired } = require("../auth/sessions");
const { transaction } = require("../storage/database"),
  { digest } = require("../../tournament-configuration/domain/canonical");
const {
  parseStructure,
} = require("../../tournament-configuration/domain/structure");
const { read, save } = require("../operations/state"),
  { cases, configuration } = require("./cases");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const { DatabaseSync } = require("node:sqlite");
function mountReference(
  api,
  app,
  {
    db,
    send,
    now,
    origins,
    secureCookies,
    frontendPath,
    databasePath,
    demoRoot,
    demoContext,
  },
) {
  api.get("/reference-cases", (req, res) =>
    send(req, res, {
      version: 1,
      workspace: demoContext ? "reference-demo" : "main",
      items: cases,
    }),
  );
  if (demoContext) return { close() {} };
  const root = path.resolve(
    demoRoot ??
      (databasePath === ":memory:"
        ? path.join(
            os.tmpdir(),
            "race-demo-" + randomUUID(),
            ".reference-demos",
          )
        : path.join(
            path.dirname(path.resolve(databasePath)),
            ".reference-demos",
          )),
  );
  if (path.basename(root) !== ".reference-demos")
    throw Error("演示根目录必须为.reference-demos");
  const children = new Map();
  let cleanupRetry = null,
    closing = false,
    retryDelay = 1000;
  function safeFile(id, suffix = ".sqlite") {
    if (!/^[a-f0-9]{64}$/.test(id)) throw Error("演示标识无效");
    const file = path.resolve(root, id + suffix);
    if (path.dirname(file) !== root) throw Error("演示路径越界");
    if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink())
      throw Error("演示目录不可为符号链接");
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
      throw Error("演示文件不可为符号链接");
    return file;
  }
  function ownedRows(uid) {
    if (!fs.existsSync(root)) return [];
    const rows = [];
    for (const name of fs
      .readdirSync(root)
      .filter((n) => /^[a-f0-9]{64}\.sqlite$/.test(n))) {
      const id = name.slice(0, 64),
        probe = new DatabaseSync(safeFile(id), { readOnly: true });
      try {
        probe.exec("BEGIN");
        if (
          !probe
            .prepare("SELECT 1 FROM sqlite_master WHERE name='reference_demo'")
            .get()
        )
          continue;
        const found = probe
          .prepare("SELECT data FROM reference_demo WHERE singleton=1")
          .get();
        if (!found) continue;
        const meta = JSON.parse(found.data);
        if (meta.parentOwnerId !== uid) continue;
        const state = Object.fromEntries(
          [
            "users",
            "sessions",
            "tournaments",
            "structure_aggregates",
            "operations_aggregates",
            "schedule_aggregates",
            "catalog_requests",
          ].map((table) => [
            table,
            probe.prepare("SELECT * FROM " + table).all(),
          ]),
        );
        rows.push({
          id,
          parentOwnerId: uid,
          result: meta.result,
          stateDigest: digest(state),
        });
      } finally {
        probe.close();
      }
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }
  function prepareDeletion(rows) {
    try {
      for (const row of rows) {
        const temporary = safeFile(row.id, ".delete.tmp");
        fs.writeFileSync(
          temporary,
          JSON.stringify({ id: row.id, parentOwnerId: row.parentOwnerId }),
          "utf8",
        );
        const handle = fs.openSync(temporary, "r+");
        try {
          fs.fsyncSync(handle);
        } finally {
          fs.closeSync(handle);
        }
        // A failed/partial write must never become a journal read at startup.
        fs.renameSync(temporary, safeFile(row.id, ".delete.json"));
      }
    } catch {
      reject(503, "STORE_FAILURE", "演示清理记录暂不可保存，请稍后重试注销。");
    }
  }
  function sweepDeletion() {
    if (!fs.existsSync(root)) return 0;
    let pending = 0;
    for (const name of fs
      .readdirSync(root)
      .filter((n) => /^[a-f0-9]{64}\.delete\.json$/.test(n))) {
      const id = name.slice(0, 64),
        journal = safeFile(id, ".delete.json"),
        job = JSON.parse(fs.readFileSync(journal, "utf8"));
      if (job.id !== id || typeof job.parentOwnerId !== "string")
        throw Error("演示清理记录无效");
      // 意图先持久化；只有父账号SQL已经提交删除后才实际删子库。
      // 父事务回滚时账号仍在，此记录不会删除任何文件。
      if (db.prepare("SELECT id FROM users WHERE id=?").get(job.parentOwnerId))
        continue;
      try {
        children.get(id)?.instance.close();
        children.delete(id);
        for (const suffix of [".sqlite", ".sqlite-wal", ".sqlite-shm"]) {
          const file = safeFile(id, suffix);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        fs.unlinkSync(journal);
      } catch {
        pending++;
      }
    }
    if (pending && !cleanupRetry && !closing) {
      cleanupRetry = setTimeout(() => {
        cleanupRetry = null;
        sweepDeletion();
      }, retryDelay);
      cleanupRetry.unref();
      retryDelay = Math.min(60000, retryDelay * 2);
    }
    if (!pending) retryDelay = 1000;
    return pending;
  }
  sweepDeletion();
  api.get("/reference-demos", (req, res) => {
    const owner = loginRequired(req);
    sweepDeletion();
    send(req, res, {
      items: ownedRows(owner.id).map((row) => ({
        ...row.result,
        name: cases.find((c) => c.id === row.result.caseId)?.name ?? "演示赛事",
      })),
    });
  });
  api.post("/reference-demos/:id/enter", (req, res) => {
    const owner = loginRequired(req);
    fields(req.body, ["expectedVersion"]);
    const c = child(req.params.id),
      meta = c && metadata(c);
    if (!meta || meta.parentOwnerId !== owner.id)
      reject(404, "NOT_FOUND", "未找到您创建的演示空间。");
    if (req.body.expectedVersion !== meta.result.version)
      reject(409, "VERSION_CONFLICT", "演示版本已变化。");
    issueSession(c, meta, res);
    send(req, res, meta.result);
  });
  function child(id, create = false) {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    if (children.has(id)) return children.get(id);
    const filename = safeFile(id);
    if (!create && !fs.existsSync(filename)) return null;
    const prefix = "/demos/" + id;
    const instance = require("../../app").createApp({
      databasePath: filename,
      origins,
      now,
      secureCookies,
      frontendPath,
      demoContext: { id, prefix },
    });
    instance.db.exec(
      "CREATE TABLE IF NOT EXISTS reference_demo(singleton INTEGER PRIMARY KEY CHECK(singleton=1),data TEXT NOT NULL)",
    );
    const c = { instance, prefix, cookieName: "race_demo_" + id, filename };
    children.set(id, c);
    return c;
  }
  function metadata(c) {
    const row = c.instance.db
      .prepare("SELECT data FROM reference_demo WHERE singleton=1")
      .get();
    return row ? JSON.parse(row.data) : null;
  }
  function issueSession(c, meta, res) {
    const token = randomBytes(32).toString("hex");
    c.instance.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(sha(token), meta.adminId, now() + 7 * 24 * 3600 * 1000);
    res.cookie(c.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: c.prefix,
      maxAge: 7 * 24 * 3600 * 1000,
    });
  }
  api.post("/reference-demos", (req, res) => {
    const owner = loginRequired(req);
    // 先核验当前真实会话，不能用演示缓存代替当前权限。
    if (
      !db.prepare("SELECT id FROM users WHERE id=?").get(owner.id) ||
      !db
        .prepare(
          "SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?",
        )
        .get(req.sessionHash, now())
    )
      reject(401, "AUTH_REQUIRED", "请重新登录再创建演示空间。");
    fields(req.body, ["caseId", "caseVersion", "expectedVersion", "confirmed"]);
    const key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !key.trim() || key.length > 200)
      reject(422, "INVALID_INPUT", "需要有效的示例请求键。");
    if (req.body.confirmed !== true)
      reject(422, "INVALID_INPUT", "请明确确认创建独立演示空间。");
    const id = sha(JSON.stringify([owner.id, key])),
      fingerprint = digest(req.body),
      existing = child(id);
    if (existing && metadata(existing)) {
      const prior = transaction(existing.instance.db, () => {
        const value = metadata(existing);
        if (value.parentOwnerId !== owner.id)
          reject(404, "NOT_FOUND", "未找到您创建的演示空间。");
        if (value.fingerprint !== fingerprint)
          reject(409, "IDEMPOTENCY_CONFLICT", "示例请求键已用于另一份输入。");
        return value;
      });
      // A committed import is an immutable retry result even when the catalog
      // changes. Current parent authorization was checked before this lookup.
      issueSession(existing, prior, res);
      send(req, res, prior.result, 201);
      return;
    }
    const sample = cases.find((c) => c.id === req.body.caseId);
    if (!sample) reject(422, "INVALID_INPUT", "未知示例。");
    if (
      req.body.caseVersion !== sample.version ||
      req.body.expectedVersion !== 0
    )
      reject(409, "VERSION_CONFLICT", "示例版本已变化，请重读后确认。");
    if (sample.status !== "ready")
      reject(409, "REFERENCE_CASE_PENDING", sample.reason);
    const c = child(id, true);
    const meta = transaction(c.instance.db, () => {
      const prior = metadata(c);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          reject(409, "IDEMPOTENCY_CONFLICT", "示例请求键已用于另一份输入。");
        return prior;
      }
      const uid = randomUUID(),
        tid = randomUUID(),
        cid = randomUUID();
      const user = {
        id: uid,
        username: "demo_admin",
        displayName: "演示管理员",
        createdAt: now(),
        salt: randomBytes(16).toString("hex"),
        passwordHash: randomBytes(64).toString("hex"),
      };
      c.instance.db
        .prepare("INSERT INTO users VALUES(?,?,?)")
        .run(uid, user.username, JSON.stringify(user));
      const event = {
        id: tid,
        ownerId: uid,
        name: sample.name + " · 隔离演示",
        game: "card",
        gameId: null,
        description:
          "固定种子" + sample.seed + "；参考单位仅为标签，不是团队成员报名。",
        location: "隔离演示",
        seriesId: null,
        startsAt: null,
        visibility: "public",
        version: 1,
        createdAt: now(),
      };
      c.instance.db
        .prepare("INSERT INTO tournaments VALUES(?,?,?)")
        .run(tid, uid, JSON.stringify(event));
      const config = {
        ...parseStructure(configuration(sample), tid),
        id: cid,
        tournamentId: tid,
        version: 1,
        state: "draft",
      };
      c.instance.db.prepare("INSERT INTO structure_aggregates VALUES(?,?)").run(
        tid,
        JSON.stringify({
          configurations: [[cid, config]],
          snapshots: [],
          requests: [],
        }),
      );
      const state = read(c.instance.db, tid);
      state.form = { fields: [], version: 1 };
      state.publishedForms = [state.form];
      state.registrationOpen = false;
      state.registrations = Array.from(
        { length: sample.entrantCount },
        (_, i) => ({
          id: randomUUID(),
          userId: "reference-" + randomUUID(),
          name:
            (sample.id === "shadow-cup-v1" ? "暗影参赛单位" : "GSL参赛单位") +
            String(i + 1).padStart(2, "0"),
          schemaVersion: 1,
          answers: {},
          status: "submitted",
          seed: null,
          sourceId: null,
        }),
      );
      save(c.instance.db, tid, state);
      const result = {
        id,
        prefix: c.prefix,
        version: 1,
        caseId: sample.id,
        caseVersion: sample.version,
        tournamentId: tid,
        configurationId: cid,
        entrantKind: "reference-unit",
        url: c.prefix + "/manage/" + tid + "/configurations/" + cid + "/stages",
      };
      const value = {
        fingerprint,
        parentOwnerId: owner.id,
        adminId: uid,
        result,
      };
      c.instance.db
        .prepare("INSERT INTO reference_demo VALUES(1,?)")
        .run(JSON.stringify(value));
      return value;
    });
    // 会话只在子库，cookie只覆盖子空间路径；原平台登录cookie保持。
    issueSession(c, meta, res);
    send(req, res, meta.result, 201);
  });
  app.use("/demos/:demoId", (req, res, next) => {
    try {
      const c = child(req.params.demoId),
        meta = c && metadata(c);
      if (
        !meta ||
        !db.prepare("SELECT id FROM users WHERE id=?").get(meta.parentOwnerId)
      )
        return res.status(404).send("未找到此演示空间。");
      const token = req.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("race_session="))
        ?.slice(13);
      const parentSession =
        token &&
        db
          .prepare(
            "SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?",
          )
          .get(sha(token), now());
      req.parentDemoAuthorized =
        !!parentSession && parentSession.userId === meta.parentOwnerId;
      req.parentAuthorization = () => {
        const current =
          token &&
          db
            .prepare(
              "SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?",
            )
            .get(sha(token), now());
        return !!current && current.userId === meta.parentOwnerId;
      };
      if (!parentSession || parentSession.userId !== meta.parentOwnerId)
        req.headers.cookie = req.headers.cookie
          ?.split(";")
          .filter((x) => !x.trim().startsWith(c.cookieName + "="))
          .join(";");
      c.instance.app(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  return {
    ownedRows,
    prepareDeletion,
    cleanup: sweepDeletion,
    close() {
      closing = true;
      if (cleanupRetry) clearTimeout(cleanupRetry);
      cleanupRetry = null;
      for (const c of children.values()) c.instance.close();
      children.clear();
      // Another instance may have committed the parent's deletion while this
      // instance retained a child handle. Sweep after releasing all handles,
      // while the parent database is still open; closing never creates a timer.
      sweepDeletion();
    },
  };
}
module.exports = { mountReference };
