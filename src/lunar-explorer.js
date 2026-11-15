import * as THREE from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';

const $=id=>document.getElementById(id),host=$('lunar-explorer'),canvas=$('ex-scene');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),math=window.ExplorerMath;
const resources=window.SeleneResources;
const reduceMotion=()=>reduced.matches||Boolean(document.getElementById('wb-reduce-motion')?.checked);
let state=null,mode='orbit',heading=0,lookPitch=0,drag=null,motion=null,pendingHorizon=false,lastSite=-1,toastTimer,needsRender=true;
const vector=a=>new THREE.Vector3(...a),origin=new THREE.Vector3();
const scene=new THREE.Scene();scene.background=new THREE.Color('#0b1015');
const camera=new THREE.PerspectiveCamera(43,1,.002,180);camera.position.set(1,-2.5,2.4);
let renderer,hasWebGL=false;
const dataOnly=new URLSearchParams(location.search).get('graphics')==='off';
try{if(dataOnly)throw new Error('Data-only view selected');renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});hasWebGL=true;}
catch(error){
  // Null renderer preserves the complete data/notebook UI when graphics cannot run.
  renderer={setPixelRatio(){},setSize(){},render(){},capabilities:{getMaxAnisotropy:()=>1}};
  host.classList.add('ex-data-only');canvas.tabIndex=-1;canvas.setAttribute('aria-hidden','true');
  $('ex-loading').setAttribute('role','status');
}

if(renderer){
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.enablePan=false;controls.minDistance=1.18;controls.maxDistance=6;
controls.addEventListener('change',()=>needsRender=true);
const orbital=new THREE.Group(),local=new THREE.Group();local.visible=false;scene.add(orbital,local);
const textureLoader=new THREE.TextureLoader();
const lunarMaterial=new THREE.MeshStandardMaterial({color:'#d8d7cf',roughness:1,metalness:0});
const moon=new THREE.Mesh(new THREE.SphereGeometry(1,128,80),lunarMaterial);orbital.add(moon);
const coordinateGrid=new THREE.Group();orbital.add(coordinateGrid);
const gridMaterial=new THREE.LineBasicMaterial({color:'#799ba9',transparent:true,opacity:.17,depthWrite:false});
for(const lat of [-80,-60,-30,0,30,60,80]){
  const points=Array.from({length:144},(_,i)=>vector(math.frame(lat,i*360/144).up).multiplyScalar(1.003));
  coordinateGrid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),gridMaterial));
}
for(let lon=0;lon<180;lon+=30){
  const points=Array.from({length:180},(_,i)=>{const angle=i*2*Math.PI/180,l=lon*Math.PI/180;return new THREE.Vector3(Math.cos(angle)*Math.sin(l),Math.sin(angle),Math.cos(angle)*Math.cos(l)).multiplyScalar(1.003);});
  coordinateGrid.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),gridMaterial));
}
$('ex-grid').onclick=()=>{coordinateGrid.visible=!coordinateGrid.visible;$('ex-grid').setAttribute('aria-pressed',String(coordinateGrid.visible));needsRender=true;};
textureLoader.load('assets/lroc_color_2k.jpg',texture=>{
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.offset.x=.25;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());lunarMaterial.map=texture;lunarMaterial.needsUpdate=true;needsRender=true;
},undefined,()=>notify('LRO image could not load. Geometry and observations remain available.'));
const solarLight=new THREE.DirectionalLight('#fff7e8',3.2);solarLight.position.set(3,0,2);scene.add(solarLight);scene.add(new THREE.AmbientLight('#7e919c',.13));

