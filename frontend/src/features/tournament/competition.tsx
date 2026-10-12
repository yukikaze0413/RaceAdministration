import { Resource, useResource } from "./resource";
import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { Field, ErrorNotice } from "../../shared/ui";
import { useWrite } from "./write";
import {
  isTiCandidate,
  TiGameFields,
  tiResultPayload,
  tiResultProblem,
  TiOpponentChoice,
  TiRoundConfirmation,
  TiStandings,
  type TiGame,
} from "./ti-runtime";
const statusName: Record<string, string> = {
  running: "进行中",
  completed: "已完成",
  "ranking-blocked": "同分待裁定",
  "pairing-blocked": "配对待裁定",
  "choosing-elimination": "附加赛对手待选择",
};
export function MatchCard({
  m,
  u,
  round,
  data,
  base,
  onSaved,
}: {
  m: any;
  u: any;
  round: any;
  data: any;
  base: string;
  onSaved: () => void;
}) {
  const write = useWrite(),
    [scores, setScores] = useState<number[]>(m.decision?.scores ?? [0, 0]),
    [reason, setReason] = useState(""),
    [doubleLoss, setDoubleLoss] = useState(false),
    [games, setGames] = useState<TiGame[]>(m.decision?.games ?? []),
    [seriesId, setSeriesId] = useState(m.decision?.seriesId ?? m.id);
  const tiSwiss = isTiCandidate(u) && round.phase === "swiss";
  const tiProblem = tiSwiss ? tiResultProblem(scores, games, m.entrants) : null;
  function adopt(result: any) {
    setScores([...result.scores]);
    setGames(structuredClone(result.games ?? []));
    setSeriesId(result.seriesId ?? m.id);
  }
  const name = (id: string) =>
    data.runtime.roster.find((e: any) => e.entrantId === id)?.name ?? "轮空";
  const active = u.rounds.find((r: any) => !r.confirmed)?.id === round.id,
    bestOf = m.bestOf ?? u.rule.bestOf,
    edit = data.permissions["results.edit"],
    submit = data.canSubmitMatchIds?.includes(m.id);
  async function save() {
    const result = doubleLoss
      ? { kind: "double-loss" }
      : tiSwiss
        ? tiResultPayload({ id: m.id, decision: { seriesId } }, scores, games)
        : { kind: "score", scores };
    const r = await write.run(
      base + "/matches/" + m.id + "/results",
      edit ? "PATCH" : "POST",
      { expectedVersion: data.version, result, reason },
    );
    if (r) onSaved();
  }
  return (
    <article className={"match-card " + (round.confirmed ? "locked" : "")}>
      <div className="match-line">
        <strong>{name(m.entrants[0])}</strong>
        <span>
          {m.bye
            ? "轮空"
            : m.decision?.kind === "double-loss"
              ? "双方判负"
              : (m.decision?.scores?.[0] ?? "—")}
        </span>
      </div>
      <div className="match-line">
        <strong>{name(m.entrants[1])}</strong>
        <span>{m.bye ? "" : (m.decision?.scores?.[1] ?? "—")}</span>
      </div>
      <small>
        {m.role && (
          <>
            {(
              {
                final: "决赛",
                thirdPlace: "季军战",
                opening: "首轮",
                winners: "胜者战",
                elimination: "淘汰轮",
                decider: "出线战",
                upper: "胜者组",
                lower: "败者组",
                lowerPreliminary: "败者预选",
                roundRobin: "循环对局",
              } as Record<string, string>
            )[m.role] ?? m.role}{" "}
            ·{" "}
          </>
        )}
        {round.confirmed
          ? "赛果已锁定"
          : m.bye
            ? "结构轮空，无需报分"
            : m.decision
              ? "已裁定，等待整轮确认"
              : "待提交或裁定"}{" "}
        · BO{bestOf}
      </small>
      {m.decision?.games && (
        <details>
          <summary>已记录逐局赛果</summary>
          <ol>
            {m.decision.games.map((g: any) => (
              <li key={g.matchId}>
                {name(g.winnerId)}胜 · {g.durationSeconds}秒
              </li>
            ))}
          </ol>
        </details>
      )}
      {m.submissions.length > 0 && (
        <details>
          <summary>提交记录 ({m.submissions.length})</summary>
          {m.submissions.map((s: any, i: number) => (
            <div key={i}>
              <p>
                {s.kind === "double-loss" ? "双方判负" : s.scores.join(" : ")}
              </p>
              {s.games && (
                <ol>
                  {s.games.map((g: any) => (
                    <li key={g.matchId}>
                      {name(g.winnerId)}胜 · {g.durationSeconds}秒
                    </li>
                  ))}
                </ol>
              )}
              {tiSwiss && active && (edit || submit) && (
                <button type="button" onClick={() => adopt(s)}>
                  采用第{i + 1}份提交
                </button>
              )}
            </div>
          ))}
        </details>
      )}
      {!m.bye && active && (edit || submit) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="score-inputs">
            {scores.map((score, i) => (
              <Field key={i} label={(i === 0 ? "左方" : "右方") + "比分"}>
                <input
                  type="number"
                  min={0}
                  max={(bestOf + 1) / 2}
                  value={score}
                  disabled={write.busy || doubleLoss}
                  onChange={(e) =>
                    setScores(
                      scores.map((s, j) =>
                        j === i ? Number(e.target.value) : s,
                      ),
                    )
                  }
                />
              </Field>
            ))}
          </div>
          {tiSwiss && (
            <TiGameFields
              games={games}
              count={Math.max(2, Math.min(3, scores[0] + scores[1]))}
              entrants={m.entrants}
              name={name}
              onChange={setGames}
            />
          )}
          {tiProblem && scores.some((score) => score > 0) && (
            <p role="alert">{tiProblem}</p>
          )}
          {[
            "round-robin",
            "double-round-robin",
            "fixed-swiss",
            "threshold-swiss",
          ].includes(u.format) &&
            !isTiCandidate(u) &&
            (edit || u.rule.allowPlayerDoubleLoss) && (
              <Field label="双方判负">
                <input
                  type="checkbox"
                  checked={doubleLoss}
                  onChange={(e) => setDoubleLoss(e.target.checked)}
                />
              </Field>
            )}
          {edit && (
            <Field label="裁定原因">
              <input
                required
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          )}
          {tiSwiss && write.error?.status === 409 && (
            <section className="warning">
              <p>
                本地输入已保留；重读后核对服务器赛果，再决定采用或重新裁定。
              </p>
              <p>
                服务器当前赛果：{m.decision?.scores?.join(" : ") ?? "尚未裁定"}
              </p>
              <button
                type="button"
                disabled={!m.decision?.scores}
                onClick={() => {
                  adopt(m.decision);
                  setReason(m.decision.reason ?? reason);
                  write.clearError();
                }}
              >
                采用服务器赛果
              </button>
            </section>
          )}
          <button className="primary" disabled={write.busy || !!tiProblem}>
            {edit ? "裁定赛果" : "提交赛果"}
          </button>
        </form>
      )}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? onSaved : save}
        />
      )}
    </article>
  );
}
export function PairingDecision({
  u,
  data,
  base,
  onSaved,
}: {
  u: any;
  data: any;
  base: string;
  onSaved: () => void;
}) {
  const rows = u.standings.filter(
    (r: any) =>
      u.format !== "threshold-swiss" ||
      (r.wins < u.plan.parameters.winsToQualify &&
        r.losses < u.plan.parameters.lossesToEliminate),
  );
  const [pairs, setPairs] = useState<string[][]>(
      Array.from({ length: Math.floor(rows.length / 2) }, () => ["", ""]),
    ),
    [bye, setBye] = useState(""),
    [reason, setReason] = useState(""),
    [allowRematch, setAllowRematch] = useState(false),
    write = useWrite();
  const major = u.ruleVersion === "major-cologne-2026-v1";
  const exceptionAvailable =
    major && u.pairingBlock?.code === "MAJOR_PRIORITY_EXHAUSTED";
  const participants = [...pairs.flat(), ...(rows.length % 2 ? [bye] : [])];
  const complete =
    participants.length === rows.length &&
    participants.every((id: string) =>
      rows.some((r: any) => r.entrantId === id),
    ) &&
    new Set(participants).size === rows.length &&
    pairs.every(
      ([a, b]) =>
        ((exceptionAvailable && allowRematch) ||
          !rows.find((r: any) => r.entrantId === a)?.opponents.includes(b)) &&
        (!major ||
          (rows.find((r: any) => r.entrantId === a)?.wins ===
            rows.find((r: any) => r.entrantId === b)?.wins &&
            rows.find((r: any) => r.entrantId === a)?.losses ===
              rows.find((r: any) => r.entrantId === b)?.losses)),
    ) &&
    (!(rows.length % 2) ||
      !rows.find((r: any) => r.entrantId === bye)?.byeCount);
  const name = (id: string) =>
    data.runtime.roster.find((r: any) => r.entrantId === id)?.name ?? id;
  return (
    <section className="warning">
      <h3>瑞士配对待裁定</h3>
      <p>
        {u.pairingBlock?.code === "PAIRING_SOLVER_LIMIT"
          ? "自动求解达到预算，尚未证明无解。"
          : "当前硬规则下没有完整配对。"}
        {exceptionAvailable
          ? "无重赛方案已全部核验不可行。人工配对必须完整并保持同战绩组；重赛需要明确确认和留因裁定。"
          : "人工配对必须完整，禁止重赛和重复满分轮空。"}
      </p>
      <p>配对输入版本 {u.pairingInputVersion}；保存时复验当前输入。</p>
      <div className="form-grid">
        {pairs.map((pair, i) => (
          <fieldset key={i}>
            <legend>第{i + 1}场</legend>
            {pair.map((id, side) => (
              <Field
                key={side}
                label={`第${i + 1}场${side === 0 ? "左方" : "右方"}`}
              >
                <select
                  value={id}
                  onChange={(e) =>
                    setPairs(
                      pairs.map((p, j) =>
                        j === i
                          ? p.map((v, k) => (k === side ? e.target.value : v))
                          : p,
                      ),
                    )
                  }
                >
                  <option value="">选择参赛者</option>
                  {rows.map((r: any) => (
                    <option key={r.entrantId} value={r.entrantId}>
                      {name(r.entrantId)}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </fieldset>
        ))}
      </div>
      {rows.length % 2 === 1 && (
        <Field label="本轮轮空">
          <select value={bye} onChange={(e) => setBye(e.target.value)}>
            <option value="">选择未获轮空者</option>
            {rows
              .filter((r: any) => !r.byeCount)
              .map((r: any) => (
                <option key={r.entrantId} value={r.entrantId}>
                  {name(r.entrantId)}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="配对裁定原因">
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {exceptionAvailable && (
        <Field label="确认 Major 重赛例外">
          <input
            type="checkbox"
            checked={allowRematch}
            onChange={(e) => setAllowRematch(e.target.checked)}
          />
        </Field>
      )}
      <button
        disabled={write.busy || !complete || !reason.trim()}
        onClick={async () => {
          const out = await write.run(
            base + "/units/" + u.id + "/pairing",
            "POST",
            {
              expectedVersion: data.version,
              inputVersion: u.pairingInputVersion,
              inputHash: u.pairingInputHash,
              pairs,
              bye: rows.length % 2 ? bye : null,
              reason,
              ...(major
                ? { allowRematch: exceptionAvailable && allowRematch }
                : {}),
            },
          );
          if (out) onSaved();
        }}
      >
        确认完整人工配对
      </button>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? onSaved
              : async () => {
                  const out = await write.retry();
                  if (out) onSaved();
                }
          }
        />
      )}
    </section>
  );
}
function RankingDecision({
  u,
  data,
  base,
  onSaved,
}: {
  u: any;
  data: any;
  base: string;
  onSaved: () => void;
}) {
  const [order, setOrder] = useState<string[]>(
      u.standings.map((s: any) => s.entrantId),
    ),
    [reason, setReason] = useState(""),
    write = useWrite();
  const name = (id: string) =>
    data.runtime.roster.find((r: any) => r.entrantId === id)?.name ?? id;
  return (
    <section className="warning">
      <h3>同分排名待裁定</h3>
      <p>
        比赛已经锁定；未确定唯一排名前不会晋级。只能调整并列者，必须记录理由。
      </p>
      <ol>
        {order.map((id, i) => (
          <li key={id}>
            {name(id)}{" "}
            <button
              disabled={i === 0 || write.busy}
              onClick={() => {
                const n = [...order];
                [n[i - 1], n[i]] = [n[i], n[i - 1]];
                setOrder(n);
              }}
            >
              上移 {name(id)}
            </button>
          </li>
        ))}
      </ol>
      <Field label="排名裁定原因">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      </Field>
      <button
        disabled={!reason.trim() || write.busy}
        onClick={async () => {
          const r = await write.run(
            base + "/units/" + u.id + "/ranking",
            "POST",
            { expectedVersion: data.version, order, reason },
          );
          if (r) onSaved();
        }}
      >
        确认并列顺序
      </button>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? onSaved
              : async () => {
                  const r = await write.retry();
                  if (r) onSaved();
                }
          }
        />
      )}
    </section>
  );
}
export function StartPanel({
  data,
  base,
  onSaved,
}: {
  data: any;
  base: string;
  onSaved: () => void;
}) {
  const configs = useResource(
      data.permissions["structure.edit"] ? base + "/configurations" : null,
    ),
    [configurationId, setConfiguration] = useState(""),
    write = useWrite();
  const selected = configs.data?.find((c: any) => c.id === configurationId),
    unavailable =
      selected?.structureVersion === "structure-v2" &&
      selected.snapshot?.runtimeReady === false;
  return (
    <section className="panel">
      <h3>开赛准备</h3>
      <p>
        {data.locked
          ? "名单已锁定，选择冻结配置并开始赛事。"
          : "请先审批并锁定名单"}
      </p>
      <Field label="开赛配置">
        <select
          value={configurationId}
          onChange={(e) => setConfiguration(e.target.value)}
        >
          <option value="">选择已冻结配置</option>
          {configs.data
            ?.filter((c: any) => c.state === "structure-frozen")
            .map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.templateOrigin?.id ?? "自定义"} · {c.id.slice(0, 8)}
              </option>
            ))}
        </select>
      </Field>
      {!data.permissions["structure.edit"] && (
        <p>请由结构管理者提供冻结配置标识。</p>
      )}
      {!data.permissions["structure.edit"] && (
        <Field label="冻结配置标识">
          <input
            value={configurationId}
            onChange={(e) => setConfiguration(e.target.value)}
          />
        </Field>
      )}
      <p>使用所选配置的规则开赛；确认后的赛果无法修改。</p>
      {unavailable && (
        <p>该配置包含尚未开放运行的规则，当前可验收计划与时间编排。</p>
      )}
      <button
        className="primary"
        disabled={!data.locked || !configurationId || write.busy || unavailable}
        onClick={async () => {
          if (window.confirm("确认锁定规则并生成首轮对阵？")) {
            const r = await write.run(base + "/start", "POST", {
              expectedVersion: data.version,
              configurationId,
            });
            if (r) onSaved();
          }
        }}
      >
        开始赛事
      </button>
      {data.permissions["structure.edit"] && (
        <RuntimeRules data={data} base={base} onSaved={onSaved} />
      )}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? onSaved
              : async () => {
                  const r = await write.retry();
                  if (r) onSaved();
                }
          }
        />
      )}
    </section>
  );
}
function RuntimeRules({
  data,
  base,
  onSaved,
}: {
  data: any;
  base: string;
  onSaved: () => void;
}) {
  const stages = useResource(base + "/stages"),
    [rules, setRules] = useState<any>(data.rules),
    write = useWrite();
  function change(id: string, key: string, value: any) {
    setRules({
      ...rules,
      [id]: {
        stageId: id,
        bestOf: 3,
        allowDraw: false,
        allowPlayerDoubleLoss: false,
        ...rules[id],
        [key]: value,
      },
    });
  }
  if (stages.data?.structureVersion === "structure-v2")
    return <p>新版赛制使用冻结参数；BO等规则请在冻结前修改。</p>;
  return (
    <details>
      <summary>自定义各阶段比赛规则</summary>
      <p>仅在开赛前编辑；平局仅循环支持。积分与破同分使用平台v1规则。</p>
      {stages.data?.items.map((s: any) => (
        <fieldset key={s.id}>
          <legend>
            阶段 {s.order} · {s.formatIntent}
          </legend>
          <Field label={"阶段" + s.order + "局数规则"}>
            <select
              value={rules[s.id]?.bestOf ?? 3}
              onChange={(e) => change(s.id, "bestOf", Number(e.target.value))}
            >
              {[1, 3, 5, 7].map((n) => (
                <option value={n} key={n}>
                  BO{n}
                </option>
              ))}
            </select>
          </Field>
          {s.formatIntent === "round-robin" && (
            <>
              <Field label={"阶段" + s.order + "允许平局"}>
                <input
                  type="checkbox"
                  checked={rules[s.id]?.allowDraw ?? false}
                  onChange={(e) => change(s.id, "allowDraw", e.target.checked)}
                />
              </Field>
              <Field label={"阶段" + s.order + "允许选手提交双方判负"}>
                <input
                  type="checkbox"
                  checked={rules[s.id]?.allowPlayerDoubleLoss ?? false}
                  onChange={(e) =>
                    change(s.id, "allowPlayerDoubleLoss", e.target.checked)
                  }
                />
              </Field>
            </>
          )}
        </fieldset>
      ))}
      <button
        disabled={write.busy}
        onClick={async () => {
          const r = await write.run(base + "/runtime-settings", "PUT", {
            expectedVersion: data.version,
            rules: Object.values(rules),
          });
          if (r) onSaved();
        }}
      >
        保存比赛规则
      </button>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? onSaved
              : async () => {
                  const r = await write.retry();
                  if (r) onSaved();
                }
          }
        />
      )}
    </details>
  );
}
export function CompetitionPage({ kind }: { kind: string }) {
  const event = useOutletContext<any>();
  const { tid } = useParams(),
    base = "/tournaments/" + tid,
    state = useResource(base + "/runtime"),
    write = useWrite();
  useEffect(() => {
    const status = state.data?.runtime?.status;
    if (status && event?.runtimeStatus !== status)
      event?.onSaved?.({ ...event, runtimeStatus: status });
  }, [
    state.data?.runtime?.status,
    event?.runtimeStatus,
    event?.onSaved,
    event?.id,
  ]);
  const title =
    kind === "rounds"
      ? "赛事运行与整轮推进"
      : kind === "standings"
        ? "积分与排名"
        : kind === "results"
          ? "赛果与裁定"
          : "比赛对阵";
  return (
    <section>
      <h2>{title}</h2>
      <Resource state={state}>
        {(data) => (
          <>
            {!data.runtime ? (
              <>
                <p className="empty">尚未开始真实比赛。</p>
                {data.permissions["rounds.confirm"] && (
                  <StartPanel data={data} base={base} onSaved={state.reload} />
                )}
              </>
            ) : (
              <>
                <p className="tag">
                  {statusName[data.runtime.status]} ·{" "}
                  {data.runtime.roster.length} 名参赛者
                </p>
                {data.runtime.blocked?.length > 0 && (
                  <details className="warning">
                    <summary>后续阶段等待来源</summary>
                    {data.runtime.blocked.map((b: any) => (
                      <p key={b.stageId}>
                        {b.diagnostics.map((d: any) => d.reason).join("；")}
                      </p>
                    ))}
                  </details>
                )}
                {data.runtime.waiting?.map((w: any) => (
                  <p key={w.stageId}>
                    {data.runtime.structure.stages.find(
                      (s: any) => s.id === w.stageId,
                    )?.name ?? w.stageId}
                    ：{w.reason}
                  </p>
                ))}
                {data.runtime.units.map((u: any, index: number) => (
                  <section className="competition-unit" key={u.id}>
                    <h3>
                      阶段{" "}
                      {
                        data.runtime.structure.stages.find(
                          (s: any) => s.id === u.stageId,
                        )?.order
                      }{" "}
                      · 比赛单位 {index + 1}{" "}
                      <span className="tag">{statusName[u.status]}</span>
                    </h3>
                    {u.status === "completed" && u.qualified?.length > 1 && (
                      <p>资格集合（{u.qualified.length}人）</p>
                    )}
                    {u.status === "completed" && u.format === "gsl" && (
                      <p>
                        有序出线：
                        {u.qualified
                          .map(
                            (q: any) =>
                              data.runtime.roster.find(
                                (e: any) => e.entrantId === q.entrantId,
                              )?.name,
                          )
                          .join(" → ")}
                      </p>
                    )}
                    {u.format === "double-elimination" &&
                      u.bindings.some((b: any) => b.initialLosses === 1) && (
                        <p>
                          败者直接入口已有一败；战绩表记录本阶段实际比赛，不添加虚构比分。
                        </p>
                      )}
                    {u.plan?.matches.some(
                      (m: any) =>
                        m.condition &&
                        !u.rounds.some((r: any) =>
                          r.matches.some(
                            (actual: any) => actual.planKey === m.planKey,
                          ),
                        ),
                    ) && (
                      <p>
                        重置决赛：
                        {u.status === "completed"
                          ? "条件未满足，未激活"
                          : "等待首次总决赛，败者组冠军获胜后才激活"}
                        。
                      </p>
                    )}
                    {!isTiCandidate(u) &&
                      ["fixed-swiss", "threshold-swiss"].includes(u.format) && (
                        <details>
                          <summary>瑞士排名规则与小分来源</summary>
                          <p>
                            排序顺序：
                            {u.plan.parameters.tiebreakers
                              .map(
                                (field: string) =>
                                  (
                                    ({
                                      points: "积分",
                                      record: "胜负战绩",
                                      "BH-points-v1": "对手积分和",
                                      "DS-wl-v1": "对手胜负差",
                                      netGames: "净胜局",
                                      initialSeed: "初始种子",
                                      "manual-with-reason": "留因裁定",
                                    }) as Record<string, string>
                                  )[field],
                              )
                              .join(" → ")}
                          </p>
                          <p>
                            对手积分和为实际交手对手当前积分之和；对手胜负差为这些对手胜数减负数之和。轮空贡献0；双方判负仍保留实际对手，净胜局贡献0。积分与小分使用精确整数累加。
                          </p>
                          <p>
                            晋级战与淘汰战同时触发BO覆盖时，使用两项较大值。
                          </p>
                        </details>
                      )}
                    {u.qualificationMismatch && (
                      <p role="alert">
                        实际晋级{u.qualificationMismatch.actual}人，配置要求
                        {u.qualificationMismatch.expected}
                        人；固定配额路由将阻塞，不补造胜者。
                      </p>
                    )}
                    {u.status === "pairing-blocked" &&
                      !isTiCandidate(u) &&
                      data.permissions["rounds.confirm"] && (
                        <PairingDecision
                          key={u.pairingInputHash}
                          u={u}
                          data={data}
                          base={base}
                          onSaved={state.reload}
                        />
                      )}
                    {isTiCandidate(u) &&
                      u.status === "choosing-elimination" &&
                      data.permissions["rounds.confirm"] && (
                        <TiOpponentChoice
                          key={u.inputHash}
                          u={u}
                          data={data}
                          base={base}
                          onSaved={state.reload}
                        />
                      )}
                    {isTiCandidate(u) &&
                      ["pairing-blocked", "ranking-blocked"].includes(
                        u.status,
                      ) && (
                        <p role="alert">
                          TI候选存在未决同分或配对选择，当前保持阻塞；不能使用通用瑞士裁定代替。
                        </p>
                      )}
                    {isTiCandidate(u) && <TiStandings u={u} data={data} />}
                    {!isTiCandidate(u) && u.standings.length > 0 && (
                      <div
                        className="table-scroll"
                        role="region"
                        aria-label={
                          ["fixed-swiss", "threshold-swiss"].includes(u.format)
                            ? "瑞士战绩表"
                            : "比赛战绩表"
                        }
                        tabIndex={0}
                      >
                        <table
                          className={
                            ["fixed-swiss", "threshold-swiss"].includes(
                              u.format,
                            )
                              ? "swiss-standings"
                              : undefined
                          }
                        >
                          <caption>
                            {u.status === "completed"
                              ? u.qualified?.length > 1
                                ? "最终资格与战绩"
                                : "最终排名"
                              : u.ruleVersion
                                ? "当前战绩"
                                : "当前积分"}
                          </caption>
                          <thead>
                            <tr>
                              <th>
                                {u.qualified?.length > 1
                                  ? "名次 / 资格"
                                  : "名次"}
                              </th>
                              <th>参赛者</th>
                              <th>胜/负/平</th>
                              {[
                                "round-robin",
                                "double-round-robin",
                                "fixed-swiss",
                                "threshold-swiss",
                              ].includes(u.format) && <th>积分</th>}
                              {["fixed-swiss", "threshold-swiss"].includes(
                                u.format,
                              ) && (
                                <>
                                  <th>对手积分和</th>
                                  <th>对手胜负差</th>
                                  <th>净胜局</th>
                                  <th>原种子</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {u.standings.map((r: any) => (
                              <tr key={r.entrantId}>
                                <td>
                                  {r.rank ??
                                    (r.qualification
                                      ? "晋级"
                                      : u.status === "completed"
                                        ? "淘汰"
                                        : "—")}
                                  {r.rank !== undefined &&
                                    u.qualified?.length > 1 &&
                                    u.status === "completed" &&
                                    (r.qualification ? " · 晋级" : " · 淘汰")}
                                </td>
                                <td>
                                  {
                                    data.runtime.roster.find(
                                      (e: any) => e.entrantId === r.entrantId,
                                    )?.name
                                  }
                                  {r.opponents && (
                                    <details>
                                      <summary>小分来源</summary>
                                      <p>
                                        轮空次数：{r.byeCount}
                                        ，轮空的小分贡献为0。
                                      </p>
                                      <ul>
                                        {r.opponents.map(
                                          (id: string, i: number) => {
                                            const opponent = u.standings.find(
                                              (other: any) =>
                                                other.entrantId === id,
                                            );
                                            return (
                                              <li key={i}>
                                                {
                                                  data.runtime.roster.find(
                                                    (e: any) =>
                                                      e.entrantId === id,
                                                  )?.name
                                                }
                                                ：积分{opponent.points}，战绩
                                                {opponent.wins}胜
                                                {opponent.losses}负。
                                              </li>
                                            );
                                          },
                                        )}
                                      </ul>
                                    </details>
                                  )}
                                </td>
                                <td>
                                  {r.wins}/{r.losses}/{r.draws}
                                </td>
                                {[
                                  "round-robin",
                                  "double-round-robin",
                                  "fixed-swiss",
                                  "threshold-swiss",
                                ].includes(u.format) && <td>{r.points}</td>}
                                {["fixed-swiss", "threshold-swiss"].includes(
                                  u.format,
                                ) && (
                                  <>
                                    <td>{r.bhPoints}</td>
                                    <td>{r.ds}</td>
                                    <td>{r.netGames}</td>
                                    <td>{r.initialSeed}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {u.status === "completed" &&
                          (!u.qualified || u.qualified.length === 1) &&
                          u.standings.some((r: any) => r.rank === 1) &&
                          !data.runtime.structure.routes.some(
                            (r: any) =>
                              r.source.stageId === u.stageId ||
                              r.source.groupId === u.id,
                          ) && (
                            <p className="winner">
                              冠军：
                              {
                                data.runtime.roster.find(
                                  (e: any) =>
                                    e.entrantId ===
                                    u.standings.find((r: any) => r.rank === 1)
                                      .entrantId,
                                )?.name
                              }
                            </p>
                          )}
                      </div>
                    )}
                    {u.status === "ranking-blocked" &&
                      !isTiCandidate(u) &&
                      data.permissions["rounds.confirm"] && (
                        <RankingDecision
                          key={u.id}
                          u={u}
                          data={data}
                          base={base}
                          onSaved={state.reload}
                        />
                      )}
                    {kind !== "standings" &&
                      u.rounds.map((round: any) => (
                        <section className="round-block" key={round.id}>
                          <header className="title-row">
                            <h4>
                              {round.phase === "elimination"
                                ? "附加淘汰赛"
                                : `第 ${round.number} 轮`}{" "}
                              ·{" "}
                              {round.confirmed
                                ? "已锁定"
                                : u.rounds.find((r: any) => !r.confirmed)
                                      ?.id === round.id
                                  ? "当前轮"
                                  : "待开始"}
                            </h4>
                            {!round.confirmed &&
                              u.rounds.find((r: any) => !r.confirmed)?.id ===
                                round.id &&
                              data.permissions["rounds.confirm"] &&
                              (isTiCandidate(u) ? (
                                <TiRoundConfirmation
                                  u={u}
                                  round={round}
                                  data={data}
                                  base={base}
                                  onSaved={state.reload}
                                />
                              ) : (
                                <button
                                  className="primary"
                                  disabled={
                                    write.busy ||
                                    round.matches.some((m: any) => !m.decision)
                                  }
                                  onClick={async () => {
                                    if (
                                      window.confirm(
                                        "确认整轮后全部赛果永久锁定，并产生下一轮。确认推进？",
                                      )
                                    ) {
                                      const r = await write.run(
                                        base +
                                          "/rounds/" +
                                          round.id +
                                          "/confirm",
                                        "POST",
                                        { expectedVersion: data.version },
                                      );
                                      if (r) state.reload();
                                    }
                                  }}
                                >
                                  确认整轮并推进
                                </button>
                              ))}
                          </header>
                          {round.pairing?.decision && (
                            <p>人工配对裁定：{round.pairing.decision.reason}</p>
                          )}
                          <div className="match-grid">
                            {round.matches.map((m: any) => (
                              <MatchCard
                                key={m.id}
                                m={m}
                                u={u}
                                round={round}
                                data={data}
                                base={base}
                                onSaved={state.reload}
                              />
                            ))}
                          </div>
                          {round.rest?.length > 0 && (
                            <p>
                              本轮休赛：
                              {round.rest
                                .map(
                                  (id: string) =>
                                    data.runtime.roster.find(
                                      (e: any) => e.entrantId === id,
                                    )?.name,
                                )
                                .join("、")}
                              （不计胜场与积分）
                            </p>
                          )}
                        </section>
                      ))}
                  </section>
                ))}
              </>
            )}
          </>
        )}
      </Resource>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? state.reload
              : async () => {
                  const r = await write.retry();
                  if (r) state.reload();
                }
          }
        />
      )}
    </section>
  );
}
