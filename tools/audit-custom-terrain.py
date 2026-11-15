"""Independent Python reconstruction of custom skylines from the retained PDS raster.

No packages or downloads. Node calculates production outputs; this audit uses
Rodrigues rotations, the PDS trigonometric projection, and Cartesian sightlines.
"""
import hashlib,json,math,mmap,pathlib,struct,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=1737400.; RAD=math.pi/180
SITES=[(-87.25,37.5),(-85,-120),(-90,45),(-89.9999999,179.999),(-83,45),(-84,0)]
node=sys.argv[1] if len(sys.argv)>1 else 'node'
script="""const E=require('./terrain-extractor.cjs'),g=E.readSource(process.cwd());
const sites=JSON.parse(process.argv[1]);console.log(JSON.stringify(sites.map(([lat,lon])=>{
const r=E.extract(g,{lat,lon,rehearsal:true});return {profile:r.profile,mesh:r.rehearsal.mesh.heights_mm.filter((_,i)=>i%97===0),rays:r.rehearsal.rays_mm.filter((_,i)=>i%17===0).map(a=>a.filter((_,i)=>i%19===0))};})));"""
outputs=json.loads(subprocess.check_output([node,'-e',script,json.dumps(SITES)],cwd=ROOT,text=True,timeout=30))
cross=lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
def frame(lat,lon):
 p,l=lat*RAD,lon*RAD
 return (math.cos(p)*math.cos(l),math.cos(p)*math.sin(l),math.sin(p)),(-math.sin(p)*math.cos(l),-math.sin(p)*math.sin(l),math.cos(p)),(-math.sin(l),math.cos(l),0)
def travel(up,north,east,az,d):
 tangent=tuple(n*math.cos(az*RAD)+e*math.sin(az*RAD) for n,e in zip(north,east))
 axis=cross(up,tangent);w=cross(axis,up);c,s=math.cos(d/R),math.sin(d/R)
 return tuple(u*c+v*s+k*dot(axis,up)*(1-c) for u,v,k in zip(up,w,axis))
def xy(u):
 lat=math.atan2(u[2],math.hypot(u[0],u[1]));lon=math.atan2(u[1],u[0]);rho=2*R*math.tan(math.pi/4+lat/2)
 return 3799.5+rho*math.sin(lon)/80,3799.5-rho*math.cos(lon)/80
raw=ROOT/'data/terrain-source/LDEM_80S_80M.IMG'
assert hashlib.sha256(raw.read_bytes()).hexdigest()=='e6591eeea35402ca5e124ca00f5bf0774381a2d4fa919144b455d82b8ff65fdc'
checks=[];sample_count=0
with raw.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as grid:
 def height(u):
  x,y=xy(u);ix,iy=math.floor(x),math.floor(y);assert 0<=ix<7599 and 0<=iy<7599
  fx,fy=x-ix,y-iy;v=[struct.unpack_from('<h',grid,2*((iy+j)*7600+ix+i))[0]*.5 for j in (0,1) for i in (0,1)]
  assert all(abs(z)<15000 for z in v)
  return (v[0]*(1-fx)+v[1]*fx)*(1-fy)+(v[2]*(1-fx)+v[3]*fx)*fy
 for site,out in zip(SITES,outputs):
  up,north,east=frame(*site);ground=height(up);p=out['profile'];assert abs(ground-p['ground_height_m'])<1e-7
  largest=0;ray_error=0;mesh_error=0
  for az in range(360):
   maximum=-90;best=None
   for i,d in enumerate(range(80,100001,80)):
    u=travel(up,north,east,az,d);h=height(u)
    sight=tuple((R+h)*v-(R+ground+2)*o for v,o in zip(u,up))
    el=math.atan2(dot(sight,up),math.hypot(dot(sight,north),dot(sight,east)))/RAD
    if el>maximum:maximum=el;best=d
    if az%17==0 and i%19==0:ray_error=max(ray_error,abs(h-out['rays'][az//17][i//19]/1000))
    sample_count+=1
   largest=max(largest,abs(max(0,maximum)-p['bins'][az]['el']));assert best==p['bins'][az]['distance_m']
  for i,mm in enumerate(out['mesh']):
   k=i*97;n=(k//241)*160-19200;e=(k%241)*160-19200
   mesh_error=max(mesh_error,abs(height(travel(up,north,east,math.atan2(e,n)/RAD,math.hypot(e,n)))-mm/1000))
  assert largest<1e-6 and ray_error<=.000501 and mesh_error<=.000501
  checks.append({'lat':site[0],'lon':site[1],'maximum_horizon_difference_deg':largest,'all_360_blocking_ranges_match':True,'max_ray_height_difference_m':ray_error,'max_mesh_height_difference_m':mesh_error})
  print(json.dumps(checks[-1]),flush=True)
report={'method':'Independent Python Rodrigues travel / PDS trigonometric projection / Cartesian sightline','source_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'full_radial_samples_checked':sample_count,'checks':checks,'limitation':'Independent implementation of the same DEM, not independent ground truth or accuracy certification.'}
(ROOT/'qa-review/custom-terrain-independent-audit.json').write_text(json.dumps(report,indent=2))
