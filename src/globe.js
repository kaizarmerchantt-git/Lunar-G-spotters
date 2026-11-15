'use strict';
// CPU ray-cast sphere. Display lighting is deliberately independent of ephemeris.
(() => {
  const canvas=document.getElementById('globe'), ctx=canvas.getContext('2d');
  const $=id=>document.getElementById(id), TAU=Math.PI*2;
  let yaw=0,pitch=-0.85,zoom=1,texture=null,textureW=0,textureH=0,state=null,queued=false,drag=null,spin=null,referenceSignature=null;
  const image=new Image();
  image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);texture=x.getImageData(0,0,c.width,c.height).data;textureW=c.width;textureH=c.height;$('texture-status').textContent='NASA LRO surface mosaic';request();};
  image.onerror=()=>{$('texture-status').textContent='Surface texture unavailable · geometry still usable';request();};
  image.src='assets/lroc_color_2k.jpg';
  function rotate(v){const x=Math.cos(yaw)*v[0]-Math.sin(yaw)*v[2],z=Math.sin(yaw)*v[0]+Math.cos(yaw)*v[2];return [x,Math.cos(pitch)*v[1]-Math.sin(pitch)*z,Math.sin(pitch)*v[1]+Math.cos(pitch)*z];}
  function request(){if(!queued){queued=true;requestAnimationFrame(draw);}}
  function draw(){
    queued=false; if(canvas.hidden||!canvas.getClientRects().length)return;
    const width=Math.min(720,Math.max(300,canvas.clientWidth)),height=500;
    canvas.width=width;canvas.height=height;
    const cx=width/2,cy=height/2,radius=Math.min(width*.38,185)*zoom;
    ctx.fillStyle='#080e16';ctx.fillRect(0,0,width,height);
    // Stable stars for depth; decorative, not an astronomical star field.
    for(let i=0;i<95;i++){const x=((i*127.31)%width),y=((i*79.71)%height);ctx.fillStyle=`rgba(182,205,224,${i%4===0?.38:.13})`;ctx.fillRect(x,y,i%5===0?1.5:1,1);}
    const glow=ctx.createRadialGradient(cx,cy,radius*.85,cx,cy,radius*1.4);glow.addColorStop(0,'#3c61752a');glow.addColorStop(1,'#3c617500');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const side=Math.ceil(radius*2),pixels=ctx.createImageData(side,side),dst=pixels.data;
    const cY=Math.cos(yaw),sY=Math.sin(yaw),cP=Math.cos(pitch),sP=Math.sin(pitch);
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const nx=(x+.5-radius)/radius,ny=-(y+.5-radius)/radius,rr=nx*nx+ny*ny;if(rr>1)continue;
      const nz=Math.sqrt(1-rr),uy=cP*ny+sP*nz,uz=-sP*ny+cP*nz;
      const wx=cY*nx+sY*uz,wz=-sY*nx+cY*uz;
      // Longitude zero is at the center of NASA's equirectangular map.
      const lon=Math.atan2(wx,wz),lat=Math.asin(Math.max(-1,Math.min(1,uy)));
      const tx=Math.min(textureW-1,Math.floor((lon/TAU+.5)*textureW)),ty=Math.min(textureH-1,Math.floor((.5-lat/Math.PI)*textureH));
      const source=4*(ty*textureW+tx),target=4*(y*side+x),light=.35+.65*Math.max(0,-nx*.35+ny*.25+nz*.9);
      for(let k=0;k<3;k++)dst[target+k]=(texture?texture[source+k]:130)*light;
      dst[target+3]=Math.min(255,(1-rr)*radius*255);
    }
    // putImageData does not blend; render to an offscreen layer first.
    const layer=document.createElement('canvas');layer.width=layer.height=side;layer.getContext('2d').putImageData(pixels,0,0);ctx.drawImage(layer,cx-radius,cy-radius);
    const project=(lat,lon)=>{lat*=Math.PI/180;lon*=Math.PI/180;const p=rotate([Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)]);return {x:cx+p[0]*radius,y:cy-p[1]*radius,front:p[2]>0};};
    if($('grid').checked){ctx.strokeStyle='#b5d7e028';ctx.lineWidth=.7;for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();let started=false;for(let lon=-180;lon<=180;lon+=3){const p=project(lat,lon);if(p.front){if(started)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);started=true;}else started=false;}ctx.stroke();}for(let lon=-180;lon<180;lon+=30){ctx.beginPath();let started=false;for(let lat=-90;lat<=90;lat+=3){const p=project(lat,lon);if(p.front){if(started)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);started=true;}else started=false;}ctx.stroke();}}
    // Pole labels establish geography independently of the camera angle.
    ctx.font='11px system-ui';for(const [lat,label]of [[90,'NORTH POLE'],[-90,'SOUTH POLE']]){const p=project(lat,0);if(p.front){ctx.fillStyle='#acc6d7';ctx.fillText(label,p.x+12,p.y+5);}}
    if(state?.sites){state.sites.forEach((site,i)=>{const p=project(site.lat,site.lon);if(!p.front)return;ctx.strokeStyle=i===state.selected?'#f3c782':'#98c6ca';ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(p.x,p.y,i===state.selected?5:3,0,TAU);ctx.fill();if(i===state.selected){ctx.beginPath();ctx.arc(p.x,p.y,11,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x+12,p.y);ctx.lineTo(p.x+50,p.y-38);ctx.lineTo(p.x+90,p.y-38);ctx.stroke();ctx.fillStyle='#f3c782';ctx.fillText('REFERENCE '+String.fromCharCode(65+i),p.x+53,p.y-46);}});}
    $('camera-state').textContent=`View ${(pitch*180/Math.PI).toFixed(0)}° lat / ${((yaw*180/Math.PI%360+360)%360).toFixed(0)}° E · zoom ${zoom.toFixed(1)}×`;
  }
  function stopSpin(){clearInterval(spin);spin=null;$('rotate').textContent='Rotate globe';$('rotate').setAttribute('aria-pressed','false');}
  canvas.addEventListener('pointerdown',e=>{stopSpin();drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.008;pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch+(e.clientY-drag.y)*.008));drag={x:e.clientX,y:e.clientY};request();});
  for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{drag=null;});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();stopSpin();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch=Math.min(Math.PI/2,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(-Math.PI/2,pitch-.1);if(['+','='].includes(e.key))zoom=Math.min(1.35,zoom+.1);if(e.key==='-')zoom=Math.max(.7,zoom-.1);request();});
  $('zoom-in').onclick=()=>{zoom=Math.min(1.35,zoom+.1);request();};$('zoom-out').onclick=()=>{zoom=Math.max(.7,zoom-.1);request();};
  $('polar').onclick=()=>{stopSpin();pitch=-Math.PI/2;yaw=0;zoom=1;request();};
  $('nearside').onclick=()=>{stopSpin();pitch=0;yaw=0;zoom=1;request();};
  $('rotate').onclick=()=>{if(spin){stopSpin();return;}$('rotate').textContent='Stop rotation';$('rotate').setAttribute('aria-pressed','true');spin=setInterval(()=>{yaw+=.02;request();},70);};
  $('grid').onchange=request;window.addEventListener('resize',request);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpin();});
  window.SeleneGlobe={update(next){state=next;$('globe-source').textContent=next.source;$('globe-site').textContent=next.name;$('globe-clock').textContent=next.time;$('live-sun').textContent=next.sun;$('live-earth').textContent=next.earth;$('globe-message').textContent=next.message;
    const signature=JSON.stringify(next.sites?.map(s=>[s.lat,s.lon])||[]);if(signature!==referenceSignature){referenceSignature=signature;$('reference-buttons').replaceChildren();if(next.sites)next.sites.forEach((s,i)=>{const b=document.createElement('button');b.className='reference-button'+(i===next.selected?' active':'');b.setAttribute('aria-pressed',String(i===next.selected));b.textContent=`${String.fromCharCode(65+i)}  ${Math.abs(s.lat)}° S / ${s.lon}° E`;b.onclick=()=>{const select=$('site');select.value=i;select.dispatchEvent(new Event('input'));};$('reference-buttons').append(b);});} [...$('reference-buttons').children].forEach((b,i)=>{b.className='reference-button'+(i===next.selected?' active':'');b.setAttribute('aria-pressed',String(i===next.selected));});request();}};
  request();
})();
