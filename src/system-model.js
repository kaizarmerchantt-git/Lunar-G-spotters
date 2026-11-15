(function(root){
  'use strict';
  function interpolate(rows,time){
    if(!Number.isFinite(time)||time<rows[0].time||time>rows.at(-1).time)throw new Error('Time outside cached system window');
    let low=0,high=rows.length-1;
    while(high-low>1){const m=(low+high)>>1;if(rows[m].time<=time)low=m;else high=m;}
    const a=rows[low],b=rows[high],f=(time-a.time)/(b.time-a.time);
    return a.position.map((v,i)=>v+(b.position[i]-v)*f);
  }
  function magnitude(p){return Math.hypot(...p);}
  function orbitGuide(rows,time,count=144){
    const position=interpolate(rows,time),radius=magnitude(position);
    let i=rows.findIndex(row=>row.time>time);if(i<0)i=rows.length-1;
    const a=rows[Math.max(0,i-1)].position,b=rows[i].position;
    const velocity=b.map((v,k)=>v-a[k]);
    const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const normal=cross(position,velocity),n=magnitude(normal);
    if(!radius||!n)throw new Error('Cannot construct orbital orientation guide');
    const x=position.map(v=>v/radius),y=cross(normal.map(v=>v/n),x);
    // A circular orientation aid at the instantaneous radius, not an ephemeris.
    return Array.from({length:count+1},(_,j)=>{
      const angle=j/count*Math.PI*2;
      return x.map((v,k)=>radius*(v*Math.cos(angle)+y[k]*Math.sin(angle)));
    });
  }
  function sceneLayout({w,h,sun,moon,yaw=0,tilt=0,zoom=1,mode='lunar'}){
    const solar=mode==='solar',rail=Math.min(200,Math.max(90,w*.23)),localWidth=w-rail;
    const scale=solar?(w*.70/160e6):Math.min(localWidth*.35,h*.32)/450000*zoom;
    const origin=solar?[w*.85,h*.49]:[rail+localWidth*.5,h*.51];
    // Orthographic projection: one km has one display length in either axis.
    const c=Math.cos(yaw),s=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
    const rawCamera=v=>{const x=v[0]*c-v[1]*s,y=v[0]*s+v[1]*c;return [x,-y*ct+v[2]*st,y*st+v[2]*ct];};
    // Fixed camera basis: user yaw and tilt are independent, with no automatic roll.
    const roll=0,camera=rawCamera;
    const su=sun.map(v=>v/magnitude(sun));
    const project=v=>{const q=solar?[-v.reduce((sum,x,i)=>sum+x*su[i],0),0,0]:camera(v);return {point:[origin[0]+q[0]*scale,origin[1]+q[1]*scale],depth:q[2],factor:1};};
    return {scale,project,camera,roll,localBounds:{left:rail,right:w},points:{earth:origin,moon:project(moon).point,sun:solar?project(sun).point:[rail*.5,h*.46]}};
  }
  function earthSpin(epoch){return (280.46061837+360.98564736629*(epoch/86400000-10957.5))*Math.PI/180;}
  function surfaceBrightness(normal,light){
    return createLighting(light)(...normal);
  }
  function createLighting(light){
    const length=magnitude(light)||1,x=light[0]/length,y=light[1]/length,z=light[2]/length;
    return (nx,ny,nz)=>Math.pow(.001+.999*Math.max(0,Math.min(1,nx*x+ny*y+nz*z)),1/2.2);
  }
  function diskTrackSegments(points,body){
    const segments=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],x=a.point[0]-body.point[0],y=a.point[1]-body.point[1],dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1];
      const A=dx*dx+dy*dy;if(A<1e-12)continue;
      const B=2*(x*dx+y*dy),C=x*x+y*y-body.radius*body.radius,D=B*B-4*A*C;if(D<0)continue;
      const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));if(hi<=lo)continue;
      const cuts=[lo,hi],cross=-a.depth/(b.depth-a.depth);if(cross>lo&&cross<hi)cuts.splice(1,0,cross);
      for(let j=1;j<cuts.length;j++){const l=cuts[j-1],r=cuts[j],p=t=>[a.point[0]+dx*t,a.point[1]+dy*t];segments.push({a:p(l),b:p(r),hidden:a.depth+(b.depth-a.depth)*(l+r)/2<0});}
    }
    return segments;
  }
  const api={interpolate,magnitude,orbitGuide,sceneLayout,earthSpin,surfaceBrightness,createLighting,diskTrackSegments};
  if(typeof module!=='undefined')module.exports=api;else root.SystemModel=api;
})(typeof window!=='undefined'?window:globalThis);
