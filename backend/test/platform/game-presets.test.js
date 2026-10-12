"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
test("GP1 one Shadowverse preset has nine distinct classes and separate neutral category", () => {
  const file = path.join(__dirname, "../../src/platform/games/presets.json");
  assert.ok(fs.existsSync(file), "versioned game preset manifest must exist");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(
    catalog.items.map((x) => x.id),
    ["street-fighter-6", "shadowverse"],
  );
  const game = catalog.items.find((x) => x.id === "shadowverse");
  assert.deepEqual(
    game.classes.map((x) => x.displayName),
    [
      "精灵",
      "皇家",
      "巫师",
      "龙族",
      "死灵",
      "吸血鬼",
      "梦魇",
      "主教",
      "复仇者",
    ],
  );
  assert.equal(new Set(game.classes.map((x) => x.id)).size, 9);
  assert.deepEqual(
    game.classes
      .filter((x) => ["shadowcraft", "bloodcraft", "nightmare"].includes(x.id))
      .map((x) => x.id),
    ["shadowcraft", "bloodcraft", "nightmare"],
  );
  assert.equal(game.neutral.id, "neutral");
  assert.ok(!game.classes.some((x) => x.id === "neutral"));
  assert.ok(!Object.hasOwn(game, "requiredEdition"));
  assert.deepEqual(game.runtimeFormats, []);
});

