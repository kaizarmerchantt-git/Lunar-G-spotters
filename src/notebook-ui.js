'use strict';
(() => {
  const N=window.SeleneNotebookData,$=id=>document.getElementById(id),host=$('lunar-explorer');
  const storageStore=N.createStore(()=>localStorage);let cases=[],undo=null,pending=null,storageBlocked=false,persistent=true,demo=null,demoCases=null,demoStep=0;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,action,cls='wb-button')=>{const b=el('button',text,cls);b.type='button';b.onclick=action;return b;};
  const utc=time=>new Date(time).toISOString().replace('T',' / ').replace('.000Z',' UTC');
  let statusTimer;function announce(text){$('wb-status').textContent=text;clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('wb-status').textContent='',6500);}
  function capture(options={}){if(!window.SeleneObservation)throw new Error('Observation data is not ready.');return N.capture(window.SeleneObservation,{id:crypto.randomUUID(),...options});}
  function download(text,name,type){
    const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  const nav=el('nav',null,'wb-nav');nav.setAttribute('aria-label','Workspace views');
  nav.append(button('Analyze',()=>view(false)),button('Compare · 0',()=>view(true)));nav.children[0].id='wb-analyze';nav.children[1].id='wb-compare';
  const header=host.querySelector('.ex-header');header.insertBefore(nav,$('ex-evidence'));
  header.insertBefore(button('Data',()=>open('wb-data'),'wb-header-button'),$('ex-evidence'));header.querySelector('.wb-header-button').id='wb-data-open';
  header.insertBefore(button('Guided review',startDemo,'wb-header-button'),$('ex-evidence'));
  $('ex-evidence').textContent='Sources';$('ex-save').textContent='Save scenario +';
  $('ex-save').setAttribute('aria-haspopup','dialog');
  const board=el('section',null,'wb-board');board.id='wb-board';board.hidden=true;
  board.innerHTML=`<div class="wb-board-heading"><div><span class="ex-small-label">MISSION NOTEBOOK / LOCAL TO THIS BROWSER</span><h1>Compare the evidence.</h1><p>Different assumptions. Every input retained.</p></div><div class="wb-actions"><button id="wb-save-current">Save current scenario +</button><button id="wb-report">Review report ↗</button><button id="wb-backup">Download notebook ↓</button></div></div><div id="wb-storage" class="wb-storage"></div><p id="wb-comparison-note"></p><div id="wb-cases" class="wb-case-grid"></div><div class="wb-board-foot"><p>Each chart keeps its own UTC window. Elevation scales are shared. Percentages are time-weighted under each scenario's threshold; these are not approved landing-site rankings. Portable source labels are supplied metadata; opening a NASA-labeled case checks its inputs against the active cache.</p><button id="wb-undo" hidden>Undo last removal</button></div>`;
  host.querySelector('.ex-body').after(board);
  const skip=el('a','Skip to workspace','wb-skip');skip.href='#lunar-explorer';skip.onclick=e=>{e.preventDefault();const heading=board.hidden?$('ex-study-title'):board.querySelector('h1');heading.tabIndex=-1;heading.focus();};host.prepend(skip);
  const overlays=el('div');overlays.innerHTML=`
  <dialog id="wb-save-dialog" class="wb-dialog"><form id="wb-save-form"><div class="wb-dialog-head"><div><span class="ex-small-label">SAVE AN INVESTIGATION</span><h2>Keep the inputs. Keep the reasoning.</h2></div><button type="button" data-wb-close="wb-save-dialog" aria-label="Close save scenario">×</button></div><p id="wb-save-context"></p><label for="wb-name">Scenario name</label><input id="wb-name" maxlength="100" required autocomplete="off"><label for="wb-notes">Investigator notes <span>optional / 500 characters</span></label><textarea id="wb-notes" maxlength="500" rows="3" placeholder="What are you testing, and why?"></textarea><p id="wb-save-error" role="alert"></p><div class="wb-actions"><button type="submit" class="wb-primary">Save to notebook</button><button type="button" data-wb-close="wb-save-dialog">Cancel</button></div></form></dialog>
  <dialog id="wb-data" class="wb-dialog"><div class="wb-dialog-head"><div><span class="ex-small-label">LOCAL INPUT / PORTABLE OUTPUT</span><h2>Your geometry, with its source.</h2></div><button data-wb-close="wb-data" aria-label="Close data workspace">×</button></div><p>Import your observation geometry and source information. Loading a dataset replaces the active analysis; saved scenarios are retained.</p><form id="wb-csv-form"><label for="wb-dataset">Dataset name</label><input id="wb-dataset" maxlength="100" required placeholder="Observer geometry / run identifier"><label for="wb-provenance">Source and conventions</label><textarea id="wb-provenance" maxlength="2000" rows="3" required placeholder="Source, coordinates, reference frame, observer height and corrections used"></textarea><label for="wb-csv-file">Geometry CSV / up to 2 MB</label><input id="wb-csv-file" type="file" accept=".csv,text/csv"><code>time_utc,sun_az,sun_el,earth_az,earth_el</code><details class="wb-paste"><summary>Or paste CSV directly</summary><label for="wb-csv-paste">Geometry CSV text / selected file takes precedence</label><textarea id="wb-csv-paste" rows="5" maxlength="2000000" placeholder="time_utc,sun_az,sun_el,earth_az,earth_el"></textarea></details><p>2–10,000 strictly increasing UTC samples ending in Z. Azimuth: north 0°, east 90°. Angles in degrees. Imported coordinates are not inferred from the label.</p><button class="wb-primary" type="submit">Load geometry</button></form><div class="wb-data-divider"><h3>Notebook backup</h3><label for="wb-notebook-file">Merge a saved JSON notebook / up to 4 MB, six scenarios</label><input id="wb-notebook-file" type="file" accept=".json,application/json"><div class="wb-actions"><button id="wb-current-csv">Download current CSV</button><button id="wb-current-report">Review current observation</button><button id="wb-nasa">Restore NASA cache</button></div></div><p id="wb-data-error" role="alert"></p></dialog>
  <dialog id="wb-report-dialog" class="wb-dialog wb-wide-dialog"><div class="wb-dialog-head"><div><span class="ex-small-label">REPRODUCIBLE REVIEW</span><h2>Evidence you can take away.</h2></div><button data-wb-close="wb-report-dialog" aria-label="Close review report">×</button></div><p>Inputs, sample values, source records, assumptions and recomputed metrics.</p><pre id="wb-report-text" tabindex="0"></pre><button id="wb-report-download" class="wb-primary">Download review .txt ↓</button></dialog>
  <dialog id="wb-samples" class="wb-dialog wb-wide-dialog"><div class="wb-dialog-head"><h2>Observer samples / UTC & degrees</h2><button data-wb-close="wb-samples" aria-label="Close sample table">×</button></div><p id="wb-sample-page"></p><div class="wb-table-wrap"><table><caption>Body-center observer geometry. Selected threshold applies to every row.</caption><thead><tr><th>UTC</th><th>Sun az°</th><th>Sun el°</th><th>Earth az°</th><th>Earth el°</th><th>Both above threshold</th></tr></thead><tbody id="wb-sample-rows"></tbody></table></div><div class="wb-actions"><button id="wb-page-prev">Previous 100</button><button id="wb-page-next">Next 100</button></div></dialog>
  <aside id="wb-tour" class="wb-tour" aria-label="Guided mission review" aria-live="polite" aria-atomic="true" hidden><div class="wb-tour-top"><span id="wb-tour-count"></span><button id="wb-tour-close" aria-label="End guided review and restore analysis">×</button></div><h2 id="wb-tour-title"></h2><p id="wb-tour-copy"></p><div class="wb-actions"><button id="wb-tour-prev">Back</button><button id="wb-tour-next">Continue →</button></div><small>Temporary study. Your previous analysis is restored on exit.</small></aside><div id="wb-status" class="wb-status" role="status" aria-live="polite"></div>`;
  host.append(overlays);
  host.querySelectorAll('dialog').forEach((dialog,i)=>{const heading=dialog.querySelector('h2');if(heading){heading.id=heading.id||'wb-dialog-title-'+i;dialog.setAttribute('aria-labelledby',heading.id);}});
  host.querySelectorAll('.wb-dialog input,.wb-dialog textarea').forEach(input=>{input.name=input.id;if(input.type!=='file')input.autocomplete='off';});
  $('wb-csv-paste').spellcheck=false;
  const T=window.SeleneObservationTransfer;
  const transferPanel=el('section',null,'observation-transfer');transferPanel.setAttribute('aria-label','Complete observation transfer');
  transferPanel.innerHTML='<h3>Keep the observation together.</h3><p>A SELENE observation file carries samples, location and source in one file. Review it before replacing the active analysis.</p><label for="wb-observation-file">Observation file / .selene.json / up to 2 MB</label><input id="wb-observation-file" type="file" accept=".json,application/json"><p id="wb-transfer-status" role="status"></p><div id="wb-transfer-preview" hidden><h4>Review this observation</h4><pre id="wb-transfer-summary"></pre><div class="wb-actions"><button id="wb-transfer-apply" type="button" class="wb-primary">Use reviewed observation</button><button id="wb-transfer-cancel" type="button">Cancel review</button></div><details><summary>Source record and conventions</summary><pre id="wb-transfer-source"></pre></details></div><button id="wb-export-observation" type="button">Download complete observation</button>';
  $('wb-csv-form').before(transferPanel);
  const csvSection=el('details',null,'observation-csv-section');csvSection.id='wb-csv-section';csvSection.append(el('summary','Import CSV / enter location separately'));$('wb-csv-form').before(csvSection);csvSection.append($('wb-csv-form'));
  let reviewedObservation=null,transferRevision=0;
  function clearReview(){transferRevision++;reviewedObservation=null;$('wb-transfer-preview').hidden=true;$('wb-transfer-status').textContent='';}
  $('wb-observation-file').onchange=async()=>{
    clearReview();$('wb-data-error').textContent='';const revision=transferRevision,file=$('wb-observation-file').files[0];if(!file)return;
    $('wb-transfer-status').textContent='Reading and validating observation…';
    try{if(file.size>2000000)throw new Error('Maximum observation size is 2 MB.');const content=await file.text();const value=T.decode(content);if(revision!==transferRevision)return;
      reviewedObservation=content;$('wb-transfer-summary').textContent=T.describe(value);$('wb-transfer-source').textContent=value.provenance;$('wb-transfer-preview').hidden=false;$('wb-transfer-status').textContent='Ready for review. The active analysis has not changed.';
    }catch(error){if(revision!==transferRevision)return;reviewedObservation=null;$('wb-observation-file').value='';$('wb-transfer-status').textContent='File rejected. The active analysis is unchanged.';showError('wb-data-error',['NotReadableError','NotFoundError','SecurityError'].includes(error.name)?'The browser could not read this observation file. Save a copy in Downloads and select it again.':error.message);}
  };
  $('wb-transfer-cancel').onclick=()=>{clearReview();$('wb-observation-file').value='';$('wb-transfer-status').textContent='Review cancelled. The active analysis is unchanged.';};
  $('wb-transfer-apply').onclick=()=>{try{if(!reviewedObservation)throw new Error('Select a valid observation file first.');window.SeleneApp.importObservation(reviewedObservation);clearReview();$('wb-observation-file').value='';hasDraft=false;$('wb-data').close();view(false);announce('Observation imported with its location and source. Save a scenario to retain it.');}catch(error){showError('wb-data-error',error.message);}};
  $('wb-export-observation').onclick=()=>{try{download(T.encode(window.SeleneObservation),'SELENE-observation.selene.json','application/json');}catch(error){showError('wb-data-error',error.message);}};
  const csvLocation=el('details');csvLocation.id='wb-csv-location';
  csvLocation.innerHTML='<summary>Lunar observer location / optional</summary><p>Enter the location these samples describe. This enables the lunar surface and local horizon; it does not verify or recompute the imported angles.</p><div class="observer-fields"><div><label for="wb-csv-lat">CSV latitude / ° north</label><input id="wb-csv-lat" name="csv-latitude" type="number" min="-90" max="90" step="any" placeholder="e.g. -84.7906"><small>Negative is south.</small></div><div><label for="wb-csv-lon">CSV longitude / ° east</label><input id="wb-csv-lon" name="csv-longitude" type="number" min="-180" max="180" step="any" placeholder="e.g. 29.1957"><small>Negative is west.</small></div></div><button type="button" id="wb-apply-csv-location">Apply location to current CSV</button><p>For the supplied IM-2 example: −84.7906° north, 29.1957° east. Use your own source coordinates for other datasets. Leave both fields empty for numerical analysis only.</p>';
  $('wb-provenance').after(csvLocation);
  function readCSVLocation(){
    const lat=$('wb-csv-lat').value.trim(),lon=$('wb-csv-lon').value.trim();
    if(!lat&&!lon)return null;
    if(!lat||!lon||!Number.isFinite(Number(lat))||Math.abs(Number(lat))>90||!Number.isFinite(Number(lon))||Math.abs(Number(lon))>180)throw new Error('Enter both lunar coordinates: latitude -90 to 90 and east longitude -180 to 180.');
    return {lat:Number(lat),lon:Number(lon)};
  }
  $('wb-apply-csv-location').onclick=()=>{try{const location=readCSVLocation();window.SeleneApp.setImportedLocation(location);hasDraft=false;$('wb-data').close();view(false);announce(location?'Observer location attached. Imported angles and numerical results are unchanged. Save a scenario to keep the location.':'Observer location cleared. Numerical analysis remains active.');}catch(error){showError('wb-data-error',error.message);}};
  for(const id of ['wb-save-error','wb-data-error']){$(id).tabIndex=-1;}
  let hasDraft=false,unsavedImport=false,lastSource='';
  host.addEventListener('input',e=>{if(e.target.closest('.wb-dialog form'))hasDraft=true;});
  window.addEventListener('beforeunload',e=>{if((hasDraft&&host.querySelector('dialog[open]'))||unsavedImport||(!persistent&&cases.length)){e.preventDefault();e.returnValue='';}});
  function showError(id,message){$(id).textContent=message;$(id).focus();}
  overlays.querySelectorAll('[data-wb-close]').forEach(b=>b.onclick=()=>$(b.dataset.wbClose).close());
  const tableButton=button('Sample table ↗',()=>{samplePage=Math.floor((window.SeleneObservation?.index||0)/100);renderSamples();open('wb-samples');},'wb-table-button');
  host.querySelector('.ex-history .ex-section-line').append(tableButton);
  const keyboard=el('details',null,'wb-help');keyboard.innerHTML='<summary>Controls & assumptions</summary><p>Globe: drag to orbit; arrow keys turn or zoom. Local horizon: drag or use arrow keys to look; Escape returns to orbit. Timeline: arrow keys step; Home / End jump. The sample table provides the same values without relying on the canvas.</p><p>Reduced-motion preferences skip camera flights. The Moon is a textured sphere; local ground and apparent body sizes are illustrative. Uniform obstruction is a chosen assumption, not measured terrain.</p>';
  host.querySelector('.ex-sites').append(keyboard);
  const motionLabel=el('label',null,'wb-motion-label'),motionToggle=el('input');motionToggle.type='checkbox';motionToggle.id=motionToggle.name='wb-reduce-motion';
  const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');motionToggle.checked=systemMotion.matches;motionToggle.disabled=systemMotion.matches;
  motionLabel.append(motionToggle,el('span','Skip camera flights'));keyboard.append(motionLabel);
  const syncMotion=()=>host.classList.toggle('wb-reduced-motion',motionToggle.checked||systemMotion.matches);motionToggle.onchange=syncMotion;syncMotion();
  systemMotion.addEventListener('change',()=>{motionToggle.disabled=systemMotion.matches;if(systemMotion.matches)motionToggle.checked=true;syncMotion();});
  function open(id){window.SeleneApp.pause();const active=host.querySelector('dialog[open]');if(active&&active.id!==id)active.close();if(id==='wb-data'){const s=window.SeleneObservation;$('wb-apply-csv-location').hidden=s?.mode!=='imported';if(s?.mode==='imported'){csvLocation.open=true;if(!s.site)csvSection.open=true;if(s.site){$('wb-csv-lat').value=s.site.lat;$('wb-csv-lon').value=s.site.lon;}else if(!hasDraft){$('wb-csv-lat').value='';$('wb-csv-lon').value='';}}else if(!hasDraft){$('wb-csv-lat').value='';$('wb-csv-lon').value='';}}$(id).showModal();}
  function view(compare){
    window.SeleneApp.pause();host.classList.toggle('wb-compare-mode',compare);board.hidden=!compare;
    $('wb-analyze').setAttribute('aria-current',compare?'false':'page');$('wb-compare').setAttribute('aria-current',compare?'page':'false');
    if(compare)renderBoard();else window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new CustomEvent('selene-workspace-change',{detail:{compare}}));
  }
  function persist(){
    persistent=storageStore.write(cases);
  }
  function renderBoard(){
    const shown=demoCases||cases;$('wb-compare').textContent=`Compare · ${cases.length}`;
    $('wb-storage').textContent=demoCases?'GUIDED STUDY / temporary scenarios, not saved':persistent?'Saved in this browser. Download a notebook backup before clearing browser data.':storageBlocked?'Existing saved data could not be read and has been kept unchanged. New scenarios are session-only; download a backup.':'Browser storage is unavailable or full. Scenarios remain in this session; download a backup before closing.';
    $('wb-backup').disabled=shown.length===0;$('wb-report').disabled=shown.length===0;$('wb-undo').hidden=!undo||Boolean(demoCases);
    const list=$('wb-cases');list.replaceChildren();
    if(!shown.length){
      const empty=el('div',null,'wb-empty');empty.append(el('span','01 / START WITH A QUESTION','ex-small-label'),el('h2','What changes when the horizon changes?'),el('p','Save the current reference, then return to Explore and change its obstruction or margin. Save again to compare both investigations.'),button('Save the current analysis',saveDialog,'wb-primary'),button('Return to analysis',()=>view(false)));
      list.append(empty);$('wb-comparison-note').textContent='A notebook holds up to six complete scenarios, including their sampled geometry.';return;
    }
    const windows=new Set(shown.map(s=>`${s.rows[0].time}/${s.rows.at(-1).time}`));
    $('wb-comparison-note').textContent=windows.size>1?'Different UTC windows. Compare these as separate studies; percentages alone do not establish a site preference.':'Shared UTC window. Check thresholds and sources before interpreting differences.';
    let min=0,max=0;for(const s of shown){max=Math.max(max,s.horizon+s.margin);for(const r of s.rows){min=Math.min(min,r.sun_el,r.earth_el);max=Math.max(max,r.sun_el,r.earth_el);}}min-=1;max+=1;
    shown.forEach((s,i)=>{
      const r=N.summary(s),sample=s.rows[s.index],threshold=s.horizon+s.margin;
      const card=el('article',null,'wb-case');card.append(el('span',`${String(i+1).padStart(2,'0')} / ${s.mode==='nasa'?'NASA CACHE SNAPSHOT':s.mode==='synthetic'?'SYNTHETIC / NOT NASA':'USER SUPPLIED'}`,'wb-case-source'),el('h2',s.name),el('p',s.datasetName,'wb-case-dataset'));
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 320 112');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Elevation history, shared vertical scale ${min.toFixed(1)} to ${max.toFixed(1)} degrees. Sun solid, Earth dashed.`);
      const x=time=>28+(time-s.rows[0].time)/(s.rows.at(-1).time-s.rows[0].time)*282,y=v=>8+(max-v)/(max-min)*92;
      const path=(d,cls)=>{const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);p.setAttribute('class',cls);svg.append(p);};
      path(`M28 ${y(threshold)}H310`,'wb-plot-threshold');
      for(const key of ['sun','earth'])path(s.rows.map((row,j)=>`${j?'L':'M'}${x(row.time).toFixed(2)},${y(row[key+'_el']).toFixed(2)}`).join(' '),'wb-plot-'+key);
      for(const [v,py]of [[max,12],[min,103]]){const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x','1');t.setAttribute('y',py);t.textContent=v.toFixed(1)+'°';svg.append(t);}
      card.append(svg,el('p','Sun ━  Earth ┄  Threshold − −','wb-plot-key'));
      const metrics=el('dl',null,'wb-metrics');for(const [label,value]of [['Sun above',(100*r.sun/r.total).toFixed(1)+'%'],['Earth above',(100*r.earth/r.total).toFixed(1)+'%'],['Both above',(100*r.both/r.total).toFixed(1)+'%'],['Earth below / longest',r.longest.toFixed(1)+' h']]){const pair=el('div');pair.append(el('dt',label),el('dd',value));metrics.append(pair);}card.append(metrics);
      const facts=el('div',null,'wb-case-facts');facts.append(el('p',`Obstruction ${s.horizon.toFixed(2)}° + margin ${s.margin.toFixed(2)}°`),el('p',`${s.rows.length} samples / ${r.total.toFixed(1)} h`),el('p',`From ${utc(s.rows[0].time)}`),el('p',`To ${utc(s.rows.at(-1).time)}`),el('p',`Selected ${utc(sample.time)}`));card.append(facts);
      if(s.notes)card.append(el('p',s.notes,'wb-investigator-note'));
      const source=el('details',null,'wb-case-evidence');source.append(el('summary','Source record'),el('pre',s.provenance));card.append(source);
      const actions=el('div',null,'wb-actions');actions.append(button('Open in analysis ↗',()=>{if(demo)endDemo();const mode=window.SeleneApp.restore(s);view(false);announce(mode==='nasa'?'Scenario restored and matched to the current NASA cache.':'Scenario restored as illustrative or user-supplied data.');}));
      if(!demoCases)actions.append(button('Remove',()=>{undo={value:s,index:cases.indexOf(s)};cases=cases.filter(c=>c.id!==s.id);persist();renderBoard();announce('Scenario removed. Undo is available until another removal or page reload.');},'wb-remove'));
      card.append(actions);list.append(card);
    });
  }
  function saveDialog(){
    try{window.SeleneApp.pause();pending=capture();$('wb-name').value=`${pending.datasetName} / ${(pending.horizon+pending.margin).toFixed(2)}°`.slice(0,100);$('wb-notes').value='';$('wb-save-context').textContent=`${utc(pending.rows[pending.index].time)} · ${pending.rows.length} samples · selected threshold ${(pending.horizon+pending.margin).toFixed(2)}°`;$('wb-save-error').textContent='';open('wb-save-dialog');}catch(e){announce(e.message);}
  }
  document.addEventListener('scenario-save-request',saveDialog);$('wb-save-current').onclick=saveDialog;
  $('wb-save-form').onsubmit=e=>{e.preventDefault();try{const next=N.validate({...pending,name:$('wb-name').value.trim(),notes:$('wb-notes').value});cases=N.merge(cases,[next]);persist();hasDraft=false;unsavedImport=false;$('wb-save-dialog').close();demoCases=null;view(true);announce(persistent?'Scenario saved to this browser.':'Scenario saved for this session; download a backup.');}catch(error){showError('wb-save-error',error.message);}};
  $('wb-undo').onclick=()=>{if(!undo)return;try{const restored=N.merge(cases,[undo.value]);cases=restored.filter(s=>s.id!==undo.value.id);cases.splice(Math.min(undo.index,cases.length),0,undo.value);undo=null;persist();renderBoard();announce('Scenario restored.');}catch(e){announce(e.message);}};
  function showReport(values){try{$('wb-report-text').textContent=N.report(values);open('wb-report-dialog');}catch(e){announce(e.message);}}
  $('wb-report').onclick=()=>showReport(demoCases||cases);
  $('wb-report-download').onclick=()=>download($('wb-report-text').textContent,'SELENE-observer-review.txt','text/plain;charset=utf-8');
  $('wb-backup').onclick=()=>{try{download(N.encode(demoCases||cases),'SELENE-notebook.json','application/json');}catch(e){announce(e.message);}};
  $('wb-current-csv').onclick=()=>{try{download(N.csv(capture()),'SELENE-current-geometry.csv','text/csv;charset=utf-8');}catch(e){$('wb-data-error').textContent=e.message;}};
  $('wb-current-report').onclick=()=>{try{showReport([capture()]);}catch(e){$('wb-data-error').textContent=e.message;}};
  $('wb-nasa').onclick=()=>{$('nasa').click();$('wb-data').close();view(false);announce('NASA cache requested. See the source indicator for the active dataset.');};
  const csvDraft=N.createFileDraft(),fileStatus=el('p','','observer-note');fileStatus.id='wb-file-status';fileStatus.setAttribute('role','status');$('wb-csv-file').after(fileStatus);
  function fileReadError(error){
    if(error.code==='FILE_UNREADABLE'){
      $('wb-csv-file').value='';csvDraft.select(null);
      $('wb-csv-paste').closest('details').open=true;
      fileStatus.textContent='File access failed. Select a fresh copy or paste the CSV.';
    }
    showError('wb-data-error',error.message);
  }
  $('wb-csv-file').onchange=async()=>{
    const file=$('wb-csv-file').files[0];csvDraft.select(file);$('wb-data-error').textContent='';
    if(!file){fileStatus.textContent='';return;}
    fileStatus.textContent='Reading selected CSV…';
    try{await csvDraft.read(file);if($('wb-csv-file').files[0]===file)fileStatus.textContent='File read successfully. Click Load geometry to validate and use it.';}
    catch(error){if($('wb-csv-file').files[0]===file)fileReadError(error);}
  };
  $('wb-csv-form').onsubmit=async e=>{
    e.preventDefault();$('wb-data-error').textContent='';const file=$('wb-csv-file').files[0],submit=e.currentTarget.querySelector('[type=submit]');submit.disabled=true;submit.textContent='Validating…';
    try{if(!file&&!$('wb-csv-paste').value.trim())throw new Error('Choose a geometry CSV or paste its contents.');const location=readCSVLocation();window.SeleneApp.importCSV($('wb-dataset').value,$('wb-provenance').value,file?await csvDraft.read(file):$('wb-csv-paste').value,location);$('wb-csv-file').value='';csvDraft.select(null);fileStatus.textContent='';$('wb-csv-paste').value='';$('wb-csv-lat').value=location?location.lat:'';$('wb-csv-lon').value=location?location.lon:'';hasDraft=false;$('wb-data').close();view(false);announce('User-supplied geometry loaded. Save a scenario to retain it. Numerical accuracy has not been independently verified.');}catch(error){fileReadError(error);}finally{submit.disabled=false;submit.textContent='Load geometry';}
  };
  $('wb-notebook-file').onchange=async e=>{
    $('wb-data-error').textContent='';try{const file=e.target.files[0];if(!file)return;if(file.size>4000000)throw new Error('Maximum notebook size is 4 MB.');const incoming=N.decode(await file.text()),next=N.merge(cases,incoming);cases=next;persist();$('wb-data').close();view(true);announce('Notebook merged. Derived results were recomputed from its inputs.');}catch(error){$('wb-data-error').textContent=error.message;}finally{e.target.value='';}
  };
  let samplePage=0;
  function renderSamples(){
    const s=window.SeleneObservation;if(!s)return;samplePage=Math.max(0,Math.min(Math.floor((s.samples.length-1)/100),samplePage));const start=samplePage*100,rows=$('wb-sample-rows');rows.replaceChildren();
    s.samples.slice(start,start+100).forEach((r,i)=>{const tr=el('tr');if(start+i===s.index)tr.className='wb-selected-row';for(const value of [utc(r.time),r.sun_az.toFixed(3),r.sun_el.toFixed(3),r.earth_az.toFixed(3),r.earth_el.toFixed(3),r.sun&&r.earth?'Yes':'No'])tr.append(el('td',value));rows.append(tr);});
    $('wb-sample-page').textContent=`Rows ${start+1}–${Math.min(start+100,s.samples.length)} of ${s.samples.length} · threshold ${s.threshold.toFixed(2)}° · ${s.mode==='nasa'?'NASA cache':'illustrative or user-supplied'}`;
    $('wb-page-prev').disabled=samplePage===0;$('wb-page-next').disabled=start+100>=s.samples.length;
  }
  $('wb-page-prev').onclick=()=>{samplePage--;renderSamples();};$('wb-page-next').onclick=()=>{samplePage++;renderSamples();};
  const demoSteps=[['Read the lunar context','A reference coordinate is not an approved landing site. Orbit the Moon, then inspect the observer at that exact coordinate.'],['Look across time','This is the next UTC day in the cached NASA window. The Sun is low; Earth remains below the flat horizon. The chart and local sky share the selected sample.'],['Change one assumption','A 2° obstruction plus 0.5° margin raises the threshold to 2.5°. It is an assumed uniform cutoff, not measured terrain. Inspect the changed result.'],['Defend the difference','These temporary cases use the same coordinate, samples and UTC window. Only the threshold changes. Inspect the metrics and source records; the report preserves the evidence.']];
  function startDemo(){
    if(demo){announce('Guided review is already active.');return;}
    if(window.SeleneObservation?.mode!=='nasa')return announce('Restore the NASA cache from Data before starting the guided review.');
    demo={original:capture(),atlas:host.classList.contains('atlas-mode'),compare:host.classList.contains('wb-compare-mode'),horizon:$('ex-horizon').getAttribute('aria-pressed')==='true',system:$('obs-system-view')?.getAttribute('aria-pressed')==='true',history:host.querySelector('.obs-history-details')?.open};demoStep=0;$('wb-tour').hidden=false;advanceDemo();
  }
  function seek(index){$('scrub').value=index;$('scrub').dispatchEvent(new Event('input',{bubbles:true}));}
  function advanceDemo(){
    if(!demo)return;window.SeleneApp.pause();demoCases=null;view(false);const history=host.querySelector('.obs-history-details');if(history)history.open=true;
    const base={...demo.original};
    // Restore the original source before selecting the first cached reference.
    window.SeleneApp.restore(base);$('site').value=0;$('site').dispatchEvent(new Event('input',{bubbles:true}));
    $('horizon').value=0;$('margin').value=0;$('horizon').dispatchEvent(new Event('input',{bubbles:true}));const demoDays=window.SeleneResources.days(window.SeleneObservation.samples);seek(demoStep===0?0:demoDays[1]?.index||Math.floor((window.SeleneObservation.samples.length-1)/2));
    if(demoStep===1&&!$('ex-horizon').disabled)$('ex-horizon').click();else $('ex-orbit').click();
    if(demoStep>=2){$('horizon').value=2;$('margin').value=.5;$('horizon').dispatchEvent(new Event('input',{bubbles:true}));}
    if(demoStep===3){const raised=capture({name:'Assumed obstruction / 2.5°'});demoCases=[N.validate({...raised,id:crypto.randomUUID(),name:'Flat reference / 0°',horizon:0,margin:0}),raised];view(true);}
    $('wb-tour-count').textContent=`GUIDED REVIEW / ${demoStep+1} OF 4`;$('wb-tour-title').textContent=demoSteps[demoStep][0];$('wb-tour-copy').textContent=demoStep===1&&$('ex-horizon').disabled?'Inspect the selected UTC sample using the compass, elevation chart and sample table. Data-only mode preserves these analyses without the 3D sky.':demoSteps[demoStep][1];if(demoStep===1&&!$('ex-horizon').disabled){const row=window.SeleneObservation.samples[window.SeleneObservation.index];$('wb-tour-copy').textContent=`Sun center ${row.sun_el.toFixed(2)}°; Earth center ${row.earth_el.toFixed(2)}°. Inspect this later UTC sample in the linked chart, compass and local sky.`;}$('wb-tour-prev').disabled=demoStep===0;$('wb-tour-next').textContent=demoStep===3?'Finish & restore':'Continue →';
  }
  function endDemo(){if(!demo)return;const original=demo;demo=null;demoCases=null;$('wb-tour').hidden=true;window.SeleneApp.restore(original.original);if(original.atlas)$('atlas-tab')?.click();else if(original.compare)view(true);else{view(false);if(original.system)$('obs-system-view')?.click();else if(original.horizon)$('ex-horizon').click();else $('ex-orbit').click();}const history=host.querySelector('.obs-history-details');if(history)history.open=Boolean(original.history);announce('Guided review ended. Your previous analysis has been restored.');}
  $('wb-tour-next').onclick=()=>{if(demoStep===3)endDemo();else{demoStep++;advanceDemo();}};$('wb-tour-prev').onclick=()=>{demoStep=Math.max(0,demoStep-1);advanceDemo();};$('wb-tour-close').onclick=endDemo;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&demo&&!host.querySelector('dialog[open]')&&!host.classList.contains('obs-expanded'))endDemo();});
  const initial=storageStore.read();cases=initial.cases;storageBlocked=initial.blocked;persistent=!storageBlocked;
  document.addEventListener('observation-change',e=>{if($('wb-samples').open)renderSamples();const s=e.detail;if(s.provenance!==lastSource){unsavedImport=s.mode==='imported'&&!cases.some(c=>c.provenance===s.provenance&&c.datasetName===s.name);lastSource=s.provenance;}});
  view(false);renderBoard();
})();
