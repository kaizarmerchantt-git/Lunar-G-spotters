'use strict';
// Earth-centered presentation. The circular guide is explicitly NOT a predicted orbit.
(() => {
  const earth = new Image(), moon = new Image();
  let earthPixels, moonPixels, solarSprite;
  const sprites = new Map();
  function loaded(image, kind) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const x = c.getContext('2d', {willReadFrequently: true});
    x.drawImage(image, 0, 0, c.width, c.height);
    const pixels = {data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};
    if (kind === 'earth') earthPixels = pixels; else moonPixels = pixels;
    sprites.clear(); document.dispatchEvent(new Event('system-asset-ready'));
  }
  earth.onload = () => loaded(earth, 'earth');
  moon.onload = () => loaded(moon, 'moon');
  earth.src = 'assets/earth-blue-marble-map.png'; moon.src = 'assets/lroc_color_2k.jpg';
  const unit = v => { const n = Math.hypot(...v); return v.map(x=>x/(n||1)); };

  function sphere(kind, light, yaw, tilt, epoch, roll) {
    const source = kind === 'earth' ? earthPixels : moonPixels;
    if (!source) return null;
    const spin=kind==='earth'?SystemModel.earthSpin(epoch):0;
    const key = [kind,...light.map(v=>Math.round(v*64)),Math.round(yaw*40),Math.round(tilt*40),Math.round((spin%(2*Math.PI))*64),Math.round(roll*40)].join('/');
    if (sprites.has(key)) return sprites.get(key);
    const size = kind === 'earth' ? 256 : 128;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), image = x.createImageData(size,size);
    const brightness=SystemModel.createLighting(light);
    const cosY=Math.cos(yaw),sinY=Math.sin(yaw),cosT=Math.cos(tilt),sinT=Math.sin(tilt),cr=Math.cos(roll),sr=Math.sin(roll);
    for (let py=0;py<size;py++) for (let px=0;px<size;px++) {
      const nx=(px+.5)/size*2-1,ny=(py+.5)/size*2-1,r2=nx*nx+ny*ny;
      if(r2>1)continue;
      const nz=Math.sqrt(1-r2);
      // Inverse camera rotation maps each visible surface normal back to the
      // texture frame. Earth adds approximate obliquity and sidereal rotation.
      const qx=nx*cr+ny*sr,qy=-nx*sr+ny*cr;
      const ry=-qy*cosT+nz*sinT,rz=qy*sinT+nz*cosT;
      let wx=qx*cosY+ry*sinY,wy=-qx*sinY+ry*cosY,wz=rz;
      if(kind==='earth'){const ob=23.43928*Math.PI/180,ey=wy*Math.cos(ob)-wz*Math.sin(ob),ez=wy*Math.sin(ob)+wz*Math.cos(ob);wy=ey;wz=ez;}
      const u=((Math.atan2(wy,wx)-spin)/(2*Math.PI)+.5+1000000)%1;
      const v=.5-Math.asin(Math.max(-1,Math.min(1,wz)))/Math.PI;
      const si=(Math.min(source.h-1,Math.floor(v*source.h))*source.w+Math.min(source.w-1,Math.floor(u*source.w)))*4;
      const di=(py*size+px)*4;
      // Lambertian illumination in linear light; sRGB display gamma and a
      // small illustrative ambient floor retain the dark limb without painting it.
      const shade=brightness(nx,ny,nz);
      for(let channel=0;channel<3;channel++)image.data[di+channel]=source.data[si+channel]*shade;
      image.data[di+3]=Math.min(1,(1-r2)*size)*255;
    }
    x.putImageData(image,0,0);
    if(sprites.size>18)sprites.delete(sprites.keys().next().value);
    sprites.set(key,c);return c;
  }

  function render({ctx,w,h,sun,moon:moonVector,yaw,tilt,zoom,data,epoch,selected,paths,minimalUI=false,scaleMode="lunar"}) {
    const compact=w<520;
    const baseYaw=Math.PI-Math.atan2(data.bodies.sun[0].position[1],data.bodies.sun[0].position[0]);
    const cameraYaw=baseYaw+yaw;
    const layout=SystemModel.sceneLayout({w,h,sun,moon:moonVector,yaw:cameraYaw,tilt,zoom,mode:scaleMode});
    const {project,camera}=layout,[cx,cy]=layout.points.earth;
    const sunCamera=unit(camera(sun)),range=SystemModel.magnitude(moonVector),orbitRadius=450000*layout.scale;
    const mp=project(moonVector),points={earth:[cx,cy],moon:mp.point};
    if(scaleMode==='solar')return renderSolar({ctx,w,h,sun,moonVector,layout,compact});
    const separation=Math.hypot(mp.point[0]-cx,mp.point[1]-cy);
    const radii={earth:Math.min(compact?34:54,w*.1),moon:Math.min(compact?15:21,w*.045),sun:Math.min(64,layout.localBounds.left*.36)};
    points.sun=layout.points.sun;
    function glow(p,r,color,end=3){const g=ctx.createRadialGradient(...p,r*.6,...p,r*end);g.addColorStop(0,color);g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(p[0]-r*end,p[1]-r*end,r*end*2,r*end*2);}
    function line(a,b,color,width=1,dashes=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dashes);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);}
    function text(value,x,y,color='#9aafba',size=9,align='left'){ctx.font=`${Math.max(size,compact?8:10)}px Consolas,monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);ctx.textAlign='left';}

    // A pinned solar reference has its own clearly separated display scale.
    const rail=layout.localBounds.left,sp=points.sun,sr=radii.sun;
    ctx.save();
    glow(sp,sr,'#ed752d45',2.5);
    // Static illustrative corona: tapered streamers, not measured solar activity.
    for(let i=0;i<56;i++){
      const a=i*Math.PI*2/56,extent=sr*(1.22+.42*(.5+.5*Math.sin(i*7.13))),spread=.012+.009*(i%3);
      const g=ctx.createRadialGradient(...sp,sr*.96,...sp,extent);g.addColorStop(0,'#ffd28f60');g.addColorStop(.45,'#f2a54d25');g.addColorStop(1,'#ed752d00');ctx.fillStyle=g;
      ctx.beginPath();ctx.moveTo(sp[0]+Math.cos(a-spread)*sr*.96,sp[1]+Math.sin(a-spread)*sr*.96);ctx.lineTo(sp[0]+Math.cos(a)*extent,sp[1]+Math.sin(a)*extent);ctx.lineTo(sp[0]+Math.cos(a+spread)*sr*.96,sp[1]+Math.sin(a+spread)*sr*.96);ctx.closePath();ctx.fill();
    }
    ctx.drawImage(sunDisk(),sp[0]-sr,sp[1]-sr,sr*2,sr*2);
    if(selected==='sun'){ctx.strokeStyle='#f9dda6';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...sp,sr+7,0,Math.PI*2);ctx.stroke();}
    text('SUN',sp[0],sp[1]-sr-22,'#ffe5b2',compact?12:15,'center');
    text('Solar reference',sp[0],sp[1]-sr-6,'#c6b18e',8,'center');
    text((SystemModel.magnitude(sun)/1e6).toFixed(3),sp[0],sp[1]+sr+29,'#ffe0a1',compact?12:17,'center');
    text('million km',sp[0],sp[1]+sr+46,'#c9bda8',8,'center');
    text('from Earth',sp[0],sp[1]+sr+61,'#c9bda8',8,'center');
    text('Separate scale',sp[0],h-38,'#b4bfc7',8,'center');
    text('Fixed reference',sp[0],h-22,'#b4bfc7',8,'center');
    ctx.restore();
    const guide=SystemModel.orbitGuide(data.bodies.moon,epoch).map(project);
    if(paths) {
      // Translucent plane + circular guide anchor the Moon spatially to Earth.
      ctx.beginPath();guide.forEach((p,i)=>i?ctx.lineTo(...p.point):ctx.moveTo(...p.point));ctx.closePath();
      const plane=ctx.createRadialGradient(cx,cy,20,cx,cy,orbitRadius*1.25);plane.addColorStop(0,'#2b667b04');plane.addColorStop(.78,'#3c91ac09');plane.addColorStop(1,'#3c91ac18');ctx.fillStyle=plane;ctx.fill();
      for(let i=1;i<guide.length;i++)line(guide[i-1].point,guide[i].point,guide[i].depth<0?'#6796a039':'#88c2cc77',guide[i].depth<0?.8:1.2,guide[i].depth<0?[3,5]:[]);
      for(let i=0;i<guide.length-1;i+=12){const p=guide[i].point;line(p,[cx+(p[0]-cx)*1.035,cy+(p[1]-cy)*1.035],'#99c6ce55');}
      const rows=data.bodies.moon,drawTrack=past=>{
        ctx.beginPath();let started=false;
        for(const row of rows){if(past&&row.time>epoch)break;const p=project(row.position).point;if(started)ctx.lineTo(...p);else{ctx.moveTo(...p);started=true;}}
        if(past&&started)ctx.lineTo(...mp.point);
        ctx.strokeStyle=past?'#c5ffe4':'#83c9b8';ctx.lineWidth=past?3:2;ctx.setLineDash([]);
        ctx.shadowColor='#9ae8cf';ctx.shadowBlur=past?8:0;ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([]);
      };
      drawTrack(false);drawTrack(true);
      const first=project(rows[0].position).point;ctx.fillStyle='#a1d9c8';ctx.beginPath();ctx.arc(...first,2.4,0,Math.PI*2);ctx.fill();
      line([cx,cy],mp.point,'#a3d8d340',.8,[2,5]);
    }
    // An Earth-centered locator cross remains anchored even when paths are hidden.
    line([cx-10,cy],[cx+10,cy],'#a8c8d34a');line([cx,cy-10],[cx,cy+10],'#a8c8d34a');
    function drawPlanet(name) {
      const p=points[name],r=radii[name];
      if(name==='earth') {
        glow(p,r,'#4c9ada30',1.6);
        ctx.strokeStyle='#7bc8ff60';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(...p,r+1,0,Math.PI*2);ctx.stroke();
      }
      const illumination=name==='earth'?sunCamera:unit(camera(sun.map((v,i)=>v-moonVector[i])));
      const sprite=sphere(name,illumination,cameraYaw,tilt,epoch,layout.roll);
      ctx.save();ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.clip();
      ctx.fillStyle=name==='earth'?'#0b2536':'#333b40';ctx.fill();
      if(sprite)ctx.drawImage(sprite,p[0]-r,p[1]-r,r*2,r*2);
      ctx.restore();
      ctx.strokeStyle=name==='earth'?'#9fd6f050':'#bacbd03a';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.stroke();
      if(name===selected){ctx.strokeStyle='#f0d09b90';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(...p,r+7,0,Math.PI*2);ctx.stroke();}
    }
    if(mp.depth<0)drawPlanet('moon');drawPlanet('earth');
    if(paths){
      const earthDisk={point:points.earth,radius:radii.earth+2};
      for(const [track,color]of [[guide,'#91bac9'],[data.bodies.moon.map(r=>project(r.position)),'#b7f3d9']]){
        const segments=SystemModel.diskTrackSegments(track,earthDisk);
        for(const hidden of [true,false]){
          ctx.beginPath();let last=null;
          for(const segment of segments.filter(s=>s.hidden===hidden)){
            if(!last||Math.hypot(segment.a[0]-last[0],segment.a[1]-last[1])>.1)ctx.moveTo(...segment.a);
            ctx.lineTo(...segment.b);last=segment.b;
          }
          ctx.strokeStyle=hidden?color+'bb':color;ctx.lineWidth=hidden?1.1:1.7;ctx.setLineDash(hidden?[3,4]:[]);ctx.stroke();ctx.setLineDash([]);
        }
      }
    }
    if(mp.depth>=0)drawPlanet('moon');
    // Leaders and compact labels explain the hierarchy without covering surfaces.
    const earthLabel=[cx+radii.earth+14,cy+3];
    text('EARTH',...earthLabel,'#c4e5f2',10);text('ORIGIN',earthLabel[0],earthLabel[1]+15,'#708e9f',8);
    const side=mp.point[0]>cx?1:-1;
    const labelX=Math.max(rail+18,Math.min(w-18,mp.point[0]+side*(radii.moon+23)));
    const labelY=Math.max(minimalUI?56:90,Math.min(h-(minimalUI?50:100),mp.point[1]-radii.moon-20));
    const align=side>0?'left':'right',actualX=Math.max(rail+55,Math.min(w-70,labelX));
    line([mp.point[0]+side*radii.moon*.5,mp.point[1]-radii.moon*.8],[actualX,labelY+5],'#a8d7c35c');
    text('MOON',actualX,labelY,'#d1e8dc',10,align);text(Math.round(range).toLocaleString()+' km',actualX,labelY+16,'#8db8b3',9,align);
    if(!minimalUI){
    text(compact?'EARTH–MOON':'EARTH–MOON DETAIL',rail+18,50,'#d7e6e9',compact?12:15);
    text('Drag freely · horizontal + vertical',rail+18,68,'#7d9aa9',8);
    
    const legendY=h-50,legendX=rail+16;
    if(paths){line([legendX,legendY],[legendX+18,legendY],'#b9efdb',2);text(`${Math.round((data.bodies.moon.at(-1).time-data.bodies.moon[0].time)/3600000)} h NASA track`,legendX+26,legendY+3,'#a4c5bd',8);}else text('Orbital guides hidden',legendX,legendY+3,'#829ea9',8);
    if(paths&&!compact){line([legendX+180,legendY],[legendX+200,legendY],'#8ac3cf77',1,[2,4]);text('Dashed: rear / hidden track',legendX+208,legendY+3,'#afc4ce',8);}
    text(compact?'Dashed = hidden track':'Camera rotates; NASA epoch advances with playback',rail+16,h-22,'#a4bbc6',compact?7:8);
    text('Enlarged bodies · approximate attitude',rail+16,h-10,'#a4bbc6',compact?7:8);
    }
    const barKm=100000,bar=barKm*layout.scale,bx=w-18-bar,by=h-62;
    line([bx,by],[w-18,by],'#c5d6df',1.5);line([bx,by-4],[bx,by+4],'#c5d6df');line([w-18,by-4],[w-18,by+4],'#c5d6df');
    text('100,000 km / projection',w-18,by-10,'#c5d6df',8,'right');
    return Object.fromEntries(Object.entries(points).map(([name,point])=>[name,{point,radius:radii[name]}]));
  }
  function sunDisk(){
    if(solarSprite)return solarSprite;
    const c=document.createElement('canvas');c.width=c.height=256;
    const x=c.getContext('2d'),im=x.createImageData(256,256);
    const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
    const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return (hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx)*(1-sy)+(hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx)*sy;};
    for(let y=0;y<256;y++)for(let xx=0;xx<256;xx++){
      const nx=(xx-127.5)/128,ny=(y-127.5)/128,r2=nx*nx+ny*ny;if(r2>1)continue;
      const granules=.965+.055*(noise(xx/4,y/4)-.5)+.025*(hash(xx,y)-.5),mu=Math.sqrt(1-r2),shade=(.70+.30*mu)*granules,i=(y*256+xx)*4;
      im.data[i]=255*shade;im.data[i+1]=(157+72*mu)*shade;im.data[i+2]=(46+110*mu)*shade;im.data[i+3]=Math.min(1,(1-r2)*128)*255;
    }
    x.putImageData(im,0,0);solarSprite=c;return c;
  }
  function renderSolar({ctx,w,h,sun,moonVector,layout,compact}){
    const {earth:e,sun:s,moon:m}=layout.points,scale=layout.scale;
    const text=(value,x,y,color='#c4d5df',size=11,align='left')=>{ctx.font=`${size}px system-ui`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);ctx.textAlign='left';};
    const line=(a,b,color='#4c6471')=>{ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
    text('SUN–EARTH DISTANCE',20,50,'#e5edf0',compact?13:18);
    text('Linear range view · NASA geometric vectors',20,74,'#a9bfcb',compact?10:12);
    line(s,e,'#9fb8c4');
    for(let km=0;km<=150e6;km+=50e6){const x=e[0]-km*scale;line([x,e[1]-7],[x,e[1]+7]);text(String(km/1e6)+'M km',x,e[1]+36,'#a9bfcb',10,'center');}
    // Icons identify bodies. Their centers, not their drawn disk edges, encode
    // distance. Moon separation on the same scale is deliberately not magnified.
    for(const [name,p,r,color]of [['sun',s,compact?15:22,'#f6cd7b'],['earth',e,compact?9:12,'#82b6d2']]){
      ctx.fillStyle='#080e16';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      line([p[0]-3,p[1]],[p[0]+3,p[1]],color);line([p[0],p[1]-3],[p[0],p[1]+3],color);
      text(name.toUpperCase(),p[0],p[1]-r-18,color,11,'center');
    }
    const projectedKm=moonVector.reduce((sum,v,i)=>sum+v*sun[i]/SystemModel.magnitude(sun),0);
    const separation=Math.abs(projectedKm)*scale;
    ctx.fillStyle='#cde9d9';ctx.fillRect(m[0]-1,m[1]-2,2,4);
    const solarRange=(SystemModel.magnitude(sun)/1e6).toFixed(3);
    const y=Math.min(h-110,e[1]+94);
    text('Earth–Sun '+solarRange+' million km',w/2,y,'#f2d297',compact?12:17,'center');
    text('Earth–Moon '+Math.round(SystemModel.magnitude(moonVector)).toLocaleString()+' km',w/2,y+27,'#cce7dc',compact?11:14,'center');
    text('Lunar separation projects to '+separation.toFixed(2)+' px at this scale.',w/2,y+55,'#a9bfcb',compact?9:11,'center');
    text('Use Earth–Moon detail to resolve the Moon.',w/2,y+73,'#a9bfcb',compact?9:11,'center');
    text('Body markers enlarged · same km/pixel for all positions',20,h-24,'#a9bfcb',compact?9:11);
    return {sun:{point:s,radius:compact?15:22},earth:{point:e,radius:compact?9:12}};
  }
  window.SeleneSystemRenderer={render};
})();
