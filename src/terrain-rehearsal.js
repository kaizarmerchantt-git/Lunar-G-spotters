import * as THREE from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';

const $=id=>document.getElementById(id),M=window.SeleneRehearsal,T=window.SeleneTerrain;
const panel=document.createElement('section');panel.className='rehearsal';panel.id='terrain-rehearsal';panel.hidden=true;panel.setAttribute('aria-labelledby','rehearsal-title');
panel.innerHTML=`<header class="rehearsal-head"><div><span class="rehearsal-kicker">LOLA / terrain rehearsal</span><h2 id="rehearsal-title">Find the ridge. Explain the window.</h2><p>Explore measured lunar relief, then inspect the sampled terrain that limits a direction in the sky.</p></div><button id="rehearsal-close" aria-label="Close terrain rehearsal">×</button></header>
 <p id="rehearsal-status" class="rehearsal-status" role="status">Preparing terrain…</p>
 <div id="rehearsal-content" hidden>
 <div class="rehearsal-toolbar"><label>Inspect direction<select id="rehearsal-follow"><option value="sun">Follow Sun</option><option value="earth">Follow Earth</option><option value="manual">Selected bearing</option></select></label><label class="rehearsal-bearing">Sampled bearing <output id="rehearsal-bearing-value">0°</output><input id="rehearsal-bearing" aria-label="Rehearsal sampled bearing" type="range" min="0" max="359" step="1" value="0"></label><label>Display relief<select id="rehearsal-relief"><option value="1">1× · true scale</option><option value="5">5× · exaggerated</option></select></label><button id="rehearsal-reset">Reset terrain camera</button><button id="rehearsal-top">Map view</button></div>
 <div class="rehearsal-layout"><div class="rehearsal-map"><canvas id="rehearsal-scene" tabindex="0" aria-label="LOLA terrain. Drag to orbit, wheel to zoom, click a ridge to select its bearing. Arrow keys rotate the view; plus and minus zoom."></canvas><div class="rehearsal-map-note">NASA LOLA · 38.4 km local patch<br>Drag to orbit · click terrain to inspect a bearing<br>Mint: terrain ray · arrows: Sun (gold), Earth (blue)</div><div id="rehearsal-scale-note" class="rehearsal-scale-note">True-scale relief · symbolic markers · inspection lighting</div><p id="rehearsal-fallback" class="rehearsal-fallback" hidden>3D graphics unavailable. Bearing selection, the full-range section and observation analysis remain available below.</p></div>
 <aside class="rehearsal-readout"><span class="rehearsal-kicker">Selected ray / maximum</span><h3 id="rehearsal-ridge-title">Sampled blocking ridge</h3><dl><div><dt>Range from observer</dt><dd id="rehearsal-range"></dd></div><div><dt>Apparent elevation</dt><dd id="rehearsal-angle"></dd></div><div><dt>Above reference sphere</dt><dd id="rehearsal-height"></dd></div></dl><p id="rehearsal-coordinate"></p><button id="rehearsal-inspect">Inspect ridge</button><p id="rehearsal-extent" class="rehearsal-warning"></p><p>Clicking the mesh selects a bearing. The marker identifies the highest angular obstruction along that ray, which may be a different ridge.</p></aside></div>
 <div class="rehearsal-section"><h3>One bearing, the full 100 km.</h3><p id="rehearsal-section-note"></p><svg id="rehearsal-section" viewBox="0 0 800 230" role="img" aria-label="Terrain apparent elevation versus logarithmic distance; selected maximum marked"></svg><p>Distance uses a logarithmic axis to keep nearby ridges readable. The horizontal dashed line is the 0° reference; all elevations include lunar curvature.</p></div>
 <div class="rehearsal-clock"><div class="rehearsal-clock-head"><time id="rehearsal-time"></time><button id="rehearsal-play" aria-pressed="false">Play observation</button></div><label>Observation sample<input id="rehearsal-time-slider" aria-label="Rehearsal observation sample" type="range" min="0" max="1" value="0"></label><p id="rehearsal-direction-source" class="rehearsal-kicker"></p><div class="rehearsal-live"><p id="rehearsal-sun"></p><p id="rehearsal-earth"></p></div></div>
 <details class="rehearsal-evidence"><summary>What this view proves—and what it does not</summary><p id="rehearsal-source"></p><p>The mesh samples the 80 m LOLA raster every 160 m; radial sections use 80 m steps at whole-degree bearings. Bilinear heights are retained to 1 mm, which is storage precision, not DEM accuracy. The 3D patch is 38.4 km square; the section reaches 100 km. No terrain beyond that range is searched.</p><p>Relief exaggeration and inspection lighting are display choices. Visibility comes from the existing unexaggerated skyline, linearly interpolated at the body's actual azimuth, with max(terrain, obstruction) + margin. The selected section is the nearest 1° ray, not an exact-azimuth trace. Below-zero terrain maxima do not become physical blockers just because the analysis applies a 0° floor.</p><p>Observer: 2 m above the DEM; ephemeris directions retain the original reference-sphere observer. No solar-disk fractions, cast-shadow simulation, power or radio-link prediction. The existing Sun–Earth–Moon workspace remains unchanged.</p></details></div>`;
