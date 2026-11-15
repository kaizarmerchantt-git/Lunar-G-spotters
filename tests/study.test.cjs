'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../src/model.js');
const file=__dirname+'/../src/study-model.js';
assert.ok(fs.existsSync(file),'threshold study model must exist');
const S=require(file);
const start=Date.UTC(2026,0,1);
const rows=[
  {time:start,sun_el:2,earth_el:1},
  {time:start+3600000,sun_el:4,earth_el:-1},
  {time:start+4*3600000,sun_el:90,earth_el:90}
];
const a=S.analyze(rows,1);
assert.equal(a.total,4);
assert.equal(a.sun,4);
assert.equal(a.earth,0,'strict > threshold excludes exact equality');
assert.equal(a.both,0);
assert.equal(a.minSun,2,'terminal sample has no interval duration');
assert.equal(a.maxSun,4);
assert.equal(a.limitingIndex,1);
assert.equal(a.cadenceMin,1);assert.equal(a.cadenceMax,3);
assert.equal(S.analyze(rows,2).sun,3,'irregular intervals must be time weighted');
assert.equal(S.analyze(rows,4).sun,0);
assert.equal(typeof S.nextChange,'function','sampled transition finder must exist');
assert.deepEqual(S.nextChange(rows,0,0),{index:1,from:rows[0].time,to:rows[1].time,bodies:['earth'],above:[false]});
assert.deepEqual(S.nextChange(rows,1,0),{index:2,from:rows[1].time,to:rows[2].time,bodies:['earth'],above:[true]});
assert.equal(S.nextChange(rows,2,0),null);
assert.equal(S.nextChange(rows,0,-2),null);
assert.equal(S.analyze([{time:0,sun_el:1,earth_el:2},{time:1,sun_el:-90,earth_el:-90}],0).limitingIndex,0,'exclude duration-free endpoint from limiting interval');
const curve=S.sweep(rows,.25);
assert.equal(curve.length,21);assert.equal(curve[0].obstruction,0);assert.equal(curve.at(-1).obstruction,10);
assert.equal(curve[4].threshold,2.25);
for(let i=1;i<curve.length;i++)for(const key of ['sun','earth','both'])assert.ok(curve[i][key]<=curve[i-1][key]);
const real=JSON.parse(fs.readFileSync(__dirname+'/../data/horizons.json','utf8'));
for(const d of real.datasets){
  const samples=d.rows.map(r=>({...r,time:typeof r.time==='number'?r.time:Date.parse(r.time_utc||r.time)}));
  for(const p of S.sweep(samples,.5)){
    const expected=M.evaluate(samples,p.obstruction,.5);
    for(const key of ['total','sun','earth','both'])assert.ok(Math.abs(p[key]-expected[key])<1e-9,`${d.name} ${key}`);
  }
}
console.log('Threshold study: strict boundaries, irregular cadence, endpoint exclusion, monotonicity and NASA-model equivalence passed.');
