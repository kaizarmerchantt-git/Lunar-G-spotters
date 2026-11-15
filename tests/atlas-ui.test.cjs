'use strict';
// Exercise real atlas navigation/prefill with graphics explicitly disabled.
// This models DOM events only, not rendering, layout, or WebGL recovery.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../src/atlas-model.js'),catalogue=JSON.parse(fs.readFileSync('data/clps-missions.json','utf8'));
function harness(){
 const elements=new Map(),events=new Map();let resolveFetch,observerOpens=0;
 class Node{
  constructor(){this.children=[];this.attrs={};this.style={};this.value='';this.hidden=false;this.listeners=new Map();const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>{const v=on===undefined?!classes.has(x):on;v?classes.add(x):classes.delete(x);return v;}};this.dataset={};}
  set id(v){this._id=v;elements.set(v,this);}get id(){return this._id;}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  click(){if(this.disabled)return;this.onclick?.({});for(const fn of this.listeners.get('click')||[])fn({});}
  append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}before(){}after(){}
  querySelector(selector){return get(selector);}querySelectorAll(selector){return selector==='.ex-header button'?[get('tour')]:[];}
  getBoundingClientRect(){return {width:800,height:600,left:0,top:0};}
 }
 const get=id=>{if(!elements.has(id)){const n=new Node();n.id=id;}return elements.get(id);};
 const document={hidden:false,getElementById:get,createElement:()=>new Node(),addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);}};
 const emit=(compare=false)=>document.dispatchEvent({type:'selene-workspace-change',detail:{compare}});
 get('tour').textContent='Guided review';
 get('wb-analyze').onclick=()=>{get('lunar-explorer').classList.remove('wb-compare-mode');emit(false);};
 get('wb-compare').onclick=()=>{get('lunar-explorer').classList.add('wb-compare-mode');emit(true);};
 get('ex-legacy').onclick=()=>{get('lunar-explorer').hidden=true;};
 get('observer-open').onclick=()=>{observerOpens++;get('observer-lat').value='reference latitude';get('observer-lon').value='reference longitude';};
 class Vector3{constructor(...v){this.v=v;}multiplyScalar(){return this;}}
 const observation=Object.freeze({site:Object.freeze({lat:-89.5,lon:0}),index:0,mode:'nasa'});
 const c={document,THREE:{Vector3,Raycaster:class{}},SeleneAtlasModel:A,SeleneObservation:observation,SeleneApp:{pause(){}},location:{search:'?graphics=off'},URLSearchParams,matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,ResizeObserver:class{observe(){}},performance:{now:()=>0},console,fetch:()=>new Promise(resolve=>resolveFetch=resolve),scrollTo(){},addEventListener(){}};c.window=c;
 const source=fs.readFileSync('src/mission-atlas.js','utf8').replace(/^import .*\r?\n/gm,'');
 vm.runInNewContext(source,c,{filename:'mission-atlas.js'});
 return {get,c,emit,observation,get observerOpens(){return observerOpens;},async load(){resolveFetch({ok:true,json:async()=>catalogue});await new Promise(setImmediate);}};
}
(async()=>{
 const h=harness();assert.equal(h.get('mission-atlas').hidden,false,'initial atlas is visible before sources arrive');
 h.get('wb-compare').click();assert.equal(h.get('mission-atlas').hidden,true);
 await h.load();assert.equal(h.get('mission-atlas').hidden,true,'late catalogue must not steal Compare navigation');assert.ok(h.get('lunar-explorer').classList.contains('wb-compare-mode'));
 h.get('atlas-tab').click();assert.equal(h.get('mission-atlas').hidden,false);assert.equal(h.get('atlas-tab').getAttribute('aria-current'),'page');
 h.get('tour').click();assert.equal(h.get('mission-atlas').hidden,false,'aborted Guided review must not hide Mission Atlas');
 h.emit(false);assert.equal(h.get('mission-atlas').hidden,true,'programmatic Data import/restore analysis navigation hides atlas');
 h.get('atlas-tab').click();const before=JSON.stringify(h.observation);h.get('atlas-analyze-coordinate').click();
 const im2=catalogue.missions.find(m=>m.id==='im-2');assert.equal(h.observerOpens,1);assert.equal(h.get('observer-lat').value,im2.coordinate.lat);assert.equal(h.get('observer-lon').value,im2.coordinate.lon);assert.equal(JSON.stringify(h.c.SeleneObservation),before,'catalogue bridge must not relabel/recompute existing analysis');assert.equal(h.get('mission-atlas').hidden,true);
 h.get('atlas-tab').click();const regionButton=h.get('atlas-list').children.find(n=>n.dataset.mission==='blue-ghost-2');regionButton.click();h.get('atlas-analyze-coordinate').click();assert.equal(h.observerOpens,1,'region-only mission must not invent observer coordinates');
 const lateClassic=harness();lateClassic.get('ex-legacy').click();await lateClassic.load();assert.equal(lateClassic.get('lunar-explorer').hidden,true);assert.equal(lateClassic.get('mission-atlas').hidden,true,'late sources preserve Classic navigation');
 {
  const obs=harness(),g=obs.get;let explorerMode='orbit';
  const Proto=obs.c.document.createElement().constructor.prototype,origAppend=Proto.append,origPrepend=Proto.prepend;
  const track=(parent,nodes)=>{for(const n of nodes)if(n&&typeof n==='object')n.parentNode=parent;};
  Object.defineProperty(Proto,'lastElementChild',{configurable:true,get(){return this._last||(this._last={textContent:''});}});
  for(const id of ['obs-system-layer','.system-controls','.system-header','.system-caption','.system-scale-switch','system-scene','body-inspector','globe-pane'])g(id);
  Proto.append=function(...n){track(this,n);return origAppend.apply(this,n);};
  Proto.prepend=function(...n){track(this,n);return origPrepend.apply(this,n);};
  g('.system-header').after=function(...n){track(g('globe-pane'),n);};g('.system-scale-switch').after=function(...n){track(g('globe-pane'),n);};
  g('inspect-body').selectedOptions=[{textContent:'Moon'}];
  g('ex-legacy').onclick=()=>{g('ex-return');};
  g('ex-horizon').onclick=()=>{if(explorerMode==='horizon')return;explorerMode='horizon';obs.c.document.dispatchEvent({type:'explorer-view-change',detail:'horizon'});};
  obs.c.SeleneExplorer={cancelCamera(){if(explorerMode==='horizon')explorerMode='orbit';}};
  obs.c.MutationObserver=class{observe(){}};obs.c.Event=class{constructor(t){this.type=t;}};obs.c.dispatchEvent=()=>{};
  obs.c.SeleneObservation={name:'Reference A · 89.5° S',index:0,mode:'nasa',samples:[{time:Date.parse('2026-11-14T00:00:00Z')},{time:Date.parse('2026-11-17T00:00:00Z')}]};
  vm.runInNewContext(fs.readFileSync('src/observatory.js','utf8'),obs.c,{filename:'observatory.js'});
  assert.equal(g('ex-legacy').hidden,false,'Classic workspace toggle remains accessible');
  assert.equal(g('.system-scale-switch').parentNode,g('.system-controls'),'Solar distance scale switch is adopted into Observatory controls');
  g('ex-horizon').click();assert.equal(g('obs-view-number').textContent,'03 / THE OBSERVER’S SKY');
  g('obs-system-view').click();assert.equal(explorerMode,'orbit','System tab parks Local sky mode so Local sky can re-open');
  g('ex-horizon').click();assert.equal(explorerMode,'horizon','Local sky re-enters after visiting Earth · Moon · Sun');
  g('ex-legacy').click();assert.equal(g('system-scene').parentNode,g('globe-pane'),'Classic workspace receives #system-scene back');
  g('ex-return').click();assert.equal(g('system-scene').parentNode,g('obs-system-layer'),'Returning from Classic re-adopts #system-scene into Observatory');
 }
 console.log('Passed: atlas late-source navigation, programmatic analysis return, verified-coordinate prefill, Observatory view/Classic handoff and region-only scientific separation in graphics-off mode.');
})().catch(error=>{console.error(error);process.exitCode=1;});
