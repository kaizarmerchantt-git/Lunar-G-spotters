'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'server/terrain-extractor.cjs');
assert.ok(fs.existsSync(file),'Custom-coordinate terrain extractor must exist');
const E=require(file),T=require('../src/terrain-model.js'),M=require('../src/rehearsal-model.js');
const bundle=JSON.parse(fs.readFileSync('data/terrain-horizons.json'));
const grid=E.readSource(root);
for(const input of [{lat:'-85',lon:0},{lat:NaN,lon:0},{lat:-91,lon:0},{lat:-85,lon:361},{lat:-85,lon:0,path:'x'}])assert.throws(()=>E.validate(input));
assert.deepEqual(E.validate({lat:-85,lon:180}),{lat:-85,lon:-180,rehearsal:false});
assert.deepEqual(E.validate({lat:-85,lon:360,rehearsal:true}),{lat:-85,lon:0,rehearsal:true});
// Independent analytic sphere and known-height ridge, not a rendered approximation.
for(const d of [80,1000,100000])assert.ok(Math.abs(E.angle(0,0,d)+d/E.R*90/Math.PI)<1e-7);
assert.ok(E.angle(100,2,1000)>5);
// Every bilinear neighbour matters, including invalid values next to a valid cell.
assert.throws(()=>E.sample(grid,-.001,100),/coverage/i);
assert.throws(()=>E.sample(grid,7599,100),/coverage/i);
const bad=Buffer.alloc(7600*2*2);bad.writeInt16LE(-32768,2);
assert.throws(()=>E.sample(bad,.2,.2),/invalid/i);
// Pole convention: the input longitude defines the north meridian.
for(const lon of [0,45,180,-180])for(const az of [0,90,180,270]){
 const u=E.destination({lat:-90,lon},az,1000),lat=Math.atan2(u[2],Math.hypot(u[0],u[1]))*180/Math.PI,longitude=Math.atan2(u[1],u[0])*180/Math.PI;
 assert.ok(Math.abs(lat-(-90+1000/E.R*180/Math.PI))<1e-10);
 assert.ok(Math.abs(((longitude-lon-az+540)%360)-180)<1e-9);
 const dest=M.destination({lat:-90,lon},az,1000);
 assert.ok(Math.abs(dest.lat-lat)<1e-10);assert.ok(Math.abs(((dest.lon-longitude+540)%360)-180)<1e-9);
}
const report=[];
for(const p of bundle.profiles){
 const out=E.extract(grid,{lat:p.lat,lon:p.lon}),v=T.validate({...bundle,profiles:[out.profile]});
 let max=0;for(let i=0;i<360;i++){max=Math.max(max,Math.abs(p.bins[i].el-out.profile.bins[i].el));assert.equal(out.profile.bins[i].distance_m,p.bins[i].distance_m);}
 assert.ok(max<=.00001);assert.ok(Math.abs(out.profile.ground_height_m-p.ground_height_m)<=.000501);
 report.push({site:out.profile.lat+','+out.profile.lon,max_existing_horizon_difference_deg:max});assert.ok(v);
}
for(const site of [{lat:-87.25,lon:37.5},{lat:-85,lon:-120},{lat:-90,lon:45},{lat:-89.9999999,lon:179.999},{lat:-83,lon:45},{lat:-84,lon:0}]){
 const out=E.extract(grid,{...site,rehearsal:true});T.validate({...bundle,profiles:[out.profile]});M.validate(out.rehearsal,bundle,out.profile);
 let max=0;for(let az=0;az<360;az++)max=Math.max(max,Math.abs(M.section(out.rehearsal,out.profile,az).published_horizon_deg-Math.max(0,M.section(out.rehearsal,out.profile,az).elevation_deg)));
 assert.ok(max<.0008);report.push({site,max_rehearsal_difference_deg:max});
}
const a=E.extract(grid,{lat:-85,lon:180}),b=E.extract(grid,{lat:-85,lon:-180});assert.deepEqual(a,b);
// Valid centre is insufficient: these complete 100 km footprints leave the square DEM.
for(const site of [{lat:-83,lon:0},{lat:-80,lon:45},{lat:0,lon:0},{lat:90,lon:0}])assert.throws(()=>E.extract(grid,site),/coverage/i);
const flat=E.extract(null,{lat:-85,lon:0},()=>0);assert.ok(flat.profile.bins.every(b=>b.el===0));
const ridge=E.extract(null,{lat:-90,lon:0},(x,y)=>Math.abs(Math.hypot(x-3799.5,y-3799.5)*80-1040)<2?100:0);
assert.ok(ridge.profile.bins.every(b=>b.distance_m===1040&&Math.abs(b.el-E.angle(100,2,1040))<1e-10));
// Approach both edges from inside and outside; exercise the complete extractor, not just endpoint estimates.
for(const lon of [0,45,90,-135]){
 let inside=-85,outside=-79;
 for(let i=0;i<20;i++){const lat=(inside+outside)/2;try{E.extract(grid,{lat,lon});inside=lat;}catch(e){assert.match(e.message,/coverage/);outside=lat;}}
 assert.doesNotThrow(()=>E.extract(grid,{lat:inside-1e-5,lon}));assert.throws(()=>E.extract(grid,{lat:outside+1e-5,lon}),/coverage/);
 report.push({boundary_longitude:lon,complete_footprint_pass_latitude:inside,complete_footprint_fail_latitude:outside});
}
fs.mkdirSync('qa-review',{recursive:true});fs.writeFileSync('qa-review/custom-terrain-numerics.json',JSON.stringify({source_sha256:bundle.sha256,checks:report},null,2));
console.log('Custom terrain: exact-site regression, sphere/ridge, full-footprint boundaries, bilinear neighbours, pole/seam and rehearsal consistency passed.');
