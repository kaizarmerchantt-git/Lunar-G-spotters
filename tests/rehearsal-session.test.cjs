'use strict';
const assert=require('node:assert/strict'),Session=require('../src/rehearsal-session.js');
(async()=>{
 const pending=new Map(),seen=[];let requests=0;
 const s=new Session(i=>{requests++;return new Promise((resolve,reject)=>pending.set(i,{resolve,reject}));},v=>seen.push(v));
 const a=s.select(0),b=s.select(1);await Promise.resolve();pending.get(1).resolve('second');await b;pending.get(0).resolve('first');await a;
 assert.deepEqual(seen,['second'],'Late old coordinate must not replace current mesh');
 await s.select(0);assert.equal(seen.at(-1),'first');assert.equal(requests,2,'Validated payload is reused');
 const c=s.select(2);s.cancel();await Promise.resolve();pending.get(2).resolve('cancelled');await c;assert.equal(seen.at(-1),'first');
 const d=s.select(3);await Promise.resolve();pending.get(3).reject(Error('network'));await assert.rejects(d,/network/);
 const e=s.select(3);await Promise.resolve();pending.get(3).resolve('retry');await e;assert.equal(seen.at(-1),'retry');
 const bounded=new Session(async i=>i,()=>{});for(let i=0;i<12;i++)await bounded.select(i);assert.ok(bounded.cache.size<=8,'Custom-coordinate meshes need a bounded cache');
 console.log('Rehearsal session: late-site response, close cancellation, validated cache reuse and retry passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
