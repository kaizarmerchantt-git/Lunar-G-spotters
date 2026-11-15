const assert=require('node:assert/strict');
const {frame,direction,skyDirection}=require('../src/explorer-math.js');
const {visibleSkySegments}=require('../src/explorer-math.js');
assert.equal(typeof visibleSkySegments,'function');
const skyRows=[{sun_az:10,sun_el:-1},{sun_az:20,sun_el:0},{sun_az:30,sun_el:1},{sun_az:40,sun_el:2},{sun_az:50,sun_el:-1}];
assert.deepEqual(visibleSkySegments(skyRows,'sun'),[skyDirection(30,1),skyDirection(40,2)],'sky traces must not imply a visible path below the horizon or invent a crossing');
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
for(const [lat,lon]of [[0,0],[-89.5,0],[-88.5,90],[-89,180],[90,90]]){
 const f=frame(lat,lon);
 for(const v of Object.values(f))close(Math.hypot(...v),1);
 close(dot(f.up,f.north),0);close(dot(f.up,f.east),0);close(dot(f.east,f.north),0);
 for(const az of [0,90,180,270,359.9])for(const el of [-90,-4.15,0,1.26,90]){
  const d=direction(lat,lon,az,el);close(Math.hypot(...d),1);close(dot(d,f.up),Math.sin(el*Math.PI/180));
  close(dot(d,f.north),Math.cos(az*Math.PI/180)*Math.cos(el*Math.PI/180));
  close(dot(d,f.east),Math.sin(az*Math.PI/180)*Math.cos(el*Math.PI/180));
 }
}
assert.deepEqual(skyDirection(0,0),[0,0,-1]);
close(skyDirection(90,0)[0],1);close(skyDirection(0,90)[1],1);
console.log('Passed: orthonormal lunar local frames, north/east azimuth convention, below/above-horizon projections, and normalized sky directions.');
const presentation=require('../src/explorer-math.js');
const rows=[{time:0,sun_el:2,earth_el:-4},{time:10,sun_el:1,earth_el:-3},{time:100,sun_el:3,earth_el:-2}];
assert.deepEqual(presentation.bearingPoint(0,10),{x:0,y:-10});
close(presentation.bearingPoint(90,10).x,10);
close(presentation.bearingPoint(180,10).y,10);
assert.equal(presentation.nearestIndex(rows,.12),1,'time spacing, not array spacing');
assert.equal(presentation.nearestIndex(rows,2),2);
assert.equal(presentation.nearestIndex(rows,-1),0);
const plot=presentation.elevationPlot(rows,6,100,50);
close(plot.sun[1].x,10);close(plot.sun.at(-1).x,100);
assert.ok(plot.min < -4 && plot.max > 6,'domain includes both bodies and threshold');
assert.ok(plot.sun[0].y < plot.earth[0].y,'greater elevation plots higher');
assert.ok(plot.thresholdY >= 0 && plot.thresholdY <= 50);
assert.equal(presentation.assessment(rows[0],0).limiter,'earth');
assert.equal(presentation.assessment(rows[0],0).both,false);
assert.equal(presentation.assessment({sun_el:2,earth_el:3},2).sun,false,'threshold is strict');
assert.equal(presentation.assessment({sun_el:3,earth_el:4},2).both,true);
console.log('Passed: azimuth plotting, irregular-time chart selection, elevation domain and strict-threshold explanations.');
const intervals=[{time:0,sun:true,earth:false},{time:1,sun:true,earth:true},{time:4,sun:false,earth:true},{time:10,sun:true,earth:true}];
assert.deepEqual(presentation.visibilityRanges(intervals,'sun'),[{left:0,width:40}]);
assert.deepEqual(presentation.visibilityRanges(intervals,'both'),[{left:10,width:30}]);
assert.deepEqual(presentation.visibilityRanges([{time:0,sun:false},{time:1,sun:true}],'sun'),[],'final sample closes the interval');
