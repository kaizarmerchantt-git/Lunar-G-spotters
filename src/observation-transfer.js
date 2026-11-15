(function(root){
  'use strict';
  const M=typeof module!=='undefined'?require('./model.js'):root.LunarModel;
  const conventions=Object.freeze({time:'UTC',angles:'degrees',azimuth:'north=0,east=90',observerBody:'Moon'});
  const MAX_BYTES=2000000;
  function text(value,label,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(label+' is missing or too long.');return value.trim();}
  function location(value){
    if(value==null)return null;
    if(!Number.isFinite(value.lat)||Math.abs(value.lat)>90||!Number.isFinite(value.lon)||Math.abs(value.lon)>180)throw new Error('Use lunar coordinates: latitude -90 to 90 and east longitude -180 to 180.');
    return {lat:value.lat,lon:value.lon};
  }
  function csv(rows){
    if(!Array.isArray(rows)||rows.length<2||rows.length>10000)throw new Error('Provide 2–10,000 observer samples.');
    return 'time_utc,sun_az,sun_el,earth_az,earth_el\n'+rows.map(r=>{
      if(!r||!['string','number'].includes(typeof r.time)||(typeof r.time==='number'&&!Number.isInteger(r.time)))throw new Error('Invalid observer UTC timestamp.');
      return [typeof r.time==='number'?new Date(r.time).toISOString():r.time,r.sun_az,r.sun_el,r.earth_az,r.earth_el].join(',');
    }).join('\n');
  }
  function prepareCSV({name,provenance,text:content,site=null}){
    text(name,'Observation name',100);text(provenance,'Source record',20000);
    if(typeof content!=='string'||new TextEncoder().encode(content).length>MAX_BYTES)throw new Error('Maximum observation size is 2 MB.');
    const observer=location(site),rows=M.parseCSV(content);
    return {name:name.trim(),provenance:provenance.trim(),site:observer,rows,category:'imported'};
  }
  function decode(content){
    if(typeof content!=='string'||new TextEncoder().encode(content).length>MAX_BYTES)throw new Error('Maximum observation size is 2 MB.');
    let value;try{value=JSON.parse(content);}catch{throw new Error('This is not a valid observation JSON file.');}
    if(value?.kind!=='selene.observation'||value.schema!==1)throw new Error('Choose a SELENE observation file (.selene.json), not a notebook or NASA raw response.');
    if(!value.conventions||Object.entries(conventions).some(([key,v])=>value.conventions[key]!==v))throw new Error('Observation conventions must be lunar observer angles in degrees, UTC, with north/east azimuth.');
    return prepareCSV({name:value.name,provenance:value.source,site:value.site,text:csv(value.rows)});
  }
  function encode(state){
    const value=prepareCSV({name:state.name,provenance:state.sourceRecord||state.provenance,site:state.site,text:csv(state.samples||state.rows)});
    const output=JSON.stringify({kind:'selene.observation',schema:1,name:value.name,source:value.provenance,site:value.site,conventions,rows:value.rows.map(r=>({...r,time:new Date(r.time).toISOString()}))},null,2);
    if(new TextEncoder().encode(output).length>MAX_BYTES)throw new Error('Maximum observation size is 2 MB. Export CSV or a notebook instead.');
    return output;
  }
  function describe(value){
    const locationText=value.site?`${Math.abs(value.site.lat)}° ${value.site.lat<0?'S':'N'} / ${Math.abs(value.site.lon)}° ${value.site.lon<0?'W':'E'}`:'Location not supplied — numerical analysis only';
    return `${value.name}\n${value.rows.length} samples · ${new Date(value.rows[0].time).toISOString()} → ${new Date(value.rows.at(-1).time).toISOString()}\n${locationText}\nSource category: user supplied; not independently verified.`;
  }
  const api={prepareCSV,decode,encode,describe,location};
  if(typeof module!=='undefined')module.exports=api;else root.SeleneObservationTransfer=api;
})(typeof window!=='undefined'?window:globalThis);
