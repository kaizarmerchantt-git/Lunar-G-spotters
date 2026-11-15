# SELENE lunar observation

SELENE explores how a lunar observer's location, UTC window and assumed horizon cutoff affect Sun and Earth visibility.

## Language

**Observer location**: Lunar geodetic latitude, positive north, and longitude, positive east, at a stated height above the reference surface. A study name does not establish a location.
_Avoid_: landing site, unless the coordinate is explicitly a published mission landing position.

**Observer geometry**: Sun and Earth body-center azimuth and elevation sampled from one observer location over a UTC window. It is distinct from Earth-centered system vectors.

**Observation**: A named set of sampled observer geometry, its source record and optional observer location. A missing location permits numerical analysis but cannot establish a point on the Moon.

**Observation file**: A portable observation that carries its sample values, source record, conventions and optional location together. Importing one retains the user-supplied classification regardless of its source label.

**Reference window**: A bundled observation at a documented coordinate and UTC window. Reference coordinates are not certified landing sites.

**Source record**: The stated origin and conventions of the geometry, including query details or source URLs when available. A source label is evidence to inspect, not independent validation.

**Scenario**: An observation with chosen obstruction, margin and selected sample, retained for comparison. An observation file transfers geometry; a notebook retains scenarios and their settings.

**Cutoff**: The sum of assumed uniform obstruction and clearance margin, in degrees. A body center is counted above cutoff only when its elevation is strictly greater.

**System vectors**: Geometric Sun and Moon positions relative to Earth's center, in the recorded frame and units. Observer-angle CSVs do not contain these vectors.

**Surface view**: A textured spherical Moon showing an observer location and local directions. Texture relief and lighting do not establish a terrain horizon.

**Local horizon**: The observer's flat reference horizontal plane, used to interpret sampled azimuth and elevation. It is not a measured terrain skyline.

**Published landing point**: A sourced historical landing coordinate, distinct from a planned target or regional destination.
