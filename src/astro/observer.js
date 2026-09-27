import * as Astronomy from 'astronomy-engine';

/**
 * Builds an Astronomy Engine Observer from a { latitude, longitude } pair.
 * Height above sea level is set to 0 by default -- close enough for
 * a stargazing app; altitude only matters for rise/set to the arcminute.
 */
export function makeObserver({ latitude, longitude, height = 0 }) {
  return new Astronomy.Observer(latitude, longitude, height);
}

/**
 * Wraps a JS Date into the AstroTime object Astronomy Engine expects.
 * Centralized here so the whole app converts time the same way.
 */
export function makeTime(date = new Date()) {
  return Astronomy.MakeTime(date);
}

/**
 * Convenience: build both observer + time in one call, since almost every
 * astro function needs the pair together.
 */
export function makeContext({ latitude, longitude, height = 0 }, date = new Date()) {
  return {
    observer: makeObserver({ latitude, longitude, height }),
    time: makeTime(date),
  };
}
