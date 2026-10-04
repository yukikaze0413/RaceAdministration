'use strict';
const {createHash}=require('node:crypto');
const {ConfigurationError}=require('./structure');
function canonical(value) {
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 throw new ConfigurationError('INVALID_INPUT','请求包含非JSON值');
}
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
module.exports={canonical,digest};
