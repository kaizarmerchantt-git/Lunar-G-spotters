'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const env=process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{};
function run(args){execFileSync(process.execPath,args,{cwd:root,env,stdio:'inherit',timeout:30000});}
for(const dir of ['src','server','tests'])for(const name of fs.readdirSync(path.join(root,dir)).filter(n=>/\.(?:js|cjs)$/.test(n)))run(['--check',path.join(dir,name)]);
for(const file of ['observer-service.test.cjs','study.test.cjs','model.test.cjs','explorer.test.cjs','notebook.test.cjs','readiness.test.cjs','app-integration.test.cjs','horizons.test.cjs','terrain.test.cjs','terrain-ui.test.cjs','system.test.cjs','system-month.test.cjs','system-layout.test.cjs','atlas.test.cjs','atlas-ui.test.cjs','csv-fixtures.test.cjs','observation-transfer.test.cjs'])run([path.join('tests',file)]);
run(['--test',path.join('tests','server.test.cjs')]);
run([path.join('tests','mission-ui.test.cjs')]);
run([path.join('tests','rehearsal.test.cjs')]);
run([path.join('tests','rehearsal-session.test.cjs')]);
run([path.join('tests','terrain-data.test.cjs')]);
run([path.join('tests','terrain-rehearsal-ui.test.cjs')]);
if(process.argv.includes('--terrain-source')){run([path.join('tests','custom-terrain.test.cjs')]);run([path.join('tests','terrain-service.test.cjs')]);}
run(['--experimental-vm-modules',path.join('tests','portable-html.test.cjs')]);
console.log('SELENE acceptance checks passed. No external API or browser automation was used by this runner.');
