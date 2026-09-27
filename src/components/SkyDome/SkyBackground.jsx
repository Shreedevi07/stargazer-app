/**
 * Renders the sky's background gradient, driven by the sun's current
 * altitude. This is what makes the app feel alive rather than a static
 * dark rectangle -- the color actually reflects real daylight state.
 *
 * sunAltitude: degrees, from getSunPosition(). Roughly:
 *   > 0      : daytime (pale blue)
 *   -6 to 0  : civil twilight (warm glow near horizon)
 *   -18 to -6: nautical/astronomical twilight (fading warm glow)
 *   < -18    : true night (deep navy, no warm tint)
 */
export function SkyBackground({ sunAltitude, children }) {
  const twilightStrength = Math.max(0, Math.min(1, (sunAltitude + 18) / 18));
  const isDaytime = sunAltitude > 0;

  // Deliberately a deep SPACE BLUE, not gray-black -- this is the color
  // that reads as "space" (think deep navy/indigo) rather than just dark.
  const zenithColor = isDaytime ? '#0c2350' : '#030816';
  const horizonColor = isDaytime
    ? blend('#123166', '#ff9d6b', twilightStrength * 0.3)
    : blend('#0a1d42', '#ff8c5a', twilightStrength * 0.4);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: `linear-gradient(to bottom, ${zenithColor} 0%, ${horizonColor} 70%)`,
        transition: 'background 4s ease',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** Linearly blends two hex colors by factor t (0..1). Small local helper -- no need for a color library here. */
function blend(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}
