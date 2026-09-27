import { useEffect, useState } from 'react';

/**
 * Wraps navigator.geolocation into a simple { coords, error, loading } state.
 * Falls back gracefully -- the caller decides what to show while loading
 * or if the user denies permission (e.g. let them type a city manually).
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  return { coords, error, loading };
}
