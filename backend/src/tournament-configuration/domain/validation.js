'use strict';
const {parseStructure,diagnostic}=require('./structure');
const sourceId=ref=>ref.poolId??ref.groupId??ref.stageId;
const nodeId=ref=>ref.poolId?'pool:'+ref.poolId:'stage:'+ref.stageId;
function stableDiagnostics(ds){return ds.sort((a,b)=>compare(a.path,b.path)||compare(a.code,b.code)||compare(a.routeId||'',b.routeId||''));}
function compare(a,b){return a<b?-1:a>b?1:0;}
function validateStructure(payload,tournamentId='T') {
 const diagnostics=[];let c;
 try{c=parseStructure(payload,tournamentId);}catch(e){return {structureValid:false,previewReady:false,runtimeReady:false,diagnostics:e.diagnostics};}
 const add=(code,path,reason,id,severity='error',details={},routeId)=>diagnostics.push(diagnostic(code,path,reason,id,severity,details,routeId));
 const required=(v,path,id)=>{if(v==null)add('CONFIG_REQUIRED',path,'缺少必需配置',id);};
 const stages=new Map(c.stages.map(s=>[s.id,s])),pools=new Map(c.pools.map(p=>[p.id,p]));
 const graph=new Map([...c.stages.map(s=>['stage:'+s.id,[]]),...c.pools.map(p=>['pool:'+p.id,[]])]);
 const orders=new Set();
 c.stages.forEach((s,i)=>{
  const p='/stages/'+i;add('FORMAT_RUNTIME_UNAVAILABLE',p+'/formatIntent','赛制仅描述意图，运行支持集为空',s.id,'info');for(const k of ['order','capacity','formatIntent'])required(s[k],p+'/'+k,s.id);
  if(orders.has(s.order))add('ORDER_INVALID',p+'/order','阶段次序重复',s.id);orders.add(s.order);
  s.groups.forEach((g,j)=>required(g.capacity,p+'/groups/'+j+'/capacity',g.id));
  if(s.groups.length&&s.groups.every(g=>g.capacity!=null)&&s.capacity!==s.groups.reduce((n,g)=>n+g.capacity,0))
   add('CAPACITY_MISMATCH',p+'/capacity','阶段容量必须等于各组容量之和',s.id);
 });
 function checkSort(sort,path,id,isPoolSource,upstream) {
  required(sort,path,id);if(!sort)return;
  if(!sort.length)add('SORT_REQUIRED',path,'排序不能为空',id);
  const fields=new Set();
  sort.forEach((s,j)=>{
   if(fields.has(s.field))add('SORT_INVALID',path+'/'+j,'排序字段重复',id);fields.add(s.field);
   if(s.field==='poolSeed'&&!isPoolSource)add('POOL_SEED_UNAVAILABLE',path+'/'+j,'只有池输出具有池种子',id);
   if(s.field==='sourcePriority'&&(!s.sources||new Set(s.sources).size!==s.sources.length||upstream.some(x=>!s.sources.includes(x))||s.sources.some(x=>!upstream.includes(x))))
    add('SOURCE_PRIORITY_INVALID',path+'/'+j+'/sources','来源优先级必须完整且唯一',id);
  });
 }
 const capacity=ref=>{
  if(ref.poolId)return pools.get(ref.poolId).capacity;
  const s=stages.get(ref.stageId);
  return ref.groupId?s.groups.find(g=>g.id===ref.groupId).capacity:s.capacity;
 };
 const targets=new Map(),sources=new Map();
 c.routes.forEach((r,i)=>{
  const p='/routes/'+i;
  for(const side of ['source','target']){
   const ref=r[side];if(ref.stageId&&stages.get(ref.stageId).groups.length&&!ref.groupId)
    add('GROUP_REQUIRED',p+'/'+side+'/groupId','分组阶段必须明确小组',r.id,'error',{},r.id);
  }
  graph.get(nodeId(r.source)).push(nodeId(r.target));
  if(!r.source.poolId)add('SOURCE_INPUT_REQUIRED',p+'/source','须提供已完成的模拟来源快照',r.id,'conditional',{sourceId:sourceId(r.source)});
  required(r.quota,p+'/quota',r.id);required(r.selector,p+'/selector',r.id);
  const sel=r.selector;
  if(sel){
   if(r.source.poolId?sel.kind!=='all':sel.kind==='all')add('SELECTOR_INVALID',p+'/selector','池仅用all，阶段必须用名次或战绩',r.id);
   const fields=sel.kind==='rankRange'?['from','to']:sel.kind==='recordEquals'?['wins','losses','draws']:[];
   for(const k of fields)required(sel[k],p+'/selector/'+k,r.id);
   if(sel.kind==='rankRange'&&sel.from>sel.to)add('SELECTOR_INVALID',p+'/selector','名次范围倒置',r.id);
  }
  const upstream=[sourceId(r.source)];
  checkSort(r.sort,p+'/sort',r.id,!!r.source.poolId,upstream);
  if(r.target.poolId){
   if(r.placement!=null)add('PLACEMENT_INVALID',p+'/placement','池输入不能有落位',r.id);
  }else{
   required(r.placement,p+'/placement',r.id);
   if(r.placement){
    if(r.placement.positions.length!==r.quota)add('PLACEMENT_COUNT',p+'/placement/positions','落位数量必须等于名额',r.id);
    r.placement.positions.forEach((v,j)=>{if(v>capacity(r.target))add('POSITION_INVALID',p+'/placement/positions/'+j,'落位超出目标容量',r.id);});
   }
  }
  const t=sourceId(r.target);if(!targets.has(t))targets.set(t,[]);targets.get(t).push({r,i});
  const s=sourceId(r.source);if(!sources.has(s))sources.set(s,[]);sources.get(s).push({r,i});
 });
 for(const entries of targets.values()){
  const first=entries[0],total=entries.reduce((n,{r})=>n+(r.quota??0),0);
  if(total>capacity(first.r.target))add('CAPACITY_EXCEEDED','/routes/'+first.i+'/target','输入总名额超过容量',sourceId(first.r.target),'error',{total,capacity:capacity(first.r.target)});
  const positions=new Set(),kinds=new Set();
  for(const {r,i}of entries)if(r.placement){
   kinds.add(r.placement.kind);
   r.placement.positions.forEach((v,j)=>{if(positions.has(v))add('POSITION_CONFLICT','/routes/'+i+'/placement/positions/'+j,'目标位置重复',r.id);positions.add(v);});
  }
  if(kinds.size>1)add('PLACEMENT_KIND_CONFLICT','/routes/'+first.i+'/placement/kind','同一目标不能混用种子与槽位',sourceId(first.r.target));
 }
 for(const entries of sources.values())for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++){
  const x=entries[a].r.selector,y=entries[b].r.selector;if(!x||!y)continue;
  const {r,i}=entries[b];let overlap=false;
  if(x.kind===y.kind)overlap=x.kind==='all'||(x.kind==='rankRange'?Math.max(x.from,y.from)<=Math.min(x.to,y.to):['wins','losses','draws'].every(k=>x[k]===y[k]));
  if(overlap)add('SELECTOR_OVERLAP','/routes/'+i+'/selector','同一来源的筛选可证明重叠',r.id);
  else if(x.kind!==y.kind)add('SELECTOR_INTERSECTION_UNKNOWN','/routes/'+i+'/selector','不同类型筛选须以未来输入复核',''+r.id,'conditional');
 }
 c.pools.forEach((pool,i)=>{
  const p='/pools/'+i;required(pool.capacity,p+'/capacity',pool.id);
  const incoming=c.routes.filter(r=>r.target.poolId===pool.id);
  if(!incoming.length)add('POOL_SOURCE_REQUIRED',p,'池必须有来源',pool.id);
  const upstream=[...new Set(incoming.map(r=>sourceId(r.source)))];
  checkSort(pool.sort,p+'/sort',pool.id,false,upstream);
 });
 const visited=new Set(),visiting=new Set(),stack=[];
 function walk(node){
  if(visiting.has(node)){add('DEPENDENCY_CYCLE','/routes','依赖形成循环',node,'error',{cycle:[...stack.slice(stack.indexOf(node)),node]});return;}
  if(visited.has(node))return;visiting.add(node);stack.push(node);
  for(const target of graph.get(node))walk(target);
  stack.pop();visiting.delete(node);visited.add(node);
 }
 for(const node of graph.keys())walk(node);
 // 每个阶段沿池链到达的后续阶段都必须拥有更大的order。
 for(const s of c.stages){
  const seen=new Set();
  function orderCheck(node){
   if(seen.has(node))return;seen.add(node);
   for(const next of graph.get(node)){
    if(next.startsWith('stage:')){
     const t=stages.get(next.slice(6));
     if(!(s.order<t.order))add('ORDER_INVALID','/stages/'+c.stages.indexOf(t)+'/order','上游阶段必须早于下游阶段',t.id,'error',{source:s.id});
    }else orderCheck(next);
   }
  }
  orderCheck('stage:'+s.id);
 }
 return {structureValid:!diagnostics.some(d=>d.severity==='error'),previewReady:false,runtimeReady:false,diagnostics:stableDiagnostics(diagnostics)};
}
module.exports={validateStructure,stableDiagnostics,sourceId,nodeId,compare};
