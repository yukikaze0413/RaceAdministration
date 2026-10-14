"use strict";
const { DatabaseSync } = require("node:sqlite");
const { mkdirSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
function openDatabase(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
    db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(tokenHash TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id),expiresAt INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS series(id TEXT PRIMARY KEY,ownerId TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tournaments(id TEXT PRIMARY KEY,ownerId TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS operations_aggregates(tournamentId TEXT PRIMARY KEY REFERENCES tournaments(id),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS structure_aggregates(tournamentId TEXT PRIMARY KEY REFERENCES tournaments(id),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS schedule_aggregates(tournamentId TEXT PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,version INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS catalog_requests(actorId TEXT NOT NULL REFERENCES users(id),requestKey TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(actorId,requestKey));
 CREATE TABLE IF NOT EXISTS planning_canvases(id TEXT PRIMARY KEY,ownerId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,version INTEGER NOT NULL,name TEXT NOT NULL,graph TEXT NOT NULL,validation TEXT);
 CREATE TABLE IF NOT EXISTS canvas_requests(actorId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,requestKey TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(actorId,requestKey));
 CREATE TABLE IF NOT EXISTS planning_canvas_schedules(canvasId TEXT PRIMARY KEY REFERENCES planning_canvases(id) ON DELETE CASCADE,version INTEGER NOT NULL,data TEXT NOT NULL);
 INSERT OR IGNORE INTO schema_migrations VALUES(1); INSERT OR IGNORE INTO schema_migrations VALUES(2); INSERT OR IGNORE INTO schema_migrations VALUES(3); INSERT OR IGNORE INTO schema_migrations VALUES(4); COMMIT;`);
    return db;
  } catch (e) {
    db.close();
    throw e;
  }
}
function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    if (result?.then) throw Error("Transactions must be synchronous");
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
module.exports = { openDatabase, transaction };
