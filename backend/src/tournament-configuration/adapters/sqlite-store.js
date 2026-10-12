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
function createSqliteStore(db, authorizeWrite = null) {
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
    readDependencies(id) {
      return guard(() =>
        structuredClone(
          require("../../platform/operations/state").read(db, id),
        ),
      );
    },
    async transaction(id, operation, context) {
      return guard(() =>
        transaction(db, () => {
          if (authorizeWrite && (!context || !authorizeWrite(context, id)))
            throw new ConfigurationError("FORBIDDEN", "没有本赛事操作权限");
          const dependencies = structuredClone(
            require("../../platform/operations/state").read(db, id),
          );
          const dependencyBefore = JSON.stringify(dependencies);
          const canWrite = (action) =>
            !!authorizeWrite && authorizeWrite(context, id, action);
          const candidate = structuredClone(read(id)),
            result = operation(candidate, dependencies, canWrite);
          if (result?.then)
            throw Error("Configuration operation must be synchronous");
          const serialized = JSON.stringify(
            Object.fromEntries(keys.map((k) => [k, [...candidate[k]]])),
          );
          const response = JSON.parse(JSON.stringify(result));
          db.prepare(
            "INSERT INTO structure_aggregates VALUES(?,?) ON CONFLICT(tournamentId) DO UPDATE SET data=excluded.data",
          ).run(id, serialized);
          if (JSON.stringify(dependencies) !== dependencyBefore)
            require("../../platform/operations/state").save(
              db,
              id,
              dependencies,
            );
          return response;
        }),
      );
    },
  };
}
module.exports = { createSqliteStore };
