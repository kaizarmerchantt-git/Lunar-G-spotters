(function(root){
  'use strict';
  const radians=d=>d*Math.PI/180;
  function frame(lat,lon){
    const p=radians(lat),l=radians(lon);
    return {up:[Math.cos(p)*Math.sin(l),Math.sin(p),Math.cos(p)*Math.cos(l)],east:[Math.cos(l),0,-Math.sin(l)],north:[-Math.sin(p)*Math.sin(l),Math.cos(p),-Math.sin(p)*Math.cos(l)]};
  }
  function direction(lat,lon,az,el){
    const f=frame(lat,lon),a=radians(az),e=radians(el);
    return f.up.map((v,i)=>v*Math.sin(e)+f.north[i]*Math.cos(e)*Math.cos(a)+f.east[i]*Math.cos(e)*Math.sin(a));
  }
  function skyDirection(az,el){const a=radians(az),e=radians(el);return [Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)];}
  function visibleSkySegments(rows,key){const points=[];for(let i=0;i<rows.length-1;i++)if(rows[i][key+'_el']>0&&rows[i+1][key+'_el']>0)for(const r of [rows[i],rows[i+1]])points.push(skyDirection(r[key+'_az'],r[key+'_el']));return points;}
  function bearingPoint(az,r){const a=radians(az);return {x:Math.sin(a)*r,y:-Math.cos(a)*r};}
  function nearestIndex(samples,fraction){
    const time=samples[0].time+Math.max(0,Math.min(1,fraction))*(samples.at(-1).time-samples[0].time);
    return samples.reduce((best,row,i)=>Math.abs(row.time-time)<Math.abs(samples[best].time-time)?i:best,0);
  }
  function elevationPlot(samples,threshold,width,height){
    const values=samples.flatMap(row=>[row.sun_el,row.earth_el]);
    const min=Math.min(0,threshold,...values)-1,max=Math.max(0,threshold,...values)+1;
    const first=samples[0].time,span=samples.at(-1).time-first||1;
    const y=v=>height*(max-v)/(max-min);
    const points=key=>samples.map(row=>({x:(row.time-first)/span*width,y:y(row[key])}));
    return {min,max,zeroY:y(0),thresholdY:y(threshold),sun:points('sun_el'),earth:points('earth_el')};
  }
  function assessment(sample,threshold){
    const sun=sample.sun_el>threshold,earth=sample.earth_el>threshold;
    return {sun,earth,both:sun&&earth,limiter:sample.sun_el===sample.earth_el?'both':sample.sun_el<sample.earth_el?'sun':'earth',clearance:Math.min(sample.sun_el,sample.earth_el)-threshold};
  }
  function visibilityRanges(samples,key){
    const result=[],first=samples[0].time,span=samples.at(-1).time-first;let start=null;
    for(let i=0;i<samples.length-1;i++){
      const on=key==='both'?samples[i].sun&&samples[i].earth:samples[i][key];
      if(on&&start===null)start=samples[i].time;
      if(start!==null&&(!on||i===samples.length-2)){
        const end=on?samples[i+1].time:samples[i].time;result.push({left:(start-first)/span*100,width:(end-start)/span*100});start=null;
      }
    }
    return result;
  }
  const api={frame,direction,skyDirection,visibleSkySegments,bearingPoint,nearestIndex,elevationPlot,assessment,visibilityRanges};
  if(typeof module!=='undefined')module.exports=api;else root.ExplorerMath=api;
})(typeof window!=='undefined'?window:globalThis);
