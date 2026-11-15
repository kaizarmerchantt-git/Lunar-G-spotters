'use strict';
const {Worker}=require('node:worker_threads'),path=require('node:path'),E=require('./terrain-extractor.cjs');
function compute(root,query,timeout){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(path.join(__dirname,'terrain-worker.cjs'),{workerData:{root,query}});let done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate().then(()=>error?reject(error):resolve(value),reject);};
  const timer=setTimeout(()=>finish(Error('Terrain calculation timed out. Retry this coordinate.')),timeout);
  worker.once('message',m=>finish(m.error?Error(m.error):null,m.value));worker.once('error',e=>finish(e));worker.once('exit',()=>{if(!done)finish(Error('Terrain worker stopped before completing the profile.'));});
 });
}
function createService(root,options={}){
 const cache=new Map(),pending=new Map();let tail=Promise.resolve(),version=null;
 const stamp=options.stamp||(()=>E.sourceStamp(root)),run=options.compute||((q)=>compute(root,q,options.timeout??20000));
 return {async query(input){
  const q=E.validate(input),current=stamp();
  if(current!==version){cache.clear();version=current;}
  const key=current+':'+JSON.stringify(q);
  if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v;}
  if(pending.has(key))return pending.get(key);
  if(pending.size>=(options.maxPending??3))throw Error('Terrain calculator is busy. Wait for the current locations to finish, then retry.');
  const task=tail.then(async()=>{
   if(stamp()!==current)throw Error('Terrain source changed. Retry to validate the new source.');
   const value=await run(q);
   if(stamp()!==current)throw Error('Terrain source changed during calculation. No result was applied.');
   cache.set(key,value);while(cache.size>(options.maxCache??8))cache.delete(cache.keys().next().value);return value;
  }).finally(()=>pending.delete(key));
  pending.set(key,task);tail=task.catch(()=>{});return task;
 }};
}
function createHandler(root){
 const service=createService(root);
 const reply=(res,status,value)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 return async(req,res)=>{
  if(req.method!=='POST')return reply(res,405,{error:'Use POST for a terrain calculation.'});
  if(req.headers.origin){
   try{const origin=new URL(req.headers.origin);if(!['http:','https:'].includes(origin.protocol)||!['127.0.0.1','localhost'].includes(origin.hostname)||origin.host!==req.headers.host)throw Error();}
   catch{return reply(res,403,{error:'Terrain requests must come from the local SELENE page.'});}
  }
  if(req.headers['sec-fetch-site']==='cross-site')return reply(res,403,{error:'Cross-site terrain request rejected.'});
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return reply(res,415,{error:'Use JSON coordinates.'});
  try{
   const body=await new Promise((resolve,reject)=>{
    let bytes=0,chunks=[],done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Error('Terrain request body timed out.')),5000);
    req.on('data',chunk=>{if(done)return;bytes+=chunk.length;if(bytes>1024){chunks=[];const e=Error('Terrain request exceeds 1 KB.');e.status=413;finish(e);}else chunks.push(chunk);});
    req.on('end',()=>finish(null,Buffer.concat(chunks).toString('utf8')));req.on('error',e=>finish(e));req.on('aborted',()=>finish(Error('Terrain request cancelled.')));
   });
   const value=await service.query(JSON.parse(body));reply(res,200,value);
  }catch(error){reply(res,error.status||400,{error:error instanceof SyntaxError?'Invalid terrain query JSON.':error.message});}
 };
}
module.exports={createService,createHandler};
