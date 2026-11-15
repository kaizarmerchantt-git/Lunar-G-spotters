'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../src/rehearsal-model.js');
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// Cardinal directions and exact spherical curvature in local east/up/north.
const n=M.point(0,1000,0,0),e=M.point(90,1000,0,0);
close(n[0],0);close(n[2],-1737400*Math.sin(1000/1737400));
close(n[1],1737400*(Math.cos(1000/1737400)-1)-2);close(e[2],0);assert.ok(e[0]>999);
close(M.elevation(0,0,1000),Math.atan2(n[1],-n[2])*180/Math.PI);
assert.equal(M.rayIndex(359.6),0);assert.equal(M.rayIndex(-.6),359);
assert.throws(()=>M.rayIndex(NaN));assert.throws(()=>M.point(0,-1,0,0));
const p={lat:-89.5,lon:0,ground_height_m:0,observer_height_m:2,bins:Array.from({length:360},(_,az)=>({az,el:0,distance_m:80,height_m:0}))};
const flat={site:{lat:-89.5,lon:0},ground_height_m:0,radial_step_m:80,rays_mm:Array.from({length:360},()=>[0,0,0])};
assert.equal(M.section(flat,p,0).floorLimited,true);
flat.rays_mm[0]=[0,100000,0];const ridge=M.section(flat,p,0);assert.equal(ridge.distance_m,160);assert.equal(ridge.floorLimited,false);
close(ridge.coordinates.lat,-89.5+160/1737400*180/Math.PI,1e-7);
const terrain=JSON.parse(fs.readFileSync('data/terrain-horizons.json'));
for(let i=0;i<4;i++){
 const d=JSON.parse(fs.readFileSync(`data/terrain-rehearsal-${i}.json`)),profile=terrain.profiles[i];
 M.validate(d,terrain,profile);
 assert.throws(()=>M.validate({...d,source_sha256:'0'.repeat(64)},terrain,profile));
 assert.throws(()=>M.validate({...d,site:{lat:0,lon:0}},terrain,profile));
 assert.throws(()=>M.validate({...d,mesh:{...d.mesh,heights_mm:[0]}},terrain,profile));
 assert.throws(()=>M.validate({...d,mesh:{...d.mesh,order:'north descending'}},terrain,profile));
 for(let az=0;az<360;az++){
  const r=M.section(d,profile,az);close(Math.max(0,r.elevation_deg),profile.bins[az].el,.0008);
  assert.ok(r.distance_m>=80&&r.distance_m<=100000);
 }
}
console.log('Rehearsal: spherical geometry, cardinal directions, ray wrap, floor distinction, source/coordinate validation and all 1440 section maxima passed.');
