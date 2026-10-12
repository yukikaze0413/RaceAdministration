'use strict';
const FORMATS = ['single-elimination','double-elimination','round-robin','double-round-robin','fixed-swiss','major-like'];
const SORT_FIELDS = ['sourcePriority','sourceRank','initialSeed','poolSeed','wins','losses','points'];
class ConfigurationError extends Error {
 constructor(code, message, diagnostics=[]) { super(message); this.code=code; this.diagnostics=diagnostics; }
}
function diagnostic(code,path,reason, objectId, severity='error',details={},routeId) {
 return {code,severity,objectId:objectId??null,...(routeId?{routeId}:{}),path,reason,details};
}
function fail(path,reason,id) { throw new ConfigurationError('INVALID_INPUT',reason,[diagnostic('INVALID_INPUT',path,reason,id)]); }
function object(value,keys,path) {
 if(!value || typeof value!=='object'||Array.isArray(value)) fail(path,'必须为对象');
 for(const key of Object.keys(value)) if(!keys.includes(key)) fail(path+'/'+key,'未知字段');
}
function text(value,path) { if(typeof value!=='string'||!value.trim()) fail(path,'必须为非空标识'); }
function integer(value,path,optional=true,min=1) {
 if(optional && value==null) return;
 if(!Number.isSafeInteger(value)||value<min) fail(path,'整数超出允许范围');
}
function array(value,path) { if(!Array.isArray(value)) fail(path,'必须为数组'); }
function parseSort(sort,path) {
 if(sort==null)return;
 array(sort,path);
 sort.forEach((s,i)=>{
  object(s,['field','direction','sources'],path+'/'+i);
  if(!SORT_FIELDS.includes(s.field)) fail(path+'/'+i+'/field','未知排序字段');
  if(!['asc','desc'].includes(s.direction)) fail(path+'/'+i+'/direction','必须指定asc或desc');
  if(s.sources!=null){array(s.sources,path+'/'+i+'/sources');s.sources.forEach((x,j)=>text(x,path+'/'+i+'/sources/'+j));}
 });
}
function parseStructure(payload,tournamentId) {
 object(payload,['entrantKind','structureVersion','routingVersion','templateOrigin','stages','pools','routes'],'');
 if(payload.structureVersion==='structure-v2')return require('./structure-v2').parseStructureV2(payload,tournamentId);
 if(payload.entrantKind!=='individual')fail('/entrantKind','仅支持个人');
 if(payload.structureVersion!=='structure-v1')fail('/structureVersion','未知结构版本');
 if(payload.routingVersion!=='routing-v1')fail('/routingVersion','未知路由版本');
 if(payload.templateOrigin!=null) {object(payload.templateOrigin,['id','version'],'/templateOrigin');text(payload.templateOrigin.id,'/templateOrigin/id');text(payload.templateOrigin.version,'/templateOrigin/version');}
 const ids=new Set(), stages=new Map(),groups=new Map(),pools=new Set();
 const id=(o,p)=>{text(o.id,p+'/id');if(ids.has(o.id))fail(p+'/id','重复对象ID',o.id);ids.add(o.id);};
 const owner=(o,p)=>{if(o.tournamentId!=null&&o.tournamentId!==tournamentId)fail(p+'/tournamentId','跨赛事对象',o.id);};
 for(const key of ['stages','pools','routes']) array(payload[key],'/'+key);
 payload.stages.forEach((s,i)=>{
  const p='/stages/'+i;object(s,['id','tournamentId','order','capacity','formatIntent','groups'],p);id(s,p);owner(s,p);
  integer(s.order,p+'/order');integer(s.capacity,p+'/capacity');
  if(s.formatIntent!=null&&!FORMATS.includes(s.formatIntent))fail(p+'/formatIntent','未知赛制意图',s.id);
  array(s.groups,p+'/groups'); stages.set(s.id,s);
  s.groups.forEach((g,j)=>{const q=p+'/groups/'+j;object(g,['id','tournamentId','stageId','capacity'],q);id(g,q);owner(g,q);
   if(g.stageId!==s.id)fail(q+'/stageId','小组归属错误',g.id);integer(g.capacity,q+'/capacity');groups.set(g.id,s.id);});
 });
 payload.pools.forEach((pool,i)=>{const p='/pools/'+i;object(pool,['id','tournamentId','capacity','sort'],p);id(pool,p);owner(pool,p);
 integer(pool.capacity,p+'/capacity');parseSort(pool.sort,p+'/sort');pools.add(pool.id);});
 const reference=(ref,p)=>{
  object(ref,['stageId','groupId','poolId'],p);
  if(ref.poolId!=null) {text(ref.poolId,p+'/poolId');if(!pools.has(ref.poolId)||ref.stageId!=null||ref.groupId!=null)fail(p,'非法池引用');}
  else {text(ref.stageId,p+'/stageId');if(!stages.has(ref.stageId))fail(p+'/stageId','阶段引用不存在');
   if(ref.groupId!=null&&groups.get(ref.groupId)!==ref.stageId)fail(p+'/groupId','小组引用归属错误');}
 };
 payload.routes.forEach((r,i)=>{
  const p='/routes/'+i;object(r,['id','tournamentId','source','target','selector','quota','sort','placement'],p);id(r,p);owner(r,p);
  reference(r.source,p+'/source');reference(r.target,p+'/target');integer(r.quota,p+'/quota');parseSort(r.sort,p+'/sort');
  if(r.selector!=null){object(r.selector,['kind','from','to','wins','losses','draws'],p+'/selector');
   if(!['rankRange','recordEquals','all'].includes(r.selector.kind))fail(p+'/selector/kind','未知筛选');
   const allowed=r.selector.kind==='rankRange'?['kind','from','to']:r.selector.kind==='recordEquals'?['kind','wins','losses','draws']:['kind'];
   object(r.selector,allowed,p+'/selector');
   for(const k of allowed.filter(k=>k!=='kind'))integer(r.selector[k],p+'/selector/'+k,true,r.selector.kind==='rankRange'?1:0);
  }
  if(r.placement!=null){object(r.placement,['kind','positions'],p+'/placement');
   if(!['seed','slot'].includes(r.placement.kind))fail(p+'/placement/kind','未知位置类型');
   array(r.placement.positions,p+'/placement/positions');r.placement.positions.forEach((v,j)=>integer(v,p+'/placement/positions/'+j,false));}
 });
 return structuredClone(payload);
}
module.exports = { parseStructure,parseSort,FORMATS,SORT_FIELDS,ConfigurationError,diagnostic,fail,object,text,integer,array };
