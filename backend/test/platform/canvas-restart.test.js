"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs"),
  { join } = require("node:path"),
  { tmpdir } = require("node:os");
const { event } = require("./formats-v2-fixture"),
  G = require("../../src/planning-canvas/graph");
test("canvas SQLite restart preserves verified snapshot, seed and original request replay", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "race-canvas-restart-")),
    databasePath = join(dir, "canvas.sqlite");
  let a, b;
  try {
    a = await event(t, { databasePath });
    const body = { name: "固定随机排序", graph: G.sample("partial-pool") };
    const saved = (
      await a.request(
        "/planning-canvases",
        "POST",
        body,
        a.cookie,
        "create-canvas",
      )
    ).data.data;
    const path = "/planning-canvases/" + saved.id;
    assert.equal(
      (
        await a.request(
          path + "/validate",
          "POST",
          { expectedVersion: 1 },
          a.cookie,
        )
      ).data.data.valid,
      true,
    );
    const first = (
      await a.request(
        path + "/preview",
        "POST",
        { expectedVersion: 1 },
        a.cookie,
      )
    ).data.data;
    await a.close();
    b = await event(t, { databasePath });
    assert.deepEqual(
      (await b.request(path, "GET", undefined, b.cookie)).data.data,
      saved,
    );
    assert.deepEqual(
      (
        await b.request(
          path + "/preview",
          "POST",
          { expectedVersion: 1 },
          b.cookie,
        )
      ).data.data,
      first,
    );
    assert.deepEqual(
      (
        await b.request(
          "/planning-canvases",
          "POST",
          body,
          b.cookie,
          "create-canvas",
        )
      ).data.data,
      saved,
    );
  } finally {
    await a?.close();
    await b?.close();
    if (!dir.startsWith(join(tmpdir(), "race-canvas-restart-")))
      throw Error("Unexpected directory");
    rmSync(dir, { recursive: true, force: true });
  }
});
test("wave plan and independent session snapshot survive SQLite restart", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "race-canvas-restart-")),
    databasePath = join(dir, "wave.sqlite");
  let a, b;
  try {
    a = await event(t, { databasePath });
    const graph = G.migrate(G.sample("single")).graph;
    const saved = (
        await a.request(
          "/planning-canvases",
          "POST",
          { name: "wave", graph },
          a.cookie,
          "create-wave",
        )
      ).data.data,
      path = "/planning-canvases/" + saved.id;
    const v = (
      await a.request(
        path + "/validate",
        "POST",
        { expectedVersion: 1 },
        a.cookie,
      )
    ).data.data;
    const body = {
      expectedVersion: 1,
      expectedScheduleVersion: 0,
      wavePlanDigest: v.wavePlanDigest,
      sessions: [
        { id: "s", name: "s", waveIds: v.wavePlan.waves.map((w) => w.id) },
      ],
    };
    const schedule = (
      await a.request(path + "/schedule", "PUT", body, a.cookie, "schedule")
    ).data.data;
    await a.close();
    b = await event(t, { databasePath });
    const read = (
      await b.request(path + "/schedule", "GET", undefined, b.cookie)
    ).data.data;
    assert.equal(read.stale, false);
    assert.deepEqual(read.schedule, schedule.schedule);
    assert.deepEqual(
      (await b.request(path + "/schedule", "PUT", body, b.cookie, "schedule"))
        .data.data,
      schedule,
    );
    assert.equal(
      (
        await b.request(
          path + "/preview",
          "POST",
          { expectedVersion: 1 },
          b.cookie,
        )
      ).data.data.wavePlanDigest,
      v.wavePlanDigest,
    );
  } finally {
    await a?.close();
    await b?.close();
    if (!dir.startsWith(join(tmpdir(), "race-canvas-restart-")))
      throw Error("Unexpected path");
    rmSync(dir, { recursive: true, force: true });
  }
});
