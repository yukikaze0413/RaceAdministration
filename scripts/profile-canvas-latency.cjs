"use strict";
const { resolve } = require("node:path");
const { writeFileSync, mkdirSync, existsSync } = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { chromium } = require("../frontend/node_modules/playwright");
const { createApp } = require("../backend/src/app");
const { listenTestServer } = require("../backend/test/helpers/http-listener");
const G = require("../backend/src/planning-canvas/graph");
function fixture(copies) {
  const base = G.sample("single"), graph = {schemaVersion:"canvas",nodes:[],edges:[],stages:[{id:"stage-all",name:"Stage",order:1,nodeIds:[]}]};
  for (let i = 0; i < copies; i++) {
    const ids = new Set([...base.nodes,...base.edges].map(x => x.id));
    const copy = (x,key) => Array.isArray(x) ? x.map(v=>copy(v,key)) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v,k)])) : typeof x === "string" && ["id","node","nodeIds","parentId","matchKey"].includes(key) && ids.has(x) ? "g"+i+"_"+x : x;
    const part = copy(base);
    for (const n of part.nodes) if (n.kind === "source") for (const seat of n.params.seats) seat.ref = "g"+i+"_"+seat.ref;
    graph.nodes.push(...part.nodes); graph.edges.push(...part.edges); graph.stages[0].nodeIds.push(...part.stages[0].nodeIds);
  }
  return graph;
}
module.exports = {fixture};
if (require.main === module) (async () => {
  const origins = [], platform = createApp({databasePath:":memory:",frontendPath:resolve(__dirname,"../frontend/dist"),origins});
  let browser, server;
  const results = [];
  try {
    server = await listenTestServer(platform.app);
    const base = "http://127.0.0.1:" + server.address().port; origins.push(base);
    browser = await chromium.launch({channel:"msedge",headless:true});
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    page.setDefaultTimeout(15000);
    for (const action of ["register","login"]) {
      const response = await page.request.post(base+"/api/v1/auth/"+action,{headers:{Origin:base},data:{username:"canvas_latency",password:"test",...(action==="register"?{displayName:"性能验收"}:{})}});
      if (!response.ok()) throw Error("Test authentication failed");
    }
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    const requests = [];
    await page.route(/\/planning-canvas\/(edit|analyze|migrate)/, async route => {requests.push(route.request().url());await route.abort();});
    const fixtures = [4,16].map(count=>({source:"synthetic",graph:fixture(count),threshold:count===4?100:150}));
    const databasePath = resolve(__dirname,"../output/local-preview/canvas-lab.sqlite");
    const skipped = [];
    if (existsSync(databasePath)) {
      const source = new DatabaseSync(databasePath,{readOnly:true});
      try {
        for (const [index,row] of source.prepare("SELECT graph FROM planning_canvases ORDER BY rowid DESC").all().entries()) {
          try { fixtures.push({source:"saved-copy-"+index,graph:G.parse(JSON.parse(row.graph)),threshold:100}); }
          catch (error) { skipped.push({source:"saved-copy-"+index,reason:error.code ?? "INVALID_GRAPH"}); }
        }
      } finally { source.close(); }
    }
    for (const [fixtureIndex,entry] of fixtures.entries()) for (const network of ["local","simulated"]) {
      await client.send("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
      const graph = entry.graph, response = await page.request.post(base+"/api/v1/planning-canvases",{headers:{Origin:base,"Idempotency-Key":"perf-"+fixtureIndex+network},data:{name:"Perf",graph}});
      if (!response.ok()) throw Error(await response.text());
      const saved = (await response.json()).data;
      const visibleNodes = graph.nodes.filter(node => !node.parentId).length;
      await page.goto(base+"/canvas-lab?canvas="+saved.id);
      await page.waitForFunction(n=>document.querySelectorAll("[data-canvas-node]").length===n,visibleNodes);
      if (network === "simulated") await client.send("Network.emulateNetworkConditions",{offline:false,latency:100,downloadThroughput:125000,uploadThroughput:125000,connectionType:"wifi"});
      const runs = [];
      for (let index = 0; index < 33; index++) {
        const run = await page.evaluate(() => new Promise((resolve,reject) => {
          const button = [...document.querySelectorAll(".canvas-palette button")].find(b=>b.textContent.trim()==="Match");
          const before = document.querySelectorAll("[data-canvas-node]").length, start = performance.now();
          let handler = 0;
          const timeout = setTimeout(()=>{observer.disconnect();reject(Error("Node did not appear"));},10000);
          const observer = new MutationObserver(()=>{if(document.querySelectorAll("[data-canvas-node]").length>before){const dom=performance.now();observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve({handler_ms:handler,network_ms:0,dom_ms:dom-start,paint_proxy_ms:performance.now()-start});}));}});
          observer.observe(document.querySelector(".canvas-lab"),{subtree:true,childList:true});button.click();handler=performance.now()-start;
        }));
        if (index >= 3) runs.push(run);
        await page.getByRole("button",{name:"撤销",exact:true}).click();
        await page.waitForFunction(n=>document.querySelectorAll("[data-canvas-node]").length===n,visibleNodes);
      }
      const sorted = runs.map(r=>r.paint_proxy_ms).sort((a,b)=>a-b), p95 = sorted[Math.ceil(sorted.length*0.95)-1];
      const result = {source:entry.source,network,nodes:graph.nodes.length,visible_nodes:visibleNodes,edges:graph.edges.length,samples:runs.length,p95_ms:p95,threshold_ms:entry.threshold,pass:p95<=entry.threshold,runs};
      results.push(result); console.log(JSON.stringify({...result,runs:undefined}));
    }
    const report = {date:new Date().toISOString(),browser:browser.version(),platform:process.platform,viewport:{width:1440,height:1000},measurement:"DOM insertion followed by two requestAnimationFrame callbacks; not physical screen scanout",simulated:{latency_ms:100,download_bytes_per_second:125000,upload_bytes_per_second:125000},ordinary_edit_requests:requests.length,skipped,results};
    mkdirSync(resolve(__dirname,"../output/playwright"),{recursive:true});
    writeFileSync(resolve(__dirname,"../output/playwright/canvas-local-latency.json"),JSON.stringify(report,null,2));
    if(requests.length || results.some(r=>!r.pass)) process.exitCode=1;
  } finally {if(browser)await browser.close();if(server)await new Promise(done=>server.close(done));platform.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