// Decorative fixed background stars; no star-catalog or celestial-attitude claim.
const starPositions=[];
for(let i=0;i<260;i++){const az=i*2.399963,el=Math.acos(1-2*(i+.5)/260),r=55;starPositions.push(r*Math.sin(el)*Math.cos(az),r*Math.cos(el),r*Math.sin(el)*Math.sin(az));}
const starsGeometry=new THREE.BufferGeometry();starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
scene.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({size:.045,color:'#637077',transparent:true,opacity:.55,depthWrite:false})));
const markers=new THREE.Group();orbital.add(markers);let markerMeshes=[];
const ring=new THREE.Mesh(new THREE.TorusGeometry(.022,.0014,8,60),new THREE.MeshBasicMaterial({color:'#d4e8c8',depthTest:true}));orbital.add(ring);
const sunArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),origin,.48,0xc5a66a,.035,.015);
const earthArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),origin,.42,0x86b3c0,.035,.015);orbital.add(sunArrow,earthArrow);
// The local scene is a flat visual reference, not a fabricated lunar terrain mesh.
const floor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshBasicMaterial({color:'#202626'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.05;local.add(floor);
const grid=new THREE.GridHelper(400,40,0x6d7771,0x333e3b);grid.position.y=-.04;grid.material.transparent=true;grid.material.opacity=.25;local.add(grid);
const earthBody=new THREE.Sprite(new THREE.SpriteMaterial({color:'#ffffff',transparent:true,depthWrite:false}));earthBody.scale.set(2.2,2.2,1);local.add(earthBody);
textureLoader.load('assets/earth-blue-marble.jpg',texture=>{
  const c=document.createElement('canvas');c.width=c.height=384;const x=c.getContext('2d');x.beginPath();x.arc(192,192,192,0,Math.PI*2);x.clip();x.drawImage(texture.image,44,40,710,710,0,0,384,384);
  earthBody.material.map=new THREE.CanvasTexture(c);earthBody.material.map.colorSpace=THREE.SRGBColorSpace;earthBody.material.needsUpdate=true;texture.dispose();needsRender=true;
});
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
const gx=glowCanvas.getContext('2d'),glow=gx.createRadialGradient(64,64,4,64,64,64);glow.addColorStop(0,'#fff4c9');glow.addColorStop(.22,'#ffe4a4');glow.addColorStop(.25,'#f2be6a');glow.addColorStop(.5,'#f6c46a29');glow.addColorStop(1,'#f6c46a00');gx.fillStyle=glow;gx.fillRect(0,0,128,128);
const sunBody=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthTest:true,depthWrite:false}));sunBody.scale.set(5,5,1);local.add(sunBody);
const compass=new THREE.Group();local.add(compass);
for(const [az,label]of [[0,'N'],[90,'E'],[180,'S'],[270,'W']]){
  const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.font='28px Segoe UI';x.textAlign='center';x.fillStyle='#a9b9b9';x.fillText(label,32,40);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));sprite.position.copy(vector(math.skyDirection(az,4)).multiplyScalar(45)).add(new THREE.Vector3(0,1.4,0));sprite.scale.set(2.5,2.5,1);compass.add(sprite);
}
const skyActions=document.createElement('div');skyActions.className='ex-sky-actions';skyActions.hidden=true;
skyActions.innerHTML='<button id="ex-face-sun">Face Sun</button><button id="ex-face-earth">Face Earth</button><span id="ex-bearing"></span>';
document.querySelector('.ex-scene-wrap').append(skyActions);
const trajectoryKey=document.createElement('span');trajectoryKey.className='ex-trajectory-key';trajectoryKey.hidden=true;
trajectoryKey.textContent='Gold / Sun path · blue / Earth path · sampled directions';
document.querySelector('.ex-scene-wrap').append(trajectoryKey);
const skyTracks=new THREE.Group();local.add(skyTracks);let trackRows=null;
function updateSkyTracks(rows){
  if(rows===trackRows)return;trackRows=rows;
  while(skyTracks.children.length){const line=skyTracks.children[0];skyTracks.remove(line);line.geometry.dispose();line.material.dispose();}
  for(const key of ['sun','earth']){
    // Only connect adjacent samples whose centers are above the flat horizon.
    // The finite visual ground must not make negative-elevation bodies visible.
    const points=math.visibleSkySegments(rows,key).map(p=>vector(p).multiplyScalar(80).add(new THREE.Vector3(0,1.4,0)));
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:key==='sun'?'#d5b16d':'#8bbccf',transparent:true,opacity:.55,depthWrite:false}));skyTracks.add(line);
  }
}
const horizonOverlay=document.createElementNS('http://www.w3.org/2000/svg','svg');horizonOverlay.classList.add('ex-horizon-overlay');horizonOverlay.setAttribute('aria-hidden','true');
const clearancePath=document.createElementNS('http://www.w3.org/2000/svg','path');horizonOverlay.append(clearancePath);document.querySelector('.ex-scene-wrap').append(horizonOverlay);
const clearanceTag=document.createElement('span');clearanceTag.className='ex-clearance-tag';document.querySelector('.ex-scene-wrap').append(clearanceTag);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

