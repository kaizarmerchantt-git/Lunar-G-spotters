'use strict';
/* Adopt the original system instrument into the current analysis workspace. */
(()=>{
 const $=id=>document.getElementById(id),host=$('lunar-explorer'),scene=host.querySelector('.ex-scene-wrap');
 const element=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 let view='system';
 host.classList.add('observatory','obs-system');
 document.title='SELENE · Lunar observatory';
 host.querySelector('.ex-brand>span>span').textContent='LUNAR OBSERVATORY';
 host.querySelector('.ex-build').textContent='01 NOV — 01 DEC / 2026';
 $('wb-analyze').textContent='Explore';
 $('ex-orbit').textContent='Lunar globe';$('ex-horizon').textContent='Local sky';
 const systemButton=element('button');systemButton.id='obs-system-view';systemButton.textContent='Earth · Moon · Sun';
 systemButton.setAttribute('aria-pressed','true');scene.querySelector('.ex-scene-tabs').prepend(systemButton);
 scene.querySelector('.ex-scene-tabs').setAttribute('aria-label','Explore system, globe or local sky');
 const focus=element('button');focus.id='obs-focus';focus.textContent='Expand scene';focus.setAttribute('aria-pressed','false');
 focus.setAttribute('aria-label','Expand scene');$('ex-grid').setAttribute('aria-label','Coordinate grid');$('ex-reset-camera').setAttribute('aria-label','Reset camera');
 scene.querySelector('.ex-scene-toolbar').append(focus);
 const system=element('div','obs-system-layer');system.id='obs-system-layer';
 const globePane=$('globe-pane'),systemHeader=globePane.querySelector('.system-header'),systemCaption=globePane.querySelector('.system-caption');
 const scaleSwitch=globePane.querySelector('.system-scale-switch'),oldCanvas=$('system-scene'),systemControls=globePane.querySelector('.system-controls'),bodyInspector=globePane.querySelector('.body-inspector');
 const systemSource=$('system-source'),systemReadout=$('system-readout'),systemTime=$('system-time');
 const info=element('details','obs-body-info');
 info.innerHTML='<summary>About this body <span id="obs-body-summary">Moon</span></summary>';
 const caption=element('div','obs-system-meta');
 system.append(info,caption);scene.append(system);
 function adoptSystem(){
  if(oldCanvas.hidden)$('view-system')?.click();
  oldCanvas.setAttribute('aria-label','Earth, Moon and Sun orbital scene. Drag or use arrow keys to orbit. Click a body to inspect it. Play observation moves the sampled NASA geometry. Body sizes and Sun distance are illustrative.');
  if(scaleSwitch)systemControls.prepend(scaleSwitch);
  system.prepend(oldCanvas,systemControls);info.append(bodyInspector);caption.append(systemSource,systemReadout,systemTime);
  window.dispatchEvent(new Event('resize'));
 }
 function releaseSystem(){
  systemHeader.prepend(systemSource);if(scaleSwitch)systemHeader.after(scaleSwitch);
  (scaleSwitch||systemHeader).after(oldCanvas,systemControls,bodyInspector);systemCaption.prepend(systemReadout,systemTime);
  window.dispatchEvent(new Event('resize'));
 }
 adoptSystem();
 $('ex-legacy').addEventListener('click',()=>{releaseSystem();$('ex-return')?.addEventListener('click',adoptSystem);});
 const help=element('details','obs-conventions');
 help.innerHTML='<summary>Scene conventions & source</summary><p>NASA/JPL geometric vectors, Earth-centered J2000 ecliptic. Solid track: sampled Moon positions. Dotted circle: orientation guide, not a predicted orbit. Body sizes, attitude, shading and Sun distance are illustrative. Observer visibility uses separate apparent geometry.</p><button id="obs-scene-source">Inspect NASA source records ↗</button>';
 system.append(help);$('obs-scene-source').onclick=()=>$('ex-evidence').click();
 const empty=element('div','obs-no-vectors');empty.hidden=true;empty.id='obs-no-vectors';
 empty.innerHTML='<span>OUTSIDE THE BUNDLED SYSTEM WINDOW</span><h2>Keep the sky honest.</h2><p>The system scene covers 1 November–1 December 2026. This observation has no matching system vectors. Its numerical analysis remains available.</p><button id="obs-show-globe">Inspect lunar globe →</button>';
 system.append(empty);$('obs-show-globe').onclick=()=>$('ex-orbit').click();
 const foot=element('div','obs-scene-foot');foot.innerHTML='<span id="obs-view-number">01 / SYSTEM GEOMETRY</span><span>Drag to orbit · select a body</span>';scene.append(foot);
 const readout=element('div','obs-current-context');readout.innerHTML='<span>SELECTED OBSERVER</span><strong id="obs-current-name">Polar month</strong><span id="obs-current-time">Loading UTC…</span>';
 host.querySelector('.ex-observer').prepend(readout);
 const originalQuestion=host.querySelector('.ex-question');originalQuestion.classList.add('obs-window-summary');
 const questionCaption=originalQuestion.querySelector('.ex-small-label');questionCaption.textContent='WINDOW SUMMARY';
 host.querySelector('.ex-analysis-stage').after(host.querySelector('.ex-timeline'),originalQuestion);
 const history=element('details','obs-history-details');history.innerHTML='<summary>Visibility history & sampled elevations</summary>';
 history.append(host.querySelector('.ex-history'),host.querySelector('.ex-lanes'),host.querySelector('.ex-timeline-note'));host.querySelector('.ex-timeline').append(history);
 function changeView(next){
  view=next;host.classList.toggle('obs-system',next==='system');system.hidden=next!=='system';
  systemButton.setAttribute('aria-pressed',String(next==='system'));
  if(next==='system'){
   window.SeleneExplorer?.cancelCamera();$('ex-orbit').setAttribute('aria-pressed','false');$('ex-horizon').setAttribute('aria-pressed','false');
  }
  $('obs-view-number').textContent=next==='system'?'01 / SYSTEM GEOMETRY':next==='horizon'?'03 / THE OBSERVER’S SKY':'02 / LUNAR SURFACE';
  foot.lastElementChild.textContent=next==='system'?'Drag to orbit · select a body':next==='horizon'?'Drag to look · face Sun or Earth':'Drag to orbit · select a reference';
  window.dispatchEvent(new Event('resize'));
 }
 systemButton.onclick=()=>changeView('system');
 document.addEventListener('explorer-view-change',e=>changeView(e.detail));
 document.addEventListener('explorer-ready',()=>changeView('system'));
 focus.onclick=()=>{const expanded=host.classList.toggle('obs-expanded');focus.textContent=expanded?'Exit expanded scene':'Expand scene';focus.setAttribute('aria-label',focus.textContent);focus.setAttribute('aria-pressed',String(expanded));window.dispatchEvent(new Event('resize'));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&host.classList.contains('obs-expanded')){focus.click();focus.focus();}});
 $('inspect-body').addEventListener('change',()=>{$('obs-body-summary').textContent=$('inspect-body').selectedOptions[0].textContent;});
 const inspectObserver=new MutationObserver(()=>{$('obs-body-summary').textContent=$('body-name').textContent;});inspectObserver.observe($('body-name'),{childList:true});
 function update(state){
  $('obs-current-name').textContent=state.name.split(' · ')[0];
  $('obs-current-time').textContent=new Date(state.samples[state.index].time).toISOString().replace('T',' / ').replace('.000Z',' UTC');
  const first=new Date(state.samples[0].time),last=new Date(state.samples.at(-1).time),fmt={day:'numeric',month:'short',timeZone:'UTC'};
  host.querySelector('.ex-build').textContent=`${first.toLocaleDateString('en-GB',fmt)} — ${last.toLocaleDateString('en-GB',fmt)} ${last.getUTCFullYear()}`.toUpperCase();
  const range=window.SeleneSystem?.range?.(),epoch=state.samples[state.index].time;
  empty.hidden=!range||(state.mode==='nasa'&&epoch>=range[0]&&epoch<=range[1]);
  system.classList.toggle('obs-unavailable',!empty.hidden);
 }
 document.addEventListener('observation-change',e=>update(e.detail));
 document.addEventListener('system-ready',()=>{if(window.SeleneObservation)update(window.SeleneObservation);});
 if(window.SeleneObservation)update(window.SeleneObservation);
 changeView('system');
})();
