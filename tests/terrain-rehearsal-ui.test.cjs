'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),listeners=new Map();
class Element{
 constructor(){this.value='0';this.hidden=false;this.attributes={};this.clientWidth=600;}
 set id(v){this._id=v;elements.set(v,this);}get id(){return this._id;}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]||'false';}
 after(){}scrollIntoView(){}focus(){}addEventListener(){}
}
const get=id=>{if(!elements.has(id)){const e=new Element();e.id=id;}return elements.get(id);};get('rehearsal-scene').parentElement=new Element();get('rehearsal-follow').value='sun';
const document={createElement:()=>new Element(),getElementById:get,querySelector:()=>new Element(),addEventListener:(n,f)=>listeners.set(n,f)};
const bundle=JSON.parse(fs.readFileSync('data/terrain-horizons.json')),rehearsal=JSON.parse(fs.readFileSync('data/terrain-rehearsal-0.json'));
let loads=0,fail=true;const rows=[0,1,2].map(i=>({time:i*3600000,sun_az:i,earth_az:90,sun_el:20,earth_el:20}));
const state={mode:'imported',site:{lat:-83,lon:0},samples:rows,index:0,horizon:0,margin:0};
const window={SeleneObservation:state,SeleneTerrain:require('../src/terrain-model.js'),SeleneRehearsal:require('../src/rehearsal-model.js'),RehearsalSession:require('../src/rehearsal-session.js'),SeleneTerrainKey:require('../src/terrain-data.js').key,SeleneTerrainData:{ready:Promise.resolve(bundle),async load(site){loads++;if(fail)throw Error('Outside coverage.');return {bundle,profile:{...bundle.profiles[0],...site},rehearsal:{...rehearsal,site}};}}};
const context={window,document,location:{search:'?graphics=off'},URLSearchParams,MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},console,THREE:{},OrbitControls:class{}};
vm.runInNewContext(fs.readFileSync('src/terrain-rehearsal.js','utf8').replace(/^import .*;\r?\n/gm,''),context);
const tick=()=>new Promise(setImmediate);
(async()=>{
 get('rehearsal-open').onclick();await tick();assert.match(get('rehearsal-status').textContent,/Outside coverage/);assert.equal(get('rehearsal-content').hidden,true);
 for(let i=0;i<5;i++){listeners.get('observation-change')({detail:{...state,index:i%3}});await tick();}
 assert.equal(loads,1,'Playback must not continually retry a failed coordinate');
 fail=false;get('rehearsal-close').onclick();get('rehearsal-open').onclick();await tick();assert.equal(loads,2);assert.equal(get('rehearsal-content').hidden,false);assert.match(get('rehearsal-status').textContent,/-83/);assert.equal(get('rehearsal-fallback').hidden,false);assert.equal(get('rehearsal-inspect').disabled,true);
 listeners.get('observation-change')({detail:{...state,index:2}});await tick();assert.match(get('rehearsal-time').textContent,/02:00/);assert.equal(loads,2);
 get('rehearsal-section').clientWidth=0;get('rehearsal-section').parentElement={clientWidth:740};get('rehearsal-bearing').oninput({target:{value:'45'}});assert.equal(get('rehearsal-section').getAttribute('viewBox'),'0 0 740 230','Firefox zero SVG clientWidth falls back to container width');
 listeners.get('observation-change')({detail:{...state,site:null}});assert.equal(get('rehearsal-content').hidden,true,'Old-site terrain must disappear synchronously when coordinates change');await tick();
 console.log('Terrain rehearsal UI: failed-site playback does not retry, explicit retry recovers, graphics-off section/time controls and missing-site cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
