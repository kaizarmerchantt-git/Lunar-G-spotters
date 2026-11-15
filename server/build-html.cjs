'use strict';
// Portable build only: no dependencies, external downloads or notebook contents.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const safe=s=>s.replace(/<\/script/gi,'<\\/script');
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const assets={};for(const p of ['assets/earth-blue-marble.jpg','assets/earth-blue-marble-map.png','assets/lroc_color_2k.jpg','assets/lola-display-bump.jpg'])assets[p]='data:image/'+(p.endsWith('.png')?'png':'jpeg')+';base64,'+fs.readFileSync(path.join(root,p)).toString('base64');
const bundled={};for(const p of ['data/horizons.json','data/system.json','data/system-month.json','data/clps-missions.json','data/terrain-horizons.json'])bundled[p]=JSON.parse(read(p));
for(let i=0;i<4;i++){const p=`data/terrain-rehearsal-${i}.json`;bundled[p]=JSON.parse(read(p));}
const core=moduleURL(read('vendor/three/build/three.core.js'));
const three=moduleURL(read('vendor/three/build/three.module.js').replaceAll("'./three.core.js'","'three/core'"));
const orbit=moduleURL(read('vendor/three/examples/jsm/controls/OrbitControls.js'));
const imports={three,'three/core':core,'selene-orbit-controls':orbit};
let html=read('src/index.html');
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,`<script type="importmap">${JSON.stringify({imports})}</script>`);
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,p)=>'<style>\n'+read('styles/'+p)+'\n</style>');
const bootstrap=`window.SELENE_ASSETS=${JSON.stringify(assets)};const seleneBundled=${JSON.stringify(bundled)};
window.fetch=async(input)=>{const raw=String(typeof input==='string'?input:input?.url||'');let p=raw.split(/[?#]/)[0].replace(/^\\.\\//,'');try{p=new URL(raw,location.href).pathname;}catch{}if(!p.startsWith('/'))p='/'+p;const key=Object.keys(seleneBundled).find(k=>p.endsWith('/'+k));
if(key)return new Response(JSON.stringify(seleneBundled[key]),{headers:{'Content-Type':'application/json'}});
if(p.endsWith('/api/observations'))return new Response('{"bundles":[]}',{headers:{'Content-Type':'application/json'}});
if(p.endsWith('/api/terrain'))return new Response(JSON.stringify({error:'Custom terrain requires the local SELENE server and the retained LOLA raster. This portable edition includes terrain at four reference coordinates.'}),{status:503,headers:{'Content-Type':'application/json'}});
return new Response(JSON.stringify({error:'New NASA queries require the local SELENE server. This shareable HTML includes the bundled observations and supports importing geometry CSV.'}),{status:503,headers:{'Content-Type':'application/json'}});};`;
html=html.replace('</head>','<script>'+safe(bootstrap)+'</script></head>');
html=html.replace(/<script( type="module")? src="([^"]+)"><\/script>/g,(_,type,p)=>{
 let code=read('src/'+p).replaceAll("'./vendor/three/examples/jsm/controls/OrbitControls.js'","'selene-orbit-controls'");
 for(const name of Object.keys(assets))code=code.replaceAll("'"+name+"'",'window.SELENE_ASSETS['+JSON.stringify(name)+']');
 return '<script'+(type||'')+'>\n'+safe(code)+'\n</script>';
});
html=html.replace('</body>',`<script>
const queryNote=document.querySelector('#observer-dialog form>p');if(queryNote)queryNote.textContent='Shareable offline edition. Bundled NASA observations, playback and CSV imports work here. Requesting a new NASA observation requires the local server.';
document.getElementById('observer-submit').textContent='Local server required';document.getElementById('observer-submit').disabled=true;
</script>\n<!-- Three.js MIT license: ${read('vendor/three/LICENSE').replaceAll('--','—')} -->\n<!-- NASA imagery attribution: ${read('assets/SOURCES.txt').replaceAll('--','—')} -->\n</body>`);
if(/<script[^>]+src=|<link[^>]+rel="stylesheet"/.test(html))throw Error('External runtime dependency remains');
const out=path.join(root,'SELENE.html');fs.writeFileSync(out,html);console.log(JSON.stringify({file:out,bytes:Buffer.byteLength(html)}));
