const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const M=require('../src/model.js'),R=require('../src/resource-model.js'),N=require('../src/notebook-data.js'),T=require('../src/observation-transfer.js');
const rows=[{time:'2028-02-28T12:00:00Z',sun_az:12,sun_el:1,earth_az:190,earth_el:-2},{time:'2028-03-01T00:00:00Z',sun_az:18,sun_el:2,earth_az:192,earth_el:1}];
const resource={provider:'NASA/JPL Horizons',retrieved_utc:'2028-01-01T00:00:00Z',conventions:'UTC, degrees, airless body centers.',datasets:Array.from({length:5},(_,i)=>({name:'Resource '+i,lat:80+i,lon:-120+i,rows}))};
function harness(){
  const elements=new Map();let resolveFetch;
  const defaults={date:'2026-11-14',site:'0',horizon:'0',margin:'0',scrub:'0',speed:'500'};
  function element(id=''){
    return {id,value:defaults[id]||'',style:{},children:[],textContent:'',innerHTML:'',disabled:false,attrs:{},get options(){return this.children;},replaceChildren(){this.children=[];},append(n){this.children.push(n);},addEventListener(){},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},click(){this.onclick?.();}};
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},createElement(){return element();},addEventListener(){},dispatchEvent(){}};
  const c={document,LunarModel:M,SeleneResources:R,SeleneNotebookData:N,SeleneObservationTransfer:T,Date,Intl,TextEncoder,console,Blob,URL,CustomEvent:class{constructor(type,props){this.type=type;Object.assign(this,props);}},setInterval(){return 1;},clearInterval(){},setTimeout,fetch(){return new Promise(resolve=>resolveFetch=resolve);}};c.window=c;
  vm.runInNewContext(fs.readFileSync('src/app.js','utf8'),c,{filename:'app.js'});
  return {c,e:id=>document.getElementById(id),load:async data=>{resolveFetch({ok:true,json:async()=>data});await new Promise(setImmediate);}};
}
(async()=>{
  const h=harness();await h.load(resource);assert.equal(h.c.SeleneObservation.comparisons.length,5);
  const s=N.capture({...h.c.SeleneObservation,samples:R.normalize(resource).datasets[4].rows,name:'Resource 4',siteIndex:4,site:{lat:84,lon:-116},index:1},{id:'fifth',name:'Fifth site'});
  h.c.SeleneApp.restore(s);assert.equal(h.c.SeleneObservation.siteIndex,4);assert.equal(h.c.SeleneObservation.site.lat,84);assert.equal(h.c.SeleneObservation.index,1);
  const late=harness();late.c.SeleneApp.importCSV('Imported first','User source / UTC / degrees',N.csv(s));await late.load(resource);assert.equal(late.c.SeleneObservation.mode,'imported');
  const savedImport=N.capture(late.c.SeleneObservation,{id:'imported',name:'Imported first'});for(let i=0;i<5;i++){late.c.SeleneApp.restore(savedImport);assert.equal(late.c.SeleneObservation.provenance,savedImport.provenance,'source record must not grow when reopening a case');}
  const single=harness();single.e('site').value='2';await single.load({...resource,datasets:[resource.datasets[0]]});assert.equal(single.c.SeleneObservation.mode,'nasa');assert.equal(single.c.SeleneObservation.siteIndex,0);
  const extra={...resource,datasets:[{...resource.datasets[0],lat:-80,name:'New observer'}]};
  h.c.SeleneApp.addObserver(extra);assert.equal(h.c.SeleneObservation.site.lat,-80);assert.equal(h.c.SeleneObservation.comparisons.length,6);
  h.c.SeleneApp.addObserver({...extra,datasets:[{...extra.datasets[0],name:'Renamed observer'}]});assert.equal(h.c.SeleneObservation.comparisons.length,6,'duplicate query reuses the observer');assert.equal(h.c.SeleneObservation.name,'Renamed observer','explicit re-selection updates custom observer study name');
  h.c.SeleneApp.addObserver({...resource,datasets:[{...resource.datasets[0],name:'Attempted rename'}]});assert.equal(h.c.SeleneObservation.name,'Resource 0','bundled reference datasets are never relabeled');
  h.c.SeleneApp.addObserver({...extra,datasets:[{...extra.datasets[0],name:'New observer'}]});
  const shifted=N.capture(h.c.SeleneObservation,{id:'shifted',name:'Reloaded query'});shifted.siteIndex=1;h.c.SeleneApp.restore(shifted);assert.equal(h.c.SeleneObservation.siteIndex,5,'reordered cache matches exact rows and coordinates instead of trusting saved index');
  h.c.SeleneApp.addObserver({...extra,datasets:[{...extra.datasets[0],lat:-70}]},false);assert.equal(h.c.SeleneObservation.site.lat,-80,'background cache addition preserves selection');
  const prior=h.c.SeleneObservation;assert.throws(()=>h.c.SeleneApp.addObserver({...extra,provider:'Untrusted'}));assert.equal(h.c.SeleneObservation,prior,'invalid bundle preserves analysis');
  const csv=N.csv(s),importSite={lat:-84.7906,lon:29.1957};
  h.c.SeleneApp.importCSV('Located CSV','User-supplied lunar observer / UTC / degrees',csv,importSite);
  assert.equal(h.c.SeleneObservation.mode,'imported');assert.equal(h.c.SeleneObservation.site.lat,importSite.lat);assert.equal(h.c.SeleneObservation.siteIndex,0);
  assert.equal(h.c.SeleneObservation.comparisons[0].lon,importSite.lon);
  const located=N.capture(h.c.SeleneObservation,{id:'located',name:'Located CSV'});h.c.SeleneApp.restore(located);assert.equal(h.c.SeleneObservation.site.lon,importSite.lon,'notebook restore retains explicit imported location');
  const beforeBad=h.c.SeleneObservation;assert.throws(()=>h.c.SeleneApp.importCSV('Bad','User source',csv,{lat:91,lon:0}),/coordinate/i);assert.equal(h.c.SeleneObservation,beforeBad);
  h.c.SeleneApp.importCSV('Unlocated CSV','User source',csv);assert.equal(h.c.SeleneObservation.site,null,'location is never inferred from rows or name');
  const beforeLocationRows=JSON.stringify(h.c.SeleneObservation.geometry);
  h.c.SeleneApp.setImportedLocation(importSite);assert.equal(h.c.SeleneObservation.site.lat,importSite.lat);assert.equal(JSON.stringify(h.c.SeleneObservation.geometry),beforeLocationRows,'attaching a location does not recompute or replace imported angles');
  assert.throws(()=>h.c.SeleneApp.setImportedLocation({lat:91,lon:0}),/coordinate/i);
  h.c.SeleneApp.setImportedLocation(null);assert.equal(h.c.SeleneObservation.site,null,'empty location clears attached CSV coordinates');
  h.c.SeleneApp.setImportedLocation(importSite);
  const transfer=T.encode(h.c.SeleneObservation),beforeTransfer=h.c.SeleneObservation;
  assert.throws(()=>h.c.SeleneApp.importObservation('{"kind":"selene.notebook"}'));assert.equal(h.c.SeleneObservation,beforeTransfer,'bad observation file preserves the active study');
  h.c.SeleneApp.importObservation(transfer);assert.equal(h.c.SeleneObservation.site.lon,importSite.lon);assert.equal(h.c.SeleneObservation.mode,'imported');assert.equal(JSON.stringify(h.c.SeleneObservation.geometry),beforeLocationRows);
  assert.equal(JSON.parse(T.encode(h.c.SeleneObservation)).source,JSON.parse(transfer).source,'repeated transfer must not accumulate rendered source headers');
  console.log('Passed: app integration with five sites, high-index scenario restore, late cache/import race and single-site selection clamp.');
})().catch(e=>{console.error(e);process.exitCode=1;});
