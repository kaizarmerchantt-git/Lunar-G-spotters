(function(root){
  'use strict';
  function validate(bundle){
    if(bundle?.schema!=='selene-terrain-v1'||bundle.pixel_m!==80||bundle.radius_m!==1737400||bundle.range_m!==100000||bundle.radial_step_m!==80||bundle.azimuth_step_deg!==1||bundle.floor_deg!==0||!Array.isArray(bundle.profiles)||!bundle.profiles.length||!/^[a-f0-9]{64}$/.test(bundle.sha256)||!/^[a-f0-9]{64}$/.test(bundle.label_sha256))throw Error('Invalid terrain source metadata');
    for(const p of bundle.profiles){
      if(!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>180||p.observer_height_m!==2||!Number.isFinite(p.ground_height_m)||p.bins?.length!==360)throw Error('Invalid terrain coordinate');
      p.bins.forEach((b,i)=>{if(b.az!==i||!Number.isFinite(b.el)||b.el<0||b.el>90||!Number.isFinite(b.distance_m)||b.distance_m<80||b.distance_m>100000||!Number.isFinite(b.height_m))throw Error('Invalid terrain horizon bin');});
    }
    return bundle;
  }
  function match(bundle,site){return site?bundle.profiles.find(p=>Math.abs(p.lat-site.lat)<1e-7&&Math.abs((((p.lon-site.lon)%360)+540)%360-180)<1e-7)||null:null;}
  function elevation(profile,az){
    if(!Number.isFinite(az))throw Error('Invalid azimuth');
    const a=((az%360)+360)%360,i=Math.floor(a),f=a-i;
    return profile.bins[i].el*(1-f)+profile.bins[(i+1)%360].el*f;
  }
  function evaluate(rows,profile,obstruction=0,margin=0){
    if(!Number.isFinite(obstruction)||!Number.isFinite(margin)||obstruction<0||margin<0)throw Error('Invalid terrain cutoff assumptions');
    if(!Array.isArray(rows)||rows.length<2||rows.length>10000)throw Error('Terrain requires 2–10,000 samples');
    const samples=rows.map(r=>{
      if(!r||!['time','sun_az','sun_el','earth_az','earth_el'].every(k=>Number.isFinite(r[k]))||Math.abs(r.sun_el)>90||Math.abs(r.earth_el)>90||r.sun_az<0||r.sun_az>=360||r.earth_az<0||r.earth_az>=360)throw Error('Invalid terrain observer sample');
      const sun_cutoff=Math.max(obstruction,elevation(profile,r.sun_az))+margin,earth_cutoff=Math.max(obstruction,elevation(profile,r.earth_az))+margin;
      return {...r,sun_cutoff,earth_cutoff,sun:r.sun_el>sun_cutoff,earth:r.earth_el>earth_cutoff};
    });
    let total=0,sun=0,earth=0,both=0,longest=0,outage=0;
    for(let i=0;i<samples.length-1;i++){
      const s=samples[i],dt=(samples[i+1].time-s.time)/3600000;
      if(!(dt>0))throw Error('Terrain samples must increase');
      total+=dt;if(s.sun)sun+=dt;if(s.earth){earth+=dt;outage=0;}else{outage+=dt;longest=Math.max(longest,outage);}if(s.sun&&s.earth)both+=dt;
    }
    return {samples,total,sun,earth,both,longest};
  }
  function nextSet(samples,index,body){
    if(!samples[index][body])return {blocked:true};
    for(let i=index+1;i<samples.length;i++)if(!samples[i][body])return {from:samples[i-1].time-samples[index].time,to:samples[i].time-samples[index].time,index:i};
    return null;
  }
  const api={validate,match,elevation,evaluate,nextSet};
  if(typeof module!=='undefined')module.exports=api;else root.SeleneTerrain=api;
})(typeof window!=='undefined'?window:globalThis);
