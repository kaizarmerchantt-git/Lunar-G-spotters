import * as THREE from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';

const $=id=>document.getElementById(id),host=$('lunar-explorer'),model=window.SeleneAtlasModel;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||Boolean($('wb-reduce-motion')?.checked);
const atlas=document.createElement('section');atlas.id='mission-atlas';atlas.hidden=true;atlas.setAttribute('aria-label','CLPS mission atlas');
atlas.innerHTML=`<div class="atlas-heading"><div><h1>Explore the CLPS destinations</h1><p>Choose a mission, inspect its published location, then prepare a Sun and Earth visibility study.</p></div><a href="https://www.nasa.gov/commercial-lunar-payload-services/landing-sites/" target="_blank" rel="noopener noreferrer">NASA mission map <span aria-hidden="true">↗</span></a></div>
<div class="atlas-layout"><aside class="atlas-catalogue" aria-label="Mission catalogue"><button id="atlas-directory-toggle" aria-expanded="false" aria-controls="atlas-directory-content">Choose a mission<span id="atlas-mobile-selection">Mission directory</span></button><div id="atlas-directory-content" class="atlas-directory-content"><div class="atlas-list-heading"><h2>Mission directory</h2><span id="atlas-count">Loading sources</span></div><label class="atlas-search-label" for="atlas-search">Find a mission or destination</label><input id="atlas-search" type="search" placeholder="Mission, lander or region" autocomplete="off"><div id="atlas-list" role="group" aria-label="Choose a CLPS mission"></div><p id="atlas-empty" hidden>No matching missions. Clear the search to show the catalogue.</p><p class="atlas-directory-note">Actual landing points and regional destinations are kept distinct. These records are not a live mission feed.</p></div></aside>
<div class="atlas-viewport"><canvas id="atlas-canvas" tabindex="0" aria-label="Interactive Moon with published CLPS landing points. Drag to orbit, use arrow keys to turn, plus or minus to zoom. Select a mission from the directory for full details."></canvas><div id="atlas-labels" aria-hidden="true"></div><div class="atlas-frame-top"><span id="atlas-view-label">Lunar destinations</span><span id="atlas-selected-coordinate"></span></div><div id="atlas-graphics-note" role="status">Preparing lunar imagery…</div><div class="atlas-map-controls" role="group" aria-label="Mission atlas camera"><button id="atlas-overview">Whole Moon</button><button id="atlas-polar">South pole</button><button id="atlas-minus" aria-label="Zoom out of mission map">−</button><button id="atlas-plus" aria-label="Zoom into mission map">+</button><button id="atlas-grid" aria-pressed="false">Grid</button></div><div class="atlas-map-caption"><span><i></i> Published landing point</span><p>NASA LRO imagery · LOLA display shading<br>Illustrative lighting. No terrain horizon or mission trajectory.</p></div></div>
<aside class="atlas-details" aria-label="Selected mission details"><div id="atlas-detail-content"></div></aside></div><p id="atlas-announcement" class="sr-only" role="status" aria-live="polite"></p>`;
host.querySelector('.ex-body').before(atlas);
const atlasTab=document.createElement('button');atlasTab.id='atlas-tab';atlasTab.textContent='Mission atlas';atlasTab.setAttribute('aria-current','false');host.querySelector('.wb-nav').prepend(atlasTab);
let missions=[],selected=null,shown=false,renderer,controls,scene,camera,moon,grid,motion=null,dirty=true,hover=null,frame=0;
const pins=[],labels=new Map(),canvas=$('atlas-canvas'),viewport=atlas.querySelector('.atlas-viewport');
const origin=new THREE.Vector3(),raycaster=new THREE.Raycaster();
function show(){window.SeleneApp?.pause();$('wb-analyze').click();shown=true;host.classList.add('atlas-mode');atlas.hidden=false;atlasTab.setAttribute('aria-current','page');$('wb-analyze').setAttribute('aria-current','false');$('wb-compare').setAttribute('aria-current','false');window.scrollTo(0,0);resize();schedule();}
function hide(){shown=false;host.classList.remove('atlas-mode');atlas.hidden=true;atlasTab.setAttribute('aria-current','false');$('wb-analyze').setAttribute('aria-current',host.classList.contains('wb-compare-mode')?'false':'page');}
document.addEventListener('selene-workspace-change',hide);
atlasTab.onclick=show;
for(const id of ['wb-analyze','wb-compare','ex-legacy'])$(id).addEventListener('click',hide);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const sourceLink=(text,url)=>{const a=node('a',text);a.href=model.safeURL(url);a.target='_blank';a.rel='noopener noreferrer';return a;};
const landerIcon=`<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M14 16h12v12H14zM17 16l3-6 3 6M20 10V5M10 18H5v9h5M30 18h5v9h-5M14 25l-5 9H5M26 25l5 9h4M18 28v5h4v-5"/><circle cx="20" cy="22" r="2"/></svg>`;
function renderList(){
 const focusId=document.activeElement?.dataset?.mission,filter=$('atlas-search').value.trim().toLowerCase(),list=$('atlas-list');list.replaceChildren();let count=0;
 for(const m of missions){if(![m.name,m.provider,m.lander,m.destination].join(' ').toLowerCase().includes(filter))continue;count++;
  const b=node('button',null,'atlas-mission');b.type='button';b.setAttribute('aria-pressed',String(selected?.id===m.id));b.setAttribute('aria-label',m.name);b.dataset.mission=m.id;
  const icon=node('span',null,'atlas-mission-icon');icon.innerHTML=landerIcon;const copy=node('span');copy.append(node('strong',m.shortName||m.name),node('span',m.destination),node('small',m.coordinate?'Published landing point':'Region only · no exact pin'));b.append(icon,copy);b.onclick=()=>select(m.id);list.append(b);
 }
 if(focusId)list.querySelector('[data-mission="'+focusId+'"]')?.focus?.({preventScroll:true});
 $('atlas-empty').hidden=count>0;$('atlas-count').textContent=`${missions.length} missions · ${missions.filter(m=>m.coordinate).length} landing points`;
}
function details(m){
 const area=$('atlas-detail-content');area.replaceChildren();area.append(node('p',m.provider,'atlas-provider'),node('h2',m.name.replace(/IM-(\d+)/g,'IM‑$1')),node('p',m.summary,'atlas-summary'));
 const facts=node('dl');for(const [name,value] of [['Destination',m.destination],['Lander',m.lander],['Landing',m.landingDate||'Not established in this record'],['Task order',m.taskOrder||'See NASA source']]){facts.append(node('dt',name),node('dd',value));}area.append(facts);
 const status=node('div',null,'atlas-status');status.append(node('strong',m.status),node('span',`Source date ${m.statusDate} · checked ${m.checkedUtc}`),sourceLink('Mission status source',m.statusSourceUrl));area.append(status);
 area.append(node('h3','The science on board'),node('p',m.payloads));
 const location=node('div',null,'atlas-location');location.append(node('h3',m.coordinate?'Published landing location':'A region, not a surveyed point'));
 if(m.coordinate){location.append(node('p',model.coordinateLabel(m.coordinate),'atlas-coordinate'),node('p',m.coordinate.note||'Published coordinate at source precision. Not independently surveyed here.'),sourceLink('NASA coordinate record',m.coordinateSourceUrl));}
 else location.append(node('p','No exact coordinate was verified for this catalogue entry. No marker or observer location has been invented.'));
 area.append(location);
 const action=node('button',m.coordinate?'Analyze this coordinate':'Open observer analysis','atlas-analyze');action.type='button';action.id='atlas-analyze-coordinate';action.onclick=()=>{
  $('wb-analyze').click();if(m.coordinate){$('observer-open').click();$('observer-name').value=m.shortName||m.name;$('observer-lat').value=m.coordinate.lat;$('observer-lon').value=m.coordinate.lon;$('observer-error').textContent='';$('observer-status').textContent='Mission coordinate prepared. Choose the UTC window and load its geometry. Existing reference results have not been relabeled.';}
 };const bridge=node('div',null,'atlas-observer-bridge');bridge.append(action,node('p',m.coordinate?'Opens a new observation request. Choose dates; loading geometry needs the local server and internet.':'Opens the existing reference study. It is not geometry for this mission.','atlas-action-note'));facts.after(bridge);area.append(sourceLink('NASA payload and mission information',m.sourceUrl));
}
function select(id,fly=true){selected=missions.find(m=>m.id===id);if(!selected)return;$('atlas-mobile-selection').textContent=selected.shortName||selected.name;if(matchMedia('(max-width:760px)').matches){atlas.querySelector('.atlas-catalogue').classList.remove('atlas-directory-open');$('atlas-directory-toggle').setAttribute('aria-expanded','false');}renderList();details(selected);$('atlas-view-label').textContent=selected.coordinate?(selected.shortName||selected.name):'Whole Moon · region-only record';$('atlas-selected-coordinate').textContent=selected.coordinate?model.coordinateLabel(selected.coordinate):'Region only · no plotted point';
 $('atlas-announcement').textContent=`${selected.name}. ${selected.destination}. ${selected.coordinate?'Published landing coordinate selected.':'No exact landing coordinate provided.'}`;
 for(const p of pins){const active=p.userData.missionId===id;p.material.color.set(active?'#f4d49d':'#afd3e0');p.scale.setScalar(active?1.35:1);}
 if(fly&&selected.coordinate)move(new THREE.Vector3(...model.point(selected.coordinate.lat,selected.coordinate.lon)).multiplyScalar(fitDistance()));else if(fly&&!selected.coordinate)move(new THREE.Vector3(.8,.1,3.4));else schedule();
}
$('atlas-search').addEventListener('input',renderList);
$('atlas-directory-toggle').onclick=()=>{const open=atlas.querySelector('.atlas-catalogue').classList.toggle('atlas-directory-open');$('atlas-directory-toggle').setAttribute('aria-expanded',String(open));resize();};
function fitDistance(){const aspect=Math.min(1,camera?.aspect||1);return Math.max(3.25,1.06/Math.sin(Math.atan(Math.tan(37*Math.PI/360)*aspect)));}
function move(position){if(!camera)return;if(reduced()){camera.position.copy(position);controls.target.copy(origin);motion=null;}else motion={from:camera.position.clone(),to:position.clone(),start:performance.now()};schedule();}
function schedule(){dirty=true;if(!frame)frame=requestAnimationFrame(draw);}
function resize(){if(!renderer||!shown)return;const b=viewport.getBoundingClientRect();if(!b.width||!b.height)return;renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();if(camera.position.length()<fitDistance())camera.position.setLength(fitDistance());if(motion&&motion.to.length()<fitDistance())motion.to.setLength(fitDistance());schedule();}
function draw(now){
 frame=0;if(!shown||!renderer||document.hidden)return;
 let changing=false;if(motion){const t=Math.min(1,(now-motion.start)/850),e=1-Math.pow(1-t,4);camera.position.lerpVectors(motion.from,motion.to,e);controls.target.copy(origin);changing=true;if(t===1)motion=null;}
 changing=controls.update()||changing;
 if(dirty||changing){renderer.render(scene,camera);drawLabels();dirty=false;}
 if(changing||motion)schedule();
}
function drawLabels(){
 const w=viewport.clientWidth,h=viewport.clientHeight,candidates=[],left=14,top=64,safeW=w-28,safeH=h-214;
 for(const p of pins){const id=p.userData.missionId,label=labels.get(id);label.hidden=true;
  if(!model.visible(p.position.toArray(),camera.position.toArray()))continue;
  const q=p.position.clone().project(camera);if(q.z<-1||q.z>1||Math.abs(q.x)>1||Math.abs(q.y)>1)continue;
  const px=(q.x+1)*w/2,py=(1-q.y)*h/2;if(py<top||py>h-150)continue;
  const active=selected?.id===id,highlight=active||hover===id;
  candidates.push({id,x:px+12-left,y:py-10-top,width:highlight?170:125,height:highlight?42:24,selected:active,priority:highlight?5:0});
 }
 for(const c of model.declutter(candidates,safeW,safeH,8)){const label=labels.get(c.id),m=missions.find(m=>m.id===c.id);label.hidden=false;label.style.left=(c.rect.x+left)+'px';label.style.top=(c.rect.y+top)+'px';label.classList.toggle('atlas-label-selected',selected?.id===c.id);label.replaceChildren(node('strong',m.shortName||m.name));if(selected?.id===c.id||hover===c.id)label.append(node('span',m.destination));}
}
function pick(event){if(!renderer)return null;const b=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-b.left)/b.width*2-1,-(event.clientY-b.top)/b.height*2+1),camera);const hit=raycaster.intersectObjects(pins)[0],surface=raycaster.intersectObject(moon)[0];return hit&&(!surface||hit.distance<surface.distance+.04)?hit.object.userData.missionId:null;}
let pointerStart=null;
canvas.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];motion=null;});
canvas.addEventListener('pointermove',e=>{const id=pick(e);if(hover!==id){hover=id;schedule();}canvas.style.cursor=id?'pointer':'grab';});
canvas.addEventListener('pointerup',e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])<5){const id=pick(e);if(id)select(id);}pointerStart=null;});
canvas.addEventListener('keydown',e=>{if(!camera)return;const k=e.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(k))return;e.preventDefault();motion=null;const s=new THREE.Spherical().setFromVector3(camera.position);if(k==='ArrowLeft')s.theta-=.12;if(k==='ArrowRight')s.theta+=.12;if(k==='ArrowUp')s.phi-=.1;if(k==='ArrowDown')s.phi+=.1;if(k==='+'||k==='=')s.radius=Math.max(1.55,s.radius-.2);if(k==='-')s.radius=Math.min(5,s.radius+.2);s.makeSafe();camera.position.setFromSpherical(s);schedule();});
$('atlas-overview').onclick=()=>move(new THREE.Vector3(.8,.1,3.4));$('atlas-polar').onclick=()=>move(new THREE.Vector3(.2,-3.2,.5));
$('atlas-plus').onclick=()=>move(camera.position.clone().multiplyScalar(Math.max(1.55,camera.position.length()-.3)/camera.position.length()));
$('atlas-minus').onclick=()=>move(camera.position.clone().multiplyScalar(Math.min(5,camera.position.length()+.3)/camera.position.length()));
$('atlas-grid').onclick=()=>{if(!grid)return;grid.visible=!grid.visible;$('atlas-grid').setAttribute('aria-pressed',String(grid.visible));schedule();};
try{
 if(new URLSearchParams(location.search).get('graphics')==='off')throw Error('Graphics disabled');
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 scene=new THREE.Scene();scene.background=new THREE.Color('#080d12');camera=new THREE.PerspectiveCamera(37,1,.01,40);camera.position.set(.8,.1,3.4);
 controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.1;controls.minDistance=1.55;controls.maxDistance=5;controls.addEventListener('change',schedule);controls.addEventListener('start',()=>{motion=null;});
 const material=new THREE.MeshStandardMaterial({color:'#c7cdd2',roughness:1,bumpScale:.012});moon=new THREE.Mesh(new THREE.SphereGeometry(1,128,80),material);scene.add(moon);
 const light=new THREE.DirectionalLight('#fff9ee',2.4);light.position.set(-4,3,4);camera.add(light,new THREE.AmbientLight('#c4d7e5',.4));scene.add(camera);
 const loader=new THREE.TextureLoader();loader.load('assets/lroc_color_2k.jpg',t=>{if(!renderer)return;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.offset.x=.25;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());material.map=t;material.needsUpdate=true;$('atlas-graphics-note').hidden=true;schedule();},undefined,()=>{$('atlas-graphics-note').textContent='Lunar image unavailable. Mission catalogue and sources remain usable.';});
 loader.load('assets/lola-display-bump.jpg',t=>{if(!renderer)return;t.wrapS=THREE.RepeatWrapping;t.offset.x=.25;material.bumpMap=t;material.needsUpdate=true;schedule();});
 grid=new THREE.Group();grid.visible=false;const lines=new THREE.LineBasicMaterial({color:'#8ca7af',transparent:true,opacity:.2});
 for(const lat of [-80,-60,-30,0,30,60,80]){const pts=Array.from({length:144},(_,i)=>new THREE.Vector3(...model.point(lat,i*2.5-180,1.003)));grid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),lines));}scene.add(grid);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('atlas-graphics-note').hidden=false;$('atlas-graphics-note').textContent='Graphics paused. Mission details and observation analysis remain available.';});
 canvas.addEventListener('webglcontextrestored',()=>{$('atlas-graphics-note').hidden=true;schedule();});
}catch(error){renderer=null;canvas.hidden=true;$('atlas-graphics-note').textContent='3D graphics unavailable. Select a mission to explore its published location, sources and observation options.';viewport.classList.add('atlas-no-graphics');for(const b of viewport.querySelectorAll('button'))b.disabled=true;}
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});new ResizeObserver(resize).observe(viewport);
show();
fetch('data/clps-missions.json').then(r=>{if(!r.ok)throw Error('Catalogue unavailable');return r.json();}).then(value=>{
 missions=model.normalize(value);
 for(const m of missions.filter(m=>m.coordinate)){
  const label=node('div',null,'atlas-map-label');label.hidden=true;$('atlas-labels').append(label);labels.set(m.id,label);
  if(renderer){const pin=new THREE.Mesh(new THREE.SphereGeometry(.012,16,12),new THREE.MeshBasicMaterial({color:'#afd3e0'}));pin.position.set(...model.point(m.coordinate.lat,m.coordinate.lon,1.012));pin.userData.missionId=m.id;scene.add(pin);pins.push(pin);}
 }
 select(missions.find(m=>m.id==='im-2')?.id||missions[0].id);
}).catch(()=>{$('atlas-count').textContent='Catalogue unavailable';$('atlas-empty').hidden=false;$('atlas-empty').textContent='Mission sources could not load or validate. The existing observation workspace remains available.';});
