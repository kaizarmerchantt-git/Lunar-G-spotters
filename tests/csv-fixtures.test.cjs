'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseCSV,evaluate}=require('../src/model.js'),{validate,parse}=require('../server/observer-service.cjs');
for(const [name,total,both]of [['NASA-polar-month-2026-11',720,364],['NASA-reference-B-2026-11-14',72,0],['NASA-IM2-coordinate-2026-11-14',72,68]]){
 const bytes=fs.readFileSync('test-data/'+name+'.csv'),record=JSON.parse(fs.readFileSync('test-data/'+name+'.source.json')),rows=parseCSV(bytes.toString());
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.csv_sha256);
 const q=validate({lat:record.lat,lon:record.lon,start:new Date(rows[0].time).toISOString().slice(0,16),days:(rows.at(-1).time-rows[0].time)/86400000,step:(rows[1].time-rows[0].time)/60000});
 for(const body of ['sun','earth']){
  const key=Object.keys(record.raw_sha256).find(k=>k===body||k.endsWith('-'+body+'.json')),hash=record.raw_sha256[key];
  const file=key===body?'test-data/'+record.raw_files[body]:'data/'+key,raw=fs.readFileSync(file);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),hash);
  const original=parse(raw.toString(),body,q);assert.equal(original.length,rows.length);
  original.forEach((r,i)=>{assert.equal(r.time,rows[i].time);assert.equal(r.az,rows[i][body+'_az']);assert.equal(r.el,rows[i][body+'_el']);});
 }
 const result=evaluate(rows,0,0);assert.equal(result.total,total);assert.equal(result.both,both);
}
console.log('Passed: three import CSVs match retained NASA raw responses, UTC, coordinates and documented interval results.');
