"use strict";
// 只读公开来源；保存原始字节和读取元数据，不写平台SQLite。
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(
  __dirname,
  "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/reference-sources",
);
const sources = [
  {
    id: "valve-cologne-may4-live",
    url: "https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/live/2026/standings_global_2026_05_04.md",
    version: "git-blob:32a9a4a31b2119916881cbfb5ebbb17fa50a6570",
    meaning:
      "公开contents/live/2026实际清单中的May4 live排名。Stage1 actual roster过滤后固定1v9…8v16全对应；候选pre-event snapshot，仍需ESL采用日期和后阶段继承核对。重名NRG两个阵容不可按名字合并。",
  },
  {
    id: "hltv-cologne-stage1",
    url: "https://www.hltv.org/events/9028/iem-cologne-major-2026-stage-1",
    meaning:
      "第二方历史Stage1名单/赛果/日期；当前排名不是初始seed，BO1图内13等为地图回合比分。",
  },
  {
    id: "hltv-cologne-stage2",
    url: "https://www.hltv.org/events/9029/iem-cologne-major-2026-stage-2",
    meaning:
      "第二方历史Stage2名单/赛果/日期；直邀集合差标推断，不当官方邀请seed。",
  },
  {
    id: "hltv-cologne-stage3",
    url: "https://www.hltv.org/events/8301/iem-cologne-major-2026",
    meaning: "第二方Stage3/淘汰赛历史赛果；需与官方最终排名交叉核对。",
  },
  {
    id: "hltv-cologne-opening",
    url: "https://www.hltv.org/news/44679/iem-cologne-major-stage-1-opening-matchups-announced",
    meaning:
      "2026-05-21报道ESL首轮配对；原文明确时间/顺序provisional，绝不写actualStartedAt。NRG ninth seed为单项报道，不补齐其他seed。",
  },
  {
    id: "ti2026-official-rules-page",
    url: "https://www.dota2.com/esports/ti15/tirules?l=english",
    meaning:
      "官方TI15规则入口，渲染标题The International 2026。原始HTML为客户端页面；正文另保存人工核验DOM转录，不把空HTML当作完整规则。页面没有公布配对优化的确定性数学算法。",
  },
  {
    id: "valve-major-before-cologne",
    url: "https://raw.githubusercontent.com/ValveSoftware/counter-strike_rules_and_regs/a22f91da503d3afc00045fdad339bc6a3cd19c98/major-supplemental-rulebook.md",
    version: "a22f91da503d3afc00045fdad339bc6a3cd19c98",
    meaning:
      "GitHub文件历史中2026-06-02前最后提交；2025-08-05。仍需赛事补充规则与官方调整证据。",
  },
  {
    id: "valve-cologne-file-history",
    url: "https://api.github.com/repos/ValveSoftware/counter-strike_rules_and_regs/commits?path=major-supplemental-rulebook.md&until=2026-06-02T00:00:00Z&per_page=3",
    meaning: "赛事前历史版本的查询证据，不将未合并PR41视作已适用规则。",
  },
  {
    id: "valve-april-vrs",
    url: "https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/invitation/2026/standings_global_2026_04_06.md",
    meaning:
      "邀请排名原始表；不是直接等同32参赛队的赛事入口/最终种子。内容hash固定本次快照。",
  },
  {
    id: "esl-cologne-stage3",
    url: "https://pro.eslgaming.com/tour/2026/02/iem-cologne-2026-stage-3-update/",
    meaning: "Stage3全BO3与阶段预计日期；不可转成逐场actualStartedAt。",
  },
  {
    id: "esl-cologne2026-final",
    url: "https://pro.eslgaming.com/tour/cs/cologne2026/",
    meaning:
      "ESL固定2026赛事页的32最终名次；通用/cs/COLOGNE/已变为2027，不再用作2026来源。该页非逐场完整比分/入口seed。",
  },
  {
    id: "ti2026-official-steam",
    url: "https://store.steampowered.com/oldnews/?appgroupname=Dota..&appids=570&feed=steam_community_announcements",
    meaning:
      "官方2026公告原文：四胜/四负、十队附加淘汰、八队双败/BO5。汇总页动态，固定此读取内容hash；完整同分/选种与附加淘汰映射仍缺。",
  },
  {
    id: "ti2026-valve-league",
    filename: "ti2026-valve-league.json",
    url: "https://www.dota2.com/webapi/IDOTA2League/GetLeagueData/v001?league_id=19719&delay_seconds=0",
    meaning:
      "Valve官方TI15赛程页面脚本使用的只读联赛数据接口；含node_groups、历史系列比分、scheduled_time与actual_time。需逐场及规则含义核验。",
  },
  {
    id: "ti2026-cn-schedule",
    filename: "ti2026-cn-schedule.json",
    url: "https://www.dota2.com.cn/international2026/getMatchScheduleGrouped?schedule_key=ti2026&swiss_format=ti_road",
    meaning:
      "完美世界官方2026专题脚本使用的数据接口，58系列及阶段分组；名字可能是赛后当前别名，需与Valve历史数据交叉核对。matchTime未明确实际/预计。",
  },
];
async function capture() {
  fs.mkdirSync(root, { recursive: true });
  const manifestPath = path.join(root, "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).sources
    : [];
  const unavailableSources = sources
    .filter((s) => new URL(s.url).hostname === "www.hltv.org")
    .map((s) => ({
      ...s,
      status: "not-frozen",
      reason:
        "Ordinary Stage1 request returned HTTP 403 on 2026-10-10. Further automatic requests to this domain are skipped; no bypass attempted.",
      attempted: s.id === "hltv-cologne-stage1",
    }));
  for (const source of sources) {
    if (new URL(source.url).hostname === "www.hltv.org") continue;
    // 已冻结来源不可被一次重新抓取静默覆盖。
    if (manifest.some((s) => s.id === source.id)) continue;
    const response = await fetch(source.url, {
      headers: { "User-Agent": "RaceAdministration-evidence" },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(source.id + " HTTP " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer()),
      filename =
        source.filename ??
        source.id +
          (source.url.includes("api.github")
            ? ".json"
            : source.url.includes(".md")
              ? ".md"
              : ".html");
    fs.writeFileSync(path.join(root, filename), bytes);
    manifest.push({
      ...source,
      filename,
      status: response.status,
      finalUrl: response.url,
      readAt: new Date().toISOString(),
      contentType: response.headers.get("content-type"),
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    });
    process.stdout.write(source.id + " " + bytes.length + " bytes\n");
  }
  fs.writeFileSync(
    path.join(root, "manifest.json"),
    JSON.stringify(
      {
        status: "pending",
        reason: "已冻结部分原始来源，未满足RC1全部规则/名单/逐场历史数据门槛",
        sources: manifest,
        unavailableSources,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}
capture().catch((error) => {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
});
