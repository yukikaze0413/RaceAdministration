'use strict';
const {object,text,integer,array,fail,diagnostic}=require('./structure');
const {validateStructure,stableDiagnostics,sourceId}=require('./validation');
function parseSources(input) {
 object(input,['roster','sourceSnapshots'],'/sources');array(input.roster,'/sources/roster');array(input.sourceSnapshots,'/sources/sourceSnapshots');
 const roster=new Map(),seeds=new Set(),snapshots=new Map();
 input.roster.forEach((r,i)=>{
  const p='/sources/roster/'+i;object(r,['entrantId','initialSeed','exitState'],p);text(r.entrantId,p+'/entrantId');integer(r.initialSeed,p+'/initialSeed',false);
  if(roster.has(r.entrantId)||seeds.has(r.initialSeed))fail(p,'参赛者与初始种子必须唯一');
  if(!['active','withdrawn','disqualified'].includes(r.exitState))fail(p+'/exitState','非法退出状态');
  seeds.add(r.initialSeed);roster.set(r.entrantId,r);
 });
 input.sourceSnapshots.forEach((s,i)=>{
  const p='/sources/sourceSnapshots/'+i;object(s,['sourceId','version','completed','rankingProfileId','recordProfileId','entries'],p);
  text(s.sourceId,p+'/sourceId');integer(s.version,p+'/version',false);if(typeof s.completed!=='boolean')fail(p+'/completed','必须声明完成状态');
  if(s.rankingProfileId!=null)text(s.rankingProfileId,p+'/rankingProfileId');if(s.recordProfileId!=null)text(s.recordProfileId,p+'/recordProfileId');
  if(snapshots.has(s.sourceId))fail(p+'/sourceId','来源快照重复');array(s.entries,p+'/entries');const ids=new Set();
  s.entries.forEach((e,j)=>{
   const q=p+'/entries/'+j;object(e,['entrantId','rank','wins','losses','draws','points'],q);text(e.entrantId,q+'/entrantId');
   if(!roster.has(e.entrantId)||ids.has(e.entrantId))fail(q+'/entrantId','未知或重复参赛者');
   integer(e.rank,q+'/rank',false);for(const k of ['wins','losses','draws'])integer(e[k],q+'/'+k,false,0);
   if(e.points!=null&&(typeof e.points!=='number'||!Number.isFinite(e.points)))fail(q+'/points','积分必须为有限数值');
   ids.add(e.entrantId);
  });
  snapshots.set(s.sourceId,{...s,path:p});
 });
 return {roster,snapshots};
}
function previewRouting(configuration,input,tournamentId='T',targetIds) {
 const report=validateStructure(configuration,tournamentId);
 const result={...report,allocations:[],excluded:[],inputVersions:[]};
 if(!report.structureValid)return result;
 let sources;
 let routes=configuration.routes;
 if(targetIds!=null){
  try{array(targetIds,'/targetIds');if(!targetIds.length)fail('/targetIds','目标不能为空');
   const valid=new Set([...configuration.stages.map(s=>s.id),...configuration.stages.flatMap(s=>s.groups.map(g=>g.id))]);
   targetIds.forEach((id,i)=>{text(id,'/targetIds/'+i);if(!valid.has(id))fail('/targetIds/'+i,'未知目标');});
  }catch(e){return {...result,diagnostics:stableDiagnostics([...report.diagnostics,...e.diagnostics])};}
  const needed=new Set();
  function include(r){if(needed.has(r.id))return;needed.add(r.id);
   if(r.source.poolId)for(const incoming of configuration.routes.filter(x=>x.target.poolId===r.source.poolId))include(incoming);
  }
  for(const r of configuration.routes)if(targetIds.includes(r.target.stageId)||targetIds.includes(r.target.groupId))include(r);
  routes=configuration.routes.filter(r=>needed.has(r.id));
 }
 try{sources=parseSources(input);}catch(e){result.previewReady=false;result.diagnostics=stableDiagnostics([...report.diagnostics,...e.diagnostics]);return result;}
 for(const r of routes)if(!r.source.poolId){
  const i=configuration.routes.indexOf(r);
  const id=sourceId(r.source),s=sources.snapshots.get(id);
  if(!s?.completed)result.diagnostics.push(diagnostic('SOURCE_NOT_READY','/routes/'+i+'/source','缺失或未完成来源',r.id,'error',{sourceId:id},r.id));
  else if(!result.inputVersions.some(v=>v.sourceId===id))result.inputVersions.push({sourceId:id,version:s.version});
 }
 result.inputVersions.sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0);
 if(!result.diagnostics.some(d=>d.severity==='error')){
  const pools=new Map(configuration.pools.map(p=>[p.id,p])),poolCache=new Map(),routeCache=new Map(),selectedBySource=new Map();
  function sortEntries(entries,sort,path,id){
   for(const field of sort.map(s=>s.field)){
    const profile=field==='points'?'rankingProfileId':['wins','losses'].includes(field)?'recordProfileId':null;
    if(profile&&entries.length&&(entries.some(e=>!e[profile])||new Set(entries.map(e=>e[profile])).size!==1)){
     result.diagnostics.push(diagnostic('ROUTING_UNRESOLVED',path,'来源成绩规则不可比或缺少规则标识',id));return null;
    }
   }
   const value=(e,s)=>s.field==='sourcePriority'?s.sources.indexOf(e.prioritySource??e.source):e[s.field];
   const compare=(a,b)=>{for(const s of sort){const av=value(a,s),bv=value(b,s);if(av!==bv)return (av<bv?-1:1)*(s.direction==='asc'?1:-1);}return 0;};
   if(entries.some(e=>sort.some(s=>!Number.isFinite(value(e,s))||(s.field==='sourcePriority'&&value(e,s)<0)))){
    result.diagnostics.push(diagnostic('ROUTING_UNRESOLVED',path,'缺少必需排序值',id));return null;
   }
   const sorted=[...entries].sort(compare);
   if(sorted.some((e,i)=>i>0&&compare(sorted[i-1],e)===0)){
    result.diagnostics.push(diagnostic('ROUTING_UNRESOLVED',path,'排序未形成全序',id));return null;
   }
   return sorted;
  }
  function selectRoute(r){
   if(routeCache.has(r.id))return routeCache.get(r.id);
   const path='/routes/'+configuration.routes.indexOf(r);
   const source=sourceId(r.source);
   let entries;
   if(r.source.poolId)entries=poolEntries(source);
   else{
    const snapshot=sources.snapshots.get(source);
    entries=snapshot.entries.map(e=>({...e,...sources.roster.get(e.entrantId),source,sourceRank:e.rank,
     rankingProfileId:snapshot.rankingProfileId,recordProfileId:snapshot.recordProfileId}));
   }
   if(entries===null)return null;
   const candidates=entries.filter(e=>r.selector.kind==='all'||(r.selector.kind==='rankRange'?
    e.rank>=r.selector.from&&e.rank<=r.selector.to:['wins','losses','draws'].every(k=>e[k]===r.selector[k])))
    .map(e=>({...e,prioritySource:source}));
   const sorted=sortEntries(candidates,r.sort,path+'/sort',r.id);
   if(sorted===null)return null;
   if(sorted.length<r.quota){result.diagnostics.push(diagnostic('ROUTING_UNRESOLVED',path+'/quota','实际名额不足',r.id));return null;}
   sorted.slice(r.quota).forEach(e=>result.excluded.push({routeId:r.id,entrantId:e.entrantId,reason:'QUOTA_EXCLUDED'}));
   const selected=sorted.slice(0,r.quota);
   const used=selectedBySource.get(source)||new Set();
   if(selected.some(e=>used.has(e.entrantId))){result.diagnostics.push(diagnostic('SELECTOR_OVERLAP',path+'/selector','来源筛选实际重复选入',r.id));return null;}
   selected.forEach(e=>used.add(e.entrantId));selectedBySource.set(source,used);
   routeCache.set(r.id,selected);return selected;
  }
  function poolEntries(id){
   if(poolCache.has(id))return poolCache.get(id);
   const pool=pools.get(id),path='/pools/'+configuration.pools.indexOf(pool);
   const entries=[];
   for(const r of configuration.routes.filter(r=>r.target.poolId===id)){
    const selected=selectRoute(r);if(selected===null)return null;entries.push(...selected);
   }
   if(new Set(entries.map(e=>e.entrantId)).size!==entries.length){
    result.diagnostics.push(diagnostic('DUPLICATE_ENTRANT',path,'池输入重复身份，不能静默去重',pool.id));return null;
   }
   if(entries.length>pool.capacity){result.diagnostics.push(diagnostic('CAPACITY_EXCEEDED',path+'/capacity','池全量输入超过容量',pool.id));return null;}
   const sorted=sortEntries(entries,pool.sort,path+'/sort',pool.id);
   if(sorted===null)return null;
   const seeded=sorted.map((e,i)=>({...e,poolSeed:i+1}));poolCache.set(id,seeded);return seeded;
  }
  for(const r of routes)if(!r.target.poolId){
   const selected=selectRoute(r);if(selected===null)continue;
   selected.forEach((e,i)=>result.allocations.push({
    entrantId:e.entrantId,exitState:e.exitState,source:e.source,sourceRank:e.sourceRank,initialSeed:e.initialSeed,
    ...(e.poolSeed!=null?{poolSeed:e.poolSeed}:{}),
    target:structuredClone(r.target),positionKind:r.placement.kind,value:r.placement.positions[i]
   }));
  }
 }
 const targetEntrants=new Set();
 for(const allocation of result.allocations){
  const key=JSON.stringify([allocation.target.stageId,allocation.entrantId]);
  if(targetEntrants.has(key))result.diagnostics.push(diagnostic('DUPLICATE_ENTRANT','/allocations','同一目标阶段出现重复参赛者',allocation.target.stageId));
  targetEntrants.add(key);
 }
 result.diagnostics=stableDiagnostics(result.diagnostics);
 result.previewReady=!result.diagnostics.some(d=>d.severity==='error');
 if(!result.previewReady){result.allocations=[];result.excluded=[];}
 return result;
}
module.exports={previewRouting,parseSources};
