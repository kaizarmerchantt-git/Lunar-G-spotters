# SELENE: Mission Atlas & Lunar Observation Analysis

**NASA Space Apps Challenge 2026: Lunar Landing Site Navigator**  
**Team: Lunar G-Spotters**

### Team Contributors
* **ADITYA HALORNEKAR**
* **DEV KANWAR**
* **HARSH JOSHI**
* **KAIZAR MERCHANT**
* **PARAM TIWARI**
* **PRASHANT MAURYA**

---

## What is SELENE?

Near the lunar south pole, the Sun skims along the horizon and the Earth wobbles low in the sky. If you move your landing site by just a couple kilometers or shift your launch date by a few days, you can lose direct line of sight to Earth or end up in deep shadow behind an impact crater rim.

We built SELENE to make this trade-off fast, visual, and mathematically inspectable. It takes real NASA JPL Horizons ephemeris data and NASA LRO LOLA elevation maps to show you exactly when, where, and why the Sun or Earth drops below the horizon. 

Instead of showing pre-rendered marketing animations, SELENE calculates every line of sight step by step. You can see the actual ridge blocking your signal, inspect the raw numbers, and compare different mission landing sites side by side.

---

## Key Features

* **3D CLPS Mission Atlas**: Browse historical Commercial Lunar Payload Services missions (including Odysseus IM-1, Athena IM-2, and Blue Ghost 1) on an interactive 3D Moon mapped with NASA LRO mosaic data. Click any landed coordinate to pull it directly into the analysis workbench.
* **Topocentric Sky Dome & Horizon Compass**: See the apparent paths of the Sun and Earth from ground level at your chosen coordinates. Tracks real-time azimuth, elevation, and clearance margins.
* **LOLA Terrain Skyline Screening**: Pulls from the NASA LOLA south-polar digital elevation model (80 meters per pixel) to cast 360 rays out to 100 km, calculating your true physical skyline instead of assuming a flat plane.
* **3D Terrain Rehearsal**: Renders a local 38.4 km square 3D elevation patch around your landing site. Click anywhere on the terrain or spin the bearing ring to see the cross-section profile of the highest blocking ridge along that heading.
* **Sun-Earth-Moon System Scene**: An interactive view driven by cached NASA Horizons orbital state vectors for November to December 2026, featuring Earth rotation and depth-tested lunar orbit tracks.
* **Scenario Comparison Notebook**: Save multiple landing site ideas, vary horizon obstruction thresholds, and compare solar and Earth contact windows side by side. Exports clean CSV and JSON reports.
* **Custom Coordinate & CSV Ingestion**: Bring your own observation data or custom coordinates. Use the local server to query live NASA JPL Horizons ephemerides, or import `.selene.json` and standard CSV files.
* **Zero-Install Standalone Build**: Includes `SELENE.html` and `index.html`, which bundle all scripts, styles, textures, and reference datasets into self-contained offline files that run straight in your browser.

---

## A Concrete Example: Why Terrain Matters

Holding the date and coordinates fixed at **89.5° S, 0.0° E** across November 2026 (720 observation hours):

* **Flat-Horizon Reference**: 720.0 hours of sunlight (100%), 364.0 hours of Earth visibility (50.6%), and 364.0 hours of joint contact.
* **With Real LOLA Terrain**: Sunlight drops to **178.0 hours** (24.7%), Earth visibility drops to **284.0 hours** (39.4%), and joint contact drops to just **134.0 hours** (18.6%). The longest continuous Earth blackout jumps from 356 hours to 392 hours.

Terrain completely rewrites your mission timeline, and SELENE shows you the exact terrain ridge responsible.

---

## Quick Start

### Option 1: Double-Click (Offline Standalone)
No installation required. Double-click `SELENE.html` or `index.html` in your browser. The bundled offline reference datasets, 3D globe, and terrain profiles will work immediately.

### Option 2: Run the Local Server (For Live NASA Queries & Custom DEM Extraction)

**Prerequisites**: Node.js v18.0.0 or newer. No `npm install` needed. All vendor libraries (Three.js 0.186.1) and microservices use local files and the Node standard library.

**On Windows**:
Double-click `Start-SELENE.bat`, or run in PowerShell:
```powershell
.\Start-SELENE.ps1
```

**Using Node / npm**:
```bash
npm start
# or:
node server/server.cjs
```
Then open `http://127.0.0.1:4173/` in your browser.

---

## Automated Verification & Tests

We wrote an extensive test suite covering coordinate math, Horizons parser verification, PDS projection logic, and terrain raycasting.

Run the test suite:
```bash
npm test
# or:
node tests/verify-all.cjs
```

If you have the full 115 MB LOLA DEM raster present in `data/terrain-source/`, test the worker thread extractor:
```bash
npm run test:terrain
```

You can also run our independent Python verification scripts:
```bash
python tools/test-terrain.py
python tools/test-rehearsal.py
```

