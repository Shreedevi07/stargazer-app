import { useEffect, useState } from 'react';
import { makeContext } from './astro/observer';
import { useGeolocation } from './hooks/useGeolocation';
import { useNow } from './hooks/useNow';
import { OptionsPage } from './components/OptionsPage';
import { ImmersiveSkyDome } from './components/SkyDome/ImmersiveSkyDome';
import { ARLiveView } from './components/ARLiveView';

const DEFAULT_COORDS = { latitude: 51.4769, longitude: -0.0005 }; // Greenwich fallback

function App() {
  const { coords } = useGeolocation();
  const now = useNow();
  const [viewMode, setViewMode] = useState('menu'); // 'menu' | 'dome' | 'ar'
  const [starsJson, setStarsJson] = useState(null);
  const [constellationLinesJson, setConstellationLinesJson] = useState(null);
  const [constellationNamesJson, setConstellationNamesJson] = useState(null);
  const [starNamesJson, setStarNamesJson] = useState(null);

  useEffect(() => {
    fetch('/data/stars.json')
      .then((res) => res.json())
      .then(setStarsJson)
      .catch((err) => console.error('Failed to load stars.json', err));

    fetch('/data/constellations.lines.json')
      .then((res) => res.json())
      .then(setConstellationLinesJson)
      .catch((err) => console.error('Failed to load constellations.lines.json', err));

    fetch('/data/constellations.json')
      .then((res) => res.json())
      .then(setConstellationNamesJson)
      .catch((err) => console.error('Failed to load constellations.json', err));

    fetch('/data/star-names.json')
      .then((res) => res.json())
      .then(setStarNamesJson)
      .catch((err) => console.error('Failed to load star-names.json', err));
  }, []);

  // Prevent browser page zoom from wheel with Ctrl and gesture events
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    const handleGesture = (e) => {
      e.preventDefault();
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('gesturestart', handleGesture, { passive: false });
    window.addEventListener('gesturechange', handleGesture, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('gesturestart', handleGesture);
      window.removeEventListener('gesturechange', handleGesture);
    };
  }, []);

  const activeCoords = coords || DEFAULT_COORDS;
  const catalogLoading = !starsJson || !constellationLinesJson || !constellationNamesJson || !starNamesJson;

  if (catalogLoading) {
    return <FullScreenLoading text="CALIBRATING STAR CATALOG & EPHEMERIS ENGINE..." />;
  }

  const { observer, time } = makeContext(activeCoords, now);

  if (viewMode === 'dome') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#090b0e', overflow: 'hidden' }}>
        <ImmersiveSkyDome
          starsJson={starsJson}
          constellationLinesJson={constellationLinesJson}
          constellationNamesJson={constellationNamesJson}
          starNamesJson={starNamesJson}
          observer={observer}
          time={time}
          coords={activeCoords}
          now={now}
          magLimit={4.5}
          onBackToMenu={() => setViewMode('menu')}
        />
      </div>
    );
  }

  if (viewMode === 'ar') {
    return (
      <ARLiveView
        starsJson={starsJson}
        observer={observer}
        time={time}
        magLimit={4.5}
        onBackToMenu={() => setViewMode('menu')}
      />
    );
  }

  return (
    <OptionsPage
      onSelectMode={setViewMode}
      coords={activeCoords}
      now={now}
      starCount={starsJson.features?.length ?? 8740}
    />
  );
}

function FullScreenLoading({ text }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 50%, #0c152b 0%, #050711 70%)',
        color: '#e2e8f0',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '13px',
        letterSpacing: '0.12em',
        padding: '20px',
        textAlign: 'center',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '3px solid rgba(56, 189, 248, 0.2)',
          borderTopColor: '#38bdf8',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span>{text}</span>
    </div>
  );
}

export default App;
