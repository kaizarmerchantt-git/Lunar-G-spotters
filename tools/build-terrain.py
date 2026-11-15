"""Bounded, standard-library LOLA skyline extraction. Run in .venv-terrain."""
import hashlib,json,math,mmap,pathlib,struct,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=1737400.; STEP=80.; LIMIT=100000.; N=7600
def project(lat,lon):
    rho=2*R*math.tan(math.pi/4+lat/2)
    return 3799.5+rho*math.sin(lon)/80,3799.5-rho*math.cos(lon)/80
def angle(height,observer,distance):
    d=distance/R
    return math.degrees(math.atan2((R+height)*math.cos(d)-(R+observer),(R+height)*math.sin(d)))
def build():
    source=ROOT/'data/terrain-source/LDEM_80S_80M.IMG'
    assert source.stat().st_size==N*N*2
    rawhash=hashlib.sha256(source.read_bytes()).hexdigest()
    profiles=[]
    with source.open('rb') as f, mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as grid:
        def sample(lat,lon):
            x,y=project(lat,lon); ix,iy=math.floor(x),math.floor(y);fx,fy=x-ix,y-iy
            if not (0<=ix<N-1 and 0<=iy<N-1):raise ValueError('DEM boundary')
            vals=[struct.unpack_from('<h',grid,2*((iy+j)*N+ix+i))[0]*.5 for j in range(2) for i in range(2)]
            if any(abs(v)>15000 for v in vals):raise ValueError('Invalid DEM value')
            return (vals[0]*(1-fx)+vals[1]*fx)*(1-fy)+(vals[2]*(1-fx)+vals[3]*fx)*fy
        for lat,lon in [(-89.5,0),(-88.5,90),(-89,180),(-84.7906,29.1957)]:
            p,l=map(math.radians,(lat,lon));h0=sample(p,l);bins=[]
            for az in range(360):
                a=math.radians(az);maximum=-90.;block=None
                for distance in range(80,100001,80):
                    d=distance/R
                    q=math.asin(math.sin(p)*math.cos(d)+math.cos(p)*math.sin(d)*math.cos(a))
                    v=l+math.atan2(math.sin(a)*math.sin(d)*math.cos(p),math.cos(d)-math.sin(p)*math.sin(q))
                    h=sample(q,v);e=angle(h,h0+2,distance)
                    if e>maximum:maximum=e;block=[distance,round(h,3)]
                bins.append({'az':az,'el':round(max(0,maximum),5),'distance_m':block[0],'height_m':block[1]})
            profiles.append({'lat':lat,'lon':lon,'ground_height_m':round(h0,3),'observer_height_m':2,'bins':bins})
            print('Computed',lat,lon,'max horizon',max(b['el'] for b in bins),flush=True)
    result={'schema':'selene-terrain-v1','source':'NASA LRO LOLA / PDS LDEM_80S_80M V2.0','url':'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG','label_url':'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.LBL','sha256':rawhash,'label_sha256':hashlib.sha256((ROOT/'data/terrain-source/LDEM_80S_80M.LBL').read_bytes()).hexdigest(),'frame':'MOON_ME / DE421; planetocentric; east longitude','radius_m':R,'pixel_m':80,'radial_step_m':80,'range_m':100000,'azimuth_step_deg':1,'floor_deg':0,'method':'Bilinear DEM; great-circle rays; spherical chord elevation; 2 m observer; zero-degree floor; unresolved terrain is not guaranteed conservative; circular linear azimuth interpolation','retrieved_date':'2026-11-13','profiles':profiles}
    (ROOT/'data/terrain-horizons.json').write_text(json.dumps(result,separators=(',',':')))
if __name__=='__main__':build()