document.querySelector('.terrain-panel').after(panel);
const open=document.createElement('button');open.id='rehearsal-open';open.textContent='Open terrain rehearsal ↗';document.querySelector('.terrain-panel .study-heading').after(open);
let state=window.SeleneObservation,bundle=null,profile=null,data=null,active=-1,opened=false,selection=null,lastRay=-1,lastData=null;
let renderer=null,scene,camera,controls,terrainMesh,patchGroup,selectionGroup,bodyGroup,observerGroup,visible=false,scheduled=false,scale=1;
const canvas=$('rehearsal-scene'),map=canvas.parentElement,fmt=(v,n=2)=>Number(v).toLocaleString('en-GB',{maximumFractionDigits:n}),vec=p=>new THREE.Vector3(p[0]/1000,p[1]/1000,p[2]/1000);
const terrainData=window.SeleneTerrainData,cachedBundle=terrainData.ready;
// A rejected source stays visible as an unavailable state, not an unhandled rejection.
cachedBundle.catch(()=>{});
const session=new window.RehearsalSession(key=>terrainData.load(JSON.parse(key),true),value=>{
 data=value.rehearsal;profile=value.profile;bundle=value.bundle;$('rehearsal-content').hidden=false;$('rehearsal-status').textContent=`${fmt(profile.lat,4)}° latitude / ${fmt(profile.lon,4)}° east · 2 m observer above LOLA terrain`;
 buildScene();lastData=null;update();});

function dispose(group){if(!group)return;while(group.children.length){const child=group.children[0];group.remove(child);child.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m){m.map?.dispose();m.dispose();}});}}
function render(){scheduled=false;if(!renderer||!visible||!opened||panel.hidden||document.hidden)return;
 camera.updateMatrixWorld();
 const sprites=[],boxes=[];scene.traverse(o=>{if(o.isSprite)sprites.push(o);});
 sprites.sort((a,b)=>b.userData.priority-a.userData.priority).forEach(o=>{
  const height=2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(o.position)/map.clientHeight*27,aspect=o.material.map.image.width/64;o.scale.set(height*aspect,height,1);
  const p=o.position.clone().project(camera),x=(p.x+1)*map.clientWidth/2,y=(1-p.y)*map.clientHeight/2,box={l:x-aspect*14,r:x+aspect*14,t:y-16,b:y+16};
  o.visible=p.z>=-1&&p.z<=1&&box.l>0&&box.r<map.clientWidth&&y>90&&y<map.clientHeight-48&&!boxes.some(b=>box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t);if(o.visible)boxes.push(box);
 });renderer.render(scene,camera);}
