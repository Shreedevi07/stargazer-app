# Sky data sources

All files in this folder are derived from the [d3-celestial](https://github.com/ofrohn/d3-celestial)
project by Olaf Frohn (BSD-style license — see `LICENSE` below). Underlying star
positions come from ESA's **Hipparcos** catalogue; constellation figures follow the
traditional Western stick-figures as used in Stellarium.

## Files

| File                        | Contents                                                                 |
|------------------------------|---------------------------------------------------------------------------|
| `stars.json`                 | 5,044 stars down to magnitude 6, as GeoJSON Points. `coordinates: [RA, Dec]` in degrees (RA range -180..180, i.e. 0–12h → 0–180°, 12–24h → -180–0°). `properties.mag` = visual magnitude, `properties.bv` = B-V color index (useful for star color). |
| `constellations.json`        | The 88 constellations — names (English + several other languages), IAU 3-letter codes (`id`), genitive form. |
| `constellations.lines.json`  | Stick-figure line segments per constellation, as `MultiLineString` geometry in the same RA/Dec coordinate space as `stars.json`. |
| `constellations.bounds.json` | Official IAU constellation boundary polygons — useful for "which constellation is this point in" lookups. |

## Coordinate note

These are **equatorial coordinates (RA/Dec)**, fixed to the celestial sphere — they
don't change with observer location or time. To render the sky as seen from a
specific place and moment (what the app needs for the horizon view and Live Sky
mode), convert RA/Dec → **Alt/Az** using the observer's lat/long and the current
time. That conversion belongs in `src/astro/starPositions.js`, using Astronomy
Engine's `Astronomy.Horizon()` function.

## Attribution requirement

The license is permissive (BSD-style) but requires the copyright notice to be kept
if this data is redistributed. Keep the `LICENSE` file below in this folder for
that reason — don't delete it even though the app itself doesn't read it at runtime.

## Star names

This dataset does not include proper star names (Sirius, Betelgeuse, etc.) —
only magnitude and color. We'll want a small supplementary `star-names.json`
(HIP catalog number → common name) for the tap-to-reveal footer, since the base
catalog only has numeric IDs. Flagging this as a follow-up.
