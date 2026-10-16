import { test, expect } from "./canvas-fixture";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app");
const { listenTestServer } = require("../../backend/test/helpers/http-listener");
const S = require("../../backend/src/planning-canvas/samples");
async function isolated(page: any, run: (base: string) => Promise<void>, graph = S.sample("empty")) {
  const origins: string[] = [], platform = createApp({ databasePath: ":memory:", frontendPath: resolve("dist"), origins });
  let server: any;
  try {
    server = await listenTestServer(platform.app);
    const base = "http://127.0.0.1:" + server.address().port; origins.push(base);
    for (const action of ["register", "login"]) expect((await page.request.post(base + "/api/v1/auth/" + action, { headers: { Origin: base }, data: { username: "local_editor", password: "test", ...(action === "register" ? { displayName: "本地编辑验收" } : {}) } })).ok()).toBeTruthy();
    const created = await page.request.post(base + "/api/v1/planning-canvases", {headers:{Origin:base,"Idempotency-Key":"fixture"},data:{name:"本地编辑",graph}});
    expect(created.ok()).toBeTruthy();
    const record = (await created.json()).data;
    await page.goto(base + "/canvas-lab?canvas=" + record.id);
    await expect(page.locator(".canvas-lab")).toBeVisible();
    await run(base);
  } finally { if (server) await new Promise<void>(done => server.close(done)); platform.close(); }
}
test("新增、属性、Stage、子图及撤销不请求编辑和分析接口", async ({ page }) => isolated(page, async () => {
  const calls: string[] = [];
  await page.route(/\/planning-canvas\/(edit|analyze|migrate)/, async route => { calls.push(route.request().url()); await route.abort(); });
  await page.locator(".canvas-palette").getByRole("button", {name:"Match",exact:true}).click();
  await expect(page.locator('[data-node-kind="match"]')).toHaveCount(1);
  const form = page.locator(".canvas-properties");
  await form.getByLabel("名称",{exact:true}).fill("本地 Match");
  await form.getByLabel("单场赛制",{exact:true}).selectOption("bo1");
  await page.getByRole("button",{name:"创建阶段",exact:true}).click();
  await expect(page.locator('[data-stage-id]')).toHaveCount(1);
  await page.getByRole("button",{name:"撤销",exact:true}).click();
  await expect(page.locator('[data-stage-id]')).toHaveCount(0);
  await page.getByRole("button",{name:"重做",exact:true}).click();
  await expect(page.locator('[data-stage-id]')).toHaveCount(1);
  await page.getByRole("button",{name:"编辑 本地 Match 参数",exact:true}).click();
  await page.getByRole("button",{name:"封装所选组件",exact:true}).click();
  await expect(page.locator('[data-node-kind="subgraph"]')).toHaveCount(1);
  await page.getByRole("button",{name:"编辑 子图 参数",exact:true}).click();
  await page.getByRole("button",{name:"展开所选子图",exact:true}).click();
  await expect(page.locator('[data-node-kind="match"]')).toHaveCount(1);
  expect(calls).toEqual([]);
  const saved = page.waitForResponse(r => r.request().method() === "PUT" && /\/planning-canvases\//.test(r.url()));
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()).data;
  expect(body.graph.nodes[0].name).toBe("本地 Match");
  expect(body.graph.nodes[0].params.matchFormat).toBe("bo1");
  for (const width of [1440,768,360]) {
    await page.setViewportSize({width,height:900});
    await expect(page.getByRole("button",{name:"保存草稿",exact:true})).toBeVisible();
    await page.screenshot({path:"../output/playwright/canvas-local-"+width+".png",fullPage:true});
  }
}));
test("乱序分析不能覆盖新增节点，分析失败不锁住编辑", async ({ page }) => isolated(page, async () => {
  let release!: () => void;
  const held = new Promise<void>(done => release = done);
  let reached!: () => void;
  const waiting = new Promise<void>(done => reached = done);
  await page.route("**/planning-canvas/analyze", async route => { const response = await route.fetch(); reached(); await held; await route.fulfill({response}); });
  await page.getByRole("button",{name:"分析草稿",exact:true}).click();
  await waiting;
  await page.locator(".canvas-palette").getByRole("button",{name:"Match",exact:true}).click();
  release();
  await expect(page.locator('[data-node-kind="match"]')).toHaveCount(1);
  await expect(page.getByLabel("草稿分析状态")).toHaveText("尚未分析");
  await page.unroute("**/planning-canvas/analyze");
  await page.route("**/planning-canvas/analyze", route => route.fulfill({status:503,json:{error:{code:"UNAVAILABLE",message:"分析暂不可用"},requestId:"test"}}));
  await page.getByRole("button",{name:"分析草稿",exact:true}).click();
  await expect(page.getByLabel("草稿分析状态")).toHaveText("草稿分析失败");
  await page.locator(".canvas-palette").getByRole("button",{name:"Match",exact:true}).click();
  await expect(page.locator('[data-node-kind="match"]')).toHaveCount(2);
}));
test("非法名称缓冲阻止保存，修正后保存最终值", async ({ page }) => isolated(page, async () => {
  await page.locator(".canvas-palette").getByRole("button",{name:"Match",exact:true}).click();
  const name = page.locator(".canvas-properties").getByLabel("名称",{exact:true});
  await name.fill("");
  let writes = 0;
  page.on("request", req => {if (req.method() === "PUT") writes++;});
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  expect(writes).toBe(0);
  await expect(name).toHaveValue("");
  await name.fill("最终名称");
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"草稿已保存"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"编辑 最终名称 参数",exact:true})).toBeAttached();
}));
test("临时空数值保留输入并阻止保存和切换", async ({ page }) => isolated(page, async () => {
  await page.locator(".canvas-palette").getByRole("button",{name:"取前 K 名",exact:true}).click();
  const count = page.locator(".canvas-properties").getByLabel("数量 K",{exact:true});
  await count.fill("");
  let writes=0; page.on("request",req=>{if(req.method()==="PUT")writes++;});
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  expect(writes).toBe(0);
  await expect(count).toHaveValue("");
  await count.fill("3");
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  await count.fill("");
  await page.getByRole("button",{name:"新建项目",exact:true}).click();
  await expect(count).toHaveValue("");
  await expect(page.locator('[data-node-kind="selector-top"]')).toHaveCount(1);
  await expect(page.getByRole("dialog",{name:"切换项目确认"})).toHaveCount(0);
}));

