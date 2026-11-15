(function(root){
  'use strict';
  const model=typeof module!=='undefined'?require('./model.js'):root.LunarModel;
  const MAX_BYTES=4000000,MAX_CASES=6;
  const text=(value,label,max,required=true)=>{
    if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`${label} must be ${required?'nonempty and ':''}at most ${max} characters.`);
    return value;
  };
  function csv(value){
    return 'time_utc,sun_az,sun_el,earth_az,earth_el\n'+value.rows.map(r=>[new Date(r.time).toISOString(),r.sun_az,r.sun_el,r.earth_az,r.earth_el].join(',')).join('\n');
  }
  function validate(value){
    if(!value||typeof value!=='object')throw new Error('Invalid scenario.');
    if(!['nasa','imported','synthetic'].includes(value.mode))throw new Error('Invalid source category.');
    if(!Number.isFinite(value.horizon)||value.horizon<0||value.horizon>10||!Number.isFinite(value.margin)||value.margin<0||value.margin>3)throw new Error('Threshold components must be in the supported range.');
    if(!Number.isInteger(value.horizon*2)||!Number.isInteger(value.margin*4))throw new Error('Use obstruction steps of 0.5° and margin steps of 0.25°.');
    if(!Array.isArray(value.rows)||value.rows.length<2||value.rows.length>10000)throw new Error('Provide 2–10,000 samples.');
    for(const r of value.rows){
      if(r&&!Number.isInteger(r.time))throw new Error('UTC times must use whole milliseconds.');
      if(!r||['time','sun_az','sun_el','earth_az','earth_el'].some(k=>!Number.isFinite(r[k]))||r.time<Date.parse('0000-01-01T00:00:00Z')||r.time>Date.parse('9999-12-31T23:59:59Z'))throw new Error('Invalid numeric sample or UTC time range.');
    }
    const rows=model.parseCSV(csv(value));
    if(!Number.isInteger(value.index)||value.index<0||value.index>=rows.length)throw new Error('Selected sample is outside this dataset.');
    let site=null;
    if(value.site!=null){
      if(!Number.isFinite(value.site.lat)||Math.abs(value.site.lat)>90||!Number.isFinite(value.site.lon)||Math.abs(value.site.lon)>360)throw new Error('Invalid coordinates.');
      site={lat:value.site.lat,lon:value.site.lon};
    }
    const siteIndex=Number.isInteger(value.siteIndex)&&value.siteIndex>=0&&value.siteIndex<32?value.siteIndex:null;
    return {id:text(value.id,'Scenario ID',100),name:text(value.name,'Scenario name',100),datasetName:text(value.datasetName,'Dataset name',100),notes:text(value.notes||'','Notes',500,false),mode:value.mode,site,siteIndex,horizon:value.horizon,margin:value.margin,index:value.index,provenance:text(value.provenance,'Provenance',20000),rows};
  }
  function capture(state,options){
    return validate({id:options.id,name:options.name||state.name,datasetName:state.name,notes:options.notes||'',mode:state.mode,site:state.site,siteIndex:state.siteIndex,horizon:state.horizon,margin:state.margin,index:state.index,provenance:state.provenance,rows:state.samples});
  }
  function summary(value){return model.evaluate(value.rows,value.horizon,value.margin);}
  function checkList(values){
    if(!Array.isArray(values)||values.length>MAX_CASES)throw new Error('Keep at most six scenarios in one notebook.');
    const result=values.map(validate);
    if(new Set(result.map(v=>v.id)).size!==result.length)throw new Error('Duplicate scenario IDs.');
    return result;
  }
  function encode(values){
    const data=JSON.stringify({schema:1,scenarios:checkList(values)},null,2);
    if(new TextEncoder().encode(data).length>MAX_BYTES)throw new Error('Notebook exceeds the 4 MB limit.');
    return data;
  }
  function decode(data){
    if(typeof data!=='string'||data.length>MAX_BYTES||new TextEncoder().encode(data).length>MAX_BYTES)throw new Error('Notebook exceeds the 4 MB limit.');
    let parsed;try{parsed=JSON.parse(data);}catch{throw new Error('This is not a valid JSON notebook.');}
    if(!parsed||parsed.schema!==1)throw new Error('Unsupported notebook version.');
    return checkList(parsed.scenarios);
  }
  function merge(existing,incoming){
    const result=existing.map(validate);
    for(const item of incoming.map(validate)){
      const previous=result.find(v=>v.id===item.id);
      if(previous&&JSON.stringify(previous)!==JSON.stringify(item))throw new Error('A scenario ID already exists with different contents. Existing data was kept.');
      if(!previous)result.push(item);
    }
    encode(result);return result;
  }
  function matchesCache(scenario,dataset){
    return scenario.mode==='nasa'&&dataset&&scenario.site?.lat===dataset.lat&&scenario.site?.lon===dataset.lon&&scenario.rows.length===dataset.rows.length&&scenario.rows.every((r,i)=>['time','sun_az','sun_el','earth_az','earth_el'].every(k=>r[k]===dataset.rows[i][k]));
  }
  const percent=(v,total)=>(100*v/total).toFixed(1)+'%';
  function report(values){
    const cases=checkList(values);
    const lines=['SELENE / LUNAR OBSERVER GEOMETRY REVIEW','Research prototype — NOT AN OPERATIONAL PLANNING TOOL','',
      'CONVENTIONS','Time: UTC. Angles: degrees. Azimuth: north 0°, increasing eastward.',
      'Visibility: body-center elevation strictly greater than obstruction + margin.',
      'Fractions and longest Earth-below-threshold intervals use the left sample of each interval.',
      'The final sample closes the window. Sampling may miss crossings and short intervals.',
      'This notebook report uses flat-reference cutoffs. The separate LOLA terrain study has its own export.',
      'No solar-disk, relay, link, power, thermal or uncertainty model is included.',
      'Source labels in a portable notebook are supplied metadata, not independent verification.',
      'Different windows or thresholds do not establish a fair landing-site ranking. No NASA endorsement.',''];
    cases.forEach((s,i)=>{
      const r=summary(s),sample=s.rows[s.index],threshold=s.horizon+s.margin;
      const maxGap=Math.max(...s.rows.slice(1).map((row,j)=>(row.time-s.rows[j].time)/3600000));
      lines.push(`${String(i+1).padStart(2,'0')} / ${s.name}`,`Dataset: ${s.datasetName}`,`Source category: ${s.mode==='nasa'?'NASA cache snapshot (verify against active cache)':s.mode==='synthetic'?'SYNTHETIC — NOT NASA PREDICTIONS':'USER SUPPLIED — NOT INDEPENDENTLY VERIFIED'}`,
        `Coordinate: ${s.site?`${s.site.lat} latitude, ${s.site.lon} longitude degrees`:'not supplied'}`,
        `Window: ${new Date(s.rows[0].time).toISOString()} to ${new Date(s.rows.at(-1).time).toISOString()}`,
        `Samples: ${s.rows.length}; duration: ${r.total.toFixed(2)} h; largest sample gap: ${maxGap.toFixed(2)} h`,
        `Obstruction: ${s.horizon.toFixed(2)}°; margin: ${s.margin.toFixed(2)}°; threshold: ${threshold.toFixed(2)}°`,
        `Sun above threshold: ${percent(r.sun,r.total)}; Earth: ${percent(r.earth,r.total)}; both: ${percent(r.both,r.total)}`,
        `Longest sampled Earth-below-threshold interval: ${r.longest.toFixed(2)} h`,
        `Selected sample: ${new Date(sample.time).toISOString()}`,
        `Sun: azimuth ${sample.sun_az.toFixed(3)}°, elevation ${sample.sun_el.toFixed(3)}°`,
        `Earth: azimuth ${sample.earth_az.toFixed(3)}°, elevation ${sample.earth_el.toFixed(3)}°`,
        `Minimum center clearance: ${(Math.min(sample.sun_el,sample.earth_el)-threshold).toFixed(3)}°`,
        `Investigator notes: ${s.notes||'(none)'}`,'SOURCE RECORD',s.provenance,'');
    });
    return lines.join('\n');
  }
  function createStore(provider,key='selene.notebook.v1'){
    let blocked=false;
    return {
      read(){try{const raw=provider().getItem(key);return {cases:raw?decode(raw):[],blocked:false};}catch{blocked=true;return {cases:[],blocked:true};}},
      write(values){const text=encode(values);if(blocked)return false;try{provider().setItem(key,text);return true;}catch{return false;}}
    };
  }
  function createFileDraft(){
    let selected=null,pending=null,revision=0;
    function select(file){
      revision++;selected=file;
      // Capture bytes while the browser's freshly selected handle is readable.
      // Settle failures as values so selection cannot create unhandled rejections.
      pending=file?Promise.resolve().then(()=>{
        if(file.size>2000000)throw new Error('Maximum CSV size is 2 MB.');
        return file.text();
      }).then(text=>({text}),error=>({error})):null;
    }
    return {select,async read(file){
      if(file!==selected)select(file);
      if(!pending)throw new Error('Choose a geometry CSV or paste its contents.');
      const version=revision,result=await pending;
      if(version!==revision)throw new Error('File selection changed while reading. Click Load geometry again.');
      if(result.error){
        if(['NotReadableError','NotFoundError','SecurityError','AbortError'].includes(result.error.name)){
          const error=new Error('The browser could not read this file. Save a copy in Downloads, select it again, and retry. Or open the CSV in a text editor and paste its contents below. Your current analysis is unchanged.');error.code='FILE_UNREADABLE';throw error;
        }
        throw result.error;
      }
      return result.text;
    }};
  }
  const api={validate,capture,summary,encode,decode,merge,matchesCache,csv,report,createStore,createFileDraft,MAX_CASES};
  if(typeof module!=='undefined')module.exports=api;else root.SeleneNotebookData=api;
})(typeof window!=='undefined'?window:globalThis);
