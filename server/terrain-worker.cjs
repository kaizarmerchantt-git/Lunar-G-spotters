'use strict';
const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),E=require('./terrain-extractor.cjs');
try{
 const grid=E.readSource(workerData.root),result=E.extract(grid,workerData.query);
 const metadata=JSON.parse(fs.readFileSync(path.join(workerData.root,'data/terrain-horizons.json'),'utf8'));
 if(metadata.sha256!==E.SHA||metadata.label_sha256!==E.LABEL_SHA)throw Error('Terrain metadata source mismatch.');
 parentPort.postMessage({value:{bundle:{...metadata,extractor:result.extractor,coverage:'Complete sampled 100 km footprint and bilinear neighbours validated against retained DEM',profiles:[result.profile]},...(result.rehearsal?{rehearsal:result.rehearsal}:{})}});
}catch(error){parentPort.postMessage({error:error.message});}
