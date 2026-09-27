/**
 * Two projection modes, for the two different screens:
 *
 *  - domeProjection: "planetarium dome" view for the home screen. Centered
 *    on the zenith (straight up), looking down at the whole sky at once,
 *    like a fisheye lens pointed up. Good for a fixed, all-at-a-glance view.
 *
 *  - liveSkyProjection: a narrow field-of-view window centered on wherever
 *    the phone is currently pointed (from device orientation), for the
 *    "match it to my real sky" AR-style mode. Only stars within the FOV
 *    are visible, like looking through a window instead of a fisheye.
 */

/**
 * Underworld projection -- for the "what's below your feet right now"
 * scroll section. This is NOT the same formula as domeProjection with
 * negative altitude; that would project points outside the horizon circle
 * and get clipped. Instead this centers on the nadir (straight down,
 * altitude -90) the same way domeProjection centers on the zenith.
 *
 * altitude 0 (horizon) maps to the edge -- so it lines up visually with
 * where the sky dome's horizon circle ends, giving a continuous feel when
 * scrolling from one view into the other. altitude -90 (nadir) maps to
 * the center.
 *
 * Only meaningful for altitude <= 0 -- callers should filter to
 * below-horizon points before calling this (see isConstellationVisible's
 * inverse, or just check `altitude < 0` on stars).
 */
export function underworldProjection({ altitude, azimuth }, { centerX, centerY, radius }) {
  if (altitude > 0) return null;

  const r = radius * (1 + altitude / 90); // altitude=0 -> radius (edge), altitude=-90 -> 0 (center)
  const theta = (azimuth - 90) * (Math.PI / 180);

  return {
    x: centerX + r * Math.cos(theta),
    y: centerY + r * Math.sin(theta),
    normalizedRadius: r / radius,
  };
}

/**
 * Stereographic dome projection.
 * altitude 90 (zenith) maps to the center; altitude 0 (horizon) maps to the
 * edge circle of radius `radius`. Azimuth 0 (North) points up on screen.
 *
 * Returns null if the point is below the horizon and includeBelowHorizon
 * is false (so callers can skip drawing it, or pass true to render the
 * "underworld" scroll section below the horizon line).
 */
export function domeProjection({ altitude, azimuth }, { centerX, centerY, radius }, includeBelowHorizon = false) {
  if (altitude < 0 && !includeBelowHorizon) return null;

  // Distance from center: 0 at zenith (alt=90), `radius` at horizon (alt=0),
  // and beyond `radius` for below-horizon points (used by the underworld view).
  const r = radius * (1 - altitude / 90);

  // Azimuth is measured clockwise from North; rotate so North is "up" on screen.
  const theta = (azimuth - 90) * (Math.PI / 180);

  return {
    x: centerX + r * Math.cos(theta),
    y: centerY + r * Math.sin(theta),
    // useful for sizing/opacity falloff near the horizon edge
    normalizedRadius: r / radius,
  };
}

/**
 * Live Sky (narrow FOV) projection -- a simple gnomonic-style projection
 * centered on the direction the device is currently facing.
 *
 * heading: compass azimuth the phone is pointed at, degrees (0=N, 90=E...)
 * pitch: how far up/down the phone is tilted, degrees (0=horizon, 90=straight up)
 * fovDegrees: how wide the visible field is (controlled by the zoom slider --
 *   smaller fov = more "zoomed in")
 */
export function liveSkyProjection(
  { altitude, azimuth },
  { heading, pitch, fovDegrees, screenWidth, screenHeight }
) {
  // Angular offset of the star from where the phone is pointed.
  let deltaAz = azimuth - heading;
  // Normalize to -180..180 so wraparound near North doesn't break the math.
  deltaAz = ((deltaAz + 540) % 360) - 180;
  const deltaAlt = altitude - pitch;

  const halfFov = fovDegrees / 2;

  // Outside the field of view -- don't draw it.
  if (Math.abs(deltaAz) > halfFov || Math.abs(deltaAlt) > halfFov) return null;

  const x = screenWidth / 2 + (deltaAz / halfFov) * (screenWidth / 2);
  // Screen Y grows downward, sky altitude grows upward, so subtract.
  const y = screenHeight / 2 - (deltaAlt / halfFov) * (screenHeight / 2);

  return { x, y };
}

/** Moon phase shading helper: which side is lit, for drawing the crescent shape. */
export function moonCrescentPath(phaseAngle, radius) {
  // phaseAngle 0-360: 0=new, 90=first quarter (right half lit, N hemisphere view),
  // 180=full, 270=last quarter (left half lit).
  const illuminatedFraction = (1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2;
  const wanning = phaseAngle > 180;
  return { illuminatedFraction, litSide: wanning ? 'left' : 'right' };
}
