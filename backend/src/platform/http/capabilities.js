"use strict";
const { visible } = require("../catalog/catalog");
const { loginRequired } = require("../auth/sessions");
const { reject } = require("./errors");
const descriptions = {
  accounts: "账号与会话",
  catalog: "赛事与系列资料",
  configuration: "结构草稿、校验、预演与冻结",
  passwordRecovery: "密码恢复",
  participation: "参赛记录",
  registration: "报名、审批、签到与候补",
  teamRegistration: "组队报名",
  pairing: "比赛对阵",
  standings: "排名",
  formatRuntime: "赛制运行",
  scoring: "报分与赛果",
  gameDetails: "逐局信息",
  advancement: "整轮确认与晋级",
  sanctions: "处罚与撤销",
  collaboration: "协作者邀请与授权",
};
const capabilities = Object.fromEntries(
  Object.entries(descriptions).map(([key, label]) => [
    key,
    {
      status: ["accounts", "catalog", "configuration"].includes(key)
        ? "implemented"
        : "unavailable",
      reasonCode: ["accounts", "catalog", "configuration"].includes(key)
        ? null
        : "FEATURE_NOT_IMPLEMENTED",
      message: ["accounts", "catalog", "configuration"].includes(key)
        ? label + "已可用。"
        : "当前尚未提供" + label + "服务。",
    },
  ]),
);
const endpoints = [
  ["post", "registrations", "registration", "member"],
  ["get", "registrations", "registration", "owner"],
  ["post", "registrations/:rid/approve", "registration", "owner"],
  ["post", "registrations/:rid/check-in", "registration", "owner"],
  ["delete", "registrations/:rid", "registration", "owner"],
  ["post", "teams", "teamRegistration", "member"],
  ["get", "matches", "pairing", "public"],
  ["get", "standings", "standings", "public"],
  ["post", "start", "formatRuntime", "owner"],
  ["post", "matches/:mid/results", "scoring", "member"],
  ["get", "results", "scoring", "public"],
  ["patch", "matches/:mid/results", "scoring", "owner"],
  ["get", "matches/:mid/games", "gameDetails", "public"],
  ["get", "rounds", "advancement", "owner"],
  ["post", "rounds/:rid/confirm", "advancement", "owner"],
  ["get", "sanctions", "sanctions", "owner"],
  ["post", "sanctions", "sanctions", "owner"],
  ["delete", "sanctions/:sid", "sanctions", "owner"],
  ["get", "collaborators", "collaboration", "owner"],
  ["post", "collaborators", "collaboration", "owner"],
  ["patch", "collaborators/:uid", "collaboration", "owner"],
  ["delete", "collaborators/:uid", "collaboration", "owner"],
];
function unavailable(key) {
  reject(
    501,
    key === "formatRuntime" ? "RUN_NOT_SUPPORTED" : "FEATURE_NOT_IMPLEMENTED",
    capabilities[key].message,
    { capability: key },
  );
}
function mountCapabilities(api, { db, send }) {
  api.get("/capabilities", (req, res) =>
    send(req, res, { version: 1, capabilities }),
  );
  api.get("/tournaments/:tid/capabilities", (req, res) => {
    const t = visible(db, req, req.params.tid),
      owner = t.ownerId === req.user?.id;
    send(req, res, {
      version: 1,
      capabilities,
      effectivePermissions: { view: true, configure: owner, manage: owner },
    });
  });
  api.post("/auth/password-reset", (req, res) =>
    unavailable("passwordRecovery"),
  );
  for (const [method, path, key, access] of endpoints)
    api[method]("/tournaments/:tid/" + path, (req, res) => {
      if (access === "member") loginRequired(req);
      visible(db, req, req.params.tid, access === "owner");
      unavailable(key);
    });
}
module.exports = { mountCapabilities, capabilities };
