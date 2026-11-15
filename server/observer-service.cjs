'use strict';
const https=require('node:https'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const endpoint='https://ssd.jpl.nasa.gov/api/horizons.api';
function readLocal(file){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2000000)throw new Error('Invalid local source file.');return fs.readFileSync(file,'utf8');}
function validate(input){
  if(!input||Object.keys(input).some(k=>!['lat','lon','start','days','step'].includes(k)))throw new Error('Unexpected query fields.');
  const {lat,lon,start,days,step}=input;
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw new Error('Use latitude −90 to 90 and east longitude −180 to 180.');
  if(typeof start!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start))throw new Error('Use a UTC date and time to the minute.');
  const epoch=Date.parse(start+':00Z');
  if(!Number.isFinite(epoch)||new Date(epoch).toISOString().slice(0,16)!==start||epoch<Date.UTC(2020,0,1)||epoch>=Date.UTC(2041,0,1))throw new Error('Choose a valid UTC start between 2020 and 2040.');
  if(![1,3,7,30].includes(days)||![15,60,180].includes(step))throw new Error('Choose 1, 3, 7 or 30 days and a 15, 60 or 180 minute spacing.');
  return {lat,lon,start,days,step,epoch,end:new Date(epoch+days*86400000).toISOString().slice(0,16)};
}
function queryURL(q,body){
  const params={format:'json',COMMAND:`'${body==='sun'?'10':'399'}'`,OBJ_DATA:"'NO'",MAKE_EPHEM:"'YES'",EPHEM_TYPE:"'OBSERVER'",CENTER:"'coord@301'",COORD_TYPE:"'GEODETIC'",SITE_COORD:`'${q.lon},${q.lat},0'`,START_TIME:`'${q.start.replace('T',' ')}'`,STOP_TIME:`'${q.end.replace('T',' ')}'`,STEP_SIZE:`'${q.step} min'`,QUANTITIES:"'4'",CSV_FORMAT:"'YES'",TIME_DIGITS:"'SECONDS'",TIME_TYPE:"'UT'",APPARENT:"'AIRLESS'",EXTRA_PREC:"'YES'"};
  return endpoint+'?'+new URLSearchParams(params);
}
function parse(raw,body,q){
  const payload=JSON.parse(raw),text=payload.result;
  if(payload.error||typeof text!=='string'||!text.includes('$$SOE')||!text.includes('$$EOE'))throw new Error('NASA returned no observer table. Try another window.');
  if(!new RegExp(`Target body name:.*\\(${body==='sun'?10:399}\\)`).test(text))throw new Error('NASA target identity did not match the request.');
  if(!/Center body name:.*Moon \(301\)/.test(text)||!/Atmos refraction: NO \(AIRLESS\)/.test(text)||!text.includes('Date__(UT)__'))throw new Error('Expected lunar, airless, UT observer geometry.');
  if(!/Center pole\/equ\s*:\s*(?:MEAN_ME \(high precision\)|MOON_ME)\s*\{East-longitude positive\}/.test(text))throw new Error('NASA lunar reference frame is not the expected high-precision mean-Earth frame.');
  const radii=text.match(/Center radii\s*:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*km/);
  if(!radii||radii.slice(1).some(v=>Math.abs(Number(v)-1737.4)>1e-6))throw new Error('NASA lunar reference radii do not match the 1737.4 km sphere.');
  const coordinate=text.match(/Center geodetic\s*:\s*([-\d.e+]+),\s*([-\d.e+]+),\s*([-\d.e+]+)/i);
  if(!coordinate||Math.abs((((Number(coordinate[1])-q.lon)%360)+540)%360-180)>1e-5||Math.abs(Number(coordinate[2])-q.lat)>1e-5||Math.abs(Number(coordinate[3]))>1e-6)throw new Error('NASA observer coordinate did not match the request.');
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rows=text.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/).map(line=>{
    const fields=line.split(',').map(x=>x.trim()),match=fields[0].match(/^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if(!match||months.indexOf(match[2])<0||!fields[3]||!fields[4])throw new Error('Unrecognized NASA observer row.');
    const time=Date.UTC(+match[1],months.indexOf(match[2]),+match[3],+match[4],+match[5],+match[6]),az=Number(fields[3]),el=Number(fields[4]);
    const date=new Date(time);if(date.getUTCFullYear()!==+match[1]||date.getUTCMonth()!==months.indexOf(match[2])||date.getUTCDate()!==+match[3]||date.getUTCHours()!==+match[4]||date.getUTCMinutes()!==+match[5]||date.getUTCSeconds()!==+match[6])throw new Error('Invalid calendar timestamp in NASA row.');
    if(!Number.isFinite(az)||!Number.isFinite(el)||az<0||az>=360||Math.abs(el)>90)throw new Error('NASA observer angle is outside its valid range.');
    return {time,az,el};
  });
  if(rows.length!==q.days*1440/q.step+1||rows.some((r,i)=>r.time!==q.epoch+i*q.step*60000))throw new Error('NASA sample window or cadence did not match the request.');
  return rows;
}
function connectionError(error){
  if(error.message?.startsWith('NASA'))return error;
  const reason={EACCES:'The local server is blocked from contacting NASA/JPL by a network permission or sandbox.',EPERM:'The local server is blocked from contacting NASA/JPL by a network permission or sandbox.',ENOTFOUND:'DNS could not resolve NASA/JPL.',EAI_AGAIN:'DNS lookup for NASA/JPL is temporarily unavailable.',ECONNRESET:'The connection to NASA/JPL was reset.',ECONNREFUSED:'The connection to NASA/JPL was refused.',ETIMEDOUT:'The connection to NASA/JPL timed out.',CERT_HAS_EXPIRED:'NASA/JPL TLS certificate validation failed.',UNABLE_TO_VERIFY_LEAF_SIGNATURE:'NASA/JPL TLS certificate validation failed.',SELF_SIGNED_CERT_IN_CHAIN:'NASA/JPL TLS certificate validation failed.'}[error.code]||'The local server could not reach NASA/JPL.';
  return new Error(reason+' Retry from Start-SELENE.ps1 in PowerShell with internet access, or use a cached observation. The active analysis is unchanged.');
}
function fetchText(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{Accept:'application/json'}},res=>{
      if(res.statusCode!==200){res.resume();reject(new Error('NASA service is unavailable. The current analysis is unchanged.'));return;}
      const chunks=[];let bytes=0;
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2000000){req.destroy(new Error('NASA response exceeds the 2 MB limit.'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));res.on('error',reject);
    });
    const timer=setTimeout(()=>req.destroy(new Error('NASA request timed out. Try again later; the current analysis is unchanged.')),22000);
    req.on('close',()=>clearTimeout(timer));req.on('error',error=>reject(connectionError(error)));
  });
}
function createService(options={}){
  const cache=new Map();let busy=false;
  return {async query(input){
    const q=validate(input),key=JSON.stringify(q);
    if(cache.has(key))return cache.get(key);
    if(options.load){const stored=options.load(crypto.createHash('sha256').update(key).digest('hex'));if(stored?.datasets?.[0]?.urls?.[0]===queryURL(q,'sun')&&stored.datasets[0].urls[1]===queryURL(q,'earth')){cache.set(key,stored);return stored;}}
    if(busy)throw new Error('A NASA query is already running. Please wait.');
    busy=true;
    try{
      const tables={},urls=[],raw_sha256={};
      for(const body of ['sun','earth']){
        const url=queryURL(q,body),raw=await (options.fetchText||fetchText)(url);
        tables[body]=parse(raw,body,q);const hash=crypto.createHash('sha256').update(raw).digest('hex');
        if(options.save)options.save(hash,raw);urls.push(url);raw_sha256[body]=hash;
      }
      const retrieved_utc=new Date().toISOString(),rows=tables.sun.map((s,i)=>({time:new Date(s.time).toISOString(),sun_az:s.az,sun_el:s.el,earth_az:tables.earth[i].az,earth_el:tables.earth[i].el}));
      const coordLabel=`${Math.abs(q.lat)}° ${q.lat<0?'S':'N'}, ${Math.abs(q.lon)}° ${q.lon<0?'W':'E'}`;
      const result={provider:'NASA/JPL Horizons',retrieved_utc,conventions:'Apparent airless body-center azimuth/elevation; lunar geodetic coordinates, east-positive longitude, altitude 0 km above the reference surface. UT (UTC for these dates). No terrain screening.',datasets:[{name:`Observer · ${coordLabel} · ${q.start.slice(0,10)}`.slice(0,100),lat:q.lat,lon:q.lon,rows,urls,raw_sha256,retrieved_utc,source:'NASA/JPL Horizons live query; target, observer, frame, epochs and angle ranges checked.'}]};
      if(options.saveBundle)options.saveBundle(crypto.createHash('sha256').update(key).digest('hex'),result);
      cache.set(key,result);if(cache.size>16)cache.delete(cache.keys().next().value);return result;
    }finally{busy=false;}
  }};
}
function createHandler(root){
  const archive=path.join(root,'_observer-cache');
  const service=createService({
    load(hash){try{const bundle=JSON.parse(readLocal(path.join(archive,'observer-'+hash+'.json')));verifyBundle(bundle,h=>readLocal(path.join(archive,h+'.json')));return bundle;}catch{return null;}},
    save(hash,raw){fs.mkdirSync(archive,{recursive:true});const file=path.join(archive,hash+'.json');if(!fs.existsSync(file))fs.writeFileSync(file,raw,{flag:'wx'});},
    saveBundle(hash,bundle){fs.mkdirSync(archive,{recursive:true});const dest=path.join(archive,'observer-'+hash+'.json'),tmp=dest+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(bundle));fs.renameSync(tmp,dest);}
  });
  const reply=(res,status,data)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  return async(req,res,pathname)=>{
    if(pathname==='/api/observations'){
      if(req.method!=='GET'){reply(res,405,{error:'Use GET to read cached observations.'});return;}
      try{
        const names=fs.existsSync(archive)?fs.readdirSync(archive).filter(n=>/^observer-[a-f0-9]{64}\.json$/.test(n)).sort((a,b)=>fs.statSync(path.join(archive,b)).mtimeMs-fs.statSync(path.join(archive,a)).mtimeMs).slice(0,16):[];
        const bundles=[];
        for(const name of names){try{const bundle=JSON.parse(readLocal(path.join(archive,name)));verifyBundle(bundle,hash=>readLocal(path.join(archive,hash+'.json')));bundles.push(bundle);}catch{ /* Preserve unreadable records; keep other observations usable. */ }}
        reply(res,200,{bundles});
      }catch{reply(res,500,{error:'The local observer cache could not be read.'});}return;
    }
    if(pathname.startsWith('/api/source/')){
      const hash=pathname.slice('/api/source/'.length);
      if(req.method!=='GET'||!/^[a-f0-9]{64}$/.test(hash)){reply(res,404,{error:'Source not found.'});return;}
      try{const raw=readLocal(path.join(archive,hash+'.json'));if(crypto.createHash('sha256').update(raw).digest('hex')!==hash)throw new Error('Changed source');res.writeHead(200,{'Content-Type':'application/json','X-Content-Type-Options':'nosniff'});res.end(raw);}catch{reply(res,404,{error:'Source is absent or its integrity check failed.'});}return;
    }
    if(req.method!=='POST'){reply(res,405,{error:'Use POST for an observer query.'});return;}
    try{
      const origin=new URL(req.headers.origin||'');
      if(!['http:','https:'].includes(origin.protocol)||!['127.0.0.1','localhost'].includes(origin.hostname)||origin.host!==req.headers.host||req.headers['sec-fetch-site']==='cross-site')throw Error();
    }catch{reply(res,403,{error:'Observer queries must come from this local application.'});return;}
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){reply(res,415,{error:'Use JSON observer query parameters.'});return;}
    try{
      const body=await new Promise((resolve,reject)=>{
        let bytes=0,chunks=[],done=false;
        const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
        const timer=setTimeout(()=>finish(new Error('Query body timed out.')),5000);
        req.on('data',chunk=>{if(done)return;bytes+=chunk.length;if(bytes>1024){chunks=[];const e=new Error('Query exceeds 1 KB.');e.status=413;finish(e);}else chunks.push(chunk);});
        req.on('end',()=>finish(null,Buffer.concat(chunks).toString('utf8')));req.on('error',error=>finish(error));req.on('aborted',()=>finish(new Error('Observer request cancelled.')));
      });
      const result=await service.query(JSON.parse(body));reply(res,200,result);
    }catch(error){reply(res,error.status||400,{error:error instanceof SyntaxError?'Invalid query JSON.':error.message});}
  };
}
function verifyBundle(bundle,readRaw){
  const d=bundle?.datasets?.[0];
  if(bundle?.provider!=='NASA/JPL Horizons'||bundle.datasets.length!==1||!d?.rows?.length)throw new Error('Invalid cached observer bundle.');
  const q=validate({lat:d.lat,lon:d.lon,start:d.rows[0].time.slice(0,16),days:(Date.parse(d.rows.at(-1).time)-Date.parse(d.rows[0].time))/86400000,step:(Date.parse(d.rows[1].time)-Date.parse(d.rows[0].time))/60000});
  for(const [i,body]of ['sun','earth'].entries()){
    const hash=d.raw_sha256?.[body];if(!/^[a-f0-9]{64}$/.test(hash||''))throw new Error('Invalid source hash.');
    const raw=readRaw(hash);if(crypto.createHash('sha256').update(raw).digest('hex')!==hash||d.urls?.[i]!==queryURL(q,body))throw new Error('Cached source record does not match.');
    const rows=parse(raw,body,q);
    if(rows.length!==d.rows.length||rows.some((r,j)=>r.time!==Date.parse(d.rows[j].time)||r.az!==d.rows[j][body+'_az']||r.el!==d.rows[j][body+'_el']))throw new Error('Cached angles do not match the raw source.');
  }
  return true;
}
module.exports={validate,queryURL,parse,createService,createHandler,verifyBundle,connectionError};
