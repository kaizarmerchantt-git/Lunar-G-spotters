# Custom-coordinate LOLA terrain

SELENE calculates terrain for an entered lunar coordinate when its complete sampled footprint fits within the retained LOLA south-polar map. The four original profiles and their visuals remain available. This does not provide global lunar DEM coverage.

## Use it

1. Run `node server.cjs` and open http://127.0.0.1:4173/.
2. Use **New observation** to request NASA/JPL geometry for your latitude, east longitude and dates. Alternatively, import your CSV under **Data**, supplying the lunar observer coordinates and source conventions.
3. Open **Terrain study**. SELENE computes the skyline for that coordinate and checks coverage before displaying a result.
4. Open **terrain rehearsal** for the matching LOLA mesh and selectable radial sections. The observation clock, follow-Sun/Earth controls, margin, obstruction, local-horizon overlay and terrain exports use that same coordinate.

Example covered coordinates include −87.25°, 37.5°; −85°, −120°; and −83°, 45°. The coordinate −83°, 0° has a valid centre but its 100 km footprint leaves the raster and is rejected. Coverage depends on longitude because the source image is square. These are coverage examples, not recommended or certified landing sites.

Coordinates are planetocentric, east-positive, in the lunar mean-Earth/DE421 frame. At the exact south pole, the entered longitude specifies the reference meridian for north/azimuth zero. Imported directions must use the same convention; entering coordinates does not verify the supplied ephemerides.

## Method and safeguards

The source is NASA LRO LOLA/PDS LDEM_80S_80M V2.0: a 7,600 × 7,600 signed little-endian 16-bit grid, 0.5 m/DN, 80 m/pixel at the pole, with a 1,737,400 m reference sphere. Cartesian north/east/up vectors trace great-circle rays without singular longitude calculations at the pole. The polar stereographic registration uses zero-index centre 3799.5.

For each integer azimuth, every 80 m sample to 100 km is bilinearly sampled. The observer is 2 m above local DEM height. Apparent terrain elevation includes spherical curvature; the greatest angular elevation is retained, with a 0° floor for screening. Circular linear interpolation supplies the cutoff at fractional body azimuths. Cutoff is max(terrain, assumed obstruction) + margin; equality is blocked. Durations use each observation interval's starting state, and the final row closes the window.

The centre, every radial sample, and all four interpolation neighbours must be valid. Rehearsal additionally validates every displayed mesh sample. Out-of-map or invalid heights cause explicit rejection; no nearby profile, truncated range or fabricated terrain is substituted. The DEM and label SHA-256 are checked before extraction. A source change invalidates the server cache and rejects in-flight results from the old source.

One worker runs at a time, with at most three distinct pending calculations, a 20-second worker timeout, coalesced duplicate requests and eight cached responses. Browser caches are also bounded. Playback does not repeatedly retry failed coordinates; explicit Retry or close/reopen provides recovery. Late responses cannot change the newly selected site. Computation does not modify the source raster or observation samples.

The optional rehearsal retains the existing 38.4 km square mesh, 160 m display sampling, 80 m radial sections and true-scale/5× display controls. Integer-millimetre height storage is rounding precision, not measurement accuracy. The original Sun-Earth-Moon, lunar surface and local-horizon renderers are unchanged.

## Local versus portable use

The development folder already contains the source raster. New terrain calculations work offline with the local Node server and that raster. New NASA/JPL ephemerides still require internet.

The shareable `SELENE.html` and static-hosted edition retain the four bundled terrain locations. They cannot calculate arbitrary terrain without the local service. The submission ZIP includes the calculator, label and source references, but excludes the 115,520,000-byte DEM. To enable custom terrain on another computer, download the official image below to `data/terrain-source/LDEM_80S_80M.IMG` beside the supplied label, then run the local server. There is no automatic source download.

- DEM: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG
- Label: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.LBL
- DEM SHA-256: `e6591eeea35402ca5e124ca00f5bf0774381a2d4fa919144b455d82b8ff65fdc`
- Label SHA-256: `107c7558cbf8832e4119d3c8c2b1b272623344275c85378a9b0e03c22876eb33`

Use **Download terrain study JSON** to preserve source metadata, the exact profile, settings, per-sample results and durations; **Download skyline CSV** exports the 360 horizon bins. Observation/notebook exports continue to contain flat-reference geometry and settings. Reopening a saved coordinate recalculates/reuses its terrain through the local service. A comparison row is screened only when its exact profile is loaded; otherwise it explicitly says terrain is not loaded. Terrain results are not silently inserted into flat-reference notebook reports.

## Verification and limits

Run `node verify-all.cjs` for the portable application checks. With the original DEM present, run `node verify-all.cjs --terrain-source` for the additional source-dependent extractor and worker/API tests. Run `python tools/audit-custom-terrain.py <node-executable>` in the project Python environment for the independent custom-coordinate audit. The audit uses only the standard library.

The independent audit reconstructs 2,700,000 radial samples at six custom sites using Python Rodrigues rotations, PDS trigonometric projection and Cartesian sightlines. All 2,160 blocking distances match; maximum skyline disagreement is below 0.000001°. Existing four profiles reproduce within their stored rounding. Tests cover exact/near poles, longitude aliases and seam, synthetic sphere/ridge geometry, bilinear bounds and invalid cells, source failures, complete-footprint acceptance/rejection near four boundary longitudes, strict cutoffs, request/cache lifecycle and graphics-off UI behavior.

This verifies implementation consistency against the same DEM, not independent terrain truth. One-degree rays and 80 m radial steps can miss narrow obstacles; terrain beyond 100 km is unsearched. The 0° floor is not a guarantee of conservative results. Ephemerides retain their original reference-sphere observer while terrain uses local height plus 2 m. No solar-disk fraction, cast shadows, solar electrical power, radio-link budget or operational landing-site certification is provided.
