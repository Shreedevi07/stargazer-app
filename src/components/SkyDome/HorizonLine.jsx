/**
 * A thin glowing line marking the horizon -- everything above is "now
 * visible" sky, everything below (revealed on scroll) is the underworld
 * of stars currently beneath your feet on the other side of the planet.
 */
export function HorizonLine({ label = 'HORIZON' }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 1,
        background: 'linear-gradient(to right, transparent, rgba(255,220,180,0.5) 20%, rgba(255,220,180,0.5) 80%, transparent)',
        boxShadow: '0 0 12px rgba(255,200,150,0.35)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: 8,
          transform: 'translateX(-50%)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'rgba(255,220,180,0.55)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}
