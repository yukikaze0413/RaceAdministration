"use strict";
const { transaction } = require("../../platform/storage/database");
const { ConfigurationError } = require("../domain/structure");
const keys = ["configurations", "snapshots", "requests"];
function empty() {
  return Object.fromEntries(keys.map((k) => [k, new Map()]));
}
function decode(row) {
  return row
    ? Object.fromEntries(keys.map((k) => [k, new Map(JSON.parse(row.data)[k])]))
    : empty();
}
function createSqliteStore(db) {
  function read(id) {
    return decode(
      db
        .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
        .get(id),
    );
  }
  function guard(fn) {
    try {
      return fn();
    } catch (e) {
      if (e instanceof ConfigurationError) throw e;
      throw new ConfigurationError(
        "STORE_FAILURE",
        "配置存储暂不可用，请稍后重试。",
      );
    }
  }
  return {
    async read(id) {
      return guard(() => structuredClone(read(id)));
    },
    async transaction(id, operation) {
      return guard(() =>
        transaction(db, () => {
          const candidate = structuredClone(read(id)),
            result = operation(candidate);
          if (result?.then)
            throw Error("Configuration operation must be synchronous");
          const serialized = JSON.stringify(
            Object.fromEntries(keys.map((k) => [k, [...candidate[k]]])),
          );
          const response = JSON.parse(JSON.stringify(result));
          db.prepare(
            "INSERT INTO structure_aggregates VALUES(?,?) ON CONFLICT(tournamentId) DO UPDATE SET data=excluded.data",
          ).run(id, serialized);
          return response;
        }),
      );
    },
  };
}
module.exports = { createSqliteStore };
