'use strict';
(()=>{
  const $=id=>document.getElementById(id),host=$('lunar-explorer');
  const mobileOptions=document.createElement('button');mobileOptions.className='study-mobile-toggle';mobileOptions.setAttribute('aria-expanded','false');mobileOptions.innerHTML='<span>Observer & assumptions</span><span id="study-mobile-current"></span>';
  const sidebar=host.querySelector('.ex-sites');sidebar.prepend(mobileOptions);mobileOptions.onclick=()=>{const open=sidebar.classList.toggle('study-options-open');mobileOptions.setAttribute('aria-expanded',String(open));};
  const stats=document.createElement('div');stats.className='study-window';stats.setAttribute('aria-label','Time above threshold over the whole window');
  stats.innerHTML='<div><span>Sun above flat cutoff</span><strong id="study-sun">—</strong></div><div><span>Earth above flat cutoff</span><strong id="study-earth">—</strong></div><div><span>Both together</span><strong id="study-both">—</strong></div>';
  host.querySelector('.ex-question').insertBefore(stats,$('ex-save'));
  const study=document.createElement('section');study.className='study-panel';study.setAttribute('aria-labelledby','study-title');
  study.innerHTML=`<div class="study-heading"><div><h2 id="study-title">How much horizon can you afford?</h2><p>Test an assumed obstruction against the same observation window.</p></div><button id="study-limiting">Inspect limiting sample ↗</button></div>
    <div class="study-body"><div class="study-plot-area"><div class="study-legend"><span class="ex-sun-key">Sun</span><span class="ex-earth-key">Earth</span><span class="study-both-key">Both</span><span id="study-cutoff"></span></div>
    <svg id="study-chart" viewBox="0 0 640 168" role="slider" tabindex="0" aria-label="Test uniform obstruction in degrees" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0" aria-describedby="study-method"><path d="M40 18H616M40 78H616M40 138H616" class="study-grid"/><text x="4" y="22">100%</text><text x="10" y="82">50%</text><text x="18" y="142">0%</text><path id="study-sun-path" class="study-sun-path"/><path id="study-earth-path" class="study-earth-path"/><path id="study-both-path" class="study-both-path"/><path id="study-cursor" class="study-cursor"/><circle id="study-point" r="5"/><text x="40" y="161">0°</text><text x="328" y="161" text-anchor="middle">5° obstruction</text><text x="616" y="161" text-anchor="end">10°</text></svg>
    <p id="study-method">Select a cutoff on the chart or use the obstruction control. Each point is a separate assumption; lines connect tested settings.</p></div>
    <div class="study-answer"><span>At this assumption</span><strong id="study-answer"></strong><p id="study-explanation"></p><p id="study-cadence"></p><details><summary>Inspect calculated values</summary><div class="study-table-wrap"><table><caption>Time above threshold / hours</caption><thead><tr><th>Cutoff</th><th>Sun</th><th>Earth</th><th>Both</th></tr></thead><tbody id="study-values"></tbody></table></div></details></div></div>`;
  host.querySelector('.ex-timeline').after(study);
  const eventRow=document.createElement('div');eventRow.className='study-event';eventRow.innerHTML='<div><strong id="study-event-title">Next sampled change</strong><span id="study-event-detail"></span></div><button id="study-next-event">Inspect change ↗</button>';host.querySelector('.ex-timeline-head').after(eventRow);
  let state=null,curve=[],cachedRows=null,cachedMargin=null,analysis=null,nextEvent=null;
  const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:2});
  const hours=n=>number.format(n)+' h';
  const spacing=n=>n<1/60?number.format(n*3600)+' s':n<1?number.format(n*60)+' min':hours(n);
  function setObstruction(value){window.SeleneApp.pause();const input=$('ex-obstruction');input.value=Math.max(0,Math.min(10,Math.round(value*2)/2));input.dispatchEvent(new Event('input',{bubbles:true}));}
  $('study-chart').onclick=e=>{const b=e.currentTarget.getBoundingClientRect();setObstruction(((e.clientX-b.left)/b.width*640-40)/576*10);};
  $('study-chart').onkeydown=e=>{if(!state)return;const values={ArrowLeft:state.horizon-.5,ArrowDown:state.horizon-.5,ArrowRight:state.horizon+.5,ArrowUp:state.horizon+.5,Home:0,End:10};if(Object.hasOwn(values,e.key)){e.preventDefault();setObstruction(values[e.key]);}};
  $('study-limiting').onclick=()=>{if(!analysis)return;window.SeleneApp.pause();$('ex-scrub').value=analysis.limitingIndex;$('ex-scrub').dispatchEvent(new Event('input',{bubbles:true}));$('ex-history-chart').focus({preventScroll:true});host.querySelector('.ex-timeline').scrollIntoView({block:'nearest',behavior:'instant'});};
  $('study-next-event').onclick=()=>{if(!nextEvent)return;window.SeleneApp.pause();$('ex-scrub').value=nextEvent.index;$('ex-scrub').dispatchEvent(new Event('input',{bubbles:true}));};
  function update(next){
    state=next;const rows=state.geometry||state.samples;
    $('study-mobile-current').textContent=`${state.name.split(' · ')[0]} · cutoff ${state.threshold.toFixed(2)}°`;
    analysis=window.SeleneStudy.analyze(rows,state.threshold);
    nextEvent=window.SeleneStudy.nextChange(rows,state.index,state.threshold);$('study-next-event').disabled=!nextEvent;
    if(nextEvent){
      $('study-event-title').textContent=nextEvent.bodies.map((k,i)=>(k==='sun'?'Sun':'Earth')+(nextEvent.above[i]?' rises above':' drops below')+' cutoff').join(' · ');
      const now=rows[state.index].time;
      $('study-event-detail').textContent=`Sample bracket: ${hours((nextEvent.from-now)/3600000)}–${hours((nextEvent.to-now)/3600000)} from this observation. Exact crossing unresolved.`;
    }else{$('study-event-title').textContent='No later sampled change';$('study-event-detail').textContent='No further cutoff transition is recorded before this dataset ends.';}
    for(const key of ['sun','earth','both']){$('study-'+key).textContent=hours(analysis[key]);$('study-'+key).title=number.format(100*analysis[key]/analysis.total)+'% of '+hours(analysis.total);}
    stats.setAttribute('aria-label',`Time above threshold over ${hours(analysis.total)}: Sun ${hours(analysis.sun)}, Earth ${hours(analysis.earth)}, both ${hours(analysis.both)}.`);
    if(rows!==cachedRows||state.margin!==cachedMargin){
      cachedRows=rows;cachedMargin=state.margin;curve=window.SeleneStudy.sweep(rows,state.margin);
      for(const key of ['sun','earth','both'])$('study-'+key+'-path').setAttribute('d',curve.map((p,i)=>`${i?'L':'M'}${40+p.obstruction/10*576} ${138-p[key]/p.total*120}`).join(' '));
      $('study-values').replaceChildren();
      for(const p of curve){const tr=document.createElement('tr');for(const value of [number.format(p.threshold)+'°',...['sun','earth','both'].map(k=>number.format(p[k]))]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('study-values').append(tr);}
    }
    const x=40+state.horizon/10*576;$('study-cursor').setAttribute('d',`M${x} 12V142`);$('study-point').setAttribute('cx',x);$('study-point').setAttribute('cy',138-analysis.sun/analysis.total*120);
    $('study-chart').setAttribute('aria-valuenow',state.horizon);$('study-chart').setAttribute('aria-valuetext',`${state.horizon} degrees obstruction plus ${state.margin} degrees margin. Sun ${hours(analysis.sun)}, Earth ${hours(analysis.earth)}, both ${hours(analysis.both)}.`);
    $('study-cutoff').textContent=`Cutoff ${number.format(state.threshold)}° · margin ${number.format(state.margin)}°`;
    $('study-answer').textContent=analysis.both===0?'No shared clear interval':`${hours(analysis.both)} with both above cutoff`;
    $('study-explanation').textContent=`Sun: ${hours(analysis.sun)} of ${hours(analysis.total)} above cutoff. Its interval-start elevation spans ${number.format(analysis.minSun)}° to ${number.format(analysis.maxSun)}°. ${analysis.earth===0?'Earth never clears this cutoff at an interval start.':'Earth clears it for '+hours(analysis.earth)+'.'} This tests geometry, not power or a radio link.`;
    const cadence=analysis.cadenceMin===analysis.cadenceMax?spacing(analysis.cadenceMin):spacing(analysis.cadenceMin)+'–'+spacing(analysis.cadenceMax);
    $('study-cadence').textContent=`${rows.length} samples · ${cadence} spacing. Durations hold each interval’s starting state; the final sample closes the window. Crossings between samples are unresolved.`;
    host.querySelector('.ex-window p').textContent=`${rows.length} observer samples · ${cadence} spacing. No terrain screening.`;
    host.querySelector('.ex-timeline-note').textContent='Select time on the chart or use arrow keys. Lines join samples; crossings between samples are unresolved. Filled lanes use each interval’s starting state.';
    for(const select of [$('ex-speed'),$('speed')])for(const option of select.options)option.textContent=(1000/Number(option.value))+' samples / s';
    host.querySelector('.ex-timeline-head .ex-small-label').textContent='Observation time / UTC';
  }
  document.addEventListener('observation-change',e=>update(e.detail));
  if(window.SeleneObservation)update(window.SeleneObservation);
})();
