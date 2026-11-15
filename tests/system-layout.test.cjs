'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const gradient={addColorStop(){}};
const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>(t[k]=v,true)});
const sandbox={window:{},Image:class{},document:{createElement:()=>({getContext:()=>ctx})},console};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('src/system-model.js','utf8'),sandbox);sandbox.SystemModel=sandbox.window.SystemModel;
vm.runInContext(fs.readFileSync('src/system-renderer.js','utf8'),sandbox);
const data=JSON.parse(fs.readFileSync('data/system-month.json','utf8'));
// Match runtime normalization of retained vector timestamps.
for(const body of Object.values(data.bodies))for(const row of body)row.time=Date.parse(row.time);
let checks=0,hiddenLayouts=0;
for(const [w,h] of [[360,420],[820,600],[1100,480]])for(const zoom of [.65,1,1.3])for(const tilt of [-1.5,0,.75,1.2,2,3.2])for(const yaw of [0,1,2,3,4,5])for(const row of data.bodies.moon.filter((_,i)=>i%72===0)){
 const p=sandbox.window.SeleneSystemRenderer.render({ctx,w,h,sun:data.bodies.sun[0].position,moon:row.position,yaw,tilt,zoom,data,epoch:row.time,selected:'moon',paths:false});
 assert.ok(p.sun.point[0]+p.sun.radius<p.earth.point[0]-p.earth.radius,'Pinned Sun overlaps local Earth');assert.ok(p.sun.point[0]+p.sun.radius<p.moon.point[0]-p.moon.radius,'Pinned Sun overlaps local Moon');assert.ok(p.sun.point[0]-p.sun.radius>=0);assert.ok(p.moon.point.every(Number.isFinite));checks++;
 assert.equal(p.earth.radius,Math.min(w<520?34:54,w*.1),'Earth disk must not shrink with camera alignment');
 const cameraYaw=Math.PI-Math.atan2(data.bodies.sun[0].position[1],data.bodies.sun[0].position[0])+yaw;
 const scene=sandbox.SystemModel.sceneLayout({w,h,sun:data.bodies.sun[0].position,moon:row.position,yaw:cameraYaw,tilt,zoom});
 const segments=sandbox.SystemModel.diskTrackSegments(sandbox.SystemModel.orbitGuide(data.bodies.moon,row.time).map(scene.project),{point:p.earth.point,radius:p.earth.radius});
 if(segments.some(s=>s.hidden))hiddenLayouts++;
}
assert.ok(hiddenLayouts>0,'tested camera sweep must exercise the reported behind-Earth track overlap');
for(const [w,h]of [[360,420],[820,600],[1100,480]]){
 const sun=data.bodies.sun[0].position,moon=data.bodies.moon[0].position;
 const p=sandbox.window.SeleneSystemRenderer.render({ctx,w,h,sun,moon,yaw:4,tilt:1.2,zoom:1.3,data,epoch:data.bodies.moon[0].time,selected:'sun',paths:true,scaleMode:'solar'});
 assert.ok(p.sun.point[0]>0&&p.sun.point[0]<p.earth.point[0]);
 assert.equal(p.sun.point[1],p.earth.point[1]);
}
console.log(`Passed: ${checks} camera layouts retain a pinned separate Sun and finite local geometry; solar distance layouts remain separate.`);

