'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
assert.ok(fs.existsSync('server/terrain-service.cjs'),'Custom terrain service must exist');
const {createService,createHandler}=require('../server/terrain-service.cjs');
(async()=>{
 const service=createService(root,{timeout:15000,maxCache:2}),q={lat:-87.25,lon:37.5};
 const [a,b]=await Promise.all([service.query(q),service.query(q)]);assert.equal(a,b,'Coalesced exact-coordinate calculation');assert.equal(await service.query(q),a);
 assert.equal(a.bundle.profiles[0].lat,q.lat);assert.equal(a.bundle.sha256,require('../server/terrain-extractor.cjs').SHA);
 const r=await service.query({...q,rehearsal:true});assert.ok(r.rehearsal);assert.deepEqual(r.bundle,a.bundle);
 await assert.rejects(service.query({lat:-83,lon:0}),/coverage/);
 await assert.rejects(service.query({lat:NaN,lon:0}),/finite/);
 await assert.rejects(createService(root,{timeout:1}).query(q),/timed out/);
 await assert.rejects(createService(root+'/missing').query(q),/source raster/);
 // Corrupt only disposable copies; original NASA files are never changed.
 const scratch=fs.mkdtempSync(path.join(root,'qa-review','terrain-integrity-')),dir=path.join(scratch,'data','terrain-source');fs.mkdirSync(dir,{recursive:true});
 const img=path.join(dir,'LDEM_80S_80M.IMG'),lbl=path.join(dir,'LDEM_80S_80M.LBL');
 try{
  fs.copyFileSync(path.join(root,'data/terrain-source/LDEM_80S_80M.IMG'),img);fs.copyFileSync(path.join(root,'data/terrain-source/LDEM_80S_80M.LBL'),lbl);
  fs.appendFileSync(lbl,'changed');assert.throws(()=>require('../server/terrain-extractor.cjs').readSource(scratch),/integrity/);
  fs.copyFileSync(path.join(root,'data/terrain-source/LDEM_80S_80M.LBL'),lbl);const fd=fs.openSync(img,'r+');try{const byte=Buffer.alloc(1);fs.readSync(fd,byte,0,1,0);byte[0]^=1;fs.writeSync(fd,byte,0,1,0);}finally{fs.closeSync(fd);}
  assert.throws(()=>require('../server/terrain-extractor.cjs').readSource(scratch),/integrity/);
 }finally{fs.unlinkSync(img);fs.unlinkSync(lbl);fs.rmdirSync(dir);fs.rmdirSync(path.dirname(dir));fs.rmdirSync(scratch);}
 const limited=createService(root,{maxPending:1});const pending=limited.query(q);
 await assert.rejects(limited.query({lat:-86,lon:0}),/busy/);await pending;
 let stamp='first',runs=0;const invalidation=createService(root,{stamp:()=>stamp,compute:async()=>({bundle:{id:++runs}})});
 const one=await invalidation.query(q);assert.equal(await invalidation.query(q),one);stamp='second';assert.notEqual(await invalidation.query(q),one);assert.equal(runs,2);
 let resolve;const changed=createService(root,{stamp:()=>stamp,compute:()=>new Promise(r=>resolve=r)});const stale=changed.query(q);await new Promise(setImmediate);stamp='third';resolve({});await assert.rejects(stale,/changed/);
 const server=http.createServer(createHandler(root));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/api/terrain`;
 try{
  assert.equal((await fetch(url)).status,405);
  assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify(q)})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(q)})).status,415);
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(1025)})).status,413);
  for(const body of ['{','{}','{"lat":-85,"lon":0,"path":"../../"}'])assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body})).status,400);
  const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});assert.equal(result.status,200);assert.equal((await result.json()).bundle.profiles[0].lat,q.lat);
 }finally{await new Promise(r=>server.close(r));}
 console.log('Terrain service: real worker, coalescing, lazy rehearsal, cache invalidation, stale source, timeout, queue bound, missing source and HTTP guards passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
