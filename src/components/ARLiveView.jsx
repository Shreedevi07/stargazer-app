import { useEffect, useRef, useState } from 'react';
import { liveSkyProjection } from '../astro/projection';
import { computeStarPositions } from '../astro/starPositions';
import { getSunPosition, getMoonPosition } from '../astro/sunMoon';
import '../App.css';

export function ARLiveView({ starsJson, observer, time, magLimit = 4.5, onBackToMenu }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Virtual phone orientation controls
  const [heading, setHeading] = useState(180); // Default pointing South
  const [pitch, setPitch] = useState(35);     // Default looking 35° up
  const [fovDegrees, setFovDegrees] = useState(60); // 60° default field of view
  const [useSensors, setUseSensors] = useState(false);

  // Enable/Disable real camera feed
  useEffect(() => {
    let currentStream = null;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err) {
        console.warn('Camera stream error:', err);
        setCameraError(err.message || 'Could not access camera feed');
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle device orientation sensors if available
  useEffect(() => {
    if (!useSensors) return;

    function handleOrientation(e) {
      if (e.alpha !== null && e.beta !== null) {
        setHeading((360 - e.alpha) % 360);
        setPitch(Math.max(-90, Math.min(90, e.beta)));
      }
    }

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [useSensors]);

  // Render AR canvas overlay
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

    const stars = computeStarPositions(starsJson, observer, time, magLimit);

    // Draw central reticle crosshair
    ctx.strokeStyle = 'rgba(212, 176, 122, 0.4)';
    ctx.lineWidth = 1;
    const cx = width / 2;
    const cy = height / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy + 12);
    ctx.stroke();

    // Draw projected stars inside FOV window
    for (const star of stars) {
      const projected = liveSkyProjection(
        { altitude: star.altitude, azimuth: star.azimuth },
        { heading, pitch, fovDegrees, screenWidth: width, screenHeight: height }
      );

      if (!projected) continue;

      const size = Math.max(1.2, (6 - star.mag) * 0.9);
      const alpha = Math.min(1, Math.max(0.4, (5 - star.mag) / 4));

      // Star outer glow
      const grad = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, size * 2.5);
      grad.addColorStop(0, `rgba(240, 243, 247, ${alpha})`);
      grad.addColorStop(0.5, `rgba(212, 176, 122, ${alpha * 0.3})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(projected.x, projected.y, size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Star core
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Project Sun
    const sun = getSunPosition({ observer, time });
    const sunProj = liveSkyProjection(
      { altitude: sun.altitude, azimuth: sun.azimuth },
      { heading, pitch, fovDegrees, screenWidth: width, screenHeight: height }
    );
    if (sunProj) {
      ctx.beginPath();
      ctx.arc(sunProj.x, sunProj.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd27a';
      ctx.fill();
      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = '#ffe9c7';
      ctx.fillText('SUN', sunProj.x + 18, sunProj.y + 4);
    }

    // Project Moon
    const moon = getMoonPosition({ observer, time });
    const moonProj = liveSkyProjection(
      { altitude: moon.altitude, azimuth: moon.azimuth },
      { heading, pitch, fovDegrees, screenWidth: width, screenHeight: height }
    );
    if (moonProj) {
      ctx.beginPath();
      ctx.arc(moonProj.x, moonProj.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#d8d8e0';
      ctx.fill();
      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = '#f0f3f7';
      ctx.fillText('MOON', moonProj.x + 14, moonProj.y + 4);
    }

  }, [starsJson, observer, time, heading, pitch, fovDegrees, magLimit]);

  const formattedTime = time ? time.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
  const formattedDate = time ? time.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase() : '';
  const lat = observer?.latitude ?? 51.4769;
  const lon = observer?.longitude ?? -0.0005;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#090b0e', overflow: 'hidden' }}>
      {/* Still Top Container Header */}
      <header className="app-header-still">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap' }}>
          {onBackToMenu && (
            <button className="btn-menu-back" onClick={onBackToMenu}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              MENU
            </button>
          )}

          <div className="header-location-spec">
            <span className="spec-label">AR OBSERVER:</span>
            <span className="spec-value">{lat.toFixed(2)}°, {lon.toFixed(2)}°</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap' }}>
          <span className="tag accent">
            {cameraActive ? 'CAMERA LIVE' : 'SIMULATED SKY'}
          </span>
          <div className="mag-spec-badge">
            MAG LIMIT: {magLimit}
          </div>
        </div>

        <div className="header-time-display">
          <span className="time-val">{formattedTime} UTC</span>
          <span className="date-val">{formattedDate}</span>
        </div>
      </header>

      {/* AR Viewport Container */}
      <main className="dome-viewport-container">

      {/* Real Camera Video Background */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: cameraActive ? 'block' : 'none',
        }}
      />

      {/* Fallback sky background if camera stream unavailable */}
      {!cameraActive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 50%, #0d1117 0%, #05070a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {cameraError && (
            <div
              style={{
                position: 'absolute',
                top: '70px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(15, 18, 23, 0.9)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
              }}
            >
              Camera: {cameraError} (Simulated Sky Mode)
            </div>
          )}
        </div>
      )}

      {/* Canvas AR Overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* Bottom HUD Orientation Panel */}
      <div
        className="hud-panel"
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '520px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            AR Sky Alignment Controls
          </span>

          <button
            onClick={() => setUseSensors(!useSensors)}
            className="btn-icon-nav"
            style={{ padding: '3px 8px', fontSize: '11px' }}
          >
            {useSensors ? 'Sensors Active' : 'Manual Sliders'}
          </button>
        </div>

        {/* Heading Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '90px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
            Heading: {Math.round(heading)}°
          </span>
          <input
            type="range"
            min="0"
            max="360"
            value={heading}
            onChange={(e) => setHeading(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
        </div>

        {/* Pitch Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '90px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
            Pitch: {Math.round(pitch)}°
          </span>
          <input
            type="range"
            min="-90"
            max="90"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
        </div>

        {/* FOV Zoom Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '90px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
            FOV: {Math.round(fovDegrees)}°
          </span>
          <input
            type="range"
            min="30"
            max="120"
            value={fovDegrees}
            onChange={(e) => setFovDegrees(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
        </div>
      </div>
    </main>
  </div>
);
}
