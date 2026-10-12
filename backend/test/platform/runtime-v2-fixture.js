"use strict";
const assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture");
async function setupV2(t, structure, entries, options = {}) {
  let clock = Date.now();
  const f = await event(t, { ...options, now: () => clock }),
    base = "/tournaments/" + f.tid;
  assert.equal(
    (
      await f.request(
        base,
        "PATCH",
        { expectedVersion: 1, visibility: "public" },
        f.cookie,
        "public",
      )
    ).status,
    200,
  );
  const created = await f.request(
    base + "/configurations",
    "POST",
    { payload: structure },
    f.cookie,
    "configuration",
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const cid = created.data.data.id;
  const frozen = await f.request(
    base + "/configurations/" + cid + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "freeze",
  );
  assert.equal(frozen.status, 200, JSON.stringify(frozen.data));
  let version = 0;
  async function mutate(path, body = {}, key = path) {
    const r = await f.request(
      base + path,
      "POST",
      { expectedVersion: version, ...body },
      f.cookie,
      key,
    );
    assert.ok(r.status < 300, JSON.stringify(r.data));
    version = r.data.data.version ?? version + 1;
    return r.data.data;
  }
  await mutate("/registration-form/publish", {}, "publish");
  const entrants = [];
  for (const [i, entry] of entries.entries()) {
    if (i && i % 8 === 0) clock += 15 * 60 * 1000 + 1;
    const username = "v2_player_" + (i + 1);
    await f.request("/auth/register", "POST", {
      username,
      displayName: username,
      password: "v2-player-password",
    });
    const login = await f.request("/auth/login", "POST", {
      username,
      password: "v2-player-password",
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const joined = await f.request(
      base + "/registrations",
      "POST",
      { schemaVersion: 1, answers: {} },
      cookie,
      "join",
    );
    assert.equal(joined.status, 201, JSON.stringify(joined.data));
    version++;
    const entrantId = joined.data.data.id;
    await mutate(
      "/registrations/" + entrantId + "/approve",
      {
        approved: true,
        seed: i + 1,
        ...(entry
          ? { entryRef: { ...entry, configurationId: cid } }
          : { sourceId: null }),
      },
      "approve-" + i,
    );
    entrants.push({
      entrantId,
      cookie,
      seed: i + 1,
      userId: login.data.data.id,
    });
  }
  await mutate("/roster/lock", { configurationId: cid }, "lock");
  return {
    ...f,
    base,
    cid,
    entrants,
    mutate,
    getVersion: () => version,
    setVersion: (v) => (version = v),
  };
}
module.exports = { setupV2 };
