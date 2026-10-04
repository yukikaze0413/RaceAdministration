'use strict';
const {ConfigurationError}=require('../domain/structure');
function createMemoryStore({beforeCommit=async()=>{}}={}) {
 const tournaments=new Map(),tails=new Map();
 const empty=()=>({configurations:new Map(),snapshots:new Map(),requests:new Map()});
 return {
  async read(tournamentId){return structuredClone(tournaments.get(tournamentId)||empty());},
  async transaction(tournamentId,operation) {
   const prior=tails.get(tournamentId)||Promise.resolve();
   let release;const gate=new Promise(resolve=>release=resolve);
   const tail=prior.then(()=>gate);tails.set(tournamentId,tail);
   await prior;
   try {
    const candidate=structuredClone(tournaments.get(tournamentId)||empty());
    const result=await operation(candidate);
    try {for(const step of ['snapshot','configuration','idempotency'])await beforeCommit(candidate,step);}catch{throw new ConfigurationError('STORE_FAILURE','仓库提交失败');}
    let committed,response;
    try {committed=structuredClone(candidate);response=structuredClone(result);}catch {throw new ConfigurationError('STORE_FAILURE','仓库数据或响应无法复制');}
    tournaments.set(tournamentId,committed);
    return response;
   } finally {release();if(tails.get(tournamentId)===tail)tails.delete(tournamentId);}
  }
 };
}
module.exports={createMemoryStore};
