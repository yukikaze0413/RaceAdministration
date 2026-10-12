"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { listenTestServer } = require("../helpers/http-listener");
async function fixture(t, options = {}) {
  const p = createApp({ ...options, origins: ["http://test.local"] }),
    server = await listenTestServer(p.app);
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(() => {
          p.close();
          r();
        });
      }),
  );
  const request = async (path, method = "GET", body, cookie = "", key = "") => {
    const r = await fetch(
      "http://127.0.0.1:" + server.address().port + "/api/v1" + path,
      {
        method,
        headers: {
          Origin: "http://test.local",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return {
      status: r.status,
      value: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const account = async (name) => {
    let r = await request("/auth/register", "POST", {
      username: name,
      password: "p",
      displayName: name,
    });
    assert.equal(r.status, 201, JSON.stringify(r.value));
    const id = r.value.data.id;
    r = await request("/auth/login", "POST", { username: name, password: "p" });
    assert.equal(r.status, 200);
    return { id, cookie: r.cookie };
  };
  return { p, request, account };
}
test("TO1 管理者可分配报分权限但不能使其获得推进权", async (t) => {
  const { request, account } = await fixture(t),
    o = await account("event_owner"),
    a = await account("event_staff");
  const e = await request(
    "/tournaments",
    "POST",
    { name: "赛事测试", game: "card", visibility: "public" },
    o.cookie,
    "create",
  );
  const base = "/tournaments/" + e.value.data.id;
  const r = await request(
    base + "/collaborators",
    "POST",
    { expectedVersion: 0, userId: a.id, permissions: ["results.edit"] },
    o.cookie,
    "grant",
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  const cap = await request(base + "/capabilities", "GET", undefined, a.cookie);
  assert.equal(cap.value.data.effectivePermissions["results.edit"], true);
  assert.equal(cap.value.data.effectivePermissions["rounds.confirm"], false);
  assert.equal(
    (
      await request(
        base + "/rounds/none/confirm",
        "POST",
        { expectedVersion: 1 },
        a.cookie,
        "bad",
      )
    ).status,
    403,
  );
});
module.exports = { fixture };

test("TO2 自定义收集表发布、校验和旧版本答案保留", async (t) => {
  const { request, account } = await fixture(t),
    o = await account("form_owner"),
    p = await account("form_player");
  const e = await request(
      "/tournaments",
      "POST",
      { name: "报名杯", game: "card", visibility: "public" },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  let r = await request(
    b + "/registration-form",
    "PUT",
    {
      expectedVersion: 0,
      fields: [
        {
          id: "nickname",
          label: "昵称",
          type: "text",
          required: true,
          max: 20,
          help: "比赛显示名",
        },
      ],
    },
    o.cookie,
    "form",
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  r = await request(
    b + "/registration-form/publish",
    "POST",
    { expectedVersion: 1 },
    o.cookie,
    "publish",
  );
  assert.equal(r.status, 200);
  assert.equal(
    (
      await request(
        b + "/registrations",
        "POST",
        { schemaVersion: 1, answers: {} },
        p.cookie,
        "invalid",
      )
    ).status,
    422,
  );
  r = await request(
    b + "/registrations",
    "POST",
    { schemaVersion: 1, answers: { nickname: "阿甲" } },
    p.cookie,
    "submit",
  );
  assert.equal(r.status, 201, JSON.stringify(r.value));
  assert.equal(
    (await request(b + "/registrations", "GET", undefined, p.cookie)).status,
    403,
  );
  r = await request(
    b + "/registration-form",
    "PUT",
    {
      expectedVersion: 3,
      fields: [
        {
          id: "nickname",
          label: "新标签",
          type: "text",
          required: true,
          max: 20,
          help: "",
        },
      ],
    },
    o.cookie,
    "form2",
  );
  assert.equal(r.status, 200);
  const mine = await request(
    b + "/my-registration",
    "GET",
    undefined,
    p.cookie,
  );
  assert.equal(mine.value.data.registration.answers.nickname, "阿甲");
  assert.equal(mine.value.data.schema.fields[0].label, "昵称");
});
async function setupEvent(t, format, count, groups = false) {
  const f = await fixture(t),
    o = await f.account("run_owner"),
    e = await f.request(
      "/tournaments",
      "POST",
      { name: "运行验收", game: "card", visibility: "public" },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  let v = 0;
  const mutate = async (path, body, key) => {
    const r = await f.request(
      b + path,
      "POST",
      { expectedVersion: v, ...body },
      o.cookie,
      key,
    );
    assert.ok(r.status < 300, JSON.stringify(r.value));
    v = r.value.data.version ?? v + 1;
    return r.value.data;
  };
  await mutate("/registration-form/publish", {}, "publish");
  const entrants = [];
  for (let i = 1; i <= count; i++) {
    const p = await f.account("player_" + i);
    const r = await f.request(
      b + "/registrations",
      "POST",
      { schemaVersion: 1, answers: {} },
      p.cookie,
      "join",
    );
    assert.equal(r.status, 201);
    v++;
    entrants.push({ ...p, entrantId: r.value.data.id });
    await mutate(
      "/registrations/" + r.value.data.id + "/approve",
      { seed: i, sourceId: groups ? (i <= 4 ? "A" : "B") : null },
      "approve_" + i,
    );
  }
  const stages = groups
    ? [
        {
          id: "group",
          order: 1,
          capacity: 8,
          formatIntent: "round-robin",
          groups: [
            { id: "A", stageId: "group", capacity: 4 },
            { id: "B", stageId: "group", capacity: 4 },
          ],
        },
        {
          id: "final",
          order: 2,
          capacity: 4,
          formatIntent: "single-elimination",
          groups: [],
        },
      ]
    : [
        {
          id: "stage",
          order: 1,
          capacity: count,
          formatIntent: format,
          groups: [],
        },
      ];
  const routes = groups
    ? [
        ["A", 1, 1],
        ["B", 2, 2],
        ["B", 1, 3],
        ["A", 2, 4],
      ].map(([groupId, rank, slot], i) => ({
        id: "r" + i,
        source: { stageId: "group", groupId },
        target: { stageId: "final" },
        selector: { kind: "rankRange", from: rank, to: rank },
        quota: 1,
        sort: [{ field: "sourceRank", direction: "asc" }],
        placement: { kind: "slot", positions: [slot] },
      }))
    : [];
  const c = await f.request(
    b + "/configurations",
    "POST",
    {
      payload: {
        entrantKind: "individual",
        structureVersion: "structure-v1",
        routingVersion: "routing-v1",
        stages,
        pools: [],
        routes,
      },
    },
    o.cookie,
    "config",
  );
  assert.equal(c.status, 201);
  const frozen = await f.request(
    b + "/configurations/" + c.value.data.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    o.cookie,
    "freeze",
  );
  assert.equal(frozen.status, 200);
  await mutate("/roster/lock", {}, "lock");
  return {
    ...f,
    o,
    b,
    entrants,
    mutate,
    configurationId: c.value.data.id,
    version: () => v,
    setVersion: (x) => (v = x),
  };
}
test("TO3 六人单败按种子轮空，整轮推进，五场决出冠军", async (t) => {
  const f = await setupEvent(t, "single-elimination", 6);
  let r = await f.request(
    f.b + "/start",
    "POST",
    { expectedVersion: f.version(), configurationId: f.configurationId },
    f.o.cookie,
    "start",
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  f.setVersion(r.value.data.version);
  let view = (await f.request(f.b + "/runtime")).value.data;
  const first = view.runtime.units[0].rounds[0];
  assert.deepEqual(
    first.matches
      .filter((m) => !m.bye)
      .map((m) =>
        m.entrants.map(
          (id) => f.entrants.findIndex((e) => e.entrantId === id) + 1,
        ),
      ),
    [
      [4, 5],
      [3, 6],
    ],
  );
  assert.equal(
    (
      await f.request(
        f.b + "/rounds/" + first.id + "/confirm",
        "POST",
        { expectedVersion: f.version() },
        f.o.cookie,
        "missing",
      )
    ).status,
    409,
  );
  for (let step = 0; step < 3; step++) {
    view = (await f.request(f.b + "/runtime")).value.data;
    const round = view.runtime.units[0].rounds.find((r) => !r.confirmed);
    for (const m of round.matches.filter((m) => !m.bye)) {
      const idx = m.entrants.map((id) =>
        f.entrants.findIndex((e) => e.entrantId === id),
      );
      const left = idx[0] < idx[1];
      r = await f.request(
        f.b + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: f.version(),
          result: { kind: "score", scores: left ? [2, 0] : [0, 2] },
          reason: "验收裁定",
        },
        f.o.cookie,
        "score_" + m.id,
      );
      assert.equal(r.status, 200, JSON.stringify(r.value));
      f.setVersion(r.value.data.version);
    }
    const body = { expectedVersion: f.version() };
    r = await f.request(
      f.b + "/rounds/" + round.id + "/confirm",
      "POST",
      body,
      f.o.cookie,
      "confirm_" + round.id,
    );
    assert.equal(r.status, 200, JSON.stringify(r.value));
    f.setVersion(r.value.data.version);
    const replay = await f.request(
      f.b + "/rounds/" + round.id + "/confirm",
      "POST",
      body,
      f.o.cookie,
      "confirm_" + round.id,
    );
    assert.deepEqual(replay.value.data, r.value.data);
  }
  view = (await f.request(f.b + "/runtime")).value.data;
  assert.equal(view.runtime.status, "completed");
  assert.equal(
    view.runtime.units[0].standings[0].entrantId,
    f.entrants[0].entrantId,
  );
  assert.equal(
    view.runtime.units[0].rounds.flatMap((r) => r.matches).filter((m) => !m.bye)
      .length,
    5,
  );
  assert.deepEqual(
    view.runtime.units[0].standings.map((e) => e.wins),
    [2, 1, 1, 1, 0, 0],
  );
});
test("TO4 五人单循环每对一次，休赛不计分，十场决出冠军", async (t) => {
  const f = await setupEvent(t, "round-robin", 5);
  let r = await f.request(
    f.b + "/start",
    "POST",
    { expectedVersion: f.version(), configurationId: f.configurationId },
    f.o.cookie,
    "start",
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  f.setVersion(r.value.data.version);
  const initial = (await f.request(f.b + "/runtime")).value.data.runtime
    .units[0];
  assert.deepEqual(
    initial.rounds.map((r) =>
      r.matches.map((m) =>
        m.entrants.map(
          (id) => f.entrants.findIndex((e) => e.entrantId === id) + 1,
        ),
      ),
    ),
    [
      [
        [2, 5],
        [3, 4],
      ],
      [
        [1, 5],
        [2, 3],
      ],
      [
        [1, 4],
        [5, 3],
      ],
      [
        [1, 3],
        [4, 2],
      ],
      [
        [1, 2],
        [4, 5],
      ],
    ],
  );
  for (const round of initial.rounds) {
    for (const m of round.matches) {
      const idx = m.entrants.map((id) =>
        f.entrants.findIndex((e) => e.entrantId === id),
      );
      r = await f.request(
        f.b + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: f.version(),
          result: { kind: "score", scores: idx[0] < idx[1] ? [2, 0] : [0, 2] },
          reason: "独立算例",
        },
        f.o.cookie,
        "s" + m.id,
      );
      assert.equal(r.status, 200, JSON.stringify(r.value));
      f.setVersion(r.value.data.version);
    }
    r = await f.request(
      f.b + "/rounds/" + round.id + "/confirm",
      "POST",
      { expectedVersion: f.version() },
      f.o.cookie,
      "c" + round.id,
    );
    assert.equal(r.status, 200, JSON.stringify(r.value));
    f.setVersion(r.value.data.version);
  }
  const view = (await f.request(f.b + "/runtime")).value.data.runtime;
  assert.equal(view.status, "completed");
  assert.deepEqual(
    view.units[0].standings.map((e) => e.points),
    [12, 9, 6, 3, 0],
  );
  assert.equal(view.units[0].rounds.flatMap((r) => r.matches).length, 10);
});
test("TO5 八人两组循环交叉晋级，全部来源完成才生成四强，共十五场", async (t) => {
  const f = await setupEvent(t, "round-robin", 8, true);
  let r = await f.request(
    f.b + "/start",
    "POST",
    { expectedVersion: f.version(), configurationId: f.configurationId },
    f.o.cookie,
    "start",
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  f.setVersion(r.value.data.version);
  const play = async (unitId) => {
    const u = (await f.request(f.b + "/runtime")).value.data.runtime.units.find(
        (u) => u.id === unitId,
      ),
      round = u.rounds.find((r) => !r.confirmed);
    for (const m of round.matches.filter((m) => !m.bye)) {
      const idx = m.entrants.map((id) =>
        f.entrants.findIndex((e) => e.entrantId === id),
      );
      const left = unitId === "final" || idx[0] < idx[1];
      r = await f.request(
        f.b + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: f.version(),
          result: { kind: "score", scores: left ? [2, 0] : [0, 2] },
          reason: "赛事验收",
        },
        f.o.cookie,
        "score" + m.id,
      );
      assert.equal(r.status, 200, JSON.stringify(r.value));
      f.setVersion(r.value.data.version);
    }
    r = await f.request(
      f.b + "/rounds/" + round.id + "/confirm",
      "POST",
      { expectedVersion: f.version() },
      f.o.cookie,
      "confirm" + round.id,
    );
    assert.equal(r.status, 200, JSON.stringify(r.value));
    f.setVersion(r.value.data.version);
  };
  for (let i = 0; i < 3; i++) await play("A");
  assert.equal(
    (await f.request(f.b + "/runtime")).value.data.runtime.units.length,
    2,
  );
  for (let i = 0; i < 3; i++) await play("B");
  let view = (await f.request(f.b + "/runtime")).value.data.runtime;
  const final = view.units.find((u) => u.id === "final");
  assert.ok(final, "完成小组必须生成淘汰阶段");
  assert.deepEqual(
    final.rounds[0].matches.map((m) =>
      m.entrants.map(
        (id) => f.entrants.findIndex((e) => e.entrantId === id) + 1,
      ),
    ),
    [
      [1, 6],
      [5, 2],
    ],
  );
  await play("final");
  await play("final");
  view = (await f.request(f.b + "/runtime")).value.data.runtime;
  assert.equal(view.status, "completed");
  assert.equal(
    view.units
      .flatMap((u) => u.rounds.flatMap((r) => r.matches))
      .filter((m) => !m.bye).length,
    15,
  );
  assert.equal(
    view.units.find((u) => u.id === "final").standings[0].entrantId,
    f.entrants[0].entrantId,
  );
});
test("TO1 结构协作者可以操作私有配置，撤权后重试亦拒绝", async (t) => {
  const f = await fixture(t),
    o = await f.account("private_owner"),
    a = await f.account("private_staff");
  const e = await f.request(
      "/tournaments",
      "POST",
      { name: "私有协作", game: "card" },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  await f.request(
    b + "/collaborators",
    "POST",
    {
      expectedVersion: 0,
      userId: a.id,
      permissions: ["structure.edit", "metadata.edit"],
    },
    o.cookie,
    "grant",
  );
  const r = await f.request(
    b + "/configurations",
    "POST",
    {
      payload: {
        entrantKind: "individual",
        structureVersion: "structure-v1",
        routingVersion: "routing-v1",
        stages: [],
        pools: [],
        routes: [],
      },
    },
    a.cookie,
    "config",
  );
  assert.equal(r.status, 201, JSON.stringify(r.value));
  const edit = await f.request(
    b,
    "PATCH",
    { expectedVersion: 1, name: "管理员资料" },
    a.cookie,
    "metadata",
  );
  assert.equal(edit.status, 200);
  const revoke = await f.request(
    b + "/collaborators/" + a.id,
    "DELETE",
    { expectedVersion: 1 },
    o.cookie,
    "revoke",
  );
  assert.equal(revoke.status, 200);
  assert.equal(
    (
      await f.request(
        b + "/configurations",
        "POST",
        {
          payload: {
            entrantKind: "individual",
            structureVersion: "structure-v1",
            routingVersion: "routing-v1",
            stages: [],
            pools: [],
            routes: [],
          },
        },
        a.cookie,
        "config",
      )
    ).status,
    404,
  );
});
test("TO6 可运行预设产生独立草稿，布局保存不更改结构版本", async (t) => {
  const f = await fixture(t),
    o = await f.account("preset_owner"),
    e = await f.request(
      "/tournaments",
      "POST",
      { name: "预设杯", game: "card" },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  const presets = await f.request(
    "/runtime-presets",
    "GET",
    undefined,
    o.cookie,
  );
  assert.equal(presets.status, 200);
  assert.equal(presets.value.data.length, 3);
  const p = presets.value.data.find((x) => x.id === "groups-to-playoffs");
  const c = await f.request(
    b + "/configurations",
    "POST",
    { payload: p.structure },
    o.cookie,
    "config",
  );
  assert.equal(c.status, 201);
  const url = b + "/configurations/" + c.value.data.id;
  const layout = await f.request(
    url + "/layout",
    "PUT",
    {
      expectedVersion: 0,
      positions: { [p.structure.stages[0].id]: { x: 30, y: 20 } },
      zoom: 1,
      pan: { x: 0, y: 0 },
    },
    o.cookie,
    "layout",
  );
  assert.equal(layout.status, 200, JSON.stringify(layout.value));
  assert.equal(
    (await f.request(url, "GET", undefined, o.cookie)).value.data.version,
    1,
  );
  assert.equal(
    (await f.request(url + "/layout", "GET", undefined, o.cookie)).value.data
      .positions[p.structure.stages[0].id].x,
    30,
  );
});
test("TO7 预设创建提交失败不遗留配置，原键重试只创建一次", async (t) => {
  const f = await fixture(t),
    o = await f.account("atomic_owner"),
    e = await f.request(
      "/tournaments",
      "POST",
      { name: "事务预设", game: "card" },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  f.p.db.exec(
    "CREATE TRIGGER reject_second BEFORE UPDATE ON structure_aggregates BEGIN SELECT RAISE(ABORT,'storage test'); END;",
  );
  const first = await f.request(
    b + "/configurations/from-runtime-preset",
    "POST",
    { presetId: "round-robin" },
    o.cookie,
    "preset",
  );
  if (first.status === 503)
    assert.equal(
      f.p.db.prepare("SELECT count(*) n FROM structure_aggregates").get().n,
      0,
      "失败不能留下部分预设",
    );
  f.p.db.exec("DROP TRIGGER reject_second");
  const r = await f.request(
      b + "/configurations/from-runtime-preset",
      "POST",
      { presetId: "round-robin" },
      o.cookie,
      "preset",
    ),
    replay = await f.request(
      b + "/configurations/from-runtime-preset",
      "POST",
      { presetId: "round-robin" },
      o.cookie,
      "preset",
    );
  assert.equal(r.status, 201, JSON.stringify(r.value));
  assert.equal(replay.value.data.id, r.value.data.id);
});
test("TO5 三人循环同分先阻塞，再按管理员留因排序完成", async (t) => {
  const f = await setupEvent(t, "round-robin", 3);
  let r = await f.request(
    f.b + "/start",
    "POST",
    { expectedVersion: f.version(), configurationId: f.configurationId },
    f.o.cookie,
    "start",
  );
  assert.equal(r.status, 200);
  f.setVersion(r.value.data.version);
  const unit = (await f.request(f.b + "/runtime")).value.data.runtime.units[0];
  for (const [i, round] of unit.rounds.entries()) {
    const m = round.matches[0];
    r = await f.request(
      f.b + "/matches/" + m.id + "/results",
      "PATCH",
      {
        expectedVersion: f.version(),
        result: { kind: "score", scores: i === 1 ? [0, 2] : [2, 0] },
        reason: "同分算例",
      },
      f.o.cookie,
      "s" + i,
    );
    assert.equal(r.status, 200);
    f.setVersion(r.value.data.version);
    r = await f.request(
      f.b + "/rounds/" + round.id + "/confirm",
      "POST",
      { expectedVersion: f.version() },
      f.o.cookie,
      "c" + i,
    );
    assert.equal(r.status, 200);
    f.setVersion(r.value.data.version);
  }
  let v = (await f.request(f.b + "/runtime")).value.data;
  assert.equal(v.runtime.units[0].status, "ranking-blocked");
  assert.deepEqual(
    v.runtime.units[0].standings.map((e) => e.rank),
    [1, 1, 1],
  );
  r = await f.request(
    f.b + "/units/" + unit.id + "/ranking",
    "POST",
    {
      expectedVersion: f.version(),
      order: f.entrants.map((e) => e.entrantId),
      reason: "公布赛前种子为最后破同分次序",
    },
    f.o.cookie,
    "ranking",
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  v = (await f.request(f.b + "/runtime")).value.data;
  assert.equal(v.runtime.status, "completed");
  assert.deepEqual(
    v.runtime.units[0].standings.map((e) => e.rank),
    [1, 2, 3],
  );
});
test("TO7 注销参赛者清除报名答案并保留他人锁定赛果", async (t) => {
  const f = await setupEvent(t, "single-elimination", 2);
  let r = await f.request(
    f.b + "/start",
    "POST",
    { expectedVersion: f.version(), configurationId: f.configurationId },
    f.o.cookie,
    "start",
  );
  assert.equal(r.status, 200);
  const player = f.entrants[0],
    preview = await f.request(
      "/me/deletion-preview",
      "GET",
      undefined,
      player.cookie,
    );
  r = await f.request(
    "/me",
    "DELETE",
    {
      currentPassword: "p",
      confirmation: "player_1",
      expectedToken: preview.value.data.token,
    },
    player.cookie,
  );
  assert.equal(r.status, 200, JSON.stringify(r.value));
  const view = (await f.request(f.b + "/runtime")).value.data;
  assert.equal(view.runtime.roster[0].name, "已注销参赛者");
  assert.equal(view.runtime.units[0].rounds.length, 1);
  const regs = await f.request(
    f.b + "/registrations",
    "GET",
    undefined,
    f.o.cookie,
  );
  assert.equal(
    regs.value.data.items.some((e) => e.userId === player.id),
    false,
  );
});
test("TO3 显式seed映射按目标种子位置而非输入数组顺序", () => {
  const { createUnit } = require("../../src/platform/operations/runtime");
  const u = createUnit(
    { id: "final", capacity: 8, formatIntent: "single-elimination" },
    null,
    [
      { entrantId: "a", position: 1 },
      { entrantId: "b", position: 8 },
    ],
    { bestOf: 3 },
  );
  assert.equal(
    u.rounds[0].matches.length,
    4,
    "目标8号种子保留8槽结构，不压缩为2槽",
  );
  assert.deepEqual(u.rounds[0].matches[0].entrants, ["a", "b"]);
});

test("TO7 确认故障回滚，重启回放与不同键竞争仅推进一次", async (t) => {
  const { mkdtempSync, rmSync } = require("node:fs"),
    { tmpdir } = require("node:os"),
    { join } = require("node:path");
  const dir = mkdtempSync(join(tmpdir(), "race-runtime-"));

  // Use a real durable database and seed only identities/configuration through the real API.
  const f = await fixture(t, { databasePath: join(dir, "runtime.sqlite") }),
    o = await f.account("durable_owner"),
    a = await f.account("durable_a"),
    b = await f.account("durable_b");
  const e = await f.request(
      "/tournaments",
      "POST",
      { name: "持久验收", game: "card", visibility: "public" },
      o.cookie,
      "event",
    ),
    base = "/tournaments/" + e.value.data.id;
  let version = 0;
  const write = async (path, body, key) => {
    const r = await f.request(
      base + path,
      "POST",
      { expectedVersion: version, ...body },
      o.cookie,
      key,
    );
    assert.ok(r.status < 300, JSON.stringify(r.value));
    version = r.value.data.version ?? version + 1;
    return r.value.data;
  };
  await write("/registration-form/publish", {}, "publish");
  for (const [i, p] of [a, b].entries()) {
    const r = await f.request(
      base + "/registrations",
      "POST",
      { schemaVersion: 1, answers: {} },
      p.cookie,
      "join",
    );
    assert.equal(r.status, 201);
    version++;
    await write(
      "/registrations/" + r.value.data.id + "/approve",
      { seed: i + 1 },
      "approve" + i,
    );
  }
  const c = await f.request(
    base + "/configurations/from-runtime-preset",
    "POST",
    { presetId: "single-elimination" },
    o.cookie,
    "config",
  );
  assert.equal(c.status, 201);
  await f.request(
    base + "/configurations/" + c.value.data.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    o.cookie,
    "freeze",
  );
  await write("/roster/lock", {}, "lock");
  await write("/start", { configurationId: c.value.data.id }, "start");
  let state = (await f.request(base + "/runtime")).value.data,
    round = state.runtime.units[0].rounds[0],
    m = round.matches[0];
  let r = await f.request(
    base + "/matches/" + m.id + "/results",
    "PATCH",
    {
      expectedVersion: version,
      result: { kind: "score", scores: [2, 0] },
      reason: "实测",
    },
    o.cookie,
    "score",
  );
  assert.equal(r.status, 200);
  version = r.value.data.version;
  const before = f.p.db
    .prepare("SELECT data FROM operations_aggregates")
    .get().data;
  f.p.db.exec(
    "CREATE TRIGGER reject_runtime BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'runtime fault'); END;",
  );
  const body = { expectedVersion: version };
  r = await f.request(
    base + "/rounds/" + round.id + "/confirm",
    "POST",
    body,
    o.cookie,
    "confirm",
  );
  assert.equal(r.status, 503);
  assert.equal(
    f.p.db.prepare("SELECT data FROM operations_aggregates").get().data,
    before,
  );
  f.p.db.exec("DROP TRIGGER reject_runtime");
  const race = await Promise.all(
    ["confirm", "race"].map((key) =>
      f.request(
        base + "/rounds/" + round.id + "/confirm",
        "POST",
        body,
        o.cookie,
        key,
      ),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  f.p.close();
  const reopened = await fixture(t, {
    databasePath: join(dir, "runtime.sqlite"),
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  r = await reopened.request(
    base + "/rounds/" + round.id + "/confirm",
    "POST",
    body,
    o.cookie,
    "confirm",
  );
  assert.equal(r.status, 200);
  assert.equal(
    (await reopened.request(base + "/runtime")).value.data.runtime.status,
    "completed",
  );
  assert.equal(
    (
      await reopened.request(
        base + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: version + 1,
          result: { kind: "score", scores: [0, 2] },
          reason: "非法改判",
        },
        o.cookie,
        "locked",
      )
    ).status,
    409,
  );
});

test("TO3 初始单败1号与8号种子保留八槽结构", async (t) => {
  const f = await setupEvent(t, "single-elimination", 2);
  const aggregate = JSON.parse(
      f.p.db.prepare("SELECT data FROM structure_aggregates").get().data,
    ),
    c = aggregate.configurations[0][1];
  // Test fixture preserves an independently defined eight-slot frozen structure.
  c.snapshot.structure.stages[0].capacity = 8;
  const {
    digest,
  } = require("../../src/tournament-configuration/domain/canonical");
  c.snapshot.digest = digest(c.snapshot.structure);
  f.p.db
    .prepare("UPDATE structure_aggregates SET data=?")
    .run(JSON.stringify(aggregate));
  const ops = JSON.parse(
    f.p.db.prepare("SELECT data FROM operations_aggregates").get().data,
  );
  ops.registrations[1].seed = 8;
  f.p.db
    .prepare("UPDATE operations_aggregates SET data=?")
    .run(JSON.stringify(ops));
  const r = await f.request(
    f.b + "/start",
    "POST",
    { expectedVersion: f.version(), configurationId: f.configurationId },
    f.o.cookie,
    "start",
  );
  assert.equal(r.status, 200);
  assert.equal(
    (await f.request(f.b + "/runtime")).value.data.runtime.units[0].rounds[0]
      .matches.length,
    4,
  );
});
test("TO7 公开排名裁定投影不泄露管理员账号标识", () => {
  const { runtimeView } = require("../../src/platform/operations/runtime");
  const view = runtimeView(
    {
      runtime: {
        roster: [],
        units: [
          {
            rankingDecision: {
              actorId: "private-admin",
              reason: "同分",
              order: [],
            },
            rounds: [],
          },
        ],
      },
    },
    undefined,
    false,
  );
  assert.equal(Object.hasOwn(view.units[0].rankingDecision, "actorId"), false);
});
test("TO5 固定同分集合小积分相同后按整场净胜局区分", () => {
  const { standings } = require("../../src/platform/operations/round-robin");
  const rows = standings({
    entrants: ["A", "B", "C"],
    rounds: [
      {
        confirmed: true,
        matches: [
          { entrants: ["A", "B"], decision: { kind: "score", scores: [2, 1] } },
          { entrants: ["B", "C"], decision: { kind: "score", scores: [2, 0] } },
          { entrants: ["C", "A"], decision: { kind: "score", scores: [2, 0] } },
        ],
      },
    ],
  });
  assert.deepEqual(
    rows.map((r) => [r.entrantId, r.points, r.headToHead, r.net, r.rank]),
    [
      ["B", 3, 3, 1, 1],
      ["C", 3, 3, 0, 2],
      ["A", 3, 3, -1, 3],
    ],
  );
});
test("TO1 被拒报名不授予私有赛事访问，但可读取自己的拒绝记录", async (t) => {
  const f = await fixture(t),
    o = await f.account("privacy_owner"),
    p = await f.account("privacy_player"),
    e = await f.request(
      "/tournaments",
      "POST",
      { name: "私有状态", game: "card", visibility: "public" },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  await f.request(
    b + "/registration-form/publish",
    "POST",
    { expectedVersion: 0 },
    o.cookie,
    "publish",
  );
  const r = await f.request(
    b + "/registrations",
    "POST",
    { schemaVersion: 1, answers: {} },
    p.cookie,
    "join",
  );
  await f.request(
    b + "/registrations/" + r.value.data.id + "/approve",
    "POST",
    { expectedVersion: 2, approved: false },
    o.cookie,
    "reject",
  );
  await f.request(
    b,
    "PATCH",
    { expectedVersion: 1, visibility: "private" },
    o.cookie,
    "private",
  );
  assert.equal((await f.request(b, "GET", undefined, p.cookie)).status, 404);
  const mine = await f.request(
    b + "/my-registration",
    "GET",
    undefined,
    p.cookie,
  );
  assert.equal(mine.status, 200);
  assert.equal(mine.value.data.registration.status, "rejected");
});
test("TO1 资料管理员可保留创建者所属系列编辑赛事名称", async (t) => {
  const f = await fixture(t),
    o = await f.account("series_owner"),
    a = await f.account("series_staff");
  const series = await f.request(
    "/series",
    "POST",
    { name: "创建者系列" },
    o.cookie,
    "series",
  );
  const e = await f.request(
      "/tournaments",
      "POST",
      {
        name: "赛事",
        game: "card",
        seriesId: series.value.data.id,
        visibility: "public",
      },
      o.cookie,
      "event",
    ),
    b = "/tournaments/" + e.value.data.id;
  await f.request(
    b + "/collaborators",
    "POST",
    { expectedVersion: 0, userId: a.id, permissions: ["metadata.edit"] },
    o.cookie,
    "grant",
  );
  const result = await f.request(
    b,
    "PATCH",
    { expectedVersion: 1, name: "协作者修改", seriesId: series.value.data.id },
    a.cookie,
    "edit",
  );
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.data.seriesId, series.value.data.id);
});
