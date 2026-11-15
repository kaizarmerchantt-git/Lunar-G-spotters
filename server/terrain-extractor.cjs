'use strict';
// LOLA V2.0 south-polar grid. No downloads; source identity is pinned, not user input.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=1737400,N=7600,rad=Math.PI/180;
const SHA='e6591eeea35402ca5e124ca00f5bf0774381a2d4fa919144b455d82b8ff65fdc';
const LABEL_SHA='107c7558cbf8832e4119d3c8c2b1b272623344275c85378a9b0e03c22876eb33';
const VERSION='cartesian-lola-v1';
function validate(q){
 if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['lat','lon','rehearsal'].includes(k))||!Number.isFinite(q.lat)||q.lat< -90||q.lat>90||!Number.isFinite(q.lon)||q.lon< -360||q.lon>360||(q.rehearsal!==undefined&&typeof q.rehearsal!=='boolean'))throw Error('Provide finite lunar latitude (−90 to 90) and east longitude (−360 to 360).');
 return {lat:Object.is(q.lat,-0)?0:q.lat,lon:((q.lon%360)+540)%360-180,rehearsal:q.rehearsal===true};
}
function sourcePaths(root){return ['LDEM_80S_80M.IMG','LDEM_80S_80M.LBL'].map(n=>path.join(root,'data','terrain-source',n));}
function sourceStamp(root){
 try{return VERSION+':'+sourcePaths(root).map(p=>{const s=fs.statSync(p);if(!s.isFile())throw Error();return [s.size,s.mtimeMs,s.ctimeMs,s.ino].join(':');}).join('|');}
 catch{throw Error('Custom terrain requires the local SELENE server and retained LOLA source raster (LDEM_80S_80M.IMG). Bundled terrain remains available.');}
}
function readSource(root){
 sourceStamp(root);const [image,label]=sourcePaths(root).map(p=>fs.readFileSync(p));
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 if(image.length!==N*N*2||hash(image)!==SHA||hash(label)!==LABEL_SHA)throw Error('LOLA source integrity check failed. Restore the documented source files before calculating custom terrain.');
 return image;
}
function basis(site){
 const p=site.lat*rad,l=site.lon*rad,sp=Math.sin(p),cp=Math.cos(p),sl=Math.sin(l),cl=Math.cos(l);
 return {up:[cp*cl,cp*sl,sp],north:[-sp*cl,-sp*sl,cp],east:[-sl,cl,0]};
}
function travel(b,az,distance){
 const a=az*rad,c=Math.cos(distance/R),s=Math.sin(distance/R),ca=Math.cos(a),sa=Math.sin(a);
 return b.up.map((v,i)=>v*c+(b.north[i]*ca+b.east[i]*sa)*s);
}
function destination(site,az,distance){return travel(basis(site),az,distance);}
function project(u){const k=2*R/(80*(1-u[2]));return [3799.5+k*u[1],3799.5-k*u[0]];}
function sample(grid,x,y){
 const ix=Math.floor(x),iy=Math.floor(y);
 if(!Number.isFinite(x)||!Number.isFinite(y)||ix<0||iy<0||ix>=N-1||iy>=N-1)throw Error('Outside LOLA coverage: the complete 100 km terrain footprint and bilinear neighbours must fit inside the retained south-polar map. No partial skyline is used.');
 const fx=x-ix,fy=y-iy,v=[];
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){
  const height=grid.readInt16LE(2*((iy+j)*N+ix+i))*.5;
  if(Math.abs(height)>=15000)throw Error('Invalid LOLA elevation cell in this terrain footprint. No partial skyline is used.');v.push(height);
 }
 return (v[0]*(1-fx)+v[1]*fx)*(1-fy)+(v[2]*(1-fx)+v[3]*fx)*fy;
}
function angle(height,observer,distance){const d=distance/R;return Math.atan2((R+height)*Math.cos(d)-(R+observer),(R+height)*Math.sin(d))/rad;}
function extract(grid,input,heightAt){
 const q=validate(input),site={lat:q.lat,lon:q.lon},b=basis(site);
 const height=u=>{const [x,y]=project(u);return heightAt?heightAt(x,y):sample(grid,x,y);};
 const ground=height(b.up),bins=[],rays=[];
 for(let az=0;az<360;az++){
  let maximum=-Infinity,blockingDistance=80,blockingHeight=0;const ray=[];
  for(let distance=80;distance<=100000;distance+=80){
   const h=height(travel(b,az,distance)),el=angle(h,ground+2,distance);
   if(el>maximum){maximum=el;blockingDistance=distance;blockingHeight=h;}
   if(q.rehearsal)ray.push(Math.round(h*1000));
  }
  bins.push({az,el:Math.max(0,maximum),distance_m:blockingDistance,height_m:blockingHeight});
  if(q.rehearsal)rays.push(ray);
 }
 const profile={...site,ground_height_m:ground,observer_height_m:2,bins};
 const result={profile,extractor:VERSION};
 if(q.rehearsal){
  const heights=[];
  for(let n=-19200;n<=19200;n+=160)for(let e=-19200;e<=19200;e+=160)heights.push(Math.round(height(travel(b,Math.atan2(e,n)/rad,Math.hypot(e,n)))*1000));
  result.rehearsal={schema:'selene-rehearsal-v1',source_sha256:SHA,label_sha256:LABEL_SHA,site,radius_m:R,ground_height_m:ground,observer_height_m:2,height_unit_m:.001,radial_step_m:80,range_m:100000,azimuth_step_deg:1,mesh:{size:241,step_m:160,half_extent_m:19200,order:'row north ascending; column east ascending',heights_mm:heights},rays_mm:rays};
 }
 return result;
}
module.exports={R,SHA,LABEL_SHA,VERSION,validate,sourceStamp,readSource,basis,destination,project,sample,angle,extract};
