const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {parseCSV,evaluate}=require('../src/model.js');
const O=require('../server/observer-service.cjs');
const cache=JSON.parse(fs.readFileSync('data/horizons.json','utf8'));
require('../src/resource-model.js').normalize(cache);let checked=0;
for(const [i,d] of cache.datasets.entries()){

  for(const key of ['sun','earth']){
    const raw=fs.readFileSync(`data/${i}-${key}.json`),result=JSON.parse(raw).result;
    O.parse(raw.toString(),key,O.validate({lat:d.lat,lon:d.lon,start:d.rows[0].time.slice(0,16),days:(Date.parse(d.rows.at(-1).time)-Date.parse(d.rows[0].time))/86400000,step:(Date.parse(d.rows[1].time)-Date.parse(d.rows[0].time))/60000}));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),d.raw_sha256[`${i}-${key}.json`]);
    assert.match(result,/Center body name: Moon \(301\)/);assert.match(result,/NO \(AIRLESS\)/);
    const coords=result.match(/Center geodetic\s*:\s*([\d.Ee+-]+),\s*([\d.Ee+-]+),\s*([\d.Ee+-]+)/);
    assert.equal(Number(coords[1]),d.lon);assert.equal(Number(coords[2]),d.lat);assert.ok(Math.abs(Number(coords[3])) < 1e-9);
    const rawRows=result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
    assert.equal(rawRows.length,d.rows.length);
    rawRows.forEach((line,j)=>{const p=line.split(',');assert.equal(Date.parse(p[0].trim()+' UTC'),Date.parse(d.rows[j].time),'raw UTC epoch must match the cache');checked++;assert.equal(d.rows[j][key+'_az'],Number(p[3]));assert.equal(d.rows[j][key+'_el'],Number(p[4]));});
  }
  const rows=parseCSV('time_utc,sun_az,sun_el,earth_az,earth_el\n'+d.rows.map(r=>[r.time,r.sun_az,r.sun_el,r.earth_az,r.earth_el].join(',')).join('\n'));
  assert.ok(evaluate(rows,0,0).total>0);
  for(let j=1;j<rows.length;j++)assert.ok(rows[j].time>rows[j-1].time);
}
console.log(`Passed: ${checked} Sun/Earth samples match raw Horizons output, including UTC epochs, coordinates, airless mode and SHA-256. This is source-integrity validation, not an independent ephemeris comparison.`);
