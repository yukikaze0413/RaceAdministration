'use strict';
const {randomUUID}=require('node:crypto');
const {parseStructure,ConfigurationError}=require('../domain/structure');
const {digest}=require('../domain/canonical');
const {instantiate}=require('../domain/templates');
const {validateStructure}=require('../domain/validation');
const {previewRouting}=require('../domain/routing');
const {createMemoryStore}=require('../adapters/memory-store');
function structureOf(c){const {id,tournamentId,version,state,snapshot,...payload}=c;return payload;}
function createService({authorize,store=createMemoryStore()}={}) {
 async function permission(p,action){
  if(!p||typeof p.tournamentId!=='string'||!p.tournamentId.trim()||typeof p.trustedContext?.actorId!=='string'||!p.trustedContext.actorId.trim()||!authorize||await authorize(p.trustedContext,p.tournamentId,action)!==true)
   throw new ConfigurationError('FORBIDDEN','没有本赛事操作权限');
 }
 function find(state,p){
  const c=state.configurations.get(p.id);if(!c)throw new ConfigurationError('NOT_FOUND','未找到本赛事配置');return c;
 }
 function version(c,p){if(p.expectedVersion!==c.version)throw new ConfigurationError('VERSION_CONFLICT','配置版本已变化');}
 async function write(operation,p,build){
  await permission(p,'configure');
  if(typeof p.requestKey!=='string'||!p.requestKey.trim())throw new ConfigurationError('INVALID_INPUT','需要请求键');
  const fingerprint=digest({operation,id:p.id??null,expectedVersion:p.expectedVersion??null,payload:p.payload??null});
  const key=JSON.stringify([p.trustedContext.actorId,p.requestKey]);
  return store.transaction(p.tournamentId,state=>{
   const prior=state.requests.get(key);
   if(prior){if(prior.fingerprint!==fingerprint)throw new ConfigurationError('IDEMPOTENCY_CONFLICT','请求键已用于不同请求');return prior.result;}
   const result=build(state);state.requests.set(key,{fingerprint,result:structuredClone(result)});return result;
  });
 }
 function create(state,p,payload){
  const c={...payload,id:randomUUID(),tournamentId:p.tournamentId,version:1,state:'draft'};
  state.configurations.set(c.id,c);return c;
 }
 return {
  async createDraft(p){return write('createDraft',p,state=>create(state,p,parseStructure(p.payload,p.tournamentId)));},
  async instantiateTemplate(p){return write('instantiateTemplate',p,state=>create(state,p,instantiate(p.payload,p.tournamentId)));},
  async getConfiguration(p){await permission(p,'view');return structuredClone(find(await store.read(p.tournamentId),p));},
  async replaceDraft(p){return write('replaceDraft',p,state=>{
   const c=find(state,p);version(c,p);
   if(c.state!=='draft')throw new ConfigurationError('STRUCTURE_FROZEN','结构不可修改或解冻');
   const payload=parseStructure(p.payload,p.tournamentId);
   const next={...payload,id:c.id,tournamentId:c.tournamentId,version:c.version+1,state:'draft'};
   state.configurations.set(c.id,next);return next;
  });},
  async freezeStructure(p){return write('freezeStructure',p,state=>{
   const c=find(state,p);version(c,p);
   if(c.state!=='draft')throw new ConfigurationError('STRUCTURE_FROZEN','结构不可修改或解冻');
   const structure=structureOf(c),report=validateStructure(structure,c.tournamentId);
   if(!report.structureValid)throw new ConfigurationError('CONFIG_INVALID','结构校验失败',report.diagnostics);
   const snapshot={snapshotId:randomUUID(),configurationId:c.id,frozenFromVersion:c.version,version:c.version+1,
    structure,diagnostics:report.diagnostics,digest:digest(structure),frozenAt:new Date().toISOString(),
    frozenBy:p.trustedContext.actorId,runtimeReady:false,started:false};
   state.snapshots.set(snapshot.snapshotId,snapshot);
   state.configurations.set(c.id,{...c,state:'structure-frozen',version:c.version+1,snapshot});return snapshot;
  });},
  async validateConfiguration(p){await permission(p,'view');const c=find(await store.read(p.tournamentId),p);version(c,p);
   return {configurationId:c.id,version:c.version,...(p.sources?previewRouting(structureOf(c),p.sources,c.tournamentId,p.targetIds):validateStructure(structureOf(c),c.tournamentId))};
  },
  async previewRouting(p){await permission(p,'view');const c=find(await store.read(p.tournamentId),p);version(c,p);
   return {configurationId:c.id,version:c.version,...previewRouting(structureOf(c),p.sources,c.tournamentId,p.targetIds)};
  },
  async requestRuntime(p){await permission(p,'view');find(await store.read(p.tournamentId),p);throw new ConfigurationError('RUN_NOT_SUPPORTED','本模块未实现赛制运行');}
 };
}
module.exports={createService};
