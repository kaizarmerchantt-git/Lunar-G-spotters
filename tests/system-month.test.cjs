'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {interpolate,magnitude}=require('../src/system-model.js');
const data=JSON.parse(fs.readFileSync('data/system-month.json'));
const observer=JSON.parse(fs.readFileSync('data/horizons.json')).datasets.find(d=>d.featured);
assert.equal(data.provider,'NASA/JPL Horizons');
for(const [body,target]of [['sun',10],['moon',301]]){
 const name=`system-month-${body}-raw.json`,bytes=fs.readFileSync('data/'+name),raw=JSON.parse(bytes).result;
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),data.raw_sha256[name]);
 assert.match(raw,new RegExp(`Target body name:.*\\(${target}\\)`));
 assert.match(raw,/Center body name: Earth \(399\)/);assert.match(raw,/Ecliptic of J2000\.0/);assert.match(raw,/KM-S/);assert.match(raw,/JDUT/);assert.match(raw,/GEOMETRIC cartesian states/);
 const lines=raw.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n'),rows=data.bodies[body];
 assert.equal(lines.length,721);assert.equal(rows.length,721);
 assert.deepEqual(rows.map(r=>Date.parse(r.time)),observer.rows.map(r=>Date.parse(r.time)));
 for(const [i,line]of lines.entries()){
  const cols=line.split(',');assert.deepEqual(rows[i].position,cols.slice(2,5).map(Number));
  assert.equal(Date.parse(rows[i].time),Date.parse(cols[1].trim().replace('A.D. ','')+' UTC'));
  const radius=magnitude(rows[i].position);assert.ok(body==='moon'?radius>300000&&radius<450000:radius>140e6&&radius<160e6);
 }
 const numeric=rows.map(r=>({...r,time:Date.parse(r.time)}));
 assert.throws(()=>interpolate(numeric,numeric[0].time-1));assert.throws(()=>interpolate(numeric,numeric.at(-1).time+1));
 assert.ok(interpolate(numeric,(numeric[340].time+numeric[341].time)/2).every(Number.isFinite));
}
console.log('Passed: 1,442 month-long system vectors match retained NASA responses and observer UTC epochs; out-of-window interpolation rejected.');