function notify(text){$('ex-toast').textContent=text;$('ex-toast').classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('ex-toast').classList.remove('is-visible'),3000);}
function seek(index){$('scrub').value=Math.max(0,Math.min(Number($('scrub').max),index));$('scrub').dispatchEvent(new Event('input',{bubbles:true}));}
function chooseSite(index){if(state?.mode!=='nasa')return;$('site').value=index;$('site').dispatchEvent(new Event('input',{bubbles:true}));}
function tween(position,target,done){
  needsRender=true;
  if(reduceMotion()||!hasWebGL){camera.position.copy(position);controls.target.copy(target);camera.lookAt(target);done?.();return;}
  motion={start:performance.now(),duration:pendingHorizon?1250:1000,from:camera.position.clone(),to:position,oldTarget:controls.target.clone(),target,done};controls.enabled=false;
}
function orbitalPose(){
  const f=state?.site?math.frame(state.site.lat,state.site.lon):math.frame(-89.5,0),up=vector(f.up),north=vector(f.north),east=vector(f.east);
  return {position:up.clone().multiplyScalar(2.7).addScaledVector(north,1.25).addScaledVector(east,.45).multiplyScalar(Math.max(1,1/camera.aspect)*1.08),target:up.clone().multiplyScalar(.20)};
}
function updateTabs(){
  document.dispatchEvent(new CustomEvent('explorer-view-change',{detail:mode}));
  needsRender=true;
  $('ex-orbit').setAttribute('aria-pressed',String(mode==='orbit'));$('ex-horizon').setAttribute('aria-pressed',String(mode==='horizon'));
  skyActions.hidden=mode!=='horizon';$('ex-descend').hidden=mode==='horizon';
  trajectoryKey.hidden=mode!=='horizon';
  $('ex-grid').hidden=mode==='horizon';
  $('ex-orbit').disabled=$('ex-reset-camera').disabled=!hasWebGL;
  horizonOverlay.style.display=clearanceTag.style.display=mode==='horizon'?'block':'none';
  $('ex-view-label').textContent=mode==='orbit'?'Lunar reference / orbital view':'Local sky / flat reference horizon';
  $('ex-render-note').textContent=mode==='orbit'?'NASA LRO mosaic on a sphere. Direction arrows use the selected observer sample. No terrain relief.':'Paths join sampled body-center directions. Ground, body sizes and distances are illustrative. Below-horizon paths are hidden; no terrain obstruction is rendered.';
}
function faceHeading(az){heading=az*Math.PI/180;lookPitch=0;localCamera();}
function localCamera(){needsRender=true;camera.position.set(0,1.4,0);controls.target.set(Math.sin(heading)*30,1.4+Math.tan(lookPitch)*30,-Math.cos(heading)*30);camera.lookAt(controls.target);$('ex-bearing').textContent=`Facing ${((heading*180/Math.PI%360+360)%360).toFixed(0)}°`;
}
function enterHorizon(){
  if(!state?.site||pendingHorizon||mode==='horizon')return;
  pendingHorizon=true;const f=math.frame(state.site.lat,state.site.lon),up=vector(f.up);
  $('ex-descend').textContent='Approaching reference…';
  tween(up.clone().multiplyScalar(1.20).addScaledVector(vector(f.north),.10),up.clone(),()=>{
    controls.enabled=false;
    const finish=()=>{
      if(!pendingHorizon)return;
      pendingHorizon=false;mode='horizon';orbital.visible=false;local.visible=true;controls.enabled=false;
      heading=state.samples[state.index].sun_az*Math.PI/180;lookPitch=0;localCamera();updateTabs();$('ex-descend').textContent='Explore this horizon ↘';canvas.style.opacity='1';
    };
    if(reduceMotion())finish();else{canvas.style.opacity='0';setTimeout(finish,170);}
  });
}
function enterOrbit(){
  pendingHorizon=false;canvas.style.opacity='1';$('ex-descend').textContent='Explore this horizon ↘';mode='orbit';orbital.visible=true;local.visible=false;controls.enabled=true;updateTabs();
  const pose=orbitalPose();camera.position.copy(pose.position.clone().multiplyScalar(.64));controls.target.copy(pose.target);tween(pose.position,pose.target);
}
function rebuildSites(comparisons){
  markerMeshes.forEach(m=>{markers.remove(m);m.geometry.dispose();m.material.dispose();});markerMeshes=[];
  const list=$('ex-site-list');list.replaceChildren();
  comparisons.forEach((site,i)=>{
    const button=document.createElement('button');button.className='ex-site-button';button.id='ex-site-'+i;
    button.innerHTML='<span class="ex-site-code"></span><span><strong></strong><small></small></span>';
    button.querySelector('.ex-site-code').textContent=resources.referenceCode(i);
    button.querySelector('strong').textContent=site.name.split(' · ')[0];button.title=site.name;
    button.querySelector('small').textContent=Number.isFinite(site.lat)?resources.coordinate(site.lat,site.lon)+'\n'+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).formatRange(new Date(site.start),new Date(site.end)):'Coordinates unavailable';
    button.onclick=()=>chooseSite(i);button.disabled=!Number.isFinite(site.lat);list.append(button);
    if(!Number.isFinite(site.lat))return;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.009,12,12),new THREE.MeshBasicMaterial({color:'#a6c5c8'}));
    mesh.position.copy(vector(math.frame(site.lat,site.lon).up).multiplyScalar(1.006));mesh.userData.site=i;markers.add(mesh);markerMeshes.push(mesh);
  });
}
function populateComparison(){
  $('ex-comparison-rows').replaceChildren();
  document.querySelector('#ex-comparison h2').textContent='Compare reference geometry.';
  const windows=new Set(state.comparisons.map(s=>`${s.start}/${s.end}`));
  document.querySelector('#ex-comparison>p').textContent=windows.size>1?'These coordinates have different UTC windows. Fractions are not directly rankable; inspect each window and source.':'Time-weighted fractions under the same threshold and UTC window. This is not an approved-site ranking.';
  state.comparisons.forEach(site=>{
    const tr=document.createElement('tr');[site.name,site.sun,site.earth,site.both,site.outage.toFixed(1)+' h'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});$('ex-comparison-rows').append(tr);
  });
}
function renderAnalysis(){
  const sample=state.samples[state.index],status=math.assessment(sample,state.threshold);
  $('ex-study-title').textContent=state.site?state.name.split(' · ')[0]:state.name;
  $('ex-coordinate').textContent=state.site?resources.coordinate(state.site.lat,state.site.lon):'Coordinates not supplied';
  document.querySelector('.ex-question .ex-small-label').textContent=state.site?'LUNAR REFERENCE / OBSERVER GEOMETRY':'IMPORTED OR ILLUSTRATIVE / OBSERVER GEOMETRY';
  $('ex-verdict').textContent=status.both?'Both above threshold':!status.sun&&!status.earth?'Both below threshold':status.earth?'Sun below threshold':'Earth below threshold';
  $('ex-verdict').dataset.clear=String(status.both);
  const body=status.limiter==='both'?'Both centers':status.limiter==='sun'?'Sun center':'Earth center';
  $('ex-reason').textContent=status.clearance===0?`${body} is exactly at the ${state.threshold.toFixed(2)}° threshold; strict visibility requires greater elevation.`:`${body}: ${Math.abs(status.clearance).toFixed(2)}° ${status.both?'above':'below'} the ${state.threshold.toFixed(2)}° threshold at this sample.`;
  for(const [key,radius]of [['sun',57],['earth',43]]){
    const p=math.bearingPoint(sample[key+'_az'],radius),x=120+p.x,y=77+p.y;
    $('ex-'+key+'-az').textContent=sample[key+'_az'].toFixed(1)+'°';
    $('ex-bearing-'+key).setAttribute('d',`M120 77L${x.toFixed(2)} ${y.toFixed(2)}`);
    $('ex-bearing-'+key).style.strokeDasharray=sample[key+'_el']<0?'4 3':'none';
    $('ex-bearing-'+key+'-dot').setAttribute('cx',x);$('ex-bearing-'+key+'-dot').setAttribute('cy',y);
  }
  $('ex-bearing-plot').setAttribute('aria-label',`Azimuth, north up: Sun ${sample.sun_az.toFixed(1)} degrees, Earth ${sample.earth_az.toFixed(1)} degrees. Elevations shown separately.`);
  const plot=math.elevationPlot(state.samples,state.threshold,800,94),path=points=>points.map((p,i)=>`${i?'L':'M'}${(p.x+38).toFixed(2)} ${(p.y+10).toFixed(2)}`).join(' ');
  for(const key of ['sun','earth']){
    $('ex-history-'+key).setAttribute('d',path(plot[key]));
    const point=plot[key][state.index];$('ex-history-'+key+'-dot').setAttribute('cx',point.x+38);$('ex-history-'+key+'-dot').setAttribute('cy',point.y+10);
  }
  $('ex-history-zero').setAttribute('d',`M38 ${plot.zeroY+10}H838`);
  $('ex-history-threshold').setAttribute('d',`M38 ${plot.thresholdY+10}H838`);
  const x=plot.sun[state.index].x+38;$('ex-history-cursor').setAttribute('d',`M${x} 3V112`);
  $('ex-history-max').textContent=plot.max.toFixed(1)+'°';$('ex-history-min').textContent=plot.min.toFixed(1)+'°';
  const chart=$('ex-history-chart');chart.setAttribute('aria-valuemax',state.samples.length-1);chart.setAttribute('aria-valuenow',state.index);
  chart.setAttribute('aria-valuetext',`${new Date(sample.time).toISOString()}, Sun ${sample.sun_el.toFixed(2)} degrees, Earth ${sample.earth_el.toFixed(2)} degrees`);
}
function update(next){
  needsRender=true;
  const previous=state;state=next;const sample=state.samples[state.index];
  if(!previous||state.mode!==previous.mode||state.comparisons.length!==previous.comparisons.length||state.name!==previous.name||state.site?.lat!==previous.site?.lat||state.site?.lon!==previous.site?.lon)rebuildSites(state.comparisons);
  document.querySelectorAll('.ex-site-button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===state.siteIndex)));
  $('ex-site-caption').textContent=state.name;
  $('ex-sun-value').textContent=sample.sun_el.toFixed(2)+'°';$('ex-earth-value').textContent=sample.earth_el.toFixed(2)+'°';
  $('ex-sun-state').textContent=sample.sun?'Above threshold':'Below threshold';$('ex-earth-state').textContent=sample.earth?'Above threshold':'Below threshold';
  $('ex-clearance').textContent=(Math.min(sample.sun_el,sample.earth_el)-state.threshold).toFixed(2)+'°';
  $('ex-clock').textContent=new Date(sample.time).toISOString().slice(0,16).replace('T',' / ')+' UTC';
  $('ex-scrub').max=state.samples.length-1;$('ex-scrub').value=state.index;$('ex-scrub').setAttribute('aria-valuetext',new Date(sample.time).toISOString());
  $('ex-sample-count').textContent=`${String(state.index+1).padStart(2,'0')} / ${state.samples.length}`;
  $('ex-prev').disabled=state.index===0;$('ex-next').disabled=state.index===state.samples.length-1;
  $('ex-start').textContent=new Date(state.samples[0].time).toISOString().slice(5,16).replace('T',' / ');$('ex-end').textContent=new Date(state.samples.at(-1).time).toISOString().slice(5,16).replace('T',' / ');
  if(!previous||state.mode!==previous.mode||state.siteIndex!==previous.siteIndex||state.samples.length!==previous.samples.length||state.samples[0].time!==previous.samples[0].time||state.samples.at(-1).time!==previous.samples.at(-1).time){
    $('ex-day').replaceChildren();resources.days(state.samples).forEach(day=>{const option=document.createElement('option');option.value=day.index;option.textContent=day.label;$('ex-day').append(option);});
  }
  for(const option of $('ex-day').options)if(Number(option.value)<=state.index)$('ex-day').value=option.value;
  $('ex-obstruction').value=$('horizon').value;$('ex-margin').value=$('margin').value;
  $('ex-obstruction-value').textContent=Number($('horizon').value).toFixed(1)+'°';$('ex-margin-value').textContent=Number($('margin').value).toFixed(2)+'°';
  const selected=state.comparisons[state.siteIndex]||state.comparisons[0];
  $('ex-finding').textContent=!state.site?'Add observer coordinates in Data to enable the lunar surface and local horizon.':selected.earth==='0.0%'?'No sampled Earth-clear intervals in this cached window.':`${selected.both} of this window has both Sun and Earth above the selected threshold.`;
  $('ex-source-state').textContent=state.mode==='nasa'?`${state.provider} / source recorded`:'User / illustrative data';
  document.querySelector('.ex-intro').textContent=state.mode==='nasa'?`${state.comparisons.length} observer windows. Select a place and date range, then test its geometry.`:state.site?'Imported observer location. Coordinates and samples are user supplied; inspect their source.':'Imported samples have no observer location. Add latitude and longitude in Data to enable the 3D views.';
  document.querySelector('.ex-window .ex-small-label').textContent=state.mode==='nasa'?'NASA cache / UTC':'Current dataset / UTC';
  document.querySelector('.ex-window>strong').textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).formatRange(new Date(state.samples[0].time),new Date(state.samples.at(-1).time));
  $('ex-day').disabled=false;moon.visible=Boolean(state.site);coordinateGrid.visible=Boolean(state.site)&&$('ex-grid').getAttribute('aria-pressed')==='true';
  $('ex-restore-nasa').disabled=$('nasa').disabled;
  $('ex-loading').hidden=hasWebGL&&Boolean(state.site);
  if(!hasWebGL)$('ex-loading').textContent='Data-only view. The 3D scene is unavailable or disabled. Elevation history, directions, samples, saved comparisons and reports remain available.';
  else if(!state.site)$('ex-loading').textContent='Observer location missing. Open Data and enter the CSV’s lunar latitude and longitude.';
  $('ex-horizon').disabled=$('ex-descend').disabled=!state.site||!hasWebGL;
  $('ex-grid').disabled=!state.site||!hasWebGL;
  if(!state.site&&mode==='horizon')enterOrbit();
  if(state.site){
    updateSkyTracks(state.geometry||state.samples);
    const f=math.frame(state.site.lat,state.site.lon),up=vector(f.up);
    const sunDirection=vector(math.direction(state.site.lat,state.site.lon,sample.sun_az,sample.sun_el));
    const earthDirection=vector(math.direction(state.site.lat,state.site.lon,sample.earth_az,sample.earth_el));
    solarLight.position.copy(sunDirection).multiplyScalar(7);
    ring.position.copy(up).multiplyScalar(1.009);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),up);
    sunArrow.position.copy(up).multiplyScalar(1.012);sunArrow.setDirection(sunDirection);
    earthArrow.position.copy(up).multiplyScalar(1.012);earthArrow.setDirection(earthDirection);
    const observer=new THREE.Vector3(0,1.4,0);
    sunBody.position.copy(observer).add(vector(math.skyDirection(sample.sun_az,sample.sun_el)).multiplyScalar(80));
    earthBody.position.copy(observer).add(vector(math.skyDirection(sample.earth_az,sample.earth_el)).multiplyScalar(80));
    sunBody.visible=sample.sun_el>0;earthBody.visible=sample.earth_el>0;
    if(lastSite!==state.siteIndex||!previous?.site||state.site.lat!==previous.site.lat||state.site.lon!==previous.site.lon){lastSite=state.siteIndex;if(mode==='orbit'){const pose=orbitalPose();tween(pose.position,pose.target);}else faceHeading(sample.sun_az);}
  }
  ring.visible=sunArrow.visible=earthArrow.visible=Boolean(state.site);
  const start=state.samples[0].time,span=state.samples.at(-1).time-start;
  for(const key of ['sun','earth','both']){
    const lane=$('ex-'+key+'-lane');lane.replaceChildren();
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 1');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',math.visibilityRanges(state.samples,key).map(r=>`M${r.left.toFixed(6)} 0h${r.width.toFixed(6)}v1h-${r.width.toFixed(6)}Z`).join(' '));svg.append(path);lane.append(svg);
    const cursor=document.createElement('b');cursor.style.left=(sample.time-start)/span*100+'%';lane.append(cursor);
    lane.setAttribute('role','slider');lane.tabIndex=0;lane.setAttribute('aria-label',`Inspect ${key} visibility timeline`);lane.setAttribute('aria-valuemin','0');lane.setAttribute('aria-valuemax',state.samples.length-1);lane.setAttribute('aria-valuenow',state.index);lane.setAttribute('aria-valuetext',`${new Date(sample.time).toISOString()}; ${state.fractions[key]||selected?.both||'0.0%'} of window above threshold`);
  }
  populateComparison();renderAnalysis();syncPlay();
}
function syncPlay(){const active=$('play').getAttribute('aria-pressed')==='true';$('ex-play').setAttribute('aria-pressed',String(active));$('ex-play').textContent=active?'Pause observation':'Play observation';$('ex-speed').value=$('speed').value;}
$('ex-play').onclick=()=>$('play').click();$('ex-prev').onclick=()=>seek(state.index-1);$('ex-next').onclick=()=>seek(state.index+1);
$('ex-scrub').oninput=e=>seek(Number(e.target.value));$('ex-day').onchange=e=>seek(Number(e.target.value));
$('ex-history-chart').onclick=e=>{
  const box=e.currentTarget.getBoundingClientRect(),svgX=(e.clientX-box.left)/box.width*860;
  seek(math.nearestIndex(state.samples,(svgX-38)/800));
};
$('ex-history-chart').onkeydown=e=>{
  const indices={ArrowLeft:state.index-1,ArrowRight:state.index+1,Home:0,End:state.samples.length-1};
  if(Object.hasOwn(indices,e.key)){e.preventDefault();seek(indices[e.key]);}
};
$('ex-speed').onchange=e=>{$('speed').value=e.target.value;$('speed').dispatchEvent(new Event('change'));};
for(const [source,target]of [['ex-obstruction','horizon'],['ex-margin','margin']])$(source).oninput=e=>{$(target).value=e.target.value;$(target).dispatchEvent(new Event('input',{bubbles:true}));};
for(const key of ['sun','earth','both'])$('ex-'+key+'-lane').onclick=e=>{
  const b=e.currentTarget.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width));
  const time=state.samples[0].time+fraction*(state.samples.at(-1).time-state.samples[0].time);let nearest=0;
  state.samples.forEach((row,i)=>{if(Math.abs(row.time-time)<Math.abs(state.samples[nearest].time-time))nearest=i;});seek(nearest);
};
$('ex-horizon').onclick=$('ex-descend').onclick=enterHorizon;$('ex-orbit').onclick=enterOrbit;
for(const key of ['sun','earth','both'])$('ex-'+key+'-lane').onkeydown=e=>$('ex-history-chart').onkeydown(e);
$('ex-reset-camera').onclick=()=>{if(mode==='horizon')faceHeading(state.samples[state.index].sun_az);else{const pose=orbitalPose();tween(pose.position,pose.target);}};
$('ex-face-sun').onclick=()=>faceHeading(state.samples[state.index].sun_az);$('ex-face-earth').onclick=()=>faceHeading(state.samples[state.index].earth_az);
$('ex-compare').onclick=()=>{const show=$('ex-comparison').hidden;$('ex-comparison').hidden=!show;$('ex-compare').setAttribute('aria-pressed',String(show));if(show)$('ex-comparison').scrollIntoView({behavior:reduceMotion()?'instant':'smooth',block:'nearest'});};
$('ex-save').onclick=()=>document.dispatchEvent(new Event('scenario-save-request'));
$('ex-clear-pin').onclick=()=>{$('ex-pinned').hidden=true;};
new MutationObserver(syncPlay).observe($('play'),{attributes:true,attributeFilter:['aria-pressed']});
document.addEventListener('observation-change',e=>update(e.detail));
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};if(mode==='horizon')canvas.setPointerCapture(e.pointerId);if(mode==='orbit'&&motion){motion=null;controls.enabled=true;}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4;if(mode==='horizon'){heading-=dx*.006;lookPitch=Math.max(-.6,Math.min(.8,lookPitch-dy*.004));localCamera();}drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{
  if(drag&&!drag.moved&&mode==='orbit'){
    const b=canvas.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(markerMeshes)[0],surface=raycaster.intersectObject(moon)[0];if(hit&&(!surface||hit.distance<surface.distance+.02))chooseSite(hit.object.userData.site);
  }drag=null;
});
canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key))return;e.preventDefault();
  if(e.key==='Escape'){enterOrbit();return;}
  if(mode==='horizon'){heading+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);lookPitch=Math.max(-.6,Math.min(.8,lookPitch+(e.key==='ArrowUp'?.08:e.key==='ArrowDown'?-.08:0)));localCamera();}
  else{motion=null;controls.enabled=true;const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);offset.multiplyScalar(e.key==='ArrowUp'?.9:e.key==='ArrowDown'?1.1:1);if(offset.length()>1.08&&offset.length()<6)camera.position.copy(controls.target).add(offset);}
});
function resize(){const b=canvas.getBoundingClientRect();if(!b.width||!b.height)return;needsRender=true;renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();if(mode==='orbit'&&state&&!pendingHorizon){motion=null;controls.enabled=true;const pose=orbitalPose();camera.position.copy(pose.position);controls.target.copy(pose.target);camera.lookAt(controls.target);}}
new ResizeObserver(resize).observe(document.querySelector('.ex-scene-wrap'));
function labelBody(body,id,key){
  const tag=$(id);if(mode!=='horizon'||!state?.site){tag.hidden=true;return;}
  const p=body.position.clone().project(camera),sample=state.samples[state.index];const visible=p.z<1&&p.z>-1&&Math.abs(p.x)<.88&&Math.abs(p.y)<.8;
  tag.hidden=!visible;if(visible){
    const terrainSample=window.SeleneTerrainView?.profile?window.SeleneTerrainView.result?.samples[state.index]:null;
    const below=terrainSample?!terrainSample[key]:sample[key+'_el']<0;
    tag.classList.toggle('ex-below',below);
    const left=Math.max(8,Math.min(canvas.clientWidth-175,(p.x+1)/2*canvas.clientWidth+10));
    // Keep body text below the disk, away from the 4-degree compass labels and
    // the toolbar. Stack nearby Sun/Earth labels instead of painting both atop it.
    let top=Math.max(100,Math.min(canvas.clientHeight-105,(-p.y+1)/2*canvas.clientHeight+16));
    const sunTag=$('ex-sun-tag');
    if(key==='earth'&&!sunTag.hidden&&Math.abs(left-parseFloat(sunTag.style.left))<175&&Math.abs(top-parseFloat(sunTag.style.top))<25)top=Math.min(canvas.clientHeight-80,parseFloat(sunTag.style.top)+26);
    tag.style.left=left+'px';tag.style.top=top+'px';
    tag.textContent=`${key==='sun'?'Sun':'Earth'} ${sample[key+'_el'].toFixed(2)}°${below?(terrainSample?' / terrain cutoff':' / below horizon'):terrainSample?' / terrain clear':''}`;
  }
}
document.addEventListener('terrain-view-change',()=>{needsRender=true;});
function drawClearance(){
  if(mode!=='horizon'||!state?.site)return;
  const half=Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect)*1.08,points=[];
  const terrain=window.SeleneTerrainView?.profile;
  $('ex-view-label').textContent=terrain?'Local sky / LOLA skyline overlay':'Local sky / flat reference horizon';
  $('ex-render-note').textContent=terrain?'Dashed skyline: sampled LOLA terrain + selected margin. Ground and body sizes are illustrative; the surface mesh is not this DEM. Main readouts retain flat-reference values.':'Paths join sampled body-center directions. Ground and body sizes are illustrative. No measured skyline is active.';
  for(let i=0;i<=128;i++){const az=(heading-half+half*2*i/128)*180/Math.PI;const cutoff=terrain?Math.max(state.horizon,window.SeleneTerrain.elevation(terrain,az))+state.margin:state.threshold;const p=vector(math.skyDirection(az,cutoff)).multiplyScalar(80).add(camera.position).project(camera);points.push([(p.x+1)/2*canvas.clientWidth,(-p.y+1)/2*canvas.clientHeight]);}
  clearancePath.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
  clearanceTag.style.top=Math.max(90,points[64][1]-20)+'px';clearanceTag.textContent=terrain?'LOLA terrain skyline + selected margin':state.threshold?`Selected clearance / ${state.threshold.toFixed(2)}°`:'Flat reference horizon / 0°';
}
function frame(now){
  requestAnimationFrame(frame);if(document.hidden||!canvas.getClientRects().length)return;
  const moving=Boolean(motion);
  if(motion){const m=motion,f=Math.min(1,(now-m.start)/m.duration),e=f*f*(3-2*f);camera.position.lerpVectors(m.from,m.to,e);controls.target.lerpVectors(m.oldTarget,m.target,e);camera.lookAt(controls.target);if(f===1){motion=null;controls.enabled=mode==='orbit';m.done?.();}}
  else if(mode==='orbit')needsRender=controls.update()||needsRender;
  if(!needsRender&&!moving)return;
  renderer.render(scene,camera);labelBody(sunBody,'ex-sun-tag','sun');labelBody(earthBody,'ex-earth-tag','earth');drawClearance();needsRender=false;
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('ex-loading').hidden=false;$('ex-loading').textContent='Graphics context paused. Your observation data is preserved.';});
canvas.addEventListener('webglcontextrestored',()=>{$('ex-loading').hidden=true;resize();});
document.body.classList.add('explorer-mode');$('ex-loading').hidden=true;resize();updateTabs();
if(window.SeleneObservation)update(window.SeleneObservation);
window.SeleneExplorer={cancelCamera(){
  motion=null;pendingHorizon=false;canvas.style.opacity='1';$('ex-descend').textContent='Explore this horizon ↘';
  if(mode==='horizon'){
    mode='orbit';orbital.visible=true;local.visible=false;controls.enabled=true;
    skyActions.hidden=trajectoryKey.hidden=true;$('ex-descend').hidden=$('ex-grid').hidden=false;
    horizonOverlay.style.display=clearanceTag.style.display='none';
    const pose=orbitalPose();camera.position.copy(pose.position);controls.target.copy(pose.target);camera.lookAt(pose.target);needsRender=true;
  }
}};
document.dispatchEvent(new Event('explorer-ready'));
if(hasWebGL)requestAnimationFrame(frame);
}
