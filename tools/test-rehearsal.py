"""Independent Cartesian sampling audit of packaged rehearsal patches/sections."""
import hashlib,json,math,mmap,pathlib,struct,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=1737400.
class RehearsalSource(unittest.TestCase):
 def test_packaged_samples_against_cartesian_dem_projection(self):
  source=ROOT/'data/terrain-source/LDEM_80S_80M.IMG';sha=hashlib.sha256(source.read_bytes()).hexdigest();count=0;maximum=0
  with source.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as grid:
   for site_index in range(4):
    d=json.loads((ROOT/f'data/terrain-rehearsal-{site_index}.json').read_text());self.assertEqual(d['source_sha256'],sha)
    p,l=map(math.radians,(d['site']['lat'],d['site']['lon']));up=(math.cos(p)*math.cos(l),math.cos(p)*math.sin(l),math.sin(p));north=(-math.sin(p)*math.cos(l),-math.sin(p)*math.sin(l),math.cos(p));east=(-math.sin(l),math.cos(l),0)
    def sample(e,n):
     distance=math.hypot(e,n);theta=distance/R;direction=[(east[k]*e+north[k]*n)/distance if distance else 0 for k in range(3)]
     u=[up[k]*math.cos(theta)+direction[k]*math.sin(theta) for k in range(3)]
     x=3799.5+(2*R/80)*u[1]/(1-u[2]);y=3799.5-(2*R/80)*u[0]/(1-u[2]);ix,iy=math.floor(x),math.floor(y);fx,fy=x-ix,y-iy
     self.assertTrue(0<=ix<7599 and 0<=iy<7599)
     v=[struct.unpack_from('<h',grid,2*((iy+j)*7600+ix+i))[0]/2 for j in (0,1) for i in (0,1)]
     return v[0]*(1-fx)*(1-fy)+v[1]*fx*(1-fy)+v[2]*(1-fx)*fy+v[3]*fx*fy
    self.assertAlmostEqual(sample(0,0),d['ground_height_m'],places=6)
    m=d['mesh'];indices=set(range(0,241**2,37))|{0,240,241*240,241**2-1,120*241+120}
    checks=[(i%241*160-19200,i//241*160-19200,m['heights_mm'][i]/1000) for i in sorted(indices)]
    for az in range(360):
     for j in (0,1,2,9,99,624,1249):
      distance=(j+1)*80;a=math.radians(az);checks.append((distance*math.sin(a),distance*math.cos(a),d['rays_mm'][az][j]/1000))
    for e,n,stored in checks:
     error=abs(sample(e,n)-stored);maximum=max(maximum,error);count+=1;self.assertLess(error,.000501)
  report={'checked_vertices_and_ray_samples':count,'max_height_rounding_error_m':maximum,'source_sha256':sha,'method':'Independent body-fixed Cartesian directions and polar projection; deterministic mesh subsample plus seven distances on every ray. Same retained DEM, not independent terrain truth.'}
  print(json.dumps(report))
if __name__=='__main__':unittest.main()
