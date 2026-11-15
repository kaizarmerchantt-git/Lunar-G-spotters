(function(root){
  'use strict';
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,label,max=2000)=>{
    if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('Invalid mission '+label+'.');
    return value.trim();
  };
  function safeURL(value){
    const raw=text(value,'source URL',2400);
    if(/[\u0000-\u001f\u007f]/.test(raw))throw new Error('Invalid mission source URL.');
    let url;try{url=new URL(raw);}catch{throw new Error('Invalid mission source URL.');}
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||url.port||!(host==='nasa.gov'||host.endsWith('.nasa.gov')))throw new Error('Mission sources must use NASA HTTPS URLs.');
    return url.href;
  }
  function date(value,label){
    const s=text(value,label,30);
    // Catalogue dates are calendar dates, not local-time instants.
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw new Error('Invalid mission '+label+'.');
    return s;
  }
  function coordinate(value){
    if(!plain(value)||!Number.isFinite(value.lat)||Math.abs(value.lat)>90||!Number.isFinite(value.lon)||Math.abs(value.lon)>180)throw new Error('Invalid mission coordinate.');
    const out={...value,lat:value.lat,lon:value.lon};
    if(value.kind!==undefined)out.kind=text(value.kind,'coordinate kind',100);
    if(value.note!==undefined)out.note=text(value.note,'coordinate note',1200);
    return out;
  }
  function normalize(value){
    const rows=Array.isArray(value)?value:plain(value)?value.missions:null;
    if(!Array.isArray(rows)||!rows.length||rows.length>100)throw new Error('Provide 1–100 mission records.');
    if(!Array.isArray(value)&&value.schemaVersion!==undefined&&value.schemaVersion!==1)throw new Error('Unsupported mission catalogue schema.');
    const ids=new Set();
    return rows.map(record=>{
      if(!plain(record))throw new Error('Invalid mission record.');
      const id=text(record.id,'ID',80);if(!/^[a-z0-9][a-z0-9-]*$/.test(id)||ids.has(id))throw new Error('Invalid or duplicate mission ID.');ids.add(id);
      const out={...record,id};
      for(const field of ['name','provider','lander','destination','status'])out[field]=text(record[field],field,200);
      for(const field of ['summary','payloads'])out[field]=text(record[field],field,2400);
      for(const field of ['shortName','taskOrder','coordinateType'])if(record[field]!==undefined)out[field]=text(record[field],field,200);
      out.checkedUtc=date(record.checkedUtc??(!Array.isArray(value)?value.checkedUtc:undefined),'checked date');
      out.sourceUrl=safeURL(record.sourceUrl);
      if(record.statusSourceUrl!==undefined)out.statusSourceUrl=safeURL(record.statusSourceUrl);
      if(record.statusDate!==undefined&&record.statusDate!==null)out.statusDate=date(record.statusDate,'status date');
      if(record.landingDate!==undefined&&record.landingDate!==null)out.landingDate=date(record.landingDate,'landing date');
      if(record.coordinate===null||record.coordinate===undefined){
        out.coordinate=null;
        if(record.coordinateSourceUrl!==null&&record.coordinateSourceUrl!==undefined)throw new Error('A coordinate source must accompany a published coordinate.');
        out.coordinateSourceUrl=null;
      }else{
        out.coordinate=coordinate(record.coordinate);
        out.coordinateSourceUrl=safeURL(record.coordinateSourceUrl);
      }
      return out;
    });
  }
  function point(lat,lon,r=1){
    coordinate({lat,lon});if(!Number.isFinite(r)||r<=0)throw new Error('Invalid globe radius.');
    const p=lat*Math.PI/180,l=lon*Math.PI/180;
    return [r*Math.cos(p)*Math.sin(l),r*Math.sin(p),r*Math.cos(p)*Math.cos(l)];
  }
  function visible(surfacePoint,camera,radius=1){
    if(!Array.isArray(surfacePoint)||surfacePoint.length!==3||!surfacePoint.every(Number.isFinite)||!Array.isArray(camera)||camera.length!==3||!camera.every(Number.isFinite)||!Number.isFinite(radius)||radius<=0)return false;
    const magnitude=Math.hypot(...surfacePoint);if(!magnitude||Math.hypot(...camera)<=radius)return false;
    // Test the base sphere's surface normal, not a raised marker's altitude.
    return surfacePoint.reduce((dot,x,i)=>dot+x/magnitude*camera[i],0)>radius+1e-10;
  }
  function declutter(candidates,width,height,gap=8){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
    if(!Array.isArray(candidates)||!Number.isFinite(gap)||gap<0)throw new Error('Invalid label layout input.');
    const prepared=candidates.map((c,index)=>({...c,index})).filter(c=>[c.x,c.y,c.width??c.w,c.height??c.h].every(Number.isFinite)&&(c.width??c.w)>0&&(c.height??c.h)>0&&(c.width??c.w)<=width&&(c.height??c.h)<=height);
    prepared.sort((a,b)=>Number(Boolean(b.selected))-Number(Boolean(a.selected))||(Number.isFinite(b.priority)?b.priority:0)-(Number.isFinite(a.priority)?a.priority:0)||a.index-b.index);
    const placed=[];
    for(const c of prepared){
      const w=c.width??c.w,h=c.height??c.h,x=Math.max(0,Math.min(width-w,c.x)),y=Math.max(0,Math.min(height-h,c.y));
      if(placed.some(p=>x<p.x+p.width+gap&&x+w+gap>p.x&&y<p.y+p.height+gap&&y+h+gap>p.y))continue;
      const {index,...candidate}=c;placed.push({...candidate,x,y,width:w,height:h,rect:{x,y,width:w,height:h}});
    }
    return placed;
  }
  function coordinateLabel(value){
    const c=coordinate(value),number=n=>Number(Math.abs(n).toFixed(4)).toString();
    return `${number(c.lat)}° ${c.lat<0?'S':'N'} / ${number(c.lon)}° ${c.lon<0?'W':'E'}`;
  }
  const api={normalize,point,visible,declutter,safeURL,coordinateLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SeleneAtlasModel=api;
})(typeof window!=='undefined'?window:globalThis);
