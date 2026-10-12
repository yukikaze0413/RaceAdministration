"use strict";
const { fields, reject } = require("../http/errors");
const { loginRequired } = require("../auth/sessions");
const { visible } = require("../catalog/catalog");
const {
  read,
  write,
  writePrepared,
  can,
  requirePermission,
  effective,
} = require("./state");
const {
  createUnit,
  validateResult,
  advanceUnit,
  runtimeView,
} = require("./runtime");
function mountRuntime(api, { db, send, now = Date.now }) {
  const b = "/tournaments/:tid",
    access = (req) => {
      if (req.method !== "GET") loginRequired(req);
      return visible(db, req, req.params.tid);
    };
  function view(req) {
    const s = read(db, req.params.tid);
    return {
      version: s.version,
      rules: s.rules,
      locked: s.rosterLocked,
      permissions: effective(db, req.params.tid, req.user?.id),
      canSubmitMatchIds:
        s.runtime?.units.flatMap((u) =>
          u.rounds
            .filter((r) => !r.confirmed)
            .slice(0, 1)
            .flatMap((r) =>
              r.matches
                .filter(
                  (m) =>
                    !m.bye &&
                    s.runtime.roster.some(
                      (e) =>
                        e.userId === req.user?.id &&
                        m.entrants.includes(e.entrantId),
                    ),
                )
                .map((m) => m.id),
            ),
        ) ?? [],
      runtime: runtimeView(
        s,
        req.user?.id,
        can(db, req.params.tid, req.user?.id, "results.edit"),
      ),
    };
  }
  api.get(b + "/runtime", (req, res) => {
    access(req);
    send(req, res, view(req));
  });
  api.put(b + "/runtime-settings", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion", "rules"]);
    send(
      req,
      res,
      write(db, req, "structure.edit", (s) => {
        if (s.runtime) reject(409, "RUNNING", "运行规则已经锁定。");
        if (!Array.isArray(req.body.rules) || req.body.rules.length > 64)
          reject(422, "INVALID_INPUT", "规则无效。");
        const ids = new Set();
        for (const rule of req.body.rules) {
          fields(rule, [
            "stageId",
            "bestOf",
            "allowDraw",
            "allowPlayerDoubleLoss",
          ]);
          if (
            typeof rule.stageId !== "string" ||
            ids.has(rule.stageId) ||
            ![1, 3, 5, 7].includes(rule.bestOf) ||
            typeof rule.allowDraw !== "boolean" ||
            typeof rule.allowPlayerDoubleLoss !== "boolean"
          )
            reject(422, "INVALID_INPUT", "阶段规则无效。");
          ids.add(rule.stageId);
        }
        s.rules = Object.fromEntries(req.body.rules.map((r) => [r.stageId, r]));
      }),
    );
  });
  api.post(b + "/start", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion", "configurationId"]);
    send(
      req,
      res,
      writePrepared(db, req, "rounds.confirm", (s) => {
        if (s.runtime) reject(409, "RUNNING", "赛事已启动。");
        if (!s.rosterLocked)
          reject(409, "ROSTER_UNLOCKED", "请先审批并锁定参赛名单。");
        const row = db
          .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
          .get(req.params.tid);
        const configs = row ? JSON.parse(row.data).configurations : [],
          c = configs.find(([id]) => id === req.body.configurationId)?.[1];
        if (!c?.snapshot)
          reject(409, "CONFIG_NOT_FROZEN", "请选择已冻结的结构。");
        const timePlan = require("../schedule/store").read(db, req.params.tid);
        if (timePlan.configurationId && timePlan.configurationId !== c.id)
          reject(
            409,
            "SCHEDULE_CONFIGURATION_MISMATCH",
            "时间计划已绑定另一配置，请先在时间编排中明确切换并保存。",
          );
        if (s.rosterConfigurationId && s.rosterConfigurationId !== c.id)
          reject(
            409,
            "ROSTER_CONFIGURATION_MISMATCH",
            "名单已锁定到另一个配置。",
          );
        const structure = structuredClone(c.snapshot.structure),
          approved = s.registrations.filter((r) => r.status === "approved");
        if (structure.structureVersion === "structure-v2") {
          s.runtime = require("./runtime-v2").startV2(c, approved);
          return;
        }
        if (
          structure.stages.some(
            (st) =>
              !["single-elimination", "round-robin"].includes(st.formatIntent),
          )
        )
          reject(501, "RUN_NOT_SUPPORTED", "该结构含未实现运行的赛制。");
        if (
          structure.stages.some(
            (st) => st.capacity > 64 || st.groups.some((g) => g.capacity > 64),
          )
        )
          reject(422, "CAPACITY_UNSUPPORTED", "运行阶段容量不能超过64。");
        if (
          Object.keys(s.rules).some(
            (id) => !structure.stages.some((st) => st.id === id),
          )
        )
          reject(422, "RULE_INVALID", "规则不属于当前冻结配置。");
        for (const st of structure.stages)
          if (
            st.formatIntent === "single-elimination" &&
            s.rules[st.id]?.allowDraw
          )
            reject(422, "RULE_INVALID", "淘汰阶段不能允许平局。");
        const roots = structure.stages.filter(
            (st) =>
              !structure.routes.some((route) => route.target.stageId === st.id),
          ),
          sources = roots.flatMap((st) =>
            st.groups.length ? st.groups.map((g) => g.id) : [st.id],
          );
        const roster = approved.map((r) => ({
          entrantId: r.id,
          userId: r.userId,
          name: r.name,
          initialSeed: r.seed,
          exitState: "active",
          sourceId: r.sourceId ?? (sources.length === 1 ? sources[0] : null),
        }));
        if (roster.some((r) => !sources.includes(r.sourceId)))
          reject(422, "ROSTER_INVALID", "请将每位参赛者分配到初始阶段或小组。");
        s.runtime = {
          status: "running",
          version: "runtime-rules-v1",
          configurationId: c.id,
          structureDigest: c.snapshot.digest,
          structure,
          roster,
          units: [],
          blocked: [],
        };
        for (const st of roots)
          for (const group of st.groups.length ? st.groups : [null]) {
            const entries = roster
              .filter((r) => r.sourceId === (group?.id ?? st.id))
              .sort((a, b) => a.initialSeed - b.initialSeed)
              .map((r, i) => ({
                ...r,
                position: group ? i + 1 : r.initialSeed,
              }));
            const rule = s.rules[st.id] ?? {
              bestOf: 3,
              allowDraw: false,
              allowPlayerDoubleLoss: false,
            };
            if (st.formatIntent === "single-elimination" && rule.allowDraw)
              reject(422, "RULE_INVALID", "淘汰赛不可允许平局。");
            s.runtime.units.push(createUnit(st, group, entries, rule));
          }
      }),
    );
  });
  function locate(s, id) {
    if (!s.runtime) reject(409, "NOT_READY", "尚未开赛。");
    for (const unit of s.runtime.units)
      for (const round of unit.rounds) {
        const match = round.matches.find((m) => m.id === id);
        if (match) return { unit, round, match };
      }
    reject(404, "NOT_FOUND", "未找到本赛事对阵。");
  }
  for (const method of ["post", "patch"])
    api[method](b + "/matches/:mid/results", (req, res) => {
      access(req);
      fields(req.body, ["expectedVersion", "result", "reason"]);
      const authorize =
        method === "post"
          ? (s, uid) => {
              const { unit, match } = locate(s, req.params.mid);
              const participant = s.runtime.roster.some(
                (r) => r.userId === uid && match.entrants.includes(r.entrantId),
              );
              const editor = can(db, req.params.tid, uid, "results.edit");
              if (!participant && !editor)
                reject(403, "FORBIDDEN", "只能提交自己当前对阵的赛果。");
              if (
                req.body.result?.kind === "double-loss" &&
                !unit.rule.allowPlayerDoubleLoss &&
                !editor
              )
                reject(403, "FORBIDDEN", "本阶段不允许选手提交双方判负。");
            }
          : undefined;
      send(
        req,
        res,
        write(
          db,
          req,
          method === "patch" ? "results.edit" : null,
          (s, uid) => {
            const { unit, round, match } = locate(s, req.params.mid);
            if (
              round.confirmed ||
              match.bye ||
              unit.rounds.find((r) => !r.confirmed)?.id !== round.id
            )
              reject(409, "ROUND_LOCKED", "已确认赛果和结构轮空不可修改。");
            const result = validateResult(unit, req.body.result, match);
            if (unit.ruleVersion === "ti2026-observed-candidate-v1") {
              if (
                method === "patch" &&
                (typeof req.body.reason !== "string" ||
                  !req.body.reason.trim() ||
                  req.body.reason.length > 500)
              )
                reject(422, "INVALID_INPUT", "请填写裁定原因。");
              const next =
                require("./format-runners/ti-unit-candidate").recordTiCandidateMatch(
                  unit,
                  match.id,
                  result,
                  {
                    expectedVersion: unit.version,
                    inputHash: unit.inputHash,
                    actorId: uid,
                    reason:
                      method === "patch"
                        ? req.body.reason
                        : "选手或管理员提交赛果",
                  },
                  method === "patch" ? "decision" : "submission",
                  method === "post" && !match.actualStartedAt
                    ? new Date(now()).toISOString()
                    : undefined,
                );
              s.runtime.units[s.runtime.units.indexOf(unit)] = next;
              return;
            }
            if (method === "patch") {
              if (
                typeof req.body.reason !== "string" ||
                !req.body.reason.trim() ||
                req.body.reason.length > 500
              )
                reject(422, "INVALID_INPUT", "请填写裁定原因。");
              match.decision = {
                ...result,
                actorId: uid,
                reason: req.body.reason,
              };
            } else {
              if (!match.actualStartedAt)
                match.actualStartedAt = new Date(now()).toISOString();
              match.submissions = match.submissions.filter(
                (x) => x.actorId !== uid,
              );
              match.submissions.push({ ...result, actorId: uid });
              match.decision = null;
            }
          },
          { authorize },
        ),
      );
    });
  api.post(b + "/matches/:mid/actual-start", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion", "actualStartedAt"]);
    send(
      req,
      res,
      write(db, req, "results.edit", (s) => {
        const { unit, round, match } = locate(s, req.params.mid);
        if (
          round.confirmed ||
          match.bye ||
          unit.rounds.find((r) => !r.confirmed)?.id !== round.id
        )
          reject(409, "ROUND_LOCKED", "只能标记当前未锁定比赛的实际开始。");
        const instant = require("../schedule/validation").instant(
          req.body.actualStartedAt ?? new Date(now()).toISOString(),
        );
        if (Date.parse(instant) > now())
          reject(422, "INVALID_INPUT", "实际开始时间不能在未来。");
        if (match.actualStartedAt && match.actualStartedAt !== instant)
          reject(409, "ACTUAL_START_LOCKED", "实际开始记录不可覆盖。");
        if (unit.ruleVersion === "ti2026-observed-candidate-v1") {
          const next =
            require("./format-runners/ti-unit-candidate").recordTiCandidateMatch(
              unit,
              match.id,
              null,
              {
                expectedVersion: unit.version,
                inputHash: unit.inputHash,
                actorId: req.user.id,
                reason: "标记实际开始",
              },
              "start",
              instant,
            );
          s.runtime.units[s.runtime.units.indexOf(unit)] = next;
        } else match.actualStartedAt = instant;
      }),
    );
  });
  api.post(b + "/rounds/:rid/confirm", (req, res) => {
    access(req);
    fields(req.body, [
      "expectedVersion",
      "inputVersion",
      "inputHash",
      "reason",
    ]);
    send(
      req,
      res,
      writePrepared(db, req, "rounds.confirm", (s, uid) => {
        if (!s.runtime) reject(409, "NOT_READY", "尚未开赛。");
        const unit = s.runtime.units.find((u) =>
          u.rounds.some((r) => r.id === req.params.rid),
        );
        if (!unit) reject(404, "NOT_FOUND", "未找到轮次。");
        if (unit.rounds.find((r) => !r.confirmed)?.id !== req.params.rid)
          reject(409, "ROUND_LOCKED", "轮次已锁定。");
        if (unit.ruleVersion === "ti2026-observed-candidate-v1") {
          const round = unit.rounds.find((r) => !r.confirmed);
          const results = round.matches.every((m) => m.decision)
            ? round.matches.map((m) => ({ ...m.decision, matchId: m.id }))
            : [];
          const next =
            require("./format-runners/ti-unit-candidate").confirmTiCandidateRound(
              unit,
              results,
              {
                expectedVersion: req.body.inputVersion,
                inputHash: req.body.inputHash,
                actorId: uid,
                reason: req.body.reason,
              },
            );
          s.runtime.units[s.runtime.units.indexOf(unit)] = next;
        } else {
          if (
            ["inputVersion", "inputHash", "reason"].some((k) =>
              Object.hasOwn(req.body, k),
            )
          )
            reject(422, "INVALID_INPUT", "此确认协议不接受TI候选字段。");
          advanceUnit(unit);
        }
        require("./progression").progress(s.runtime, s.rules);
      }),
    );
  });
  api.post(b + "/units/:uid/pairing", (req, res) => {
    access(req);
    fields(req.body, [
      "expectedVersion",
      "inputVersion",
      "inputHash",
      "pairs",
      "bye",
      "reason",
      "allowRematch",
    ]);
    send(
      req,
      res,
      writePrepared(db, req, "rounds.confirm", (s, uid) => {
        const unit = s.runtime?.units.find((u) => u.id === req.params.uid);
        if (!unit) reject(404, "NOT_FOUND", "未找到比赛单位。");
        if (unit.ruleVersion === "ti2026-observed-candidate-v1")
          reject(501, "RUN_NOT_SUPPORTED", "TI候选不能使用通用瑞士裁定协议。");
        if (!["fixed-swiss", "threshold-swiss"].includes(unit.format))
          reject(409, "PAIRING_LOCKED", "此赛制无需瑞士配对裁定。");
        if (
          typeof req.body.reason !== "string" ||
          !req.body.reason.trim() ||
          req.body.reason.length > 500
        )
          reject(422, "INVALID_INPUT", "请填写配对裁定原因。");
        const {
          validateManualPairing,
          applyPairing,
        } = require("./format-runners/swiss");
        const out = validateManualPairing(unit, req.body);
        applyPairing(unit, out);
        unit.rounds.at(-1).pairing.decision = {
          actorId: uid,
          reason: req.body.reason,
        };
        require("./progression").progress(s.runtime, s.rules);
      }),
    );
  });
  api.post(b + "/units/:uid/ranking", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion", "order", "reason"]);
    send(
      req,
      res,
      writePrepared(db, req, "rounds.confirm", (s) => {
        const unit = s.runtime?.units.find((u) => u.id === req.params.uid);
        if (!unit) reject(404, "NOT_FOUND", "未找到比赛单位。");
        if (unit.ruleVersion === "ti2026-observed-candidate-v1")
          reject(501, "RUN_NOT_SUPPORTED", "TI候选不能使用通用排名裁定协议。");
        if (unit.status !== "ranking-blocked")
          reject(409, "RANKING_LOCKED", "该排名无需裁定或已确定。");
        const order = req.body.order,
          rows = unit.standings;
        if (
          !Array.isArray(order) ||
          order.length !== rows.length ||
          new Set(order).size !== order.length ||
          order.some((id) => !rows.some((r) => r.entrantId === id)) ||
          typeof req.body.reason !== "string" ||
          !req.body.reason.trim() ||
          req.body.reason.length > 500
        )
          reject(422, "INVALID_INPUT", "请给出完整、不重复的并列顺序与原因。");
        const ranks = order.map(
          (id) => rows.find((r) => r.entrantId === id).rank,
        );
        if (ranks.some((rank, i) => i > 0 && rank < ranks[i - 1]))
          reject(422, "INVALID_INPUT", "只能调整并列者，不能颠倒已确定排名。");
        unit.standings = order.map((id, i) => ({
          ...rows.find((r) => r.entrantId === id),
          rank: i + 1,
        }));
        unit.rankingDecision = {
          actorId: req.user.id,
          reason: req.body.reason,
          order,
        };
        unit.status = "completed";
        if (
          unit.plan &&
          ["round-robin", "double-round-robin"].includes(unit.format)
        )
          require("./format-runners/round-robin").finalizeRoundRobin(unit);
        if (["fixed-swiss", "threshold-swiss"].includes(unit.format))
          require("./format-runners/swiss").finalizeSwiss(unit);
        require("./progression").progress(s.runtime, s.rules);
      }),
    );
  });

  api.post(b + "/units/:uid/ti-opponent", (req, res) => {
    access(req);
    fields(req.body, [
      "expectedVersion",
      "inputVersion",
      "inputHash",
      "chooserId",
      "opponentId",
      "reason",
    ]);
    send(
      req,
      res,
      writePrepared(db, req, "rounds.confirm", (s, uid) => {
        const unit = s.runtime?.units.find((u) => u.id === req.params.uid);
        if (!unit) reject(404, "NOT_FOUND", "未找到比赛单位。");
        if (unit.ruleVersion !== "ti2026-observed-candidate-v1")
          reject(501, "RUN_NOT_SUPPORTED", "此规则没有TI对手选择协议。");
        const next =
          require("./format-runners/ti-unit-candidate").chooseTiCandidateOpponent(
            unit,
            req.body.chooserId,
            req.body.opponentId,
            {
              expectedVersion: req.body.inputVersion,
              inputHash: req.body.inputHash,
              actorId: uid,
              reason: req.body.reason,
            },
          );
        s.runtime.units[s.runtime.units.indexOf(unit)] = next;
        require("./progression").progress(s.runtime, s.rules);
      }),
    );
  });
  for (const resource of ["matches", "results", "standings", "rounds"])
    api.get(b + "/" + resource, (req, res) => {
      access(req);
      if (resource === "rounds") loginRequired(req);
      send(req, res, view(req));
    });
}
module.exports = { mountRuntime };
