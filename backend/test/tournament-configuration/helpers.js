'use strict';
const { createService }=require('../../src/tournament-configuration/application/service');
const draft=()=>({entrantKind:'individual',structureVersion:'structure-v1',routingVersion:'routing-v1',
 stages:[{id:'A',order:1,capacity:4,formatIntent:'fixed-swiss',groups:[]}],pools:[],routes:[]});
function setup() {
 const grants=new Map([['admin:T',new Set(['view','configure'])],['viewer:T',new Set(['view'])]]);
 const authorize=(ctx,t,action)=>grants.get(ctx.actorId+':'+t)?.has(action)===true;
 return {service:createService({authorize}),grants,ctx:{actorId:'admin'},viewer:{actorId:'viewer'}};
}
const command=(ctx,payload,key='create')=>({trustedContext:ctx,tournamentId:'T',requestKey:key,payload});
module.exports={draft,setup,command};
