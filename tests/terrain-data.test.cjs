'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
assert.ok(fs.existsSync('src/terrain-data.js'),'Shared terrain data controller must exist');
const Data=require('../src/terrain-data.js'),T=require('../src/terrain-model.js'),M=require('../src/rehearsal-model.js'),bundle=JSON.parse(fs.readFileSync('data/terrain-horizons.json'));
(async()=>{
 const calls=[];let resolve,fail=false;const fetcher=async(url,options)=>{
  calls.push(url);if(url==='data/terrain-horizons.json')return {ok:true,json:async()=>bundle};
  if(url.startsWith('data/terrain-rehearsal-'))return {ok:true,json:async()=>JSON.parse(fs.readFileSync(url))};
  if(fail)return {ok:false,json:async()=>({error:'Outside coverage'})};
  return new Promise(r=>resolve=r);
 };
 const data=new Data(fetcher,T,M);await data.ready;
 assert.equal((await data.load({lat:-89.5,lon:0})).profile,bundle.profiles[0]);assert.equal(calls.length,1);
 assert.ok((await data.load({lat:-89.5,lon:0},true)).rehearsal);
 const site={lat:-87.25,lon:37.5},one=data.load(site),two=data.load(site);await new Promise(setImmediate);assert.equal(calls.filter(x=>x==='/api/terrain').length,1);
 const custom={...bundle,profiles:[{...bundle.profiles[0],...site}]};resolve({ok:true,json:async()=>({bundle:custom})});assert.equal(await one,await two);assert.equal(data.peek(site).profile.lat,site.lat);
 assert.equal(data.peek({lat:-87.2501,lon:37.5}),null);
 fail=true;await assert.rejects(data.load({lat:-86,lon:0}),/Outside coverage/);await assert.rejects(data.load({lat:-86,lon:0}),/Outside coverage/);assert.equal(calls.filter(x=>x==='/api/terrain').length,3,'Failures can be retried');
 fail=false;const wrong=data.load({lat:-88,lon:0});await new Promise(setImmediate);resolve({ok:true,json:async()=>({bundle:custom})});await assert.rejects(wrong,/coordinate/);
 const otherSource=data.load({lat:-88,lon:0});await new Promise(setImmediate);resolve({ok:true,json:async()=>({bundle:{...custom,sha256:'a'.repeat(64)}})});await assert.rejects(otherSource,/source/);
 assert.equal(Data.key({lat:-85,lon:180}),Data.key({lat:-85,lon:-180}));
 console.log('Terrain data: shared exact-coordinate profiles, retained fallback, lazy rehearsal, coalescing, retry, source/coordinate guards and seam keys passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
