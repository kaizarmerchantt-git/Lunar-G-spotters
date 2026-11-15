'use strict';
(()=>{
  const $=id=>document.getElementById(id),host=$('lunar-explorer');
  const launch=document.createElement('button');launch.id='observer-open';launch.textContent='New observation +';launch.className='ex-outline-button';
  host.querySelector('.ex-window').before(launch);
  const dialog=document.createElement('dialog');dialog.id='observer-dialog';dialog.className='wb-dialog';dialog.setAttribute('aria-labelledby','observer-title');
  dialog.innerHTML=`<form id="observer-form"><div class="wb-dialog-head"><div><h2 id="observer-title">A different place. A different date.</h2></div><button type="button" id="observer-close" aria-label="Close new observation">×</button></div>
    <p>Request Sun and Earth geometry directly from NASA/JPL Horizons. The current analysis stays available if a request fails.</p>
    <label for="observer-name">Study name</label><input id="observer-name" name="study" maxlength="60" autocomplete="off" required value="Custom observer">
    <div class="observer-fields"><div><label for="observer-lat">Latitude / ° north</label><input id="observer-lat" name="latitude" type="number" min="-90" max="90" step="0.000001" value="-89.5" required autocomplete="off"><small>Negative values are south.</small></div><div><label for="observer-lon">Longitude / ° east</label><input id="observer-lon" name="longitude" type="number" min="-180" max="180" step="0.000001" value="0" required autocomplete="off"><small>Negative values are west.</small></div></div>
    <label for="observer-start">Start date and time / UTC</label><input id="observer-start" name="start" type="datetime-local" min="2020-01-01T00:00" max="2040-12-31T23:59" value="2026-11-14T00:00" required autocomplete="off"><p class="observer-note">The entered clock time is UTC, regardless of your device’s time zone.</p>
    <div class="observer-fields"><div><label for="observer-days">Window</label><select id="observer-days" name="days"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="7">7 days</option><option value="30">30 days</option></select></div><div><label for="observer-step">Sample spacing</label><select id="observer-step" name="step"><option value="15">15 minutes</option><option value="60" selected>1 hour</option><option value="180">3 hours</option></select></div></div>
    <p class="observer-note">Airless body centers · altitude 0 km above the lunar reference surface · no terrain screening. Only the coordinates, UTC window and spacing are sent to NASA; your study name and notebook stay local.</p>
    <p id="observer-error" role="alert" tabindex="-1"></p><p id="observer-status" role="status" aria-live="polite"></p>
    <div class="wb-actions"><button id="observer-submit" class="wb-primary" type="submit">Load NASA observation</button><button id="observer-cancel" type="button">Cancel request</button></div><p class="observer-note">New observations require an internet connection. Loaded observations remain available for repeat use and source review.</p></form>`;
  host.append(dialog);let controller=null;
  launch.onclick=()=>{const s=window.SeleneObservation;if(s?.site){$('observer-lat').value=s.site.lat;$('observer-lon').value=s.site.lon>180?s.site.lon-360:s.site.lon;$('observer-start').value=new Date(s.samples[0].time).toISOString().slice(0,16);}dialog.showModal();};
  $('observer-close').onclick=()=>dialog.close();$('observer-cancel').onclick=()=>{if(controller)controller.abort();else dialog.close();};
  dialog.addEventListener('cancel',()=>controller?.abort());
  const nameStorageKey='selene.observer-names.v1';
  const bundleKey=d=>{if(!d?.rows?.length)return '';const step=d.rows.length>1?Math.round((Date.parse(d.rows[1].time)-Date.parse(d.rows[0].time))/60000):60,days=Math.round((Date.parse(d.rows.at(-1).time)-Date.parse(d.rows[0].time))/86400000);return `${d.lat},${d.lon},${new Date(Date.parse(d.rows[0].time)).toISOString().slice(0,16)},${days},${step}`;};
  const readStudyNames=()=>{try{const raw=localStorage.getItem(nameStorageKey);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch{return {};}};
  const saveStudyName=(key,label)=>{try{const map=readStudyNames();map[key]=label;localStorage.setItem(nameStorageKey,JSON.stringify(map));}catch{}};
  $('observer-form').onsubmit=async event=>{
    event.preventDefault();if(controller)return;
    const name=$('observer-name').value.trim();if(!name){$('observer-error').textContent='Give this observation a study name.';$('observer-error').focus();return;}
    const rawLat=$('observer-lat').value.trim(),rawLon=$('observer-lon').value.trim();
    if(!rawLat||!rawLon){$('observer-error').textContent='Use latitude −90 to 90 and east longitude −180 to 180.';$('observer-error').focus();return;}
    const input={lat:Number(rawLat),lon:Number(rawLon),start:$('observer-start').value,days:Number($('observer-days').value),step:Number($('observer-step').value)};
    const before=window.SeleneObservation;window.SeleneApp.pause();
    controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),50000);
    $('observer-error').textContent='';$('observer-status').textContent='Requesting Sun, then Earth. Checking returned coordinates and UTC samples…';$('observer-submit').disabled=true;
    try{
      const response=await fetch('/api/observer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});
      const bundle=await response.json();if(!response.ok)throw new Error(bundle.error||'NASA query failed.');
      const fullName=(name+' · '+input.start.slice(0,10)).slice(0,100);
      bundle.datasets[0].name=fullName;
      saveStudyName(`${input.lat},${input.lon},${input.start},${input.days},${input.step}`,fullName);
      // A closed query dialog or another source selection must not displace work.
      const sameSource=window.SeleneObservation?.provenance===before?.provenance;
      window.SeleneApp.addObserver(bundle,dialog.open&&sameSource);
      $('observer-status').textContent=dialog.open&&sameSource?'NASA observation loaded. Save a scenario to compare it.':'Observation added to the reference list; your active analysis is unchanged.';
      if(dialog.open&&sameSource)dialog.close();
    }catch(error){$('observer-status').textContent='';$('observer-error').textContent=error.name==='AbortError'?'Request cancelled or timed out. The current analysis is unchanged.':error.message;if(dialog.open)$('observer-error').focus();}
    finally{clearTimeout(timer);controller=null;$('observer-submit').disabled=false;}
  };
  // Disk cache restoration uses no external request and never replaces selection.
  let loaded=false;
  async function restoreCache(){if(loaded||window.SeleneObservation?.mode!=='nasa')return;loaded=true;try{const response=await fetch('/api/observations');if(!response.ok)return;const value=await response.json(),names=readStudyNames();for(const bundle of value.bundles||[])try{const saved=names[bundleKey(bundle?.datasets?.[0])];if(typeof saved==='string'&&saved.trim()&&saved.length<=100)bundle.datasets[0].name=saved.trim();window.SeleneApp.addObserver(bundle,false);}catch{ /* A malformed cache entry cannot block the base workspace. */ }}catch{ /* Offline base data remains available. */ }}
  document.addEventListener('observation-change',restoreCache);restoreCache();
  window.addEventListener('beforeunload',event=>{if(controller){event.preventDefault();event.returnValue='';}});
  const sourceLinks=document.createElement('p');sourceLinks.className='observer-source-links';$('ex-method-content').after(sourceLinks);
  function updateSources(s){
    sourceLinks.replaceChildren();if(s.mode!=='nasa')return;
    try{const record=JSON.parse(s.provenance);for(const body of ['sun','earth']){const hash=record.raw_sha256?.[body];if(!/^[a-f0-9]{64}$/.test(hash||''))continue;const link=document.createElement('a');link.href='/api/source/'+hash;link.target='_blank';link.rel='noopener';link.textContent='Raw '+(body==='sun'?'Sun':'Earth')+' response';sourceLinks.append(link);}}catch{ /* Bundled and imported source records use their existing provenance. */ }
  }
  document.addEventListener('observation-change',e=>updateSources(e.detail));if(window.SeleneObservation)updateSources(window.SeleneObservation);
})();
