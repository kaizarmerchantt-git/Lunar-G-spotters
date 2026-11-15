"""Numerical and source checks independent of the browser presentation."""
from pathlib import Path
import unittest,math,hashlib,json,struct,importlib.util
spec=importlib.util.spec_from_file_location('build_terrain',Path(__file__).with_name('build-terrain.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class TerrainTests(unittest.TestCase):
 def test_projection(self):
  self.assertAlmostEqual(b.project(-math.pi/2,0)[0],3799.5)
  self.assertAlmostEqual(b.project(-math.pi/2,0)[1],3799.5)
  self.assertLess(b.project(math.radians(-89),0)[1],3799.5)
  self.assertGreater(b.project(math.radians(-89),math.pi/2)[0],3799.5)
 def test_pds_pixel_registration_roundtrip(self):
  # PDS DSMAP_POLAR.CAT line/sample -> lat/lon equations, independently
  # including the one-based half-pixel registration and southern NS=-1.
  for lat,lon in [(-89.5,0),(-88.5,90),(-89,180),(-84.7906,29.1957),(-85,-120)]:
   col,row=b.project(math.radians(lat),math.radians(lon))
   x=(col+1-7600/2-.5)*80
   y=(row+1-7600/2-.5)*80*-1
   got_lat=-90+math.degrees(2*math.atan(math.hypot(x,y)/(2*1737400)))
   got_lon=math.degrees(math.atan2(x,y))
   self.assertAlmostEqual(got_lat,lat,places=10)
   self.assertAlmostEqual((got_lon-lon+180)%360-180,0,places=10)
 def test_sphere(self):
  # Same-radius targets: chord direction is exactly minus half central angle.
  for distance in [80,1000,100000]:
   self.assertAlmostEqual(b.angle(0,0,distance),-math.degrees(distance/b.R)/2,places=7)
 def test_ridge(self):
  # Independent Cartesian dot products against observer east/up basis.
  d=1000/b.R;target=[(b.R+100)*math.cos(d),(b.R+100)*math.sin(d),0]
  vector=[target[0]-(b.R+2),target[1],0]
  expected=math.degrees(math.atan2(vector[0],math.hypot(vector[1],vector[2])))
  self.assertAlmostEqual(b.angle(100,2,1000),expected,places=10)
  self.assertGreater(expected,5)
 def test_retained_source(self):
  data=json.loads((b.ROOT/'data/terrain-horizons.json').read_text());raw=b.ROOT/'data/terrain-source/LDEM_80S_80M.IMG'
  self.assertEqual(raw.stat().st_size,7600*7600*2)
  self.assertEqual(hashlib.sha256(raw.read_bytes()).hexdigest(),data['sha256'])
  label=(b.ROOT/'data/terrain-source/LDEM_80S_80M.LBL').read_bytes()
  self.assertEqual(hashlib.sha256(label).hexdigest(),data['label_sha256'])
  self.assertIn(b'SCALING_FACTOR        = 0.5',label)
  # Independent nearest-vertex convex bound for bilinear observer height.
  with raw.open('rb') as f:
   for p in data['profiles']:
    x,y=b.project(math.radians(p['lat']),math.radians(p['lon']));values=[]
    for j in [0,1]:
     for i in [0,1]:
      f.seek(2*((math.floor(y)+j)*7600+math.floor(x)+i));values.append(struct.unpack('<h',f.read(2))[0]*.5)
    self.assertGreaterEqual(p['ground_height_m'],min(values)-.001)
    self.assertLessEqual(p['ground_height_m'],max(values)+.001)
if __name__=='__main__':unittest.main()
