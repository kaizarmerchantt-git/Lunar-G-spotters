'use strict';
const $ = id => document.getElementById(id);
const names = ['Ridge A', 'Ridge B', 'Crater rim C'];
let imported = null;
let importedCategory = 'imported';
let importedRecord = null;
let nasa = null, baseDatasetCount = 0, usingNASA = false, playback = null;
const labelFor = n => usingNASA ? nasa.datasets[n].name : names[n];
function rowsFor(n) { return usingNASA ? nasa.datasets[n].rows : LunarModel.fixture(Date.parse($('date').value + 'T00:00:00Z'), n); }
function stopPlayback() { clearInterval(playback); playback = null; window.SeleneSystem?.pause(); $('play').textContent = 'Play timeline'; $('play').setAttribute('aria-pressed', 'false'); $('globe-play').textContent='Play observation';$('globe-play').setAttribute('aria-pressed','false'); }
function pct(v, total) { return (100 * v / total).toFixed(1) + '%'; }
function current() { return imported ? imported.rows : rowsFor(Number($('site').value)); }
function render() {
  if (!$('date').value && !imported) return;
  const horizon = Number($('horizon').value), margin = Number($('margin').value);
  $('hval').textContent = horizon.toFixed(1) + '°'; $('mval').textContent = margin.toFixed(2) + '°';
  const result = LunarModel.evaluate(current(), horizon, margin), total = result.total;
  $('title').textContent = imported ? imported.name : labelFor(Number($('site').value));
  for (const key of ['sun', 'earth', 'both']) $(key).textContent = pct(result[key], total);
  $('outage').textContent = result.longest.toFixed(1) + ' h';
  $('scrub').max = result.samples.length - 1;
  $('scrub').value = Math.min(Number($('scrub').value), result.samples.length - 1);
  const index = Number($('scrub').value), s = result.samples[index];
  $('timestamp').textContent = new Date(s.time).toISOString().replace('.000Z', ' UTC');
  $('sample').textContent = `Sun: ${s.sun_el.toFixed(2)}° elevation / ${s.sun_az.toFixed(2)}° azimuth · ${s.sun ? 'visible' : 'blocked'}     |     Earth: ${s.earth_el.toFixed(2)}° elevation / ${s.earth_az.toFixed(2)}° azimuth · ${s.earth ? 'visible' : 'blocked'}`;
  const rows = result.samples, min = Math.min(-2, ...rows.flatMap(r => [r.sun_el, r.earth_el])), max = Math.max(12, horizon + margin + 1, ...rows.flatMap(r => [r.sun_el, r.earth_el]));
  const x = t => 42 + (t - rows[0].time) / (rows.at(-1).time - rows[0].time) * 690;
  const y = e => 200 - (e - min) / (max - min) * 180;
  const path = key => rows.map((r,i) => `${i ? 'L' : 'M'}${x(r.time).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
  let grid = '';
  for(let i=0;i<=4;i++){const el=min+(max-min)*i/4;grid+=`<line x1="42" y1="${y(el)}" x2="732" y2="${y(el)}" stroke="#293540"/><text x="3" y="${y(el)+4}" fill="#9baab8" font-size="10">${el.toFixed(0)}°</text>`;}
  for(let i=0;i<=4;i++) grid+=`<text x="${42+i*172.5}" y="224" fill="#9baab8" font-size="10" text-anchor="middle">${(total*i/4).toFixed(1)} h</text>`;
  $('chart').innerHTML = `<svg viewBox="0 0 750 235" role="img" aria-label="Sun and Earth elevation curves; exact current sample values appear below">${grid}<line x1="42" x2="732" y1="${y(horizon+margin)}" y2="${y(horizon+margin)}" stroke="#b5a17b" stroke-dasharray="5 5"/><path d="${path('sun_el')}" fill="none" stroke="#f3c782" stroke-width="2.5"/><path d="${path('earth_el')}" fill="none" stroke="#8ecdc5" stroke-width="2.5"/><line x1="${x(s.time)}" x2="${x(s.time)}" y1="20" y2="200" stroke="#ffffff66"/></svg>`;
  $('comparison').replaceChildren();
  const comparisonResults=[];
  (imported ? [0] : usingNASA ? nasa.datasets.map((_,i)=>i) : [0,1,2]).forEach(n => {
    const r = LunarModel.evaluate(imported ? imported.rows : rowsFor(n), horizon, margin), tr = document.createElement('tr');
    if (imported || n === Number($('site').value)) tr.className = 'selected';
    [imported ? imported.name : labelFor(n), ...['sun','earth','both'].map(k=>pct(r[k],r.total))].forEach(v => {const td=document.createElement('td');td.textContent=v;tr.append(td);});
    $('comparison').append(tr);
    comparisonResults.push({geometry:imported?imported.rows:rowsFor(n),index:n,name:imported?imported.name:labelFor(n),lat:imported?imported.site?.lat??null:usingNASA?nasa.datasets[n].lat:null,lon:imported?imported.site?.lon??null:usingNASA?nasa.datasets[n].lon:null,sun:pct(r.sun,r.total),earth:pct(r.earth,r.total),both:pct(r.both,r.total),outage:r.longest,start:r.samples[0].time,end:r.samples.at(-1).time});
  });
  $('record').textContent = imported ? `USER-SUPPLIED · NOT INDEPENDENTLY VERIFIED\n${imported.name}\n${imported.provenance}\nObserver location supplied separately: ${imported.site?JSON.stringify(imported.site)+' / degrees north and east':'not supplied'}\n${rows.length} samples · ${new Date(rows[0].time).toISOString()} → ${new Date(rows.at(-1).time).toISOString()}` : 'SYNTHETIC FIXTURE\nFictional sites; trigonometric curves for interface testing only.\nNo ephemeris, real coordinates, kernels or terrain data. Changing the date shifts timestamps only.\n73 samples spanning 72 hours, one-hour cadence.';
  if (usingNASA && !imported) $('record').textContent = JSON.stringify({provider:nasa.provider,retrieved_utc:nasa.retrieved_utc,conventions:nasa.conventions,...nasa.datasets[Number($('site').value)],rows:undefined}, null, 2);
  if(imported&&importedCategory==='synthetic')$('record').textContent='SYNTHETIC SNAPSHOT — NOT NASA PREDICTIONS\n'+imported.provenance;
  if(imported&&importedRecord)$('record').textContent=importedRecord;
  $('compare-note').textContent = usingNASA && !imported ? 'NASA/JPL geometry at the loaded reference coordinates. No terrain screening; not a ranking of approved landing sites.' : 'Illustrative scenarios or user-supplied data; no independently validated landing-site ranking.';
  renderSky(result, index);
  window.SeleneSystem?.update({epoch:s.time,nextEpoch:rows[Math.min(index+1,rows.length-1)].time,playing:Boolean(playback),stepMs:Number($('speed').value),mode:usingNASA&&!imported?'nasa':'other'});
  $('strip-epoch').textContent = new Date(s.time).toISOString().replace('T',' · ').replace(':00.000Z','');
  $('strip-sun').textContent = s.sun_el.toFixed(2)+'° / '+(s.sun?'above threshold':'below threshold');
  $('strip-earth').textContent = s.earth_el.toFixed(2)+'° / '+(s.earth?'above threshold':'below threshold');
  $('strip-sample').textContent = `${index+1} / ${rows.length} samples`;
  $('strip-progress').style.width = `${index/(rows.length-1)*100}%`;
  if(window.SeleneGlobe)window.SeleneGlobe.update({source:imported?'User-supplied geometry':usingNASA?'NASA/JPL Horizons · lunar reference points':'Synthetic demonstration · no real coordinates',name:imported?imported.name:labelFor(Number($('site').value)),sites:usingNASA&&!imported?nasa.datasets:null,selected:Number($('site').value),time:new Date(s.time).toISOString().replace('T',' · ').replace('.000Z',''),sun:s.sun_el.toFixed(2)+'°',earth:s.earth_el.toFixed(2)+'°',message:s.sun&&s.earth?'Both body centers clear the selected threshold at this sample.':s.sun?'Sun clears the threshold; Earth does not. Direct-to-Earth visibility is unavailable at this sample.':s.earth?'Earth clears the threshold; Sun does not. Solar illumination is unavailable at this sample.':'Neither body center clears the selected threshold at this sample.'});
  window.SeleneObservation={samples:result.samples,geometry:current(),index,name:$('title').textContent,horizon,margin,provenance:$('record').textContent,sourceRecord:imported?imported.provenance:$('record').textContent,threshold:horizon+margin,fractions:{sun:pct(result.sun,total),earth:pct(result.earth,total)},mode:usingNASA&&!imported?'nasa':imported?importedCategory:'synthetic',provider:usingNASA&&!imported?nasa.provider:'User / illustrative',siteIndex:imported?0:Number($('site').value),comparisons:comparisonResults,site:imported?(imported.site?{...imported.site}:null):usingNASA?{lat:nasa.datasets[Number($('site').value)].lat,lon:nasa.datasets[Number($('site').value)].lon}:null};
  document.dispatchEvent(new CustomEvent('observation-change',{detail:window.SeleneObservation}));
}
function renderSky(result,index) {
  const rows=result.samples, s=rows[index];
  const point=(az,el)=>{const a=az*Math.PI/180,r=(90-el)/90*112;return [180+r*Math.sin(a),160-r*Math.cos(a)];};
  const track=key=>rows.map((r,i)=>{const p=point(r[key+'_az'],r[key+'_el']);return `${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`;}).join(' ');
  const marker=(key,color)=>{const p=point(s[key+'_az'],s[key+'_el']);return `<line x1="180" y1="160" x2="${p[0]}" y2="${p[1]}" stroke="${color}" opacity=".3"/><circle cx="${p[0]}" cy="${p[1]}" r="${key==='sun'?8:6}" fill="${color}" opacity="${s[key]?1:.3}"/><text x="${p[0]+12}" y="${p[1]+4}" fill="${color}" font-size="12">${key==='sun'?'Sun':'Earth'}</text>`;};
  $('sky').innerHTML=`<svg viewBox="0 0 360 320" role="img" aria-label="Local sky compass, north up and east right. Horizon is the outer circle. Bodies below the horizon appear outside it."><circle cx="180" cy="160" r="112" fill="#111d27" stroke="#5b6e7b"/><circle cx="180" cy="160" r="56" fill="none" stroke="#2d414e" stroke-dasharray="3 5"/><line x1="68" x2="292" y1="160" y2="160" stroke="#2d414e"/><line x1="180" x2="180" y1="48" y2="272" stroke="#2d414e"/><text x="180" y="32" text-anchor="middle" fill="#aebfca">N · 0°</text><text x="320" y="164" text-anchor="middle" fill="#aebfca">E</text><text x="180" y="300" text-anchor="middle" fill="#aebfca">S · 180°</text><text x="39" y="164" fill="#aebfca">W</text><path d="${track('sun')}" fill="none" stroke="#f3c782" opacity=".3"/><path d="${track('earth')}" fill="none" stroke="#8ecdc5" opacity=".3"/>${marker('sun','#f3c782')}${marker('earth','#8ecdc5')}<circle cx="180" cy="160" r="3" fill="#edf2f5"/><text x="187" y="180" fill="#9baab8" font-size="10">Zenith</text></svg>`;
  $('sun-state').textContent=s.sun?'Sun above threshold':'Sun below threshold';
  $('earth-state').textContent=s.earth?'Earth above threshold':'Earth below threshold';
  $('scene-time').textContent=new Date(s.time).toISOString().replace('.000Z',' UTC');
  $('scene-progress').style.width=(index/(rows.length-1)*100)+'%';
}
function updateOptions(){const selected=Number($('site').value)||0,labels=usingNASA?nasa.datasets.map(d=>d.name):names.map(n=>n+' · illustrative');$('site').replaceChildren();labels.forEach((label,i)=>{const o=document.createElement('option');o.value=i;o.textContent=label;$('site').append(o);});$('site').value=Math.min(selected,labels.length-1);}
function activateNASA(){stopPlayback();imported=null;usingNASA=true;updateOptions();$('date').value=new Date(nasa.datasets[Number($('site').value)||0].rows[0].time).toISOString().slice(0,10);$('date').disabled=true;$('site').disabled=false;$('scrub').value=0;updateOptions();$('range').textContent=`Reference cache: ${nasa.datasets.length} coordinates · UTC observer samples`;$('status').textContent='NASA/JPL HORIZONS · cached apparent airless geometry · flat reference horizon, no terrain model';render();}
const importedLocation=site=>window.SeleneObservationTransfer.location(site);
function loadGeometry(name,provenance,rows,category='imported',site=null){
  const location=importedLocation(site);
  stopPlayback();imported={name,provenance,rows,site:location};importedCategory=category;importedRecord=null;
  $('date').disabled=$('site').disabled=true;$('scrub').value=0;
  $('range').textContent='Imported window · defined by CSV timestamps';
  $('status').textContent=category==='synthetic'?'SYNTHETIC SNAPSHOT — not NASA predictions.':'USER-SUPPLIED GEOMETRY — source recorded; accuracy not independently verified.';
  render();
}
window.SeleneApp={
  pause:stopPlayback,
  addObserver(value,select=true){
    const bundle=SeleneResources.normalize(value);
    if(!nasa||bundle.provider!=='NASA/JPL Horizons'||bundle.datasets.length!==1)throw new Error('Load the NASA reference cache before adding an observer.');
    const d=bundle.datasets[0];
    const existing=nasa.datasets.findIndex(s=>s.lat===d.lat&&s.lon===d.lon&&s.rows.length===d.rows.length&&s.rows[0].time===d.rows[0].time&&s.rows.at(-1).time===d.rows.at(-1).time&&s.rows.every((r,i)=>['sun_az','sun_el','earth_az','earth_el'].every(k=>r[k]===d.rows[i][k])));
    if(existing<0&&nasa.datasets.length>=32)throw new Error('The workspace supports up to 32 observer windows.');
    if(existing<0&&nasa.datasets.reduce((n,s)=>n+s.rows.length,0)+d.rows.length>50000)throw new Error('The workspace supports up to 50,000 total observer samples.');
    if(existing<0)nasa.datasets.push({...d,conventions:bundle.conventions,retrieved_utc:bundle.retrieved_utc});
    else if(select&&existing>=baseDatasetCount&&d.name)nasa.datasets[existing].name=d.name;
    if(select){stopPlayback();usingNASA=true;imported=null;updateOptions();$('site').value=existing<0?nasa.datasets.length-1:existing;activateNASA();}
    else if(usingNASA&&!imported){updateOptions();render();}
  },
  importCSV(name,provenance,csv,site=null){
    if(typeof name!=='string'||!name.trim()||name.length>100||typeof provenance!=='string'||!provenance.trim()||provenance.length>2000)throw new Error('Provide a dataset name (up to 100 characters) and source record (up to 2,000).');
    if(typeof csv!=='string'||new TextEncoder().encode(csv).length>2000000)throw new Error('Maximum CSV size is 2 MB.');
    const value=window.SeleneObservationTransfer.prepareCSV({name,provenance,text:csv,site});loadGeometry(value.name,value.provenance,value.rows,'imported',value.site);
  },
  importObservation(content){
    const value=window.SeleneObservationTransfer.decode(content);
    loadGeometry(value.name,value.provenance,value.rows,'imported',value.site);
  },
  setImportedLocation(site){
    const location=importedLocation(site);
    if(!imported||importedCategory!=='imported')throw new Error('Load a CSV before attaching its observer location.');
    if(site!==null&&!location)throw new Error('Enter both observer coordinates.');
    stopPlayback();imported.site=location;importedRecord=null;render();
  },
  restore(value){
    const s=window.SeleneNotebookData.validate(value);
    const match=nasa?.datasets.findIndex(d=>window.SeleneNotebookData.matchesCache(s,d));
    if(match>=0)s.siteIndex=match;
    const cached=nasa?.datasets[s.siteIndex];
    const verified=window.SeleneNotebookData.matchesCache(s,cached);
    stopPlayback();$('horizon').value=s.horizon;$('margin').value=s.margin;
    if(verified){usingNASA=true;imported=null;updateOptions();$('site').value=s.siteIndex;$('date').value=new Date(cached.rows[0].time).toISOString().slice(0,10);$('date').disabled=true;$('site').disabled=false;$('range').textContent=`Reference cache: ${nasa.datasets.length} coordinates · UTC observer samples`;$('status').textContent='NASA/JPL HORIZONS · restored inputs match the active reference cache';updateOptions();}
    else{loadGeometry(s.datasetName,s.provenance,s.rows,s.mode==='synthetic'?'synthetic':'imported',s.site?{lat:s.site.lat,lon:Math.abs(s.site.lon)<=180?s.site.lon:((s.site.lon+180)%360+360)%360-180}:null);importedRecord=s.mode==='nasa'?'RESTORED SNAPSHOT — does not match the active NASA cache; treat as user supplied.\n'+s.provenance:s.provenance;}
    $('scrub').value=s.index;render();return verified?'nasa':s.mode==='synthetic'?'synthetic':'imported';
  }
};
$('play').onclick=()=>{if(playback){stopPlayback();return;}$('play').textContent='Pause timeline';$('globe-play').textContent='Pause observation';$('globe-play').setAttribute('aria-pressed','true');$('play').setAttribute('aria-pressed','true');if(Number($('scrub').value)>=Number($('scrub').max))$('scrub').value=0;playback=setInterval(()=>{const next=Number($('scrub').value)+1;if(next>Number($('scrub').max)){stopPlayback();return;}$('scrub').value=next;render();},Number($('speed').value));render();};
$('speed').onchange=()=>{if(playback){stopPlayback();$('play').click();}};
$('globe-play').onclick=()=>{$('play').click();$('globe-play').textContent=playback?'Pause observation':'Play observation';$('globe-play').setAttribute('aria-pressed',String(Boolean(playback)));};
$('scrub').addEventListener('input',stopPlayback);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
$('nasa').onclick=()=>{if(nasa)activateNASA();};
for(const id of ['date','site','horizon','margin','scrub']) $(id).addEventListener('input',render);
$('file').addEventListener('change', async e => {
  $('error').textContent = '';
  try {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2000000) throw new Error('Maximum CSV size is 2 MB.');
    const name = $('dataset').value.trim(), provenance = $('provenance').value.trim();
    if (!name || !provenance) throw new Error('Enter a dataset label and provenance before importing.');
    window.SeleneApp.importCSV(name,provenance,await file.text());
  } catch(error) { $('error').textContent = error.message; }
  e.target.value = '';
});
$('reset').onclick = () => {stopPlayback();imported=null;usingNASA=false;updateOptions();$('date').disabled=$('site').disabled=false; $('range').textContent='72 hours · hourly synthetic samples'; $('status').textContent='ILLUSTRATIVE MODE — synthetic geometry and fictional sites. Not NASA predictions.'; $('error').textContent=''; render();};
$('export').onclick = () => {
  const rows=current(), csv='time_utc,sun_az,sun_el,earth_az,earth_el\n'+rows.map(r=>[new Date(r.time).toISOString(),r.sun_az,r.sun_el,r.earth_az,r.earth_el].join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=imported?'user-supplied-geometry.csv':usingNASA?'NASA-JPL-Horizons.csv':'SYNTHETIC-NOT-NASA.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('system-ready',render);
render();
fetch('data/horizons.json').then(r=>{if(!r.ok)throw new Error('Cache unavailable');return r.json();}).then(data=>{nasa=window.SeleneResources.normalize(data);baseDatasetCount=nasa.datasets.length;$('nasa').disabled=false;if(!imported){const featured=nasa.datasets.findIndex(d=>d.featured===true);if(featured>=0){usingNASA=true;updateOptions();$('site').value=featured;}activateNASA();}}).catch(()=>{if(!imported)$('status').textContent='Reference cache could not load or validate. Showing explicitly synthetic fixtures instead.';});
