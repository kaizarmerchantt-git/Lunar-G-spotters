const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const observerHandler=require('./observer-service.cjs').createHandler(root);
const terrainHandler=require('./terrain-service.cjs').createHandler(root);
const diskPath=file=>file==='SELENE.html'||file.includes('/')?file:file==='index.html'?'src/index.html':file.endsWith('.css')?'styles/'+file:'src/'+file;
const files={'/':'src/index.html','/index.html':'src/index.html','/style.css':'styles/style.css','/model.js':'src/model.js','/app.js':'src/app.js'};
for(const file of ['notebook-data.js','notebook-ui.js','notebook.css','study-model.js','study-ui.js','study.css','observer-ui.js','observatory.js','observatory.css'])files['/'+file]=diskPath(file);
for(const file of ['terrain-model.js','terrain-data.js','terrain-ui.js','terrain.css','data/terrain-horizons.json'])files['/'+file]=diskPath(file);
for(const file of ['rehearsal-model.js','rehearsal-session.js','terrain-rehearsal.js','terrain-rehearsal.css',...Array.from({length:4},(_,i)=>`data/terrain-rehearsal-${i}.json`)])files['/'+file]=diskPath(file);
files['/resource-model.js']='src/resource-model.js';
files['/observation-transfer.js']='src/observation-transfer.js';
files['/data/horizons.json']='data/horizons.json';
files['/globe.js']='src/globe.js';
files['/workspace.css']='styles/workspace.css';
files['/flight-console.css']='styles/flight-console.css';
files['/console-ui.js']='src/console-ui.js';
files['/system-model.js']='src/system-model.js';
files['/system-scene.js']='src/system-scene.js';
files['/system-renderer.js']='src/system-renderer.js';
files['/system-scene.css']='styles/system-scene.css';
files['/mission-experience.css']='styles/mission-experience.css';
files['/mission-ui.js']='src/mission-ui.js';
for(const file of ['explorer.css','explorer-math.js','explorer-layout.js','lunar-explorer.js','vendor/three/build/three.module.js','vendor/three/build/three.core.js','vendor/three/examples/jsm/controls/OrbitControls.js'])files['/'+file]=diskPath(file);
files['/assets/earth-blue-marble.jpg']='assets/earth-blue-marble.jpg';
files['/assets/earth-blue-marble-map.png']='assets/earth-blue-marble-map.png';
files['/data/system.json']='data/system.json';
files['/data/system-month.json']='data/system-month.json';
files['/assets/lroc_color_2k.jpg']='assets/lroc_color_2k.jpg';
for(const file of ['atlas-model.js','mission-atlas.js','mission-atlas.css','data/clps-missions.json','assets/lola-display-bump.jpg','SELENE.html'])files['/'+file]=diskPath(file);
http.createServer((req,res)=>{
  let pathname;
  try {
    // This static server accepts local paths, not authority or absolute URL targets.
    if(!req.url.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')){
      res.writeHead(400);return res.end('Bad request');
    }
    pathname=new URL(req.url,'http://localhost').pathname;
  } catch {
    res.writeHead(400);return res.end('Bad request');
  }
  if(pathname==='/api/observer'||pathname==='/api/observations'||pathname.startsWith('/api/source/')){observerHandler(req,res,pathname);return;}
  if(pathname==='/api/terrain'){terrainHandler(req,res);return;}
  const file=files[pathname];if(!file){res.writeHead(404);return res.end('Not found');}res.setHeader('Content-Type',file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');fs.createReadStream(path.join(root,file)).pipe(res);
}).listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173'));
