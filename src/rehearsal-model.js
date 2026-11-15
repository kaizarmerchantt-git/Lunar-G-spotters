(function(root){
  'use strict';
  const R=1737400,rad=Math.PI/180;
  const finite=(...v)=>v.every(Number.isFinite);
  function rayIndex(az){if(!Number.isFinite(az))throw Error('Invalid bearing');return ((Math.round(az)%360)+360)%360;}
  function point(az,distance,height,ground){
    if(!finite(az,distance,height,ground)||distance<0||distance>150000)throw Error('Invalid terrain point');
    const a=az*rad,d=distance/R,r=R+height,horizontal=r*Math.sin(d);
    // east / up / south; coordinates in metres, origin at the observer's eye.
    return [horizontal*Math.sin(a),r*Math.cos(d)-(R+ground+2),-horizontal*Math.cos(a)];
  }
  function elevation(height,ground,distance){const p=point(0,distance,height,ground);return Math.atan2(p[1],-p[2])/rad;}
  function destination(site,az,distance){
    const p=site.lat*rad,l=site.lon*rad,a=az*rad,d=distance/R;
    // Cartesian local frame remains defined at the pole: longitude sets the north meridian.
    const sp=Math.sin(p),cp=Math.cos(p),sl=Math.sin(l),cl=Math.cos(l),c=Math.cos(d),s=Math.sin(d),ca=Math.cos(a),sa=Math.sin(a);
    const x=cp*cl*c+(-sp*cl*ca-sl*sa)*s,y=cp*sl*c+(-sp*sl*ca+cl*sa)*s,z=sp*c+cp*ca*s;
    return {lat:Math.atan2(z,Math.hypot(x,y))/rad,lon:((Math.atan2(y,x)/rad+540)%360)-180};
  }
  function validate(d,bundle,profile){
    if(d?.schema!=='selene-rehearsal-v1'||d.source_sha256!==bundle.sha256||d.label_sha256!==bundle.label_sha256||!profile||d.site?.lat!==profile.lat||d.site?.lon!==profile.lon||d.radius_m!==R||d.observer_height_m!==2||d.radial_step_m!==80||d.range_m!==100000||d.azimuth_step_deg!==1||d.height_unit_m!==.001||!Number.isFinite(d.ground_height_m)||Math.abs(d.ground_height_m-profile.ground_height_m)>.000501)throw Error('Terrain rehearsal source or coordinate mismatch');
    const m=d.mesh,valid=a=>Array.isArray(a)&&a.every(v=>Number.isSafeInteger(v)&&Math.abs(v)<15000000);
    if(m?.order!=='row north ascending; column east ascending'||m?.size!==241||m.step_m!==160||m.half_extent_m!==19200||!valid(m.heights_mm)||m.heights_mm.length!==241**2||!Array.isArray(d.rays_mm)||d.rays_mm.length!==360||!d.rays_mm.every(a=>valid(a)&&a.length===1250))throw Error('Invalid terrain rehearsal grid');
    return d;
  }
  function section(data,profile,az){
    const index=rayIndex(az),heights=data.rays_mm[index],points=[];let maximum=-Infinity,best=0;
    heights.forEach((mm,i)=>{const distance=(i+1)*data.radial_step_m,height=mm/1000,p=point(index,distance,height,data.ground_height_m),el=Math.atan2(p[1],Math.hypot(p[0],p[2]))/rad;
      points.push({distance,height,point:p,elevation:el});if(el>maximum){maximum=el;best=i;}});
    const blocker=points[best],a=index*rad;
    return {az:index,points,index:best,distance_m:blocker.distance,height_m:blocker.height,elevation_deg:maximum,
      floorLimited:maximum<=0,coordinates:destination(data.site,index,blocker.distance),
      outsidePatch:Math.abs(blocker.distance*Math.sin(a))>data.mesh?.half_extent_m||Math.abs(blocker.distance*Math.cos(a))>data.mesh?.half_extent_m,
      published_horizon_deg:profile.bins[index].el};
  }
  const api={point,elevation,destination,rayIndex,validate,section};
  if(typeof module!=='undefined')module.exports=api;else root.SeleneRehearsal=api;
})(typeof window!=='undefined'?window:globalThis);
