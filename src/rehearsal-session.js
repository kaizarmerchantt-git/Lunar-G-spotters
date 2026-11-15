(function(root){
 'use strict';
 class RehearsalSession{
  constructor(load,apply){this.load=load;this.apply=apply;this.cache=new Map();this.generation=0;}
  cancel(){this.generation++;}
  async select(index){
   const generation=++this.generation;
   if(!this.cache.has(index)){
    const task=Promise.resolve().then(()=>this.load(index)).catch(e=>{if(this.cache.get(index)===task)this.cache.delete(index);throw e;});
    this.cache.set(index,task);
   }else{const task=this.cache.get(index);this.cache.delete(index);this.cache.set(index,task);}
   while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);
   try{const value=await this.cache.get(index);if(generation===this.generation)this.apply(value);}
   catch(e){if(generation===this.generation)throw e;}
  }
 }
 if(typeof module!=='undefined')module.exports=RehearsalSession;else root.RehearsalSession=RehearsalSession;
})(typeof window!=='undefined'?window:globalThis);