for (const action of ["撤销", "清空画布", "新建项目"]) test(`旧分析响应在${action}后不能恢复旧图`, async ({page}) => isolated(page,async()=>{
  await page.locator(".canvas-palette").getByRole("button",{name:"Match",exact:true}).click();
  let release!:()=>void, reached!:()=>void;
  const held=new Promise<void>(done=>release=done), waiting=new Promise<void>(done=>reached=done);
  await page.route("**/planning-canvas/analyze",async route=>{const response=await route.fetch();reached();await held;await route.fulfill({response});});
  await page.getByRole("button",{name:"分析草稿",exact:true}).click();
  await waiting;
  if(action==="清空画布") page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:action,exact:true}).click();
  if(action==="新建项目") await page.getByRole("button",{name:"舍弃修改并切换",exact:true}).click();
  await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
  const response=page.waitForResponse("**/planning-canvas/analyze");release();await response;
  await expect(page.getByLabel("草稿分析状态")).toHaveText("尚未分析");
  await expect(page.locator("[data-canvas-node]")).toHaveCount(0);
}));

test("分析到达保留未提交的空数值缓冲",async({page})=>isolated(page,async()=>{
  await page.locator(".canvas-palette").getByRole("button",{name:"取前 K 名",exact:true}).click();
  let release!:()=>void,reached!:()=>void;
  const held=new Promise<void>(done=>release=done),waiting=new Promise<void>(done=>reached=done);
  await page.route("**/planning-canvas/analyze",async route=>{const response=await route.fetch();reached();await held;await route.fulfill({response});});
  await page.getByRole("button",{name:"分析草稿",exact:true}).click();await waiting;
  const count=page.locator(".canvas-properties").getByLabel("数量 K",{exact:true});await count.fill("");
  release();await expect(page.getByLabel("草稿分析状态")).toHaveText("分析结果已更新");
  await expect(count).toHaveValue("");
  expect(await count.evaluate((input:HTMLInputElement)=>input.checkValidity())).toBe(false);
}));

test("身份失效的保存不能继续切换且保留本地草稿",async({page})=>isolated(page,async()=>{
  await page.locator(".canvas-palette").getByRole("button",{name:"Match",exact:true}).click();
  await page.route("**/api/v1/planning-canvases/*",async route=>{
    if(route.request().method()==="PUT") await route.fulfill({status:401,json:{error:{code:"AUTH_REQUIRED",message:"登录状态已失效",retryable:false},requestId:"test"}});
    else await route.continue();
  });
  await page.getByRole("button",{name:"新建项目",exact:true}).click();
  await page.getByRole("button",{name:"保存后切换",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("登录状态已失效");
  await expect(page.getByRole("dialog",{name:"切换项目确认"})).toBeVisible();
  await expect(page.locator('[data-node-kind="match"]')).toHaveCount(1);
  await page.getByRole("button",{name:"取消切换",exact:true}).click();
  await expect(page.getByRole("button",{name:"保存草稿",exact:true})).toBeEnabled();
  let writes=0;
  page.on("request",request=>{if(request.method()==="PUT")writes++;});
  await page.route("**/api/v1/auth/session",route=>route.fulfill({status:200,json:{data:{user:{id:"another-owner"}},requestId:"test"}}));
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("请使用原账号重新登录");
  expect(writes).toBe(0);
  await page.unroute("**/api/v1/auth/session");
  await page.unroute("**/api/v1/planning-canvases/*");
  await page.getByRole("button",{name:"保存草稿",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  expect(writes).toBe(1);
}));

const dragFixture=S.sample("single");
test("拖动一次撤销恢复节点和端口连线位置",async({page})=>isolated(page,async()=>{
  await page.getByRole("button",{name:"适应全图",exact:true}).click();
  const card=page.locator('[data-canvas-node="M1"]'),handle=card.locator(".canvas-drag");
  const edgeId=dragFixture.edges.find((edge:any)=>edge.from.node==="M1").id;
  const edge=page.locator(`[data-canvas-edge="${edgeId}"]`);
  const before=await card.getAttribute("style"),path=await edge.getAttribute("d"),box=(await handle.boundingBox())!;
  const center={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(center.x,center.y);await page.mouse.down();
  await page.mouse.move(center.x+60,center.y+40,{steps:12});await page.mouse.up();
  await expect(card).not.toHaveAttribute("style",before!);
  await expect(edge).not.toHaveAttribute("d",path!);
  await page.getByRole("button",{name:"撤销",exact:true}).click();
  await expect(card).toHaveAttribute("style",before!);
  await expect(edge).toHaveAttribute("d",path!);
},dragFixture));
