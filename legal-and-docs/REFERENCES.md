# SELENE references

## NASA data used in the application

1. NASA/JPL Horizons: observer ephemerides and geometric system vectors. https://ssd.jpl.nasa.gov/horizons/ · API: https://ssd.jpl.nasa.gov/api/horizons.api · methods: https://ssd.jpl.nasa.gov/horizons/manual.html . Retained response/query metadata and SHA-256 hashes are in data/. Apparent observer directions and geometric system vectors use different conventions.
2. NASA LRO LOLA / PDS LDEM_80S_80M V2.0: terrain elevation raster. https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG · label: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.LBL · projection catalogue: https://imbrium.mit.edu/CATALOG/DSMAP_POLAR.CAT . Retained source hash: e6591eeea35402ca5e124ca00f5bf0774381a2d4fa919144b455d82b8ff65fdc. Original raster is not included in the compact submission; source-derived extracts are included.
3. NASA/GSFC SVS CGI Moon Kit, Ernie Wright: lunar imagery and display bump. https://svs.gsfc.nasa.gov/4720/ . Exact URLs and hashes: assets/SOURCES.txt. Display imagery is not used to calculate terrain horizons.
4. NASA/GSFC SVS Blue Marble, Eric Sokolowsky; data courtesy Reto Stockli and NASA Earth Observatory. https://svs.gsfc.nasa.gov/2915/ . Historical Earth visual context; not live weather. Additional Earth image context: https://science.nasa.gov/resource/blue-marble-2002/ .
5. NASA CLPS: mission and location context. https://www.nasa.gov/commercial-lunar-payload-services/ · https://www.nasa.gov/commercial-lunar-payload-services/landing-sites/ . Exact mission-record URLs and dated claims: CLPS_MISSION_SOURCES.txt and data/clps-missions.json. Published destinations are distinguished from actual landing coordinates.
6. NASA NSSDCA lunar artifact/impact records: published landing coordinates. https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html .

## Challenge resources and contextual references

7. Official Lunar Landing Site Navigator challenge and Resources tab. https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/ .
8. QuickMap, ASU/LROC lunar mapping context: https://quickmap.lroc.asu.edu/ . Reference link, not the source of the packaged DEM extraction or an independent validation of our horizon.
9. NASA Moon Trek: https://trek.nasa.gov/moon/ . Reference link, not a completed independent cross-validation.
10. CSA Moon Exploration: https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ . Challenge context; no CSA measurement dataset is claimed as integrated.
11. NAIF SPICE and WebGeocalc: https://naif.jpl.nasa.gov/naif/toolkit.html · https://naif.jpl.nasa.gov/naif/webgeocalc.html . Background methods linked in the app; SELENE does not execute a local SPICE solution.

## Software and development tools

12. Three.js 0.186.1 and OrbitControls, MIT: https://github.com/mrdoob/three.js . Runtime files and license retained under vendor/three/.
13. JavaScript, HTML/CSS, browser Canvas/WebGL, Node.js and Python standard library. Python scripts process the source DEM and check geometry.

## Submission rules

14. Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/ .
15. Judging & Awards Guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/ .
16. Participant terms: https://www.spaceappschallenge.org/legal/ .
17. Cottbus event and preliminary schedule: https://www.spaceappschallenge.org/2026/local-events/cottbus/ · https://spacecottbus.com/ .
