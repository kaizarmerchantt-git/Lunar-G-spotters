'use strict';
(() => {
  const $=id=>document.getElementById(id), canvas=$('system-scene'),ctx=canvas.getContext('2d');
  let cacheError=false,data=null,observation=null,epoch=0,started=0,playing=false,frame=null,yaw=0,tilt=.75,zoom=1,drag=null,mode='system';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let hitBodies={},cameraMotion=null;
  let scaleMode='lunar';
  const scales=document.createElement('div');scales.className='system-scale-switch';scales.setAttribute('role','group');scales.setAttribute('aria-label','System distance scale');
  scales.innerHTML='<button id="system-lunar-scale" aria-pressed="true">Earth–Moon detail</button><button id="system-solar-scale" aria-pressed="false">Solar distance</button><span id="system-scale-note">Drag Earth–Moon view · Sun stays left</span>';
  canvas.before(scales);
  function setScale(next){scaleMode=next;cameraMotion=null;for(const id of ['system-top','system-in','system-out','system-reset','system-paths'])$(id).disabled=next==='solar';document.querySelector('.system-header span:last-child').textContent=next==='solar'?'Range view · Earth-centered':'Drag to orbit the view';$('system-lunar-scale').setAttribute('aria-pressed',String(next==='lunar'));$('system-solar-scale').setAttribute('aria-pressed',String(next==='solar'));$('system-scale-note').textContent=next==='solar'?'One linear distance scale. Body markers enlarged.':'Drag Earth–Moon view · Sun stays left';canvas.setAttribute('aria-label',next==='solar'?'NASA Sun-Earth linear distance view. Earth and Moon are almost coincident at this scale. Switch to Earth-Moon detail to resolve the Moon.':'Fixed Sun on the left with a separate rotating Earth-Moon view. Free two-axis camera; lighting follows NASA geometry. Drag or use arrow keys to rotate; playback changes UTC.');schedule();}
  $('system-lunar-scale').onclick=()=>setScale('lunar');$('system-solar-scale').onclick=()=>setScale('solar');
  const reduceMotion=()=>reduced.matches||Boolean(document.getElementById('wb-reduce-motion')?.checked);
  function moveCamera(target){if(reduceMotion()){({yaw,tilt,zoom}=target);cameraMotion=null;}else cameraMotion={from:{yaw,tilt,zoom},target,start:performance.now()};schedule();}
  document.addEventListener('system-asset-ready',schedule);
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  function draw(){
    frame=null;if(mode!=='system'||document.hidden||!canvas.getClientRects().length)return;
    if(cameraMotion){const f=reduceMotion()?1:Math.min(1,(performance.now()-cameraMotion.start)/550),e=1-Math.pow(1-f,3),a=cameraMotion.from,b=cameraMotion.target;yaw=a.yaw+(b.yaw-a.yaw)*e;tilt=a.tilt+(b.tilt-a.tilt)*e;zoom=a.zoom+(b.zoom-a.zoom)*e;if(f===1)cameraMotion=null;}
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),ratio=Math.min(2,window.devicePixelRatio||1);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.fillStyle='#080e16';ctx.fillRect(0,0,w,h);
    for(let i=0;i<130;i++){ctx.fillStyle=i%7===0?'#b9cfdd70':'#a6b8c22a';ctx.fillRect((i*139.4)%w,(i*81.7)%h,i%7===0?1.5:1,1);}
    if(!data||!observation){ctx.fillStyle='#a8b4bf';ctx.font='13px system-ui';ctx.fillText(cacheError?'NASA vector cache unavailable. Site analysis remains available.':'Loading NASA/JPL system geometry…',20,250);return;}
    if(!observation.available){$('system-source').textContent='No matching NASA system vectors for this dataset';$('system-time').textContent='';ctx.fillStyle='#c9b392';ctx.font='13px system-ui';ctx.fillText('System geometry unavailable for this dataset / epoch.',20,250);$('system-readout').textContent='Use the cached NASA dataset for synchronized system motion.';$('body-distance').textContent='Unavailable';$('body-description').textContent='No NASA system geometry matches this dataset. Return to the NASA reference dataset.';hitBodies={};return;}
    let t=epoch;
    if(playing&&!reduceMotion())t=Math.min(data.bodies.moon.at(-1).time,observation.nextEpoch,epoch+(performance.now()-started)/observation.stepMs*(observation.nextEpoch-epoch));
    const sun=SystemModel.interpolate(data.bodies.sun,t),moon=SystemModel.interpolate(data.bodies.moon,t);
    const chosen=$('inspect-body').value;
    hitBodies=SeleneSystemRenderer.render({ctx,w,h,sun,moon,yaw,tilt,zoom,data,epoch:t,selected:chosen,paths:$('system-paths').checked,minimalUI:Boolean(canvas.closest('.obs-system-layer')),scaleMode});
    $('body-name').textContent=chosen[0].toUpperCase()+chosen.slice(1);
    $('body-distance').textContent=chosen==='earth'?'Reference origin':chosen==='moon'?Math.round(SystemModel.magnitude(moon)).toLocaleString()+' km':(SystemModel.magnitude(sun)/1e6).toFixed(3)+' million km';
    $('body-description').textContent=chosen==='earth'?'Earth is the coordinate origin. NASA Blue Marble is a historical composite; displayed hemisphere, attitude and shading are illustrative.':chosen==='moon'?'Distance from Earth’s center. Mint track: cached NASA positions. Dotted guide: schematic orientation. Dashed portions show rear or hidden track. Body disks are enlarged; attitude is approximate.':'Earth–Sun geometric distance at the displayed UTC epoch. The Sun is pinned to the left in a separate display scale. Its disk and granulation are illustrative. Solar distance gives a linear range view.';
    $('system-readout').textContent=`Earth–Moon ${Math.round(SystemModel.magnitude(moon)).toLocaleString()} km · Earth–Sun ${(SystemModel.magnitude(sun)/1e6).toFixed(3)} million km`;
    $('system-time').textContent=new Date(t).toISOString().replace('T',' · ').replace(/\.\d{3}Z$/,' UTC');
    $('system-source').textContent=playing&&!reduceMotion()?'Interpolated motion between hourly NASA samples':'NASA/JPL geometric vectors · sampled epoch';
    if((playing||cameraMotion)&&!reduceMotion())schedule();
  }
  function setMode(next){mode=next;canvas.hidden=next!=='system';$('globe').hidden=next==='system';$('globe-pane').classList.toggle('system-mode',next==='system');$('view-system').setAttribute('aria-pressed',String(next==='system'));$('view-surface').setAttribute('aria-pressed',String(next==='surface'));if(next==='system')schedule();else window.dispatchEvent(new Event('resize'));}
  $('view-system').onclick=()=>setMode('system');$('view-surface').onclick=()=>setMode('surface');
  $('system-in').onclick=()=>{zoom=Math.min(1.3,zoom+.1);schedule();};$('system-out').onclick=()=>{zoom=Math.max(.65,zoom-.1);schedule();};
  $('system-reset').onclick=()=>moveCamera({yaw:0,tilt:.75,zoom:1});$('inspect-body').onchange=schedule;
  $('system-top').onclick=()=>moveCamera({yaw:0,tilt:0,zoom:1});$('system-paths').onchange=schedule;
  canvas.addEventListener('pointerdown',e=>{if(scaleMode==='solar')return;cameraMotion=null;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.008;tilt+=(e.clientY-drag.y)*.006;drag={...drag,x:e.clientX,y:e.clientY,moved:drag.moved||Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5};schedule();});
  canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;const found=Object.entries(hitBodies).sort((a,b)=>Math.hypot(x-a[1].point[0],y-a[1].point[1])-Math.hypot(x-b[1].point[0],y-b[1].point[1])).find(([,body])=>Math.hypot(x-body.point[0],y-body.point[1])<=Math.max(24,body.radius+12));if(found){$('inspect-body').value=found[0];schedule();}}drag=null;});
  canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('keydown',e=>{if(scaleMode==='solar'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();cameraMotion=null;if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')tilt+=.1;if(e.key==='ArrowDown')tilt-=.1;schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;cancelAnimationFrame(frame);frame=null;}else schedule();});window.addEventListener('resize',schedule);
  window.SeleneSystem={range(){return data?[data.bodies.moon[0].time,data.bodies.moon.at(-1).time]:null;},update(next){if(!data){observation=null;return;}observation={...next,available:next.mode==='nasa'&&next.epoch>=data.bodies.moon[0].time&&next.epoch<=data.bodies.moon.at(-1).time};epoch=next.epoch;playing=next.playing;started=performance.now();schedule();},pause(){playing=false;schedule();}};
  fetch('data/system-month.json').then(r=>{if(!r.ok)throw new Error('Vector cache missing');return r.json();}).then(d=>{for(const name of ['sun','moon']){const rows=d.bodies[name];if(rows.length!==721)throw new Error('Invalid vector count');rows.forEach((r,i)=>{r.time=Date.parse(r.time);if(!Number.isFinite(r.time)||r.position.length!==3||r.position.some(v=>!Number.isFinite(v))||(i&&r.time<=rows[i-1].time))throw new Error('Invalid vector data');});}data=d;$('system-record').textContent=JSON.stringify({...d,bodies:undefined},null,2);document.dispatchEvent(new Event('system-ready'));schedule();}).catch(()=>{cacheError=true;$('system-source').textContent='NASA vector cache unavailable';schedule();});
  setMode('system');
})();
