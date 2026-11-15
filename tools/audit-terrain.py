"""Independent Cartesian reconstruction of every retained skyline bin.

Uses the retained PDS raster, but neither the generator's projection, great-circle
destination function nor elevation formula. Bounded: 4 x 360 x 1250 samples.
This checks implementation consistency, not independent DEM accuracy.
"""
import hashlib, json, math, mmap, pathlib, struct

ROOT = pathlib.Path(__file__).resolve().parents[1]
R = 1737400.0

def audit():
    bundle = json.loads((ROOT / 'data/terrain-horizons.json').read_text())
    report = {'method': 'Independent Cartesian ray and local-basis reconstruction',
              'source_sha256': bundle['sha256'], 'profiles': []}
    source = ROOT / 'data/terrain-source/LDEM_80S_80M.IMG'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == bundle['sha256']
    with source.open('rb') as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as grid:
        def height(u):
            # South polar stereographic from a unit body-fixed Cartesian vector.
            x = 3799.5 + (2 * R / 80) * u[1] / (1-u[2])
            y = 3799.5 - (2 * R / 80) * u[0] / (1-u[2])
            ix, iy = math.floor(x), math.floor(y)
            assert 0 <= ix < 7599 and 0 <= iy < 7599
            z = [struct.unpack_from('<h', grid, 2*((iy+j)*7600+ix+i))[0] / 2
                 for j in (0, 1) for i in (0, 1)]
            dx, dy = x-ix, y-iy
            return z[0]*(1-dx)*(1-dy)+z[1]*dx*(1-dy)+z[2]*(1-dx)*dy+z[3]*dx*dy
        for p in bundle['profiles']:
            lat, lon = math.radians(p['lat']), math.radians(p['lon'])
            up = (math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat))
            north = (-math.sin(lat)*math.cos(lon), -math.sin(lat)*math.sin(lon), math.cos(lat))
            east = (-math.sin(lon), math.cos(lon), 0)
            observer_radius = R+height(up)+2
            errors, range_mismatches = [], 0
            for b in p['bins']:
                az = math.radians(b['az'])
                tangent = tuple(north[k]*math.cos(az)+east[k]*math.sin(az) for k in range(3))
                best, blocking_range = -90, None
                for distance in range(80, 100001, 80):
                    d = distance/R
                    u = tuple(up[k]*math.cos(d)+tangent[k]*math.sin(d) for k in range(3))
                    radius = R+height(u)
                    ray = tuple(radius*u[k]-observer_radius*up[k] for k in range(3))
                    vertical = sum(ray[k]*up[k] for k in range(3))
                    northward = sum(ray[k]*north[k] for k in range(3))
                    eastward = sum(ray[k]*east[k] for k in range(3))
                    angle = math.degrees(math.atan2(vertical, math.hypot(northward, eastward)))
                    if angle > best:
                        best, blocking_range = angle, distance
                errors.append(abs(max(0, best)-b['el']))
                range_mismatches += blocking_range != b['distance_m']
            item = {'lat': p['lat'], 'lon': p['lon'], 'bins': len(errors),
                    'max_elevation_error_deg': max(errors), 'blocking_range_mismatches': range_mismatches}
            print(json.dumps(item), flush=True)
            assert max(errors) < 0.000006, item
            assert range_mismatches == 0, item
            report['profiles'].append(item)
    out = ROOT / 'terrain-numerical-audit.json'
    out.write_text(json.dumps(report, indent=2)+'\n')
    print('All 1440 retained bins agree within stored rounding; report:', out)

if __name__ == '__main__':
    audit()
