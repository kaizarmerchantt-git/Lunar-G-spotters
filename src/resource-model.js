(function(root){
  'use strict';
  const model=typeof module!=='undefined'?require('./model.js'):root.LunarModel;
  function normalize(value){
    if(!value||!Array.isArray(value.datasets)||value.datasets.length<1||value.datasets.length>32)throw new Error('Resource bundle requires 1–32 sites.');
    for(const key of ['provider','retrieved_utc','conventions'])if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>20000)throw new Error('Resource metadata is missing or too long: '+key);
    if(value.provider.length>200||value.retrieved_utc.length>100)throw new Error('Resource provider or retrieval label is too long.');
    let count=0;
    const datasets=value.datasets.map(d=>{
      if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>100)throw new Error('Each resource site requires a name of at most 100 characters.');
      if(!Number.isFinite(d.lat)||Math.abs(d.lat)>90||!Number.isFinite(d.lon)||Math.abs(d.lon)>360)throw new Error('Invalid resource coordinate.');
      if(!Array.isArray(d.rows)||d.rows.length<2||d.rows.length>10000)throw new Error('Each resource site requires 2–10,000 samples.');
      count+=d.rows.length;if(count>50000)throw new Error('Resource bundle exceeds 50,000 total samples.');
      const csv='time_utc,sun_az,sun_el,earth_az,earth_el\n'+d.rows.map(r=>{if(typeof r.time==='number'&&!Number.isInteger(r.time))throw new Error('Resource times must use whole milliseconds.');return [typeof r.time==='number'?new Date(r.time).toISOString():r.time,r.sun_az,r.sun_el,r.earth_az,r.earth_el].join(',');}).join('\n');
      return {...d,rows:model.parseCSV(csv)};
    });
    return {...value,datasets};
  }
  function days(rows){const seen=new Set(),result=[];rows.forEach((r,index)=>{const key=new Date(r.time).toISOString().slice(0,10);if(!seen.has(key)){seen.add(key);result.push({index,label:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(r.time)});}});return result;}
  function referenceCode(index){let text='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))text=String.fromCharCode(65+(n-1)%26)+text;return text;}
  function coordinate(lat,lon){const l=lon>180?lon-360:lon<-180?lon+360:lon;return `${Math.abs(lat)}° ${lat<0?'S':'N'} / ${Math.abs(l)}° ${l<0?'W':'E'}`;}
  const api={normalize,days,referenceCode,coordinate};
  if(typeof module!=='undefined')module.exports=api;else root.SeleneResources=api;
})(typeof window!=='undefined'?window:globalThis);
