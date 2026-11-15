'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../src/atlas-model.js'),E=require('../src/explorer-math.js');
const catalogue=JSON.parse(fs.readFileSync('data/clps-missions.json','utf8'));
const records=A.normalize(catalogue);assert.equal(records.length,4);
assert.equal(records.filter(m=>m.coordinate).length,3);
assert.ok(records.some(m=>m.coordinate===null));
assert.deepEqual(A.normalize(records),records);
for(const [i,m]of records.entries()){
  for(const key of ['statusDate','statusSourceUrl','coordinateType','shortName','taskOrder','landingDate','summary','payloads'])assert.equal(m[key],catalogue.missions[i][key]);
  if(m.coordinate)assert.equal(m.coordinate.note,catalogue.missions[i].coordinate.note);
}
const clone=()=>JSON.parse(JSON.stringify(catalogue));
for(const change of [
 d=>d.missions.push(d.missions[0]),d=>d.missions[0].coordinate.lat=91,
 d=>d.missions[0].coordinate.lon=-181,d=>delete d.missions[0].coordinateSourceUrl,
 d=>d.missions[0].checkedUtc='2026-02-30',d=>d.missions[0].sourceUrl='https://nasa.gov.evil.example/data',
 d=>d.missions[0].statusSourceUrl='javascript:alert(1)',d=>d.missions[0].coordinate.lat='-80.13'
]){const d=clone();change(d);assert.throws(()=>A.normalize(d));}
for(const url of ['http://nasa.gov','https://nasa.gov@evil.example/','https://evil.example/nasa.gov','https://nasa.gov:444/','data:text/html,hello','https://nasa.gov/\nattack'])assert.throws(()=>A.safeURL(url));
assert.equal(A.safeURL('https://nssdc.gsfc.nasa.gov/planetary/'),'https://nssdc.gsfc.nasa.gov/planetary/');
for(const [lat,lon]of [[0,0],[90,180],[-90,-180],[18.562,61.81],[-84.7906,29.1957]]){
 const actual=A.point(lat,lon),expected=E.frame(lat,lon).up;actual.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-12));assert.ok(Math.abs(Math.hypot(...actual)-1)<1e-12);
}
assert.throws(()=>A.point(NaN,0));assert.throws(()=>A.point(0,0,0));
assert.equal(A.visible([0,0,1],[0,0,3]),true);
assert.equal(A.visible([0,0,-1],[0,0,3]),false);
assert.equal(A.visible([1,0,0],[0,0,3]),false);
assert.equal(A.visible([0,0,1],[0,0,.5]),false);
assert.equal(A.visible([0,0,0],[0,0,3]),false);
assert.equal(A.visible([0,0,1.01],[0,0,3]),true);
assert.equal(A.visible([1,0,0],[1,0,3]),false); // tangent
assert.equal(A.visible([NaN,0,1],[0,0,3]),false);
const labels=[{id:'a',x:100,y:100,width:100,height:30},{id:'polar-selected',selected:true,x:101,y:99,width:100,height:30},{id:'b',priority:2,x:105,y:103,width:100,height:30},{id:'edge',x:-40,y:300,width:120,height:28}];
const result=A.declutter(labels,360,240,8);assert.deepEqual(result.map(x=>x.id),['polar-selected','edge']);
for(const r of result){assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=360&&r.y+r.height<=240);assert.deepEqual(r.rect,{x:r.x,y:r.y,width:r.width,height:r.height});}
assert.deepEqual(labels[0],{id:'a',x:100,y:100,width:100,height:30}); // pure layout
assert.deepEqual(A.declutter(labels,0,0),[]);
assert.deepEqual(A.declutter([{x:0,y:0,width:999,height:1}],100,100),[]);
assert.equal(A.declutter([{x:0,y:0,width:10,height:10},{x:18,y:0,width:10,height:10}],100,100,8).length,2);
assert.equal(A.coordinateLabel({lat:-84.7906,lon:29.1957}),'84.7906° S / 29.1957° E');
console.log('Passed: source-backed mission catalogue validation, coordinate conventions, sphere occlusion and selected-priority bounded label layout.');
