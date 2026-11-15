(function(root){
 'use strict';
 class TerrainData{
  static key(site){return site&&Number.isFinite(site.lat)&&Math.abs(site.lat)<=90&&Number.isFinite(site.lon)&&Math.abs(site.lon)<=360?JSON.stringify({lat:site.lat,lon:((site.lon%360)+540)%360-180}):null;}
  constructor(fetcher,T,M){
   this.fetch=fetcher;this.T=T;this.M=M;this.cache=new Map();this.pending=new Map();this.bundle=null;
   this.ready=fetcher('data/terrain-horizons.json').then(async r=>{if(!r.ok)throw Error('Terrain source metadata unavailable');this.bundle=T.validate(await r.json());return this.bundle;});this.ready.catch(()=>{});
  }
  peek(site){
   const key=TerrainData.key(site);if(!key)return null;
   if(this.cache.has(key)){const v=this.cache.get(key);this.cache.delete(key);this.cache.set(key,v);return v;}
   const profile=this.bundle&&this.T.match(this.bundle,site);return profile?{bundle:this.bundle,profile}:null;
  }
  async load(site,rehearsal=false){
   await this.ready;const key=TerrainData.key(site);if(!key)throw Error('Valid lunar observer coordinates are required for terrain.');
   const known=this.peek(site);if(known&&(!rehearsal||known.rehearsal))return known;
   const requestKey=key+':'+rehearsal;if(this.pending.has(requestKey))return this.pending.get(requestKey);
   if(this.pending.size>=8)throw Error('Several terrain locations are loading. Wait and retry.');
   const task=(async()=>{
    const retained=this.T.match(this.bundle,site);let value;
    if(retained&&rehearsal){
     const response=await this.fetch(`data/terrain-rehearsal-${this.bundle.profiles.indexOf(retained)}.json`);if(!response.ok)throw Error('Retained terrain rehearsal unavailable.');
     value={bundle:this.bundle,profile:retained,rehearsal:this.M.validate(await response.json(),this.bundle,retained)};
    }else{
     let response;try{response=await this.fetch('/api/terrain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(key),rehearsal})});}
     catch{throw Error('Could not reach the local terrain calculator. Start SELENE with its local server and retained LOLA raster, then retry.');}
     let payload;try{payload=await response.json();}catch{throw Error('Custom terrain requires the local SELENE server and retained LOLA raster.');}
     if(!response.ok)throw Error(payload.error||'Custom terrain is unavailable.');
     const b=this.T.validate(payload.bundle);
     if(b.sha256!==this.bundle.sha256||b.label_sha256!==this.bundle.label_sha256)throw Error('Terrain source identity mismatch.');
     if(b.profiles.length!==1||TerrainData.key(b.profiles[0])!==key)throw Error('Terrain coordinate mismatch.');
     value={bundle:b,profile:b.profiles[0]};if(rehearsal)value.rehearsal=this.M.validate(payload.rehearsal,b,value.profile);
    }
    // Do not let a later profile-only response discard an already loaded mesh.
    const current=this.cache.get(key);if(current?.rehearsal&&!value.rehearsal)return current;
    this.cache.delete(key);this.cache.set(key,value);while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);return value;
   })().finally(()=>this.pending.delete(requestKey));this.pending.set(requestKey,task);return task;
  }
 }
 if(typeof module!=='undefined')module.exports=TerrainData;
 else{root.SeleneTerrainData=new TerrainData((...args)=>root.fetch(...args),root.SeleneTerrain,root.SeleneRehearsal);root.SeleneTerrainKey=TerrainData.key;}
})(typeof window!=='undefined'?window:globalThis);
