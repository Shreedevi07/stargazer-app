import { useEffect, useRef } from 'react';
import { computeStarPositions } from '../../astro/starPositions';
import { getSunPosition, getMoonPosition } from '../../astro/sunMoon';
import { domeProjection, underworldProjection } from '../../astro/projection';

/**
 * The main sky canvas. Two distinct modes -- these are NOT mirror images
 * of each other, they show genuinely different stars:
 *
 *  - mode="sky" (default): the planetarium dome, centered on the zenith.
 *    Only draws what's currently ABOVE the horizon (altitude > 0).
 *
 *  - mode="underworld": the "what's beneath your feet right now" view,
 *    centered on the nadir. Only draws what's currently BELOW the horizon
 *    (altitude < 0) -- the complementary half of the sky, not a dimmed
 *    copy of the same stars.
 */
export function SkyDome({
  starsJson,
  observer,
  time,
  magLimit = 4.5,
  mode = 'sky',
  onStarTap,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!starsJson || !observer || !time) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const projConfig = { centerX, centerY, radius };
    const project = mode === 'underworld'
      ? (point) => underworldProjection(point, projConfig)
      : (point) => domeProjection(point, projConfig, false);

    // --- Stars ---
    const allStars = computeStarPositions(starsJson, observer, time, magLimit);
    const relevantStars = mode === 'underworld'
      ? allStars.filter((s) => s.altitude < 0)
      : allStars.filter((s) => s.altitude > 0);

    for (const star of relevantStars) {
      const p = project(star);
      if (!p) continue;
      const size = Math.max(0.6, 2.4 - star.mag * 0.35);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'underworld'
        ? 'rgba(150, 160, 190, 0.55)' // cooler, dimmer tone for the underworld view
        : 'rgba(244, 239, 230, 1)';
      ctx.fill();
    }

    // --- Sun (only drawn in whichever view it's actually in) ---
    const sun = getSunPosition({ observer, time });
    if ((mode === 'underworld') === (sun.altitude < 0)) {
      const sunP = project(sun);
      if (sunP) drawGlowingDisc(ctx, sunP.x, sunP.y, 14, '#ffd27a', '#fff6de');
    }

    // --- Moon (same rule) ---
    const moon = getMoonPosition({ observer, time });
    if ((mode === 'underworld') === (moon.altitude < 0)) {
      const moonP = project(moon);
      if (moonP) drawMoon(ctx, moonP.x, moonP.y, 10, moon.phaseFraction, moon.phaseAngle);
    }

    // --- Horizon ring + compass directions ---
    drawCompassRing(ctx, projConfig);
  }, [starsJson, observer, time, magLimit, mode]);

  return (
    <canvas
      ref={canvasRef}
      onClick={(e) => {
        if (!onStarTap) return;
        // Hit-testing against the drawn stars would need the same projected
        // list kept around; wired up when we build the interactive tap layer.
      }}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

const COMPASS_POINTS = [
  { label: 'N', azimuth: 0 },
  { label: 'NE', azimuth: 45 },
  { label: 'E', azimuth: 90 },
  { label: 'SE', azimuth: 135 },
  { label: 'S', azimuth: 180 },
  { label: 'SW', azimuth: 225 },
  { label: 'W', azimuth: 270 },
  { label: 'NW', azimuth: 315 },
];

function drawCompassRing(ctx, { centerX, centerY, radius }) {
  // Faint ring marking the horizon boundary itself.
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 220, 180, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  for (const { label, azimuth } of COMPASS_POINTS) {
    // Same azimuth-to-angle convention as domeProjection: rotate so North is up.
    const theta = (azimuth - 90) * (Math.PI / 180);
    const labelRadius = radius + 14;
    const x = centerX + labelRadius * Math.cos(theta);
    const y = centerY + labelRadius * Math.sin(theta);

    const isCardinal = label.length === 1;
    ctx.font = isCardinal
      ? "600 13px 'Space Grotesk', sans-serif"
      : "400 10px 'IBM Plex Mono', monospace";
    ctx.fillStyle = isCardinal ? 'rgba(255,235,210,0.9)' : 'rgba(255,235,210,0.45)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
}

function drawGlowingDisc(ctx, x, y, radius, coreColor, glowColor) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(0.3, coreColor);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawMoon(ctx, x, y, radius, illuminatedFraction, phaseAngle) {
  // Base disc (dark side)
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(180,180,190,0.25)';
  ctx.fill();

  // Illuminated portion via clipping -- simple crescent approximation good
  // enough for a small icon-scale moon; swap for a proper terminator curve
  // later if we want a large detailed moon view.
  const wanning = phaseAngle > 180;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  const litWidth = radius * 2 * illuminatedFraction;
  const litX = wanning ? x - radius : x + radius - litWidth;
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(litX, y - radius, litWidth, radius * 2);
  ctx.restore();
}