const { createApp } = require("../../src/app");
async function fixture(t, databasePath = ":memory:") {
  let platform = createApp({
    databasePath,
    origins: ["http://localhost:5173"],
  });
  let server;
  for (let attempt = 0; attempt < 30; attempt++) {
    server = platform.app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise((resolve, reject) => {
      server.once("listening", () => resolve(true));
      server.once("error", (error) =>
        ["EADDRINUSE", "EACCES"].includes(error.code)
          ? resolve(false)
          : reject(error),
      );
    });
    if (ready) break;
    if (attempt === 29) {
      platform.close();
      throw new Error("No available high test port");
    }
  }
  t.after(async () => {
    await new Promise((r) => server.close(r));
    platform.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  let cookie = "";
  async function request(
    url,
    method = "GET",
    body,
    key = require("node:crypto").randomUUID(),
  ) {
    const response = await fetch(base + url, {
      method,
      headers: {
        Connection: "close",
        Origin: "http://localhost:5173",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body
          ? { "Content-Type": "application/json", "Idempotency-Key": key }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, json: await response.json() };
  }
  await request("/auth/register", "POST", {
    username: "gameowner",
    displayName: "游戏",
    password: "x",
  });
  await request("/auth/login", "POST", {
    username: "gameowner",
    password: "x",
  });
  return {
    request,
    get platform() {
      return platform;
    },
    restart: async () => {
      const port = server.address().port;
      await new Promise((r) => server.close(r));
      platform.close();
      platform = createApp({
        databasePath,
        origins: ["http://localhost:5173"],
      });
      server = platform.app.listen(port, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
    },
  };
}
test("TC1 game preset creation derives classification and replays same request", async (t) => {
  const { request } = await fixture(t);
  const body = { name: "街霸六赛事", gameId: "street-fighter-6" };
  const first = await request("/tournaments", "POST", body, "create-game");
  assert.equal(first.status, 201);
  assert.equal(first.json.data.gameId, "street-fighter-6");
  assert.equal(first.json.data.game, "fighting");
  assert.equal(first.json.data.runtimeStatus, "not-started");
  assert.deepEqual(
    (await request("/tournaments", "POST", body, "create-game")).json.data,
    first.json.data,
  );
});

test("TC1 inconsistent preset/category is atomically rejected", async (t) => {
  const { request, platform } = await fixture(t);
  const result = await request("/tournaments", "POST", {
    name: "错误",
    gameId: "street-fighter-6",
    game: "card",
  });
  assert.equal(result.status, 422);
  assert.equal(result.json.error.fieldErrors[0].path, "/game");
  assert.equal(
    platform.db.prepare("SELECT count(*) n FROM tournaments").get().n,
    0,
  );
  assert.equal(
    platform.db.prepare("SELECT count(*) n FROM catalog_requests").get().n,
    0,
  );
});

test("TC1 partial game edit derives new classification and rejects category-only contradiction", async (t) => {
  const { request } = await fixture(t);
  const item = (
    await request("/tournaments", "POST", {
      name: "影之诗赛事",
      gameId: "shadowverse",
    })
  ).json.data;
  const edit = await request("/tournaments/" + item.id, "PATCH", {
    gameId: "street-fighter-6",
    expectedVersion: 1,
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.json.data.game, "fighting");
  const bad = await request("/tournaments/" + item.id, "PATCH", {
    game: "card",
    expectedVersion: 2,
  });
  assert.equal(bad.status, 422);
  assert.equal((await request("/tournaments/" + item.id)).json.data.version, 2);
  const cleared = await request("/tournaments/" + item.id, "PATCH", {
    gameId: null,
    expectedVersion: 2,
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.json.data.gameId, null);
  assert.equal(cleared.json.data.game, "fighting");
});

test("TC1 old JSON reads as unspecified without rewriting old idempotency results", async (t) => {
  const { request, platform } = await fixture(t);
  const body = { name: "旧卡牌赛事", game: "card", visibility: "public" };
  const created = (await request("/tournaments", "POST", body, "old-request"))
    .json.data;
  const stored = JSON.parse(
    platform.db
      .prepare("SELECT data FROM tournaments WHERE id=?")
      .get(created.id).data,
  );
  delete stored.gameId;
  platform.db
    .prepare("UPDATE tournaments SET data=? WHERE id=?")
    .run(JSON.stringify(stored), created.id);
  const prior = platform.db
    .prepare("SELECT result FROM catalog_requests WHERE requestKey=?")
    .get("old-request").result;
  const oldResult = JSON.parse(prior);
  delete oldResult.gameId;
  platform.db
    .prepare("UPDATE catalog_requests SET result=? WHERE requestKey=?")
    .run(JSON.stringify(oldResult), "old-request");
  assert.equal(
    (await request("/tournaments/" + created.id)).json.data.gameId,
    null,
  );
  const replay = await request("/tournaments", "POST", body, "old-request");
  assert.equal(replay.status, 201);
  assert.equal(replay.json.data.id, created.id);
  assert.equal(
    platform.db
      .prepare("SELECT result FROM catalog_requests WHERE requestKey=?")
      .get("old-request").result,
    JSON.stringify(oldResult),
  );
  const edited = await request("/tournaments/" + created.id, "PATCH", {
    name: "旧赛事改名",
    expectedVersion: 1,
  });
  assert.equal(edited.json.data.gameId, null);
  assert.equal(edited.json.data.game, "card");
});

test("TC2 public game filters intersect classification, paginate and exclude private records", async (t) => {
  const { request } = await fixture(t);
  for (const [name, gameId, game, visibility] of [
    ["SF公开一", "street-fighter-6", "fighting", "public"],
    ["SF公开二", "street-fighter-6", "fighting", "public"],
    ["SV公开", "shadowverse", "card", "public"],
    ["旧公开", null, "card", "public"],
    ["SF私有", "street-fighter-6", "fighting", "private"],
  ]) {
    assert.equal(
      (
        await request("/tournaments", "POST", {
          name,
          gameId,
          game,
          visibility,
        })
      ).status,
      201,
    );
  }
  const first = await request(
    "/tournaments?gameId=street-fighter-6&game=fighting&pageSize=1",
  );
  assert.equal(first.status, 200);
  assert.equal(first.json.data.total, 2);
  assert.equal(first.json.data.items.length, 1);
  const next = (
    await request(
      "/tournaments?gameId=street-fighter-6&game=fighting&pageSize=1&page=2",
    )
  ).json.data;
  assert.notEqual(first.json.data.items[0].id, next.items[0].id);
  assert.equal(
    (await request("/tournaments?gameId=street-fighter-6&game=card")).json.data
      .total,
    0,
  );
  const old = (await request("/tournaments?gameId=unspecified")).json.data;
  assert.equal(old.total, 1);
  assert.equal(old.items[0].name, "旧公开");
  assert.equal((await request("/tournaments?gameId=nope")).status, 400);
});

test("GP1 games catalog is public versioned data and does not write tournaments", async (t) => {
  const { request, platform } = await fixture(t);
  await request("/auth/logout", "POST", {});
  const result = await request("/games");
  assert.equal(result.status, 200);
  assert.equal(result.json.data.schemaVersion, 1);
  assert.deepEqual(
    result.json.data.items.map((x) => x.id),
    ["street-fighter-6", "shadowverse"],
  );
  assert.equal(
    platform.db.prepare("SELECT count(*) n FROM tournaments").get().n,
    0,
  );
});

test("TC1 unknown IDs, ownership and same-version races leave no partial writes", async (t) => {
  const { request, platform } = await fixture(t);
  for (const gameId of ["unknown", "unspecified", "", 4, {}, []])
    assert.equal(
      (await request("/tournaments", "POST", { name: "无效", gameId })).status,
      422,
    );
  const item = (
    await request("/tournaments", "POST", {
      name: "公开赛事",
      gameId: "shadowverse",
      visibility: "public",
    })
  ).json.data;
  const race = await Promise.all([
    request(
      "/tournaments/" + item.id,
      "PATCH",
      { gameId: "street-fighter-6", expectedVersion: 1 },
      "race-a",
    ),
    request(
      "/tournaments/" + item.id,
      "PATCH",
      { gameId: null, expectedVersion: 1 },
      "race-b",
    ),
  ]);
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
  assert.equal(
    platform.db.prepare("SELECT count(*) n FROM catalog_requests").get().n,
    2,
  );
  await request("/auth/logout", "POST", {});
  await request("/auth/register", "POST", {
    username: "gameother",
    displayName: "乙",
    password: "y",
  });
  await request("/auth/login", "POST", {
    username: "gameother",
    password: "y",
  });
  assert.equal(
    (
      await request("/tournaments/" + item.id, "PATCH", {
        gameId: "shadowverse",
        expectedVersion: 2,
      })
    ).status,
    403,
  );
  assert.equal((await request("/tournaments/" + item.id)).json.data.version, 2);
});
test("GP1 game/catalog updates do not change frozen structure or enable runtime", async (t) => {
  const { request, platform } = await fixture(t);
  const item = (
    await request("/tournaments", "POST", { name: "冻结赛事", game: "card" })
  ).json.data;
  const url = "/tournaments/" + item.id + "/configurations";
  const c = (
    await request(url + "/from-template", "POST", {
      templateId: "four-groups",
      templateVersion: "1",
    })
  ).json.data;
  const frozen = await request(
    url + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    "freeze-game",
  );
  assert.equal(frozen.status, 200);
  const before = platform.db
    .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
    .get(item.id).data;
  assert.equal(
    (
      await request("/tournaments/" + item.id, "PATCH", {
        gameId: "street-fighter-6",
        expectedVersion: 1,
      })
    ).status,
    200,
  );
  const manifest = require("../../src/platform/games/presets.json"),
    original = manifest.catalogVersion;
  try {
    manifest.catalogVersion = "test-next";
    await request("/games");
  } finally {
    manifest.catalogVersion = original;
  }
  assert.equal(
    platform.db
      .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
      .get(item.id).data,
    before,
  );
  assert.equal(
    (await request("/tournaments/" + item.id)).json.data.runtimeStatus,
    "not-started",
  );
  assert.equal(
    (
      await request(
        url + "/" + c.id + "/freeze",
        "POST",
        { expectedVersion: 1 },
        "freeze-game",
      )
    ).json.data.snapshotId,
    frozen.json.data.snapshotId,
  );
});
test("TC1 new/old game records, sessions and historical request survive SQLite restart", async (t) => {
  const {
    mkdtempSync,
    readdirSync,
    unlinkSync,
    rmdirSync,
  } = require("node:fs");
  const dir = mkdtempSync(path.join(require("node:os").tmpdir(), "race-game-"));
  const { request, platform, restart } = await fixture(
    t,
    path.join(dir, "game.sqlite"),
  );
  t.after(() => {
    for (const f of readdirSync(dir)) unlinkSync(path.join(dir, f));
    rmdirSync(dir);
  });
  const body = { name: "持久游戏", gameId: "street-fighter-6" };
  const item = (await request("/tournaments", "POST", body, "durable-game"))
    .json.data;
  const legacy = (
    await request(
      "/tournaments",
      "POST",
      { name: "历史游戏", game: "card" },
      "legacy-game",
    )
  ).json.data;
  const data = JSON.parse(
    platform.db
      .prepare("SELECT data FROM tournaments WHERE id=?")
      .get(legacy.id).data,
  );
  delete data.gameId;
  platform.db
    .prepare("UPDATE tournaments SET data=? WHERE id=?")
    .run(JSON.stringify(data), legacy.id);
  await restart();
  assert.equal(
    (await request("/tournaments/" + item.id)).json.data.gameId,
    "street-fighter-6",
  );
  assert.equal(
    (await request("/tournaments/" + legacy.id)).json.data.gameId,
    null,
  );
  assert.equal(
    (await request("/tournaments", "POST", body, "durable-game")).json.data.id,
    item.id,
  );
  const edited = await request("/tournaments/" + legacy.id, "PATCH", {
    name: "历史改名",
    expectedVersion: 1,
  });
  assert.equal(edited.json.data.game, "card");
  assert.equal(edited.json.data.gameId, null);
});
