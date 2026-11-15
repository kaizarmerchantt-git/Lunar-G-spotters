"""Bounded standard-library extraction from retained LOLA; no downloads.
Four 241-square patches and 360 x 1250 radial samples per coordinate.
"""
import hashlib,json,pathlib,math,mmap,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=1737400.
def destination(lat,lon,az,distance):
 p,l,a,d=math.radians(lat),math.radians(lon),math.radians(az),distance/R
 q=math.asin(max(-1,min(1,math.sin(p)*math.cos(d)+math.cos(p)*math.sin(d)*math.cos(a))))
 v=l+math.atan2(math.sin(a)*math.sin(d)*math.cos(p),math.cos(d)-math.sin(p)*math.sin(q))
 return q,v

def build():
 source=ROOT/'data/terrain-source/LDEM_80S_80M.IMG'
 bundle=json.loads((ROOT/'data/terrain-horizons.json').read_text())
 assert source.stat().st_size==7600*7600*2
 assert hashlib.sha256(source.read_bytes()).hexdigest()==bundle['sha256']
 report=[]
 with source.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as grid:
  def sample(p,l):
   rho=2*R*math.tan(math.pi/4+p/2);x,y=3799.5+rho*math.sin(l)/80,3799.5-rho*math.cos(l)/80
   ix,iy=math.floor(x),math.floor(y);fx,fy=x-ix,y-iy
   if not(0<=ix<7599 and 0<=iy<7599):raise ValueError('Outside DEM')
   vs=[struct.unpack_from('<h',grid,2*((iy+j)*7600+ix+i))[0]*.5 for j in (0,1) for i in (0,1)]
   if any(abs(v)>=15000 for v in vs):raise ValueError('Invalid DEM cell')
   return (vs[0]*(1-fx)+vs[1]*fx)*(1-fy)+(vs[2]*(1-fx)+vs[3]*fx)*fy
  for i,p in enumerate(bundle['profiles']):
   lat,lon=p['lat'],p['lon'];ground=sample(*map(math.radians,(lat,lon)))
   patch=[round(sample(*destination(lat,lon,math.degrees(math.atan2(e,n)),math.hypot(e,n)))*1000) for n in range(-19200,19201,160) for e in range(-19200,19201,160)]
   rays=[];error=0
   for az in range(360):
    ray=[];maximum=-90
    for distance in range(80,100001,80):
     mm=round(sample(*destination(lat,lon,az,distance))*1000);ray.append(mm);d=distance/R
     el=math.degrees(math.atan2((R+mm/1000)*math.cos(d)-(R+ground+2),(R+mm/1000)*math.sin(d)))
     maximum=max(maximum,el)
    error=max(error,abs(max(0,maximum)-p['bins'][az]['el']));rays.append(ray)
   assert error<.0008
   data={'schema':'selene-rehearsal-v1','source_sha256':bundle['sha256'],'label_sha256':bundle['label_sha256'],'site':{'lat':lat,'lon':lon},'radius_m':R,'ground_height_m':ground,'observer_height_m':2,'height_unit_m':.001,'radial_step_m':80,'range_m':100000,'azimuth_step_deg':1,'mesh':{'size':241,'step_m':160,'half_extent_m':19200,'order':'row north ascending; column east ascending','heights_mm':patch},'rays_mm':rays}
   path=ROOT/f'data/terrain-rehearsal-{i}.json';path.write_text(json.dumps(data,separators=(',',':')))
   report.append({'file':path.name,'bytes':path.stat().st_size,'max_horizon_difference_deg':error,'mesh_vertices':241**2,'ray_samples':360*1250});print(json.dumps(report[-1]),flush=True)
 (ROOT/'rehearsal-build-check.json').write_text(json.dumps({'source_sha256':bundle['sha256'],'profiles':report},indent=2))
if __name__=='__main__':build()
