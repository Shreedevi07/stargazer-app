import { useEffect, useState } from 'react';

/**
 * Returns the current Date, updating every `intervalMs`. Everything that
 * needs "live" sky positions (sun, moon, stars) should derive from this
 * single ticking clock rather than each component polling Date.now() on
 * its own -- keeps all the astro math in sync to the same instant.
 *
 * Default interval is 60s: star/sun/moon positions don't move fast enough
 * on screen to need finer-grained updates, and this keeps CPU usage low.
 */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
