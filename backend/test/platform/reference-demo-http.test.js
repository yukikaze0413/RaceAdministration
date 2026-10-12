"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { event, payload } = require("./formats-v2-fixture");
test("RC3 explicit versioned idempotent import uses another SQLite and scoped session", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "race-demo-import-"));
  const root = path.join(directory, ".reference-demos");
  const f = await event(t, { demoRoot: root });
  t.after(async () => {
    await f.close();
    for (const name of fs.existsSync(root) ? fs.readdirSync(root) : []) {
      const file = path.resolve(root, name);
      assert.equal(path.dirname(file), path.resolve(root));
      if (fs.statSync(file).isFile()) fs.unlinkSync(file);
    }
    if (fs.existsSync(root)) fs.rmdirSync(root);
    fs.rmdirSync(directory);
  });
  const parentSnapshot = () =>
    Object.fromEntries(
      [
        "users",
        "sessions",
        "tournaments",
        "operations_aggregates",
        "structure_aggregates",
        "catalog_requests",
        "schedule_aggregates",
      ].map((table) => [
        table,
        f.platform.db.prepare("SELECT * FROM " + table).all(),
      ]),
    );
  const before = parentSnapshot();
  const body = {
    caseId: "gsl-reset-v1",
    caseVersion: 1,
    expectedVersion: 0,
    confirmed: true,
  };
  assert.equal(
    (
      await f.request(
        "/reference-demos",
        "POST",
        { ...body, confirmed: false },
        f.cookie,
        "no-confirm",
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await f.request(
        "/reference-demos",
        "POST",
        { ...body, caseVersion: 2 },
        f.cookie,
        "bad-version",
      )
    ).status,
    409,
  );
  assert.equal(
    (await f.request("/reference-demos", "POST", body, undefined, "anonymous"))
      .status,
    401,
  );
  const created = await f.request(
    "/reference-demos",
    "POST",
    body,
    f.cookie,
    "demo",
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const d = created.data.data;
  assert.equal(d.version, 1);
  assert.equal(d.caseId, body.caseId);
  const cookie = created.headers.get("set-cookie");
  assert.ok(cookie.includes("Path=" + d.prefix));
  assert.ok(!cookie.startsWith("race_session="));
  const again = await f.request(
    "/reference-demos",
    "POST",
    body,
    f.cookie,
    "demo",
  );
  assert.equal(again.status, 201);
  assert.deepEqual(again.data.data, d);
  const sample = require("../../src/platform/reference/cases").cases.find(
      (c) => c.id === body.caseId,
    ),
    originalVersion = sample.version;
  try {
    sample.version++;
    const oldCommittedRetry = await f.request(
      "/reference-demos",
      "POST",
      body,
      f.cookie,
      "demo",
    );
    assert.equal(
      oldCommittedRetry.status,
      201,
      "catalog upgrade must preserve original committed retry",
    );
    assert.deepEqual(oldCommittedRetry.data.data, d);
    assert.equal(
      (
        await f.request(
          "/reference-demos",
          "POST",
          body,
          f.cookie,
          "new-old-version",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(
          "/reference-demos",
          "POST",
          { ...body, caseVersion: sample.version },
          f.cookie,
          "demo",
        )
      ).data.error.code,
      "IDEMPOTENCY_CONFLICT",
    );
  } finally {
    sample.version = originalVersion;
  }
  assert.equal(
    (
      await f.request(
        "/reference-demos",
        "POST",
        { ...body, caseId: "shadow-cup-v1" },
        f.cookie,
        "demo",
      )
    ).status,
    409,
  );
  assert.deepEqual(
    parentSnapshot(),
    before,
    "导入及会话仅写演示数据库，父库字节行保持",
  );
  const childCookie = cookie.split(";")[0];
  async function child(url, method = "GET", body, key) {
    const r = await fetch(f.origin + d.prefix + "/api/v1" + url, {
      method,
      headers: {
        Origin: "http://localhost:5173",
        Cookie: childCookie + "; " + f.cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  }
  assert.equal(
    (await child("/auth/session")).data.data.user.displayName,
    "演示管理员",
  );
  assert.equal(
    (await f.request("/auth/session", "GET", undefined, f.cookie)).data.data
      .user.username,
    "v2_owner",
  );
  const c = (
    await child(
      "/tournaments/" + d.tournamentId + "/configurations/" + d.configurationId,
    )
  ).data.data;
  assert.equal(c.entrantKind, "reference-unit");
  assert.equal(c.state, "draft");
  const onlyChild = await fetch(
    f.origin +
      d.prefix +
      "/api/v1/tournaments/" +
      d.tournamentId +
      "/configurations/" +
      d.configurationId,
    { headers: { Cookie: childCookie } },
  );
  assert.equal(onlyChild.status, 401, "演示cookie不能替代原空间当前登录授权");
  const foreignSignup = await fetch(
    f.origin + d.prefix + "/api/v1/auth/register",
    {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "foreign_demo",
        displayName: "他人",
        password: "foreign-demo-password",
      }),
    },
  );
  assert.equal(
    foreignSignup.status,
    401,
    "公开演示URL不可向他人的隔离库新增账号或任何写入",
  );
  const freeze = await child(
    "/tournaments/" +
      d.tournamentId +
      "/configurations/" +
      d.configurationId +
      "/freeze",
    "POST",
    { expectedVersion: 1 },
    "freeze",
  );
  assert.equal(freeze.status, 200, JSON.stringify(freeze.data));
  assert.equal(freeze.data.data.structure.entrantKind, "reference-unit");
  const registrations = (
    await child("/tournaments/" + d.tournamentId + "/registrations")
  ).data.data;
  assert.equal(registrations.items.length, 16);
  assert.ok(
    registrations.items.every(
      (r) => r.status === "submitted" && r.seed === null,
    ),
  );
  assert.ok(!JSON.stringify(registrations).includes("v2_owner"));
  const normal = { ...payload(), entrantKind: "reference-unit" };
  assert.equal(
    (
      await f.request(
        "/tournaments/" + f.tid + "/configurations",
        "POST",
        { payload: normal },
        f.cookie,
        "real-reference-reject",
      )
    ).status,
    422,
  );
  for (const id of ["cologne2026", "ti2026"]) {
    const r = await f.request(
      "/reference-demos",
      "POST",
      { ...body, caseId: id },
      f.cookie,
      "pending-" + id,
    );
    assert.equal(r.status, 409);
    assert.equal(r.data.error.code, "REFERENCE_CASE_PENDING");
  }
  assert.equal(
    fs.readdirSync(root).filter((n) => n.endsWith(".sqlite")).length,
    1,
  );
});
