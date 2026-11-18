import { useEffect, useState } from 'react';
import '../App.css';

export function OptionsPage({ onSelectMode, coords, now, starCount = 8740 }) {
  const [customLat, setCustomLat] = useState(coords?.latitude ?? 51.4769);
  const [customLon, setCustomLon] = useState(coords?.longitude ?? -0.0005);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationName, setLocationName] = useState('Greenwich, London, UK');

  const formattedTime = now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
  const formattedDate = now ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : '';

  const currentLat = coords ? coords.latitude : customLat;
  const currentLon = coords ? coords.longitude : customLon;

  // Approximate location name resolution via reverse geocoding
  useEffect(() => {
    if (!currentLat || !currentLon) return;

    let isMounted = true;
    const isDefaultGreenwich = Math.abs(currentLat - 51.4769) < 0.05 && Math.abs(currentLon - (-0.0005)) < 0.05;

    if (isDefaultGreenwich) {
      setLocationName('Greenwich, London, UK');
      return;
    }

    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${currentLat}&longitude=${currentLon}&localityLanguage=en`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const city = data.city || data.locality || data.principalSubdivision;
        const country = data.countryName || '';
        if (city) {
          setLocationName(`${city}${country ? `, ${country}` : ''}`);
        } else if (country) {
          setLocationName(country);
        } else {
          setLocationName(`Observed Sector (${currentLat.toFixed(1)}°, ${currentLon.toFixed(1)}°)`);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocationName(`Observed Sector (${currentLat.toFixed(1)}°, ${currentLon.toFixed(1)}°)`);
        }
      });

    return () => { isMounted = false; };
  }, [currentLat, currentLon]);

  return (
    <div className="stargazer-layout">
      <div className="grid-pattern-bg" />

      {/* Header Bar */}
      <header className="app-header">
        {/* Title Brand */}
        <div className="header-brand">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'var(--sans)',
                fontSize: '16px',
                fontWeight: '600',
                letterSpacing: '0.08em',
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              STARGAZER
            </h1>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
              ASTRONOMICAL OBSERVATION & AR ENGINE
            </p>
          </div>
        </div>

        {/* Time & Location Container */}
        <div className="header-time-loc">
          {/* Date & Time */}
          <div className="header-time" style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '12px' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {formattedTime} <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>UTC</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '2px' }}>
              {formattedDate}
            </div>
          </div>

          {/* Location with Approximate Name */}
          <div className="header-location">
            <button
              className="btn-icon-nav header-loc-btn"
              onClick={() => setEditingLocation(!editingLocation)}
              title="Configure Observer Location"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              </svg>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{locationName}</strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                  ({currentLat.toFixed(2)}°, {currentLon.toFixed(2)}°)
                </span>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Location Drawer */}
      {editingLocation && (
        <div
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-strong)',
            padding: '12px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            zIndex: 9,
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>LATITUDE:</span>
          <input
            type="number"
            step="0.01"
            value={customLat}
            onChange={(e) => setCustomLat(parseFloat(e.target.value) || 0)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              padding: '5px 10px',
              borderRadius: '4px',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              width: '90px',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>LONGITUDE:</span>
          <input
            type="number"
            step="0.01"
            value={customLon}
            onChange={(e) => setCustomLon(parseFloat(e.target.value) || 0)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              padding: '5px 10px',
              borderRadius: '4px',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              width: '90px',
            }}
          />
          <button
            onClick={() => setEditingLocation(false)}
            className="btn-primary"
            style={{ padding: '6px 14px', fontSize: '12px' }}
          >
            Apply Location
          </button>
        </div>
      )}

      {/* Main Container */}
      <main
        className="options-main"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '32px 24px 48px',
          maxWidth: '1040px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          zIndex: 5,
        }}
      >
        {/* Title Header */}
        <div style={{ width: '100%', marginBottom: '32px' }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              color: 'var(--accent)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            // SELECT INTERFACE
          </div>
          <h2
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 'clamp(22px, 4vw, 28px)',
              fontWeight: '600',
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}
          >
            Astronomical Observation Modes
          </h2>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            Select an observation interface to calculate topocentric coordinates for <strong style={{ color: 'var(--text-primary)' }}>{locationName}</strong>.
          </p>
        </div>

        {/* Options Cards Grid */}
        <div className="options-grid">
          {/* Option 1: Live Planetarium Dome */}
          <div className="option-card featured" onClick={() => onSelectMode('dome')}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="tag accent">3D PLANETARIUM</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)' }}>PRIMARY</span>
              </div>

              <h3
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '10px',
                }}
              >
                Live Planetarium Dome
              </h3>

              <p
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '20px',
                }}
              >
                Interactive 360° celestial dome. Observe naked-eye stars, constellation stick figures, real-time Sun & Moon ephemeris, and horizon twilight color transitions.
              </p>

              {/* Specs Table */}
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>CATALOG</span>
                  <span style={{ color: 'var(--text-primary)' }}>{starCount.toLocaleString()} Stars</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>CONSTELLATIONS</span>
                  <span style={{ color: 'var(--text-primary)' }}>88 IAU Lines</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PROJECTION</span>
                  <span style={{ color: 'var(--text-primary)' }}>Stereographic Dome</span>
                </div>
              </div>
            </div>

            <button className="btn-primary" style={{ width: '100%' }}>
              Launch 3D Dome
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Option 2: VR / AR Live Sky View */}
          <div className="option-card" onClick={() => onSelectMode('ar')}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="tag muted">CAMERA OVERLAY</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)' }}>AR ENGINE</span>
              </div>

              <h3
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '10px',
                }}
              >
                VR / AR Live Sky View
              </h3>

              <p
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '20px',
                }}
              >
                Superimpose real-time star positions directly over device camera feed. Uses gnomonic projection, field-of-view zooming, and compass/pitch sensors.
              </p>

              {/* Specs Table */}
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>VIDEO FEED</span>
                  <span style={{ color: 'var(--text-primary)' }}>Live WebRTC Stream</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>PROJECTION</span>
                  <span style={{ color: 'var(--text-primary)' }}>Gnomonic FOV Window</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>TRACKING</span>
                  <span style={{ color: 'var(--text-primary)' }}>Gyroscope & Compass</span>
                </div>
              </div>
            </div>

            <button className="btn-secondary" style={{ width: '100%' }}>
              Enter AR Mode
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="footer-bar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <span>EPHEMERIS: Astronomy Engine v2.1</span>
          <span>DATA: Yale Bright Star Catalog (J2000)</span>
        </div>

        <div>
          <span>OBSERVER STATE: READY</span>
        </div>
      </footer>
    </div>
  );
}
