'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'SELENE.html'),'utf8');
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
let imports,classic=0;const appCodes=[];
for(const [,attrs,code]of scripts){
 if(attrs.includes('importmap'))imports=JSON.parse(code).imports;
 else if(attrs.includes('module'))appCodes.push(code);
 else {new vm.Script(code);classic++;}
}
assert.equal(appCodes.length,3,'Observer, atlas and terrain rehearsal modules must ship');
assert.ok(!/<script[^>]+src=|<link[^>]+rel="stylesheet"/.test(html),'Standalone runtime must not use sibling scripts or CSS');
const bundledJSON=html.match(/const seleneBundled=(.*);\nwindow\.fetch=/)[1];
const bundled=JSON.parse(bundledJSON);
assert.deepEqual(bundled['data/clps-missions.json'],JSON.parse(fs.readFileSync(path.join(root,'data/clps-missions.json'),'utf8')));
assert.deepEqual(bundled['data/terrain-horizons.json'],JSON.parse(fs.readFileSync(path.join(root,'data/terrain-horizons.json'),'utf8')));
for(let i=0;i<4;i++){const p=`data/terrain-rehearsal-${i}.json`;assert.deepEqual(bundled[p],JSON.parse(fs.readFileSync(path.join(root,p),'utf8')));}
assert.ok(html.includes('assets/lola-display-bump.jpg'));
assert.ok(html.includes('Local server required'));
const modules=new Map(Object.entries(imports).map(([name,url])=>{
 assert.ok(url.startsWith('data:text/javascript;base64,'));
 return [name,new vm.SourceTextModule(Buffer.from(url.split(',')[1],'base64').toString('utf8'))];
}));
(async()=>{
 for(const code of appCodes)await new vm.SourceTextModule(code).link(name=>{
  assert.ok(modules.has(name),'Unbundled module '+name);return modules.get(name);
 });
 const boot=scripts.find(([,attrs,code])=>!attrs.includes('importmap')&&!attrs.includes('module')&&code.includes('window.fetch=async'))[2];
 const sandbox={window:{},location:{href:'about:srcdoc'},URL,Response};
 vm.runInNewContext(boot,sandbox);
 assert.equal((await sandbox.window.fetch('data/horizons.json')).status,200,'portable fetch resolves bundled data under about:srcdoc');
 assert.equal((await sandbox.window.fetch('/api/observations')).status,200,'portable fetch resolves observations stub under about:srcdoc');
 assert.equal((await sandbox.window.fetch('/api/terrain')).status,503,'portable fetch returns offline terrain message under about:srcdoc');
 console.log(`Passed: portable HTML has ${classic} valid classic scripts, all three app modules, linked embedded dependencies and the source-matched mission catalogue. Browser execution remains a separate check.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
