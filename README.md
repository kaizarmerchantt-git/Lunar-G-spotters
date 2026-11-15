# SELENE: Mission Atlas and Lunar Observation Analysis

**NASA Space Apps Challenge 2026: Lunar Landing Site Navigator**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r186.1-blue.svg)](vendor/three/)

## Overview

SELENE is a web-based mission atlas and lunar observation workspace for evaluating solar illumination and direct-to-Earth (DTE) line-of-sight visibility at lunar surface coordinates, with a focus on the lunar south pole.

### Features

* **3D Mission Atlas:** Global LRO WAC lunar globe with NASA LOLA display relief, a searchable Commercial Lunar Payload Services (CLPS) mission directory, published landing site pins, and coordinate handoff into the analysis workspace.
* **Sun-Earth-Moon Orbital View:** Interactive orbital scene driven by 1,442 cached NASA JPL Horizons geometric vectors for November to December 2026.
* **Local Horizon and Sky Compass:** 360-degree topocentric sky projection, elevation plots over time, and apparent Sun and Earth angles including light-time and aberration corrections.
* **LOLA Terrain Screening:** Horizon obstruction profiles extracted from the NASA LRO LOLA LDEM_80S_80M V2.0 south-polar digital elevation model (80 m/pixel grid) out to 100 km range.
* **3D Terrain Rehearsal:** Local 3D relief patch with 1x and 5x vertical scale controls, bearing selection, and radial cross-section profiles showing the highest blocking ridge along any azimuth.
* **Comparison Notebook:** Side-by-side scenario comparison stored in browser local storage, with CSV and JSON report exports.
* **Custom Geometry Import:** Import custom azimuth/elevation CSV tables or `.selene.json` observation files with source provenance and observer coordinates.
* **Standalone Portable File (`SELENE.html`):** Single-file build containing all scripts, stylesheets, textures, reference ephemerides, and precomputed terrain meshes for offline use.

## Quick Start

### Prerequisites
* **Node.js** v18.0.0 or newer ([nodejs.org](https://nodejs.org/))
* No external `npm install` step is needed. The local server uses the Node.js standard library and the bundled Three.js modules in `vendor/three/`.

### Run Locally

#### Windows Launcher
Double-click `Start-SELENE.bat` or run in PowerShell:
```powershell
.\Start-SELENE.ps1
```

#### Node / NPM
```bash
npm start
# or:
node server/server.cjs
```

Then open `http://127.0.0.1:4173/` in your browser.

## Standalone Offline Build (`SELENE.html`)

`SELENE.html` can be opened directly in a browser without running the local server. It includes the four reference observation windows, the CLPS mission catalogue, and the four precomputed south-polar terrain profiles.

To rebuild `SELENE.html` from `src/` and `styles/`:
```bash
npm run build:html
```

## Running Tests

Run the verification suite:
```bash
npm test
# or:
node tests/verify-all.cjs
```

If the full LOLA DEM file (`data/terrain-source/LDEM_80S_80M.IMG`) is present locally, you can also run the DEM extractor and worker service tests:
```bash
npm run test:terrain
```

## Repository Structure

```
selene/
├── src/                          # Frontend application modules
│   ├── index.html                # Main HTML entry point
│   ├── app.js                    # State coordinator and dataset loader
│   ├── lunar-explorer.js         # Three.js lunar globe and local sky view
│   ├── mission-atlas.js          # CLPS mission directory and 3D globe
│   ├── system-renderer.js        # 2D canvas Sun-Earth-Moon renderer
│   ├── system-scene.js           # Orbital camera and timeline controls
│   ├── terrain-ui.js             # LOLA skyline chart and metrics panel
│   ├── terrain-rehearsal.js      # 3D terrain mesh and radial section view
│   ├── notebook-ui.js            # Scenario comparison notebook UI
│   └── model.js                  # Visibility interval and duration calculations
├── styles/                       # CSS stylesheets
├── server/                       # Local HTTP server and worker scripts
│   ├── server.cjs                # Static file and API server (port 4173)
│   ├── observer-service.cjs      # NASA JPL Horizons query and cache handler
│   ├── terrain-service.cjs       # Custom-coordinate LOLA extraction service
│   ├── terrain-extractor.cjs     # Polar stereographic DEM ray sampler
│   └── build-html.cjs            # Standalone SELENE.html bundler
├── data/                         # Ephemeris tables, mission catalogue, and terrain profiles
├── assets/                       # Lunar and Earth surface textures
├── vendor/three/                 # Bundled Three.js 0.186.1 and OrbitControls
├── tests/                        # Automated unit and integration tests
├── tools/                        # Python DEM processing and verification scripts
├── legal-and-docs/               # Documentation, glossary, and data references
├── test-data/                    # Sample observation CSV and .selene.json fixtures
├── Start-SELENE.bat              # Windows batch launcher
├── Start-SELENE.ps1              # PowerShell launcher
├── SELENE.html                   # Standalone single-file offline build
├── index.html                    # Exact SELENE.html FILE for live site preview
└── LICENSE                       # MIT License
```

## Custom Coordinate Terrain Data (Optional)

The four reference south-polar terrain profiles are precomputed in `data/terrain-horizons.json` and `data/terrain-rehearsal-*.json`.

To compute terrain skylines for arbitrary custom south-polar coordinates via the local server:
1. Download the official NASA LOLA south-polar DEM file:
   * File: [LDEM_80S_80M.IMG](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG) (115.5 MB)
   * SHA-256: `e6591eeea35402ca5e124ca00f5bf0774381a2d4fa919144b455d82b8ff65fdc`
2. Place `LDEM_80S_80M.IMG` in `data/terrain-source/` next to `LDEM_80S_80M.LBL`.
3. Restart `node server/server.cjs`.

Note: `LDEM_80S_80M.IMG` exceeds GitHub's 100 MB per-file limit and is listed in `.gitignore`. The label and catalog files are tracked in `data/terrain-source/`.

## Conventions and Scope

* **Coordinates:** Planetocentric latitude (positive North) and longitude (positive East) in the lunar mean-Earth/polar axis (DE421) frame.
* **Reference Sphere:** Lunar radius $R = 1,737,400	ext{ m}$, with the observer positioned $2	ext{ m}$ above the local surface.
* **Ephemerides:** Apparent airless body-center azimuth and elevation from NASA JPL Horizons.
* **Scope:** Calculations evaluate geometric line-of-sight visibility. They do not model solar disk limb darkening, cast surface shadows, power generation, thermal loads, or RF link budgets.

## Data Sources and Credits

* **NASA / JPL Horizons:** Solar System Dynamics Group ([ssd.jpl.nasa.gov](https://ssd.jpl.nasa.gov/))
* **NASA / GSFC LRO LOLA Team:** Lunar Orbiter Laser Altimeter ([imbrium.mit.edu](https://imbrium.mit.edu/))
* **NASA SVS:** Scientific Visualization Studio CGI Moon Kit ([svs.gsfc.nasa.gov/4720](https://svs.gsfc.nasa.gov/4720/))
* **NASA Earth Observatory:** Blue Marble 2002 mosaic ([earthobservatory.nasa.gov](https://earthobservatory.nasa.gov/))
* **Three.js:** MIT License ([github.com/mrdoob/three.js](https://github.com/mrdoob/three.js))

## License

Released under the [MIT License](LICENSE).


#contributors; ADITYA HALORNEKAR; DEV KANWAR; HARSH JOSHI; KAIZAR MERCHANT; PARAM TIWARI; PRASHANT MAURYA.
