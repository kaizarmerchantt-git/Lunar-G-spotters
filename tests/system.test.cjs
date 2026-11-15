const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {interpolate,magnitude,orbitGuide,sceneLayout}=require('../src/system-model.js');
const lighting=require('../src/system-model.js');
assert.equal(lighting.surfaceBrightness([1,0,0],[1,0,0]),1);
assert.ok(lighting.surfaceBrightness([-1,0,0],[1,0,0])<.08);
assert.ok(lighting.surfaceBrightness([0,1,0],[1,0,0])<.08,'terminator follows the light normal, not a painted overlay');
let phases=new Set();
for(const yaw of [0,.8,1.6,2.4]){
 const scene=sceneLayout({w:1000,h:500,sun:[150e6,0,0],moon:[400000,0,0],yaw,tilt:1,zoom:1});
 const projected=scene.camera([150e6,0,0]);assert.ok(Math.abs(magnitude(projected)-150e6)<1e-6,'camera preserves physical vectors');
 phases.add(lighting.surfaceBrightness([0,0,1],projected).toFixed(2));
}
assert.ok(phases.size>1,'visible illuminated hemisphere changes with camera orbit');
const hidden=lighting.diskTrackSegments([{point:[-20,0],depth:-2},{point:[20,0],depth:-2}],{point:[0,0],radius:10});
assert.ok(hidden.length>0&&hidden.every(s=>s.hidden),'rear track crossing the Earth disk remains available for a dashed depth overlay');
assert.ok(lighting.diskTrackSegments([{point:[-20,0],depth:2},{point:[20,0],depth:2}],{point:[0,0],radius:10}).every(s=>!s.hidden),'foreground track is not styled as hidden');
// One linear length scale per view; rotating a camera never moves the Sun into
// the local Earth-Moon view, and an epoch's Moon range is not auto-normalized.
for(const mode of ['lunar','solar']){
 const a=sceneLayout({w:1000,h:500,sun:[150e6,0,0],moon:[400000,0,0],yaw:0,tilt:0,zoom:1,mode});
 const b=sceneLayout({w:1000,h:500,sun:[150e6,0,0],moon:[300000,0,0],yaw:0,tilt:0,zoom:1,mode});
 assert.equal(a.scale,b.scale);
 assert.ok(Math.abs(Math.hypot(a.points.moon[0]-a.points.earth[0],a.points.moon[1]-a.points.earth[1])/a.scale-400000)<1e-6);
 if(mode==='lunar'){assert.ok(a.points.sun[0]<a.localBounds.left);assert.deepEqual(a.points.sun,sceneLayout({w:1000,h:500,sun:[150e6,0,0],moon:[300000,0,0],yaw:2,tilt:1,zoom:1.3,mode}).points.sun,'Sun stays pinned while the local camera moves');}
 else assert.ok(Math.abs(Math.hypot(a.points.sun[0]-a.points.earth[0],a.points.sun[1]-a.points.earth[1])/a.scale-150e6)<1e-6);
}
assert.deepEqual(interpolate([{time:0,position:[0,2,4]},{time:10,position:[10,4,8]}],5),[5,3,6]);
assert.deepEqual(interpolate([{time:0,position:[0,2,4]},{time:10,position:[10,4,8]}],10),[10,4,8]);
assert.throws(()=>interpolate([{time:0,position:[0,0,0]},{time:10,position:[1,1,1]}],11));
const d=JSON.parse(fs.readFileSync('data/system.json'));
const observer=JSON.parse(fs.readFileSync('data/horizons.json'));
assert.deepEqual(d.bodies.sun.map(r=>r.time),d.bodies.moon.map(r=>r.time));
assert.deepEqual(d.bodies.moon.map(r=>r.time),observer.datasets[0].rows.map(r=>r.time));
for(const body of ['sun','moon']){
 const bytes=fs.readFileSync(`data/system-${body}-raw.json`),raw=JSON.parse(bytes).result;
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),d.raw_sha256[`system-${body}-raw.json`]);
 assert.match(raw,/Center body name: Earth \(399\)/);assert.match(raw,/Ecliptic of J2000\.0/);assert.match(raw,/KM-S/);
 const lines=raw.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');assert.equal(lines.length,73);
 for(const [i,line]of lines.entries()){
  const p=line.split(',');assert.deepEqual(d.bodies[body][i].position,p.slice(2,5).map(Number));
  assert.equal(Date.parse(d.bodies[body][i].time),Date.parse(p[1].trim().replace('A.D. ','')+' UTC'));
  const radius=magnitude(d.bodies[body][i].position);assert.ok(body==='moon'?radius>300000&&radius<450000:radius>140e6&&radius<160e6);
 }
 const rows=d.bodies[body].map(r=>({...r,time:Date.parse(r.time)}));assert.equal(rows.at(-1).time-rows[0].time,72*3600000);
}
console.log('Passed: 146 vectors and UTC epochs match raw NASA output; hashes, Earth center, frame, units, plausible ranges and interpolation checked.');
// The display guide must pass through the Moon, close, and stay in its local plane.
const guideRows=d.bodies.moon.map(r=>({...r,time:Date.parse(r.time)}));
for(const index of [0,36,72]){
 const time=guideRows[index].time,guide=orbitGuide(guideRows,time),p=guideRows[index].position;
 const a=guideRows[index===72?71:index].position,b=guideRows[Math.min(72,index+1)].position;
 const v=b.map((x,k)=>x-a[k]),normal=[p[1]*v[2]-p[2]*v[1],p[2]*v[0]-p[0]*v[2],p[0]*v[1]-p[1]*v[0]];
 assert.ok(magnitude(guide[0].map((x,k)=>x-p[k]))<1e-8);
 assert.ok(magnitude(guide.at(-1).map((x,k)=>x-guide[0][k]))<1e-8);
 for(const point of guide)assert.ok(Math.abs(magnitude(point)-magnitude(p))<1e-8);
 for(const point of guide)assert.ok(Math.abs(point.reduce((s,x,k)=>s+x*normal[k],0)/magnitude(normal))<1e-8);
}
assert.throws(()=>orbitGuide([{time:0,position:[1,0,0]},{time:1,position:[2,0,0]}],0));
console.log('Passed: circular display guide closes, intersects the Moon, preserves radius and local orbital plane, and rejects degenerate geometry.');

// Independent camera axes must not be cancelled by automatic solar roll.
const view=(yaw,tilt)=>sceneLayout({w:1000,h:500,sun:[150e6,0,0],moon:[250000,250000,10000],yaw,tilt});
assert.notDeepEqual(view(0,0).points.moon,view(.7,0).points.moon);
assert.notDeepEqual(view(.7,0).points.moon,view(.7,2).points.moon);
assert.equal(view(1,2).roll,0);
assert.ok(Math.abs((lighting.earthSpin(86400000)-lighting.earthSpin(0))*180/Math.PI-360.98564736629)<1e-6);
