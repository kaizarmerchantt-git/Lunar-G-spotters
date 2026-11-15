'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise production update with irregular timestamps; a sample index is not
// a time coordinate on the interval-weighted visibility bands.
const elements=new Map(),listeners=new Map();
function element(){return {style:{setProperty(){}},children:[],attrs:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},options:[{value:'1000'},{value:'500'},{value:'250'}],setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},replaceChildren(){this.children=[];},append(e){this.children.push(e);},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}};}
function get(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}
const document={getElementById:get,createElement:element,querySelector:get,querySelectorAll:()=>[],body:element(),addEventListener:(n,f)=>listeners.set(n,f)};
const context={document,window:{dispatchEvent(){}},matchMedia:()=>({matches:true}),MutationObserver:class{observe(){}},ResizeObserver:class{observe(){}},Event:class{},setTimeout,clearTimeout,Date};
vm.runInNewContext(fs.readFileSync('src/mission-ui.js','utf8'),context);
const samples=[0,1,10].map(h=>({time:Date.UTC(2026,10,1)+h*3600000,sun:true,earth:true,sun_el:5,earth_el:2}));
listeners.get('observation-change')({detail:{samples,index:1,name:'Irregular import',threshold:0,mode:'imported',fractions:{sun:'100%',earth:'100%'}}});
assert.equal(get('availability-cursor').style.left,'10%','timeline marker must use elapsed UTC time, not 50% sample index');
assert.match(get('.data-stamp').textContent,/User supplied/,'classic source badge must follow imported data');
assert.match(get('.data-stamp').textContent,/2026-11-01/);
assert.deepEqual(get('mission-speed').options.map(o=>o.textContent),['1 samples / s','2 samples / s','4 samples / s'],'playback advances samples, not necessarily hours');
listeners.get('observation-change')({detail:{samples,index:2,name:'NASA fixture',threshold:0,mode:'nasa',fractions:{sun:'100%',earth:'100%'}}});
assert.equal(get('availability-cursor').style.left,'100%');
assert.match(get('.data-stamp').textContent,/NASA\/JPL/);
console.log('Classic UI: irregular-time cursor, source/date badge and sample-rate units passed.');
