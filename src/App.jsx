import { useEffect, useState } from 'react';
import { makeContext } from './astro/observer';
import { useGeolocation } from './hooks/useGeolocation';
import { useNow } from './hooks/useNow';
import { ImmersiveSkyDome } from './components/SkyDome/ImmersiveSkyDome';

function App() {
  const { coords, error, loading } = useGeolocation();
  const now = useNow();
  const [starsJson, setStarsJson] = useState(null);
  const [constellationLinesJson, setConstellationLinesJson] = useState(null);
  const [constellationNamesJson, setConstellationNamesJson] = useState(null);

  useEffect(() => {
    fetch('/data/stars.json').then((res) => res.json()).then(setStarsJson);
    fetch('/data/constellations.lines.json').then((res) => res.json()).then(setConstellationLinesJson);
    fetch('/data/constellations.json').then((res) => res.json()).then(setConstellationNamesJson);
  }, []);

  if (loading) return <FullScreenMessage text="Finding your location..." />;
  if (error) return <FullScreenMessage text={`Couldn't get your location: ${error}. Allow location access and reload.`} />;
  if (!starsJson) return <FullScreenMessage text="Loading star catalog..." />;

  const { observer, time } = makeContext(coords, now);

  return (
    <div style={{ width: '100%', height: '100vh', background: '#000' }}>
      <ImmersiveSkyDome
        starsJson={starsJson}
        constellationLinesJson={constellationLinesJson}
        constellationNamesJson={constellationNamesJson}
        observer={observer}
        time={time}
        magLimit={4.5}
      />
    </div>
  );
}

function FullScreenMessage({ text }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#070b16',
        color: 'rgba(244,239,230,0.8)',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 14,
        padding: 20,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}

export default App;
