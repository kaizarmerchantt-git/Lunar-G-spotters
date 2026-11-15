const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('../src/terrain-model.js'),M=require('../src/model.js');
const bundle=T.validate(JSON.parse(fs.readFileSync('data/terrain-horizons.json')));
assert.equal(T.match(bundle,{lat:-89.5,lon:360}).lon,0);assert.equal(T.match(bundle,{lat:-89.5001,lon:0}),null);assert.equal(T.match(bundle,null),null);
const p={bins:Array.from({length:360},(_,az)=>({az,el:az===0?4:0}))};
assert.equal(T.elevation(p,359.5),2);assert.equal(T.elevation(p,-.5),2);assert.equal(T.elevation(p,360),4);assert.throws(()=>T.elevation(p,NaN));
const rows=[0,1,4,5].map((h,i)=>({time:h*3600000,sun_az:0,earth_az:90,sun_el:[5,4,6,2][i],earth_el:[2,-1,2,2][i]}));
const r=T.evaluate(rows,p);assert.equal(r.sun,2);assert.equal(r.earth,2);assert.equal(r.both,2);assert.equal(r.longest,3);
assert.deepEqual(T.nextSet(r.samples,0,'sun'),{from:0,to:3600000,index:1});assert.deepEqual(T.nextSet(r.samples,1,'sun'),{blocked:true});assert.equal(T.nextSet(r.samples,2,'earth'),null);
const flat={bins:Array.from({length:360},()=>({el:0}))};assert.deepEqual(T.evaluate(rows,flat).samples.map(s=>[s.sun,s.earth]),M.evaluate(rows,0,0).samples.map(s=>[s.sun,s.earth]));
const h=JSON.parse(fs.readFileSync('data/horizons.json'));
for(const d of h.datasets){const profile=T.match(bundle,d);assert.ok(profile);const rows=d.rows.map(r=>({...r,time:Date.parse(r.time)}));const t=T.evaluate(rows,profile),f=M.evaluate(rows,0,0);for(const k of ['sun','earth','both'])assert.ok(t[k]<=f[k]);}
const corrupt=structuredClone(bundle);corrupt.profiles[0].bins[5].az=0;assert.throws(()=>T.validate(corrupt));
for(const patch of [{radial_step_m:800},{azimuth_step_deg:5},{floor_deg:-1},{label_sha256:'missing'}])assert.throws(()=>T.validate({...bundle,...patch}),/metadata/,'source sampling metadata must match the method used by the calculation');
assert.throws(()=>T.evaluate([{...rows[0],time:NaN},rows[1]],p),/sample/i);
assert.throws(()=>T.evaluate([{...rows[0],sun_el:NaN},rows[1]],p),/sample/i,'invalid angles must not silently become blocked bodies');
assert.throws(()=>T.evaluate(rows,p,NaN,0),/cutoff|assumption/i);
console.log('Terrain: coordinate matching, circular interpolation, strict cutoff, irregular durations, sampled set brackets, flat equivalence, malformed profiles and NASA window bounds passed.');
