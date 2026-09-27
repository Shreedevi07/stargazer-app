import * as Astronomy from 'astronomy-engine';

/**
 * stars.json stores RA as a longitude-style value in degrees, range -180..180
 * (0..12h maps to 0..180, 12..24h maps to -180..0). Astronomy Engine's
 * Horizon() wants RA in sidereal HOURS, range 0..24. This converts one star's
 * coordinate pair.
 */
function raDegToHours(raDeg) {
  const normalized = raDeg < 0 ? raDeg + 360 : raDeg;
  return normalized / 15;
}

/**
 * Converts a single star (from stars.json geometry.coordinates = [raDeg, decDeg])
 * into its current altitude/azimuth for the given observer + time.
 *
 * Note: stars.json coordinates are J2000 mean-equator positions. We pass them
 * to Horizon() without precessing to equator-of-date first. Precession is
 * about 50 arcseconds/year, so over a few decades this introduces an error of
 * a few arcminutes -- invisible at the zoom level of a phone screen. If you
 * later need arcsecond precision (e.g. for a "center exactly on this star"
 * telescope-pointing feature), swap this for Astronomy.Equator() with a
 * user-defined star via Astronomy.DefineStar().
 */
export function starAltAz([raDeg, decDeg], observer, time) {
  const raHours = raDegToHours(raDeg);
  const hz = Astronomy.Horizon(time, observer, raHours, decDeg, 'normal');
  return { altitude: hz.altitude, azimuth: hz.azimuth };
}

/**
 * Takes the full stars.json FeatureCollection and returns a flat array of
 * stars annotated with current alt/az, filtered to a magnitude limit.
 *
 * magLimit: lower = fewer, brighter stars. ~4.5 is a reasonable default for
 * a phone screen; 6 shows everything in the catalog (dark-sky naked-eye limit).
 */
export function computeStarPositions(starsGeoJson, observer, time, magLimit = 4.5) {
  const result = [];
  for (const feature of starsGeoJson.features) {
    const mag = feature.properties.mag;
    if (mag > magLimit) continue;

    const { altitude, azimuth } = starAltAz(feature.geometry.coordinates, observer, time);
    result.push({
      id: feature.id,
      mag,
      bv: feature.properties.bv,
      raDeg: feature.geometry.coordinates[0],
      decDeg: feature.geometry.coordinates[1],
      altitude,
      azimuth,
      isUp: altitude > 0,
    });
  }
  return result;
}

/**
 * Same idea, but for constellation line segments (constellations.lines.json).
 * Each feature's geometry is a MultiLineString of [raDeg, decDeg] points;
 * we convert every point to alt/az so the line can be drawn in screen space.
 */
export function computeConstellationLines(linesGeoJson, observer, time) {
  return linesGeoJson.features.map((feature) => ({
    id: feature.id, // 3-letter IAU code, e.g. "Ori"
    segments: feature.geometry.coordinates.map((segment) =>
      segment.map(([raDeg, decDeg]) => starAltAz([raDeg, decDeg], observer, time))
    ),
  }));
}

/** Simple average-altitude check: is any part of this constellation above the horizon? */
export function isConstellationVisible(constellationLine) {
  return constellationLine.segments.some((segment) =>
    segment.some((point) => point.altitude > 0)
  );
}