function invalidate(){if(!scheduled&&renderer&&visible&&opened){scheduled=true;requestAnimationFrame(render);}}
function label(text,color='#d8e6eb'){
 const c=document.createElement('canvas');c.width=text.length===1?64:256;c.height=64;const x=c.getContext('2d');x.fillStyle='#14222bd9';x.fillRect(0,0,c.width,64);x.fillStyle=color;x.font='24px system-ui';x.textAlign='center';x.fillText(text,c.width/2,41);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));sprite.scale.set(3.2,.8,1);sprite.userData.priority=text==='OBSERVER'?2:text.length===1?0:3;sprite.renderOrder=3;return sprite;
}
function initScene(){
 if(renderer)return true;if(new URLSearchParams(location.search).get('graphics')==='off')return false;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor('#121c23');
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(43,1,.03,400);controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.49;controls.addEventListener('change',invalidate);
  scene.add(new THREE.HemisphereLight(0xc6e1ec,0x26313a,.8));const light=new THREE.DirectionalLight(0xffe4bf,1.7);light.position.set(-18,16,8);scene.add(light);
  patchGroup=new THREE.Group();selectionGroup=new THREE.Group();bodyGroup=new THREE.Group();observerGroup=new THREE.Group();scene.add(patchGroup,selectionGroup,bodyGroup,observerGroup);
  new ResizeObserver(()=>{if(!map.clientWidth||!map.clientHeight)return;renderer.setSize(map.clientWidth,map.clientHeight,false);camera.aspect=map.clientWidth/map.clientHeight;camera.updateProjectionMatrix();invalidate();}).observe(map);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;invalidate();},{threshold:.01}).observe(canvas);
  document.addEventListener('visibilitychange',invalidate);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('rehearsal-fallback').hidden=false;canvas.hidden=true;for(const id of ['rehearsal-reset','rehearsal-top','rehearsal-relief','rehearsal-inspect'])$(id).disabled=true;});
  canvas.addEventListener('webglcontextrestored',()=>{$('rehearsal-fallback').hidden=true;canvas.hidden=false;for(const id of ['rehearsal-reset','rehearsal-top','rehearsal-relief'])$(id).disabled=false;if(data){buildScene();if(selection){$('rehearsal-inspect').disabled=selection.outsidePatch;drawSelection();}}invalidate();});
  let down=null;canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6||!terrainMesh)return;down=null;
   const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);const hit=ray.intersectObject(terrainMesh)[0];if(hit){choose(M.rayIndex(Math.atan2(hit.point.x,-hit.point.z)*180/Math.PI));}});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();
   const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi=Math.max(.08,s.phi-.1);if(e.key==='ArrowDown')s.phi=Math.min(1.53,s.phi+.1);if(e.key==='+'||e.key==='=')s.radius=Math.max(2,s.radius*.85);if(e.key==='-')s.radius=Math.min(110,s.radius/ .85);camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(controls.target));controls.update();invalidate();});
  return true;
 }catch(error){renderer?.dispose();renderer=null;return false;}
}
function resetCamera(top=false){if(!renderer)return;controls.target.set(0,0,0);camera.position.set(top?0:26,top?54:27,top?.1:32);controls.update();invalidate();}
function buildScene(){
 if(!initScene()){$('rehearsal-fallback').hidden=false;canvas.hidden=true;for(const id of ['rehearsal-reset','rehearsal-top','rehearsal-relief','rehearsal-inspect'])$(id).disabled=true;return;}
 dispose(patchGroup);dispose(selectionGroup);dispose(observerGroup);dispose(bodyGroup);
 const m=data.mesh,positions=new Float32Array(m.size*m.size*3),colors=new Float32Array(positions.length),indices=[];
 let min=Infinity,max=-Infinity;for(const h of m.heights_mm){min=Math.min(min,h);max=Math.max(max,h);}
 for(let row=0;row<m.size;row++)for(let col=0;col<m.size;col++){
  const i=row*m.size+col,east=col*m.step_m-m.half_extent_m,north=row*m.step_m-m.half_extent_m,p=M.point(Math.atan2(east,north)*180/Math.PI,Math.hypot(east,north),m.heights_mm[i]/1000,data.ground_height_m);
  positions.set(p.map(v=>v/1000),i*3);const t=(m.heights_mm[i]-min)/(max-min||1),c=new THREE.Color().setRGB(.25+t*.34,.30+t*.34,.32+t*.32);colors.set([c.r,c.g,c.b],i*3);
  if(row<m.size-1&&col<m.size-1){const a=i,b=i+1,c=i+m.size,d=c+1;indices.push(a,b,c,b,d,c);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 terrainMesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide}));patchGroup.add(terrainMesh);patchGroup.scale.y=scale;
 const observer=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),new THREE.MeshBasicMaterial({color:0xe5f2ed,depthTest:false}));observerGroup.add(observer);observer.renderOrder=4;
 for(const [text,x,z]of [['N',0,-18],['E',18,0],['OBSERVER',0,0]]){const s=label(text);s.position.set(x,text==='OBSERVER'?1.1:2,z);observerGroup.add(s);}
 resetCamera();
}
function choose(az){$('rehearsal-follow').value='manual';$('rehearsal-bearing').value=az;update();}
function drawSection(s){
 const body=$('rehearsal-follow').value,row=state.samples[state.index],values=s.points.map(p=>p.elevation),target=body==='manual'?null:row[body+'_el'];
 const bottom=Math.floor(Math.min(-1,...values,target??0)),top=Math.ceil(Math.max(2,...values,target??0))+1;
 const svg=$('rehearsal-section'),width=Math.max(320,svg.clientWidth||svg.parentElement?.clientWidth||0),right=width-22;
 svg.setAttribute('viewBox',`0 0 ${width} 230`);
 const x=d=>42+Math.log(d/80)/Math.log(100000/80)*(right-42),y=e=>180-(e-bottom)/(top-bottom)*155;
 const line=s.points.map((p,i)=>(i?'L':'M')+x(p.distance).toFixed(2)+','+y(p.elevation).toFixed(2)).join(' '),mx=x(s.distance_m),my=y(s.elevation_deg);
 $('rehearsal-section').innerHTML=`<path d="${line} L${right} 180 H42 Z" fill="#74979640"/><path d="${line}" stroke="#426f74" stroke-width="1.6" fill="none"/><path d="M42 ${y(0)}H${right}" stroke="#55717d" stroke-dasharray="5 5"/>`+
  [80,1000,10000,100000].map(d=>`<text x="${x(d)}" y="208" text-anchor="middle">${d<1000?d+' m':d/1000+' km'}</text>`).join('')+
  [bottom,0,top].filter((v,i,a)=>a.indexOf(v)===i).map(e=>`<text x="5" y="${y(e)+4}">${e}°</text>`).join('')+
  (target===null?'':`<path d="M42 ${y(target)}H${right}" stroke="${body==='sun'?'#a5752e':'#327c9a'}" stroke-dasharray="3 4"/><text x="${right-5}" y="${Math.max(14,y(target)-6)}" text-anchor="end">${body==='sun'?'Sun':'Earth'} center at actual azimuth</text>`)+
  `<circle cx="${mx}" cy="${my}" r="5" fill="#a64c48"/><path d="M${mx} ${my+7}V180" stroke="#a64c48" stroke-dasharray="2 4"/>`;
 $('rehearsal-section-note').textContent=`Bearing ${s.az}° · 1,250 terrain samples · red marker: maximum apparent terrain elevation${s.floorLimited?' (below the analysis floor)':''}.`;
}
function drawSelection(){
 if(!renderer||!selection)return;dispose(selectionGroup);dispose(bodyGroup);const s=selection;
 const points=[new THREE.Vector3(0,-.002*scale,0),...s.points.filter(p=>Math.abs(p.distance*Math.sin(s.az*Math.PI/180))<=19200&&Math.abs(p.distance*Math.cos(s.az*Math.PI/180))<=19200).map(p=>{const v=vec(p.point);v.y=v.y*scale+.035;return v;})];
 selectionGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x79b9ad,depthTest:false})));selectionGroup.renderOrder=2;
 if(!s.outsidePatch){const v=vec(s.points[s.index].point);v.y*=scale;const marker=new THREE.Mesh(new THREE.SphereGeometry(.08,14,10),new THREE.MeshBasicMaterial({color:0xf39080,depthTest:false}));marker.position.copy(v);selectionGroup.add(marker);if(s.distance_m>3000){const caption=label(s.floorLimited?'TERRAIN MAX':'LIMITING RIDGE','#ffc5b7');caption.position.copy(v).add(new THREE.Vector3(0,1,0));selectionGroup.add(caption);}}
 const row=state.samples[state.index];for(const [body,color]of [['sun',0xf4c976],['earth',0x83c9e7]]){const az=row[body+'_az']*Math.PI/180,el=row[body+'_el']*Math.PI/180;const dir=new THREE.Vector3(Math.cos(el)*Math.sin(az),Math.sin(el)*scale,-Math.cos(el)*Math.cos(az));bodyGroup.add(new THREE.ArrowHelper(dir.clone().normalize(),new THREE.Vector3(),12*dir.length(),color,.7,.3));}
 invalidate();
}
function syncPlay(){const playing=$('play').getAttribute('aria-pressed')==='true';$('rehearsal-play').textContent=playing?'Pause observation':'Play observation';$('rehearsal-play').setAttribute('aria-pressed',String(playing));}
function update(){
 if(!opened||!data||!state||!profile)return;const row=state.samples[state.index],follow=$('rehearsal-follow').value,az=follow==='manual'?Number($('rehearsal-bearing').value):M.rayIndex(row[follow+'_az']);
 $('rehearsal-bearing').value=az;$('rehearsal-bearing-value').textContent=az+'°';
 if(data!==lastData||az!==lastRay){selection=M.section(data,profile,az);lastData=data;lastRay=az;}
 const s=selection;$('rehearsal-ridge-title').textContent=s.floorLimited?'Terrain below the 0° floor':'Sampled blocking ridge';
 $('rehearsal-range').textContent=fmt(s.distance_m/1000,2)+' km';$('rehearsal-angle').textContent=fmt(s.elevation_deg,3)+'°';$('rehearsal-height').textContent=fmt(s.height_m,1)+' m';
 $('rehearsal-inspect').disabled=!renderer||s.outsidePatch;
 $('rehearsal-coordinate').textContent=`Maximum at ${fmt(s.coordinates.lat,5)}° latitude, ${fmt(s.coordinates.lon,5)}° east.`;
 $('rehearsal-extent').textContent=s.outsidePatch?'This maximum lies outside the detailed mesh. Inspect it in the full-range section below.':'This maximum is inside the detailed mesh; the coral marker locates it.';
 $('rehearsal-direction-source').textContent=state.mode==='nasa'?'Directions: NASA/JPL observer samples':'Directions: user supplied · not independently verified';
 $('rehearsal-time').textContent=new Date(row.time).toISOString().replace('T',' / ').replace('.000Z',' UTC');$('rehearsal-time-slider').max=state.samples.length-1;$('rehearsal-time-slider').value=state.index;
 for(const body of ['sun','earth']){const horizon=T.elevation(profile,row[body+'_az']),cutoff=Math.max(horizon,state.horizon)+state.margin,clear=row[body+'_el']-cutoff;
  $('rehearsal-'+body).textContent=`${body==='sun'?'Sun':'Earth'} · az ${fmt(row[body+'_az'])}° / el ${fmt(row[body+'_el'])}° · ${clear>0?'clear':'blocked'} (${fmt(clear,3)}° clearance). Actual-azimuth cutoff ${fmt(cutoff,3)}°.`;}
 $('rehearsal-source').textContent=`LOLA LDEM_80S_80M V2.0 · mean-Earth frame · radius 1,737,400 m · DEM SHA-256 ${data.source_sha256}. Ground at observer: ${fmt(data.ground_height_m,2)} m above reference sphere. ${follow==='manual'?'Manual bearing selection.':`Following ${follow}; section rounded to ${az}°.`}`;
 drawSection(s);drawSelection();syncPlay();
}
async function selectSite(){
 if(!opened)return;try{await cachedBundle;if(!opened)return;const key=state?.mode==='synthetic'?null:window.SeleneTerrainKey(state?.site);
  if(key===active&&data){update();return;}if(key===active&&key)return;
  session.cancel();active=key;data=null;profile=null;$('rehearsal-content').hidden=true;
  if(!key){$('rehearsal-status').textContent='Add lunar observer coordinates to inspect their terrain. Nearby terrain is never substituted.';return;}
  $('rehearsal-status').textContent='Loading and validating the exact-coordinate LOLA patch and 100 km radial sections…';await session.select(key);
 }catch(error){if(opened){data=null;profile=null;$('rehearsal-content').hidden=true;$('rehearsal-status').textContent=error.message.replace(/\.$/,'')+'. Close and reopen to retry.';}}
}
open.onclick=()=>{opened=true;panel.hidden=false;open.setAttribute('aria-expanded','true');panel.scrollIntoView({block:'start',behavior:'instant'});selectSite();};open.setAttribute('aria-expanded','false');open.setAttribute('aria-controls',panel.id);
$('rehearsal-close').onclick=()=>{opened=false;panel.hidden=true;session.cancel();active=-1;data=null;profile=null;open.setAttribute('aria-expanded','false');open.focus();};
$('rehearsal-bearing').oninput=e=>choose(Number(e.target.value));$('rehearsal-follow').onchange=update;
$('rehearsal-relief').onchange=e=>{scale=Number(e.target.value);if(patchGroup)patchGroup.scale.y=scale;$('rehearsal-scale-note').textContent=(scale===1?'True-scale relief':'5× vertical exaggeration · analysis unchanged')+' · symbolic markers · inspection lighting';drawSelection();};
$('rehearsal-inspect').onclick=()=>{if(!renderer||!selection||selection.outsidePatch)return;const target=vec(selection.points[selection.index].point);target.y*=scale;controls.target.copy(target);const distance=Math.max(2.5,Math.min(30,selection.distance_m/1000*.8));camera.position.copy(target).add(new THREE.Vector3(distance*.65,distance*.65,distance*.8));controls.update();canvas.focus();invalidate();};
$('rehearsal-reset').onclick=()=>resetCamera();$('rehearsal-top').onclick=()=>resetCamera(true);
$('rehearsal-time-slider').oninput=e=>{$('scrub').value=e.target.value;$('scrub').dispatchEvent(new Event('input',{bubbles:true}));};
$('rehearsal-play').onclick=()=>{$('play').click();syncPlay();};new MutationObserver(syncPlay).observe($('play'),{attributes:true,attributeFilter:['aria-pressed']});
document.addEventListener('observation-change',e=>{
 state=e.detail;const key=state.mode==='synthetic'?null:window.SeleneTerrainKey(state.site);
 // Invalidate before the first await, so an old response cannot use new-site angles.
 if(key!==active){session.cancel();active=-1;data=null;profile=null;$('rehearsal-content').hidden=true;}
 selectSite();
});

const sectionObserver=new ResizeObserver(()=>{if(opened&&data&&selection)drawSection(selection);});
sectionObserver.observe($('rehearsal-section'));
if($('rehearsal-section').parentElement)sectionObserver.observe($('rehearsal-section').parentElement);
