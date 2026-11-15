"""Bounded sensitivity check at actual Sun/Earth azimuths in the polar month.
Compare the shipped 1-degree skyline interpolation with direct DEM rays at
40 m radial spacing. Same 80 m raster, observer and 100 km range; not ground truth.
"""
import json, math, mmap, pathlib, struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
R=1737400.

def run():
    bundle=json.loads((ROOT/'data/terrain-horizons.json').read_text())
    window=next(d for d in json.loads((ROOT/'data/horizons.json').read_text())['datasets'] if d.get('featured'))
    profile=next(p for p in bundle['profiles'] if p['lat']==window['lat'] and p['lon']==window['lon'])
    lat,lon=math.radians(profile['lat']),math.radians(profile['lon'])
    up=(math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat))
    north=(-math.sin(lat)*math.cos(lon),-math.sin(lat)*math.sin(lon),math.cos(lat))
    east=(-math.sin(lon),math.cos(lon),0)
    out={'description':__doc__,'site':{'lat':profile['lat'],'lon':profile['lon']},'source_sha256':bundle['sha256'],'bodies':{}}
    with (ROOT/'data/terrain-source/LDEM_80S_80M.IMG').open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as grid:
        def height(u):
            x=3799.5+(2*R/80)*u[1]/(1-u[2]);y=3799.5-(2*R/80)*u[0]/(1-u[2])
            ix,iy=math.floor(x),math.floor(y);dx,dy=x-ix,y-iy
            assert 0<=ix<7599 and 0<=iy<7599
            z=[struct.unpack_from('<h',grid,2*((iy+j)*7600+ix+i))[0]/2 for j in (0,1) for i in (0,1)]
            return z[0]*(1-dx)*(1-dy)+z[1]*dx*(1-dy)+z[2]*(1-dx)*dy+z[3]*dx*dy
        observer=R+height(up)+2
        # Precompute radial trigonometry. 2 bodies x 721 rays x 2500 positions.
        radii=[(math.cos(d/R),math.sin(d/R)) for d in range(40,100001,40)]
        for body in ('sun','earth'):
            errors=[];direct_states=[];shipped_states=[]
            for row in window['rows']:
                az=row[body+'_az'];a=math.radians(az)
                tangent=tuple(north[k]*math.cos(a)+east[k]*math.sin(a) for k in range(3))
                best=0.
                for cd,sd in radii:
                    u=tuple(up[k]*cd+tangent[k]*sd for k in range(3))
                    radius=R+height(u)
                    angle=math.degrees(math.atan2(radius*cd-observer,radius*sd))
                    best=max(best,angle)
                i=math.floor(az);fraction=az-i
                shipped=profile['bins'][i]['el']*(1-fraction)+profile['bins'][(i+1)%360]['el']*fraction
                errors.append(shipped-best)
                direct_states.append(row[body+'_el']>best)
                shipped_states.append(row[body+'_el']>shipped)
            # This retained window is hourly; final row closes the window.
            result={'sample_count':len(errors),'max_absolute_cutoff_difference_deg':max(map(abs,errors)),
                    'rms_cutoff_difference_deg':math.sqrt(sum(e*e for e in errors)/len(errors)),
                    'shipped_visible_h':sum(shipped_states[:-1]),'direct_ray_visible_h':sum(direct_states[:-1]),
                    'disagreeing_interval_states':sum(a!=b for a,b in zip(shipped_states[:-1],direct_states[:-1]))}
            out['bodies'][body]=result
            print(body,json.dumps(result),flush=True)

if __name__=='__main__':run()
