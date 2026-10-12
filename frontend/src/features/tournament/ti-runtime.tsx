import { useState } from "react";
import { Field, ErrorNotice } from "../../shared/ui";
import { useWrite } from "./write";
export const isTiCandidate = (u: any) =>
  u.ruleVersion === "ti2026-observed-candidate-v1";
export type TiGame = {
  winnerId: string;
  durationSeconds: number;
  matchId?: string;
};
export function TiGameFields({
  games,
  count,
  entrants,
  name,
  onChange,
}: {
  games: TiGame[];
  count: number;
  entrants: string[];
  name: (id: string) => string;
  onChange: (games: TiGame[]) => void;
}) {
  function change(i: number, patch: Partial<TiGame>) {
    onChange(
      Array.from({ length: count }, (_, j) => ({
        ...{ winnerId: "", durationSeconds: 0 },
        ...games[j],
        ...(i === j ? patch : {}),
      })),
    );
  }
  return (
    <fieldset className="parameter-nested">
      <legend>逐局赛果与时长</legend>
      <p>填写实际局胜者和时长；系列比分必须与逐局胜数一致。</p>
      {Array.from({ length: count }, (_, i) => (
        <div className="form-grid" key={i}>
          <Field label={`第${i + 1}局胜者`}>
            <select
              required
              value={games[i]?.winnerId ?? ""}
              onChange={(e) => change(i, { winnerId: e.target.value })}
            >
              <option value="">选择胜者</option>
              {entrants.map((id) => (
                <option key={id} value={id}>
                  {name(id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`第${i + 1}局时长（秒）`}>
            <input
              type="number"
              min={1}
              step={1}
              required
              value={games[i]?.durationSeconds || ""}
              onChange={(e) =>
                change(i, { durationSeconds: Number(e.target.value) })
              }
            />
          </Field>
        </div>
      ))}
    </fieldset>
  );
}
export function tiResultPayload(m: any, scores: number[], games: TiGame[]) {
  return {
    kind: "score",
    scores,
    seriesId: m.decision?.seriesId ?? m.id,
    games: games.slice(0, scores[0] + scores[1]).map((g, i) => ({
      matchId: g.matchId ?? `${m.id}/game/${i + 1}`,
      winnerId: g.winnerId,
      durationSeconds: g.durationSeconds,
    })),
  };
}
export function tiResultProblem(
  scores: number[],
  games: TiGame[],
  entrants: string[],
) {
  if (
    scores.length !== 2 ||
    scores.some((n) => !Number.isInteger(n) || n < 0 || n > 2) ||
    Math.max(...scores) !== 2 ||
    Math.min(...scores) >= 2
  )
    return "系列比分需符合BO3决胜规则。";
  const selected = games.slice(0, scores[0] + scores[1]);
  if (
    selected.length !== scores[0] + scores[1] ||
    selected.some(
      (g) =>
        !entrants.includes(g.winnerId) ||
        !Number.isSafeInteger(g.durationSeconds) ||
        g.durationSeconds <= 0,
    )
  )
    return "请完整填写每局胜者和正整数时长。";
  if (
    entrants.some(
      (id, i) => selected.filter((g) => g.winnerId === id).length !== scores[i],
    )
  )
    return "逐局胜数与系列比分不一致。";
  return null;
}
export function TiOpponentChoice({
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
  const [opponent, setOpponent] = useState(""),
    [reason, setReason] = useState(""),
    write = useWrite();
  const chooser = u.elimination.choosers[u.elimination.selections.length],
    available = u.elimination.opponents.filter(
      (o: any) =>
        !u.elimination.selections.some(
          (s: any) => s.entrantIds[1] === o.entrantId,
        ),
    );
  const name = (id: string) =>
    data.runtime.roster.find((r: any) => r.entrantId === id)?.name ??
    "未知参赛者";
  async function save() {
    if (!window.confirm("确认本次附加淘汰赛对手选择？")) return;
    const out = await write.run(
      base + "/units/" + u.id + "/ti-opponent",
      "POST",
      {
        expectedVersion: data.version,
        inputVersion: u.version,
        inputHash: u.inputHash,
        chooserId: chooser.entrantId,
        opponentId: opponent,
        reason,
      },
    );
    if (out) onSaved();
  }
  return (
    <section className="warning">
      <h4>附加淘汰赛对手选择</h4>
      <p>
        按最终瑞士排名，3–2队伍依次选择尚未分配的2–3对手。此选择允许此前已交手的对手。
      </p>
      <p>当前选择队伍：{name(chooser.entrantId)}</p>
      <p>已完成 {u.elimination.selections.length}/5 项选择</p>
      <Field label="附加赛对手">
        <select value={opponent} onChange={(e) => setOpponent(e.target.value)}>
          <option value="">选择剩余对手</option>
          {available.map((o: any) => (
            <option key={o.entrantId} value={o.entrantId}>
              {name(o.entrantId)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="选择原因">
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <button
        disabled={
          write.busy ||
          !reason.trim() ||
          !available.some((o: any) => o.entrantId === opponent)
        }
        onClick={() => void save()}
      >
        确认附加赛对手
      </button>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? onSaved : save}
        />
      )}
    </section>
  );
}
export function TiRoundConfirmation({
  u,
  round,
  data,
  base,
  onSaved,
}: {
  u: any;
  round: any;
  data: any;
  base: string;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(""),
    write = useWrite();
  async function save() {
    if (!window.confirm("确认整轮后全部赛果永久锁定。确认推进？")) return;
    const out = await write.run(`${base}/rounds/${round.id}/confirm`, "POST", {
      expectedVersion: data.version,
      inputVersion: u.version,
      inputHash: u.inputHash,
      reason,
    });
    if (out) onSaved();
  }
  return (
    <div>
      <Field label="TI整轮确认原因">
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <button
        className="primary"
        disabled={
          write.busy ||
          !reason.trim() ||
          round.matches.some((m: any) => !m.decision)
        }
        onClick={() => void save()}
      >
        确认整轮并推进
      </button>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? onSaved : save}
        />
      )}
    </div>
  );
}
export function TiStandings({ u, data }: { u: any; data: any }) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="TI瑞士战绩表"
      tabIndex={0}
    >
      <p>TI候选统计公式尚待官方核验。附加赛只决定资格，保留瑞士排名和小分。</p>
      <table className="swiss-standings">
        <caption>瑞士排名与晋级资格</caption>
        <thead>
          <tr>
            {[
              "瑞士名次",
              "参赛者",
              "胜/负",
              "对手胜场和",
              "小局胜率",
              "对手小局胜率",
              "平均局时长（秒）",
              "资格",
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {u.standings.map((r: any) => (
            <tr key={r.entrantId}>
              <td>{r.rank}</td>
              <td>
                {
                  data.runtime.roster.find(
                    (e: any) => e.entrantId === r.entrantId,
                  )?.name
                }
              </td>
              <td>
                {r.wins}/{r.losses}
              </td>
              <td>{r.opponentWins}</td>
              <td>
                {r.gameWinPercentage}%（{r.gameWins}/{r.gameCount}）
              </td>
              <td>{r.opponentGameWinPercentage}%</td>
              <td>{r.averageDuration}</td>
              <td>
                {r.qualification
                  ? `晋级第${r.qualification.index}位`
                  : u.status === "completed"
                    ? "淘汰"
                    : "待确定"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
