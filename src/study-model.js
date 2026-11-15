(function(root){
  'use strict';
  // Duration belongs to [sample_i, sample_i+1). No crossing interpolation.
  function analyze(rows,threshold){
    let total=0,sun=0,earth=0,both=0,minSun=Infinity,maxSun=-Infinity,
      minEarth=Infinity,maxEarth=-Infinity,cadenceMin=Infinity,cadenceMax=0,
      limitingIndex=0,clearance=Infinity;
    for(let i=0;i<rows.length-1;i++){
      const r=rows[i],hours=(rows[i+1].time-r.time)/3600000;
      total+=hours;cadenceMin=Math.min(cadenceMin,hours);cadenceMax=Math.max(cadenceMax,hours);
      minSun=Math.min(minSun,r.sun_el);maxSun=Math.max(maxSun,r.sun_el);
      minEarth=Math.min(minEarth,r.earth_el);maxEarth=Math.max(maxEarth,r.earth_el);
      if(r.sun_el>threshold)sun+=hours;
      if(r.earth_el>threshold)earth+=hours;
      if(r.sun_el>threshold&&r.earth_el>threshold)both+=hours;
      const gap=Math.min(r.sun_el,r.earth_el)-threshold;
      if(gap<clearance){clearance=gap;limitingIndex=i;}
    }
    return {total,sun,earth,both,minSun,maxSun,minEarth,maxEarth,cadenceMin,cadenceMax,limitingIndex,clearance};
  }
  function sweep(rows,margin){
    return Array.from({length:21},(_,i)=>({obstruction:i/2,threshold:i/2+margin,...analyze(rows,i/2+margin)}));
  }
  function nextChange(rows,index,threshold){
    for(let i=index+1;i<rows.length;i++){
      const bodies=['sun','earth'].filter(k=>(rows[i][k+'_el']>threshold)!==(rows[i-1][k+'_el']>threshold));
      if(bodies.length)return {index:i,from:rows[i-1].time,to:rows[i].time,bodies,above:bodies.map(k=>rows[i][k+'_el']>threshold)};
    }
    return null;
  }
  const api={analyze,sweep,nextChange};
  if(typeof module!=='undefined')module.exports=api;else root.SeleneStudy=api;
})(typeof window!=='undefined'?window:globalThis);