---

## Project Structure

```
selene/
├── src/                      # Frontend JavaScript modules
│   ├── app.js                # Core app controller and dataset loader
│   ├── explorer-math.js      # Orthonormal lunar reference frames and vector projection
│   ├── globe.js              # Three.js 3D lunar globe with LRO texture
│   ├── lunar-explorer.js     # Topocentric surface camera and local sky views
│   ├── mission-atlas.js      # CLPS mission directory and 3D landing site pins
│   ├── model.js              # Ephemeris evaluator and interval-weighted math
│   ├── notebook-ui.js        # Multi-scenario comparison notebook
│   ├── rehearsal-model.js    # 3D terrain patch math and ridge locator
│   ├── system-renderer.js    # 2D canvas orbital Sun-Earth-Moon view
│   ├── terrain-model.js      # 360-degree skyline interpolation and cutoff math
│   └── terrain-rehearsal.js  # Interactive 3D LOLA relief renderer
├── styles/                   # Modular CSS stylesheets
├── server/                   # Zero-dependency local Node.js server
│   ├── server.cjs            # HTTP static and API router (port 4173)
│   ├── observer-service.cjs  # NASA JPL Horizons proxy with disk cache
│   ├── terrain-service.cjs   # Thread pool and request coalescing for DEM queries
│   ├── terrain-extractor.cjs # Polar stereographic LOLA DEM raycaster
│   └── build-html.cjs        # Standalone single-file HTML bundler
├── data/                     # Ephemeris tables, mission records, and terrain data
│   └── terrain-source/       # NASA PDS label and map projection files
├── assets/                   # LRO 2K lunar map, bump maps, and Blue Marble textures
├── vendor/three/             # Three.js r186.1 and OrbitControls (MIT)
├── tests/                    # 26 automated unit, integration, and load tests
├── tools/                    # Python verification tools and numerical checks
├── test-data/                # Sample NASA CSV ephemerides and .selene.json fixtures
├── SELENE.html               # Compiled standalone offline single-file build
├── index.html                # Standalone preview file
├── Start-SELENE.bat          # 1-click Windows launcher
└── LICENSE                   # MIT License
```

---

## Custom Terrain DEM Setup (Optional)

The repository comes pre-bundled with 4 reference south-polar terrain profiles (`data/terrain-horizons.json` and `data/terrain-rehearsal-*.json`).

To calculate custom skylines for any arbitrary coordinate in the south-polar region:
1. Download the official NASA LOLA south-polar DEM grid:
   * **URL**: [LDEM_80S_80M.IMG](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG) (115.5 MB)
   * **SHA-256**: `e6591eeea35402ca5e124ca00f5bf0774381a2d4fa919144b455d82b8ff65fdc`
2. Drop `LDEM_80S_80M.IMG` into `data/terrain-source/` beside `LDEM_80S_80M.LBL`.
3. Start the local server (`npm start`).

*(Note: `LDEM_80S_80M.IMG` is excluded in `.gitignore` so you do not accidentally exceed GitHub's 100 MB file limit).*

---

## Technical Notes & Limitations

* **Coordinate Frame**: Planetocentric latitude (positive North) and longitude (positive East) in the lunar mean-Earth/polar axis (DE421) frame. Reference lunar radius is 1,737,400 meters, with the local observer placed 2 meters above ground elevation.
* **Duration Calculations**: Durations strictly evaluate left-endpoint interval states ($[t_i, t_{i+1})$). We do not invent imaginary crossing points between discrete sample steps.
* **Engineering Scope**: SELENE calculates geometric line-of-sight visibility for celestial body centers. It is an early-stage screening tool and does not calculate solar cell electrical power, radio frequency link budgets, or thermal transfer.

---

## NASA Data Sources & Credits

* **NASA JPL Horizons**: Apparent airless topocentric ephemerides and geometric state vectors ([ssd.jpl.nasa.gov](https://ssd.jpl.nasa.gov/))
* **NASA LRO LOLA Science Team**: South Polar Digital Elevation Model (LDEM_80S_80M V2.0) ([imbrium.mit.edu](https://imbrium.mit.edu/))
* **NASA GSFC Scientific Visualization Studio**: CGI Moon Kit visual mosaic and displacement maps ([svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720/))
* **NASA Earth Observatory**: Global Blue Marble texture ([earthobservatory.nasa.gov](https://earthobservatory.nasa.gov/))
* **NASA NSSDCA**: Sourced coordinates and mission reports for landed CLPS spacecraft ([nssdc.gsfc.nasa.gov](https://nssdc.gsfc.nasa.gov/))
* **Three.js**: WebGL 3D rendering library under MIT license ([github.com/mrdoob/three.js](https://github.com/mrdoob/three.js))

---

## License

Original code and documentation are released under the [MIT License](LICENSE).
