import * as Astronomy from 'astronomy-engine';

/**
 * Returns the Sun's current position for the given observer/time.
 * altitude/azimuth are in degrees. altitude < 0 means below the horizon.
 */
export function getSunPosition({ observer, time }) {
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const hz = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
  return {
    altitude: hz.altitude,
    azimuth: hz.azimuth,
    isUp: hz.altitude > 0,
  };
}

/**
 * Returns the Moon's current position AND phase info.
 * phaseFraction: 0 = new moon, 0.5 = quarter, 1 = full moon (illuminated fraction).
 * phaseAngle: 0-360 degrees, useful for drawing the correct crescent shape
 *   (which side is lit) rather than just how "full" it is.
 */
export function getMoonPosition({ observer, time }) {
  const eq = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const hz = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const moonPhase = Astronomy.MoonPhase(time); // ecliptic longitude angle, 0-360

  return {
    altitude: hz.altitude,
    azimuth: hz.azimuth,
    isUp: hz.altitude > 0,
    phaseFraction: illum.phase_fraction, // 0..1 illuminated
    phaseAngle: moonPhase, // 0=new, 90=first quarter, 180=full, 270=last quarter
  };
}

/**
 * Human-readable phase name from the phase angle, since the UI will want
 * to show "New Moon" / "Waxing Crescent" etc rather than raw numbers.
 */
export function getMoonPhaseName(phaseAngle) {
  const a = ((phaseAngle % 360) + 360) % 360;
  if (a < 22.5) return 'New Moon';
  if (a < 67.5) return 'Waxing Crescent';
  if (a < 112.5) return 'First Quarter';
  if (a < 157.5) return 'Waxing Gibbous';
  if (a < 202.5) return 'Full Moon';
  if (a < 247.5) return 'Waning Gibbous';
  if (a < 292.5) return 'Last Quarter';
  if (a < 337.5) return 'Waning Crescent';
  return 'New Moon';
}
