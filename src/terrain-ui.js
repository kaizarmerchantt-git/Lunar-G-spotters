'use strict';
(()=>{
  const $=id=>document.getElementById(id),T=window.SeleneTerrain,D=window.SeleneTerrainData;
  const panel=document.createElement('section');panel.className='study-panel terrain-panel';panel.setAttribute('aria-labelledby','terrain-title');
  panel.innerHTML=`<div class="study-heading"><div><h2 id="terrain-title">What changes behind the ridgeline?</h2><p>LOLA terrain screening · separate from the flat-reference analysis above</p></div><label><input type="checkbox" id="terrain-overlay" checked> Show skyline in Local horizon</label></div>
    <p id="terrain-status" role="status">Loading NASA terrain profiles…</p><button id="terrain-retry" hidden>Retry terrain calculation</button>
    <div id="terrain-results" hidden><div class="terrain-metrics"><div><span>Sun above terrain</span><strong id="terrain-sun"></strong></div><div><span>Earth above terrain</span><strong id="terrain-earth"></strong></div><div><span>Both together</span><strong id="terrain-both"></strong></div><div><span>Longest Earth blockage</span><strong id="terrain-outage"></strong></div></div>
    <svg id="terrain-chart" viewBox="0 0 720 200" role="img" aria-label="Terrain skyline by azimuth, north zero degrees, east ninety degrees; current Sun and Earth elevations"></svg>
    <p id="terrain-current"></p><div class="terrain-events"><p id="terrain-sunset"></p><p id="terrain-earthset"></p></div>
    <details><summary>Compare terrain with flat-reference results</summary><p id="terrain-comparison-note"></p><div class="study-table-wrap"><table><caption>Hours above cutoff; each flat → terrain pair uses the same observer samples and assumptions</caption><thead><tr><th>Window / UTC</th><th>Sun: flat → terrain</th><th>Earth: flat → terrain</th><th>Both: flat → terrain</th></tr></thead><tbody id="terrain-comparison"></tbody></table></div></details>
    <details><summary>Source, resolution and limits</summary><p id="terrain-method"></p><p>One-degree azimuth bins and 80 m radial samples can miss narrow obstructions. Terrain beyond 100 km is not searched. A 0° floor removes horizon dips; it does not guarantee conservative results for unresolved terrain. No solar/Earth disk fraction, diffraction, solar-array power or antenna-link budget is calculated. Observer directions retain their original airless reference-sphere conventions; the 2 m terrain observer is an approximation, not a new ephemeris solution. Retained NASA responses and this DEM use the lunar mean-Earth frame; imported coordinates and frame conventions remain user supplied.</p><p><a href="https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE/" target="_blank" rel="noopener">NASA LOLA / PDS elevation source ↗</a> · <a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noopener">Inspect terrain in QuickMap ↗</a> · <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">Moon Trek ↗</a></p><pre id="terrain-source"></pre></details>
    <button id="terrain-download">Download terrain study JSON</button> <button id="terrain-csv">Download skyline CSV</button>
    <p class="hint">Saved scenarios and observation exports retain the existing flat-reference analysis. Use Download terrain study to retain this separate terrain result and its full profile.</p></div>`;
  document.querySelector('#lunar-explorer .ex-timeline').after(panel);
  const jump=document.createElement('button');jump.textContent='Terrain study ↓';jump.className='terrain-jump';jump.onclick=()=>panel.scrollIntoView({block:'start',behavior:'instant'});document.querySelector('#lunar-explorer .ex-question').append(jump);
  let bundle=null,state=null,profile=null,result=null,lastRows=null,lastProfile=null,lastHorizon=null,lastMargin=null,activeKey=null,requested=false,failure=null,generation=0;
  const n=v=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(v),hours=v=>n(v)+' h';
  function emit(){window.SeleneTerrainView={profile:$('terrain-overlay').checked?profile:null,result};document.dispatchEvent(new Event('terrain-view-change'));}
  function download(name,type,text){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('terrain-csv').onclick=()=>download('SELENE-terrain-skyline.csv','text/csv','azimuth_deg,horizon_elevation_deg,blocking_distance_m,blocking_height_m\n'+profile.bins.map(b=>[b.az,b.el,b.distance_m,b.height_m].join(',')).join('\n'));
  $('terrain-download').onclick=()=>download('SELENE-terrain-study.json','application/json',JSON.stringify({schema:'selene-terrain-study-v1',dataset:state.name,site:state.site,ephemeris_source:state.sourceRecord,source:{...bundle,profiles:undefined},profile,obstruction_deg:state.horizon,margin_deg:state.margin,summary:{total_h:result.total,sun_h:result.sun,earth_h:result.earth,both_h:result.both,longest_earth_blockage_h:result.longest},samples:result.samples},null,2));
  $('terrain-overlay').onchange=emit;
  $('terrain-retry').onclick=()=>{generation++;requested=false;failure=null;update(state);};
  function update(next){
    state=next;if(!D.bundle)return;
    const key=state.mode==='synthetic'?null:window.SeleneTerrainKey(state.site);
    if(key!==activeKey){activeKey=key;requested=false;failure=null;generation++;}
    const record=key?D.peek(state.site):null;profile=record?.profile||null;bundle=record?.bundle||D.bundle;
    $('terrain-results').hidden=!profile;$('terrain-overlay').disabled=!profile;$('terrain-retry').hidden=!failure||!!profile;
    if(!profile){
      $('terrain-status').textContent=!key?'Add lunar observer coordinates to calculate terrain. No skyline is inferred from a dataset name.':failure?failure+' Flat-reference observation analysis is unchanged.':'Calculating the exact coordinate’s LOLA skyline and checking the complete 100 km footprint…';
      result=null;emit();
      if(key&&!requested){requested=true;const token=++generation;D.load(state.site).then(()=>{if(token===generation)update(state);}).catch(e=>{if(token===generation){failure=e.message;update(state);}});}
      return;
    }
    const rows=state.geometry||state.samples;
    if(!result||rows!==lastRows||profile!==lastProfile||state.horizon!==lastHorizon||state.margin!==lastMargin){result=T.evaluate(rows,profile,state.horizon,state.margin);lastRows=rows;lastProfile=profile;lastHorizon=state.horizon;lastMargin=state.margin;}
    $('terrain-status').textContent=`${window.SeleneResources.coordinate(state.site.lat,state.site.lon)} · NASA LOLA 80 m grid · observer 2 m above terrain · 100 km search`;
    for(const k of ['sun','earth','both'])$('terrain-'+k).textContent=hours(result[k]);$('terrain-outage').textContent=hours(result.longest);
    const s=result.samples[state.index];
    $('terrain-current').textContent=`Current clearance: Sun ${n(s.sun_el-s.sun_cutoff)}° (${s.sun?'clear':'blocked'}); Earth ${n(s.earth_el-s.earth_cutoff)}° (${s.earth?'clear':'blocked'}). Cutoff = max(terrain skyline, assumed obstruction) + margin.`;
    for(const k of ['sun','earth']){const event=T.nextSet(result.samples,state.index,k),label=k==='sun'?'Sunset / terrain blockage':'Earthset / terrain blockage';$('terrain-'+(k==='sun'?'sunset':'earthset')).textContent=label+': '+(event?.blocked?'already blocked at this sample':event?`${hours(event.from/3600000)}–${hours(event.to/3600000)} from now (sample bracket)`:'not recorded before this window ends');}
    const top=Math.max(12,...profile.bins.map(b=>b.el),s.sun_el,s.earth_el)+1,bottom=Math.min(-3,s.sun_el,s.earth_el)-1,x=a=>40+a/360*650,y=e=>162-(e-bottom)/(top-bottom)*140;
    const path=profile.bins.concat([{az:360,el:profile.bins[0].el}]).map((b,i)=>(i?'L':'M')+x(b.az).toFixed(2)+','+y(b.el).toFixed(2)).join(' ');
    $('terrain-chart').innerHTML=`<path d="M40 ${y(0)}H690" stroke="#a9bcc4" stroke-dasharray="3 5"/><path d="${path} L690 162 H40Z" fill="#54858b30"/><path d="${path}" fill="none" stroke="#78aaa9" stroke-width="2"/>`+[0,90,180,270,360].map((a,i)=>`<text x="${x(a)}" y="185" text-anchor="middle">${['N / 0°','E / 90°','S / 180°','W / 270°','N / 360°'][i]}</text>`).join('')+[0,top].map(e=>`<text x="2" y="${y(e)+4}">${n(e)}°</text>`).join('')+['sun','earth'].map(k=>`<circle cx="${x(s[k+'_az'])}" cy="${y(s[k+'_el'])}" r="5" fill="${k==='sun'?'#b88024':'#35749b'}"/><text x="${Math.min(620,x(s[k+'_az'])+8)}" y="${Math.max(12,y(s[k+'_el'])-8)}">${k==='sun'?'Sun':'Earth'}</text>`).join('');
    $('terrain-comparison').replaceChildren();
    const windows=new Set(state.comparisons.map(c=>{const g=c.geometry||rows;return g[0].time+'/'+g.at(-1).time;}));
    $('terrain-comparison-note').textContent=windows.size>1?'Different UTC windows: totals across rows are not a site ranking. Compare the flat and terrain values within each row.':'Shared UTC window. These screening results do not establish mission suitability.';
    for(const c of state.comparisons){
      const matched=D.peek({lat:c.lat,lon:c.lon})?.profile,tr=document.createElement('tr');
      const geometry=c.geometry||rows,flat=window.LunarModel.evaluate(geometry,state.horizon,state.margin),screened=matched?T.evaluate(geometry,matched,state.horizon,state.margin):null;
      const interval=geometry.map(r=>r.time),utc=t=>new Date(t).toISOString().slice(0,16).replace('T',' ');
      [c.name+'\n'+utc(interval[0])+' → '+utc(interval.at(-1))+' UTC · '+hours(flat.total),...['sun','earth','both'].map(k=>screened?`${hours(flat[k])} → ${hours(screened[k])}`:'Terrain not loaded for this coordinate')].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});$('terrain-comparison').append(tr);
    }
    $('terrain-method').textContent=`Bilinear height sampling from LDEM_80S_80M (0.5 m/DN), spherical radius 1,737,400 m. Great-circle rays every 1° in azimuth, sampled every 80 m out to 100 km. Surface height here ${n(profile.ground_height_m)} m above the reference sphere. Linear interpolation between azimuth bins. Durations hold each interval’s starting state; the final row closes the window. Results apply to this exact coordinate only. Custom sites require the complete sampled 100 km footprint and all bilinear neighbours inside the retained south-polar DEM; this is not global coverage. At the exact south pole, the entered longitude defines the north-facing reference meridian.`;
    $('terrain-source').textContent=JSON.stringify({...bundle,profiles:undefined},null,2);emit();
  }
  document.addEventListener('observation-change',e=>update(e.detail));
  D.ready.then(()=>{if(window.SeleneObservation)update(window.SeleneObservation);}).catch(e=>{$('terrain-status').textContent=e.message+'. Flat-reference analysis is still available.';});
})();
