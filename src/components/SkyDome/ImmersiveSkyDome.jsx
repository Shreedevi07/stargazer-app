import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { computeStarPositions, starAltAz } from '../../astro/starPositions';

const SPHERE_RADIUS = 50;

function altAzToVector3(altitudeDeg, azimuthDeg, radius = SPHERE_RADIUS) {
  const alt = (altitudeDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  const x = radius * Math.cos(alt) * Math.sin(az);
  const y = radius * Math.sin(alt);
  const z = -radius * Math.cos(alt) * Math.cos(az);
  return new THREE.Vector3(x, y, z);
}

function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const cx = 64, cy = 64;

  ctx.globalCompositeOperation = 'lighter';

  // Tighter, higher-contrast glow -- less spread than before so it stays
  // crisp and visible even when scaled down small or viewed on a dim screen.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.2)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);

  function drawRay(length, width) {
    const grad = ctx.createLinearGradient(cx - length, cy, cx + length, cy);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - length, cy - width / 2, length * 2, width);
  }
  ctx.save();
  ctx.translate(cx, cy);
  drawRay(42, 2.2);
  ctx.rotate(Math.PI / 2);
  drawRay(42, 2.2);
  ctx.restore();

  // Sharp, bright pinpoint core -- this is what stays legible at small sizes.
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 128, 128);

  return new THREE.CanvasTexture(canvas);
}

function createLabelSprite(text, { color = '#ffe9c7', fontSize = 48, bold = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = `${bold ? '700' : '400'} ${fontSize}px 'Space Grotesk', sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 2, 1);
  return sprite;
}

function createConstellationNameSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.font = "700 76px 'Space Grotesk', sans-serif";
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 12;
  ctx.fillText(text.toUpperCase(), 512, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(11.5, 2.875, 1);
  return sprite;
}

function createPlanetNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = "700 48px 'Space Grotesk', sans-serif";
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 8;
  ctx.fillText(name.toUpperCase(), 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8.5, 2.125, 1);
  return sprite;
}

const CELESTIAL_BODIES = [
  { body: Astronomy.Body.Sun, name: 'SUN', color: 0xffd27a, size: 0.75 },
  { body: Astronomy.Body.Moon, name: 'MOON', color: 0xd8d8e0, size: 0.75 },
  { body: Astronomy.Body.Mercury, name: 'MERCURY', color: 0xb5a795, size: 0.25 },
  { body: Astronomy.Body.Venus, name: 'VENUS', color: 0xffe4a0, size: 0.4 },
  { body: Astronomy.Body.Mars, name: 'MARS', color: 0xff7b54, size: 0.35 },
  { body: Astronomy.Body.Jupiter, name: 'JUPITER', color: 0xe3b574, size: 0.5 },
  { body: Astronomy.Body.Saturn, name: 'SATURN', color: 0xf7d399, size: 0.45 },
  { body: Astronomy.Body.Uranus, name: 'URANUS', color: 0x7de3f4, size: 0.3 },
  { body: Astronomy.Body.Neptune, name: 'NEPTUNE', color: 0x4b7bec, size: 0.3 },
];

const COMPASS_POINTS = [
  { label: 'N', azimuth: 0, cardinal: true },
  { label: 'NE', azimuth: 45, cardinal: false },
  { label: 'E', azimuth: 90, cardinal: true },
  { label: 'SE', azimuth: 135, cardinal: false },
  { label: 'S', azimuth: 180, cardinal: true },
  { label: 'SW', azimuth: 225, cardinal: false },
  { label: 'W', azimuth: 270, cardinal: true },
  { label: 'NW', azimuth: 315, cardinal: false },
];

const ANCHOR_COLOR = '#0a205a';

/**
 * Background gradient sphere. Above the horizon: gentle darkening toward
 * the zenith. Below the horizon: the blue holds completely steady for the
 * first 55% of the way down, THEN fades toward true black over the
 * remaining 45%, reaching pure black only at the very bottom (nadir).
 */
function createBackgroundSphere() {
  const radius = 90;
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const posAttr = geometry.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const horizon = new THREE.Color(ANCHOR_COLOR);
  const zenith = horizon.clone().multiplyScalar(0.38);
  const black = new THREE.Color('#000000');
  const PLATEAU = 0.55;

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const t = y / radius;
    let c;
    if (t >= 0) {
      c = horizon.clone().lerp(zenith, t);
    } else {
      const belowT = -t;
      if (belowT <= PLATEAU) {
        c = horizon.clone();
      } else {
        const progress = (belowT - PLATEAU) / (1 - PLATEAU);
        c = horizon.clone().lerp(black, progress);
      }
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geometry, material);
}



function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

export function ImmersiveSkyDome({
  starsJson,
  constellationLinesJson,
  constellationNamesJson,
  starNamesJson,
  observer,
  time,
  coords,
  now,
  magLimit = 4.5,
  onBackToMenu,
}) {
  const containerRef = useRef(null);
  const headingRef = useRef(null);
  const sunBadgeRef = useRef(null);
  const labelRef = useRef(null);
  const labelTimeoutRef = useRef(null);
  const starNamesRef = useRef(starNamesJson);
  starNamesRef.current = starNamesJson;
  const lastTappedStarIdRef = useRef(null);
  const showingStarNameRef = useRef(false);
  const planetsMetaRef = useRef([]);
  const selectedConstellationSymbolRef = useRef(null);

  const getInitialSunData = () => {
    if (!observer || !time) return { altitude: -90, dir: new THREE.Vector3(0, 1, 0) };
    try {
      const eq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
      const hz = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
      const dir = altAzToVector3(hz.altitude, hz.azimuth, 1).normalize();
      return { altitude: hz.altitude, dir };
    } catch {
      return { altitude: -90, dir: new THREE.Vector3(0, 1, 0) };
    }
  };
  const initialSun = getInitialSunData();

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const cameraTweenRef = useRef(null);

  const sceneRef = useRef(null);
  const starPointsRef = useRef(null);
  const starMetaRef = useRef([]);
  const starPositionsRef = useRef(null);
  const starBaseColorsRef = useRef(null);
  const starPhasesRef = useRef(null);
  const starFreqsRef = useRef(null); // per-star twinkle speed, for non-uniform flicker
  const starAmpsRef = useRef(null); // per-star twinkle intensity, for non-uniform flicker
  const constellationGroupRef = useRef(null);
  const activeCenteredSymbolRef = useRef(null);

  const sunAltitudeRef = useRef(initialSun.altitude); // tracked each data update, read every frame to fade dust in/out
  const sunDirRef = useRef(initialSun.dir);
  const planetTargetsRef = useRef([]);
  const starTargetsRef = useRef([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(createBackgroundSphere());



    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 200);
    camera.position.set(0, 0, 0);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Continuous smooth horizon ring line (solid line, not dots)
    const ringPoints = [];
    const segments = 360;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.sin(a) * SPHERE_RADIUS, 0, Math.cos(a) * SPHERE_RADIUS));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xffe9c7,
      transparent: true,
      opacity: 0.75,
    });
    const ring = new THREE.LineLoop(ringGeo, ringMat);
    scene.add(ring);

    // Continuous anti-aliased horizon ribbon to guarantee uninterrupted solid line on mobile/retina displays
    const ribbonGeo = new THREE.RingGeometry(SPHERE_RADIUS - 0.08, SPHERE_RADIUS + 0.08, 180);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xffe9c7,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.rotation.x = Math.PI / 2;
    scene.add(ribbon);

    for (const { label, azimuth, cardinal } of COMPASS_POINTS) {
      const pos = altAzToVector3(2, azimuth, SPHERE_RADIUS * 0.98);
      const sprite = createLabelSprite(label, {
        fontSize: cardinal ? 56 : 40,
        color: cardinal ? '#ffe9c7' : 'rgba(255,233,199,0.55)',
      });
      sprite.position.copy(pos);
      scene.add(sprite);
    }

    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
      size: 1.7,
      map: createStarTexture(),
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.12,
      depthWrite: false,
    });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);
    starPointsRef.current = starPoints;

    const constellationGroup = new THREE.Group();
    scene.add(constellationGroup);
    constellationGroupRef.current = constellationGroup;

    renderer.domElement.style.touchAction = 'none';

    let dragging = false;
    let lastX = 0, lastY = 0;
    let downX = 0, downY = 0;
    const sensitivity = 0.004;

    const activePointers = new Map();
    let lastPinchDist = 0;
    let wasPinching = false;

    function onPointerDown(e) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        dragging = true;
        wasPinching = false;
        lastX = downX = e.clientX;
        lastY = downY = e.clientY;
      } else if (activePointers.size === 2) {
        dragging = false;
        wasPinching = true;
        const pts = Array.from(activePointers.values());
        lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    }

    function onPointerMove(e) {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Smooth, responsive, continuous two-finger pinch-to-zoom
      if (activePointers.size === 2) {
        const pts = Array.from(activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinchDist > 0 && dist > 0) {
          const ratio = dist / lastPinchDist;
          // Direct 1:1 responsive scaling - snappy, immediate, matches rotation responsiveness
          const zoomFactor = Math.pow(ratio, 1.4);
          camera.fov = Math.max(15, Math.min(95, camera.fov / zoomFactor));
          camera.updateProjectionMatrix();
        }
        lastPinchDist = dist;
        return;
      }

      // Responsive single-finger or mouse rotation
      if (!dragging || activePointers.size !== 1) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cameraTweenRef.current = null;
      yawRef.current -= dx * sensitivity;
      pitchRef.current = Math.max(-1.45, Math.min(1.45, pitchRef.current - dy * sensitivity));
    }

    function onPointerUp(e) {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        lastPinchDist = 0;
      }
      if (activePointers.size === 0) {
        dragging = false;
        const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
        // Only select star on deliberate single tap, never when releasing from a pinch gesture
        if (!wasPinching && moved < 8) {
          handleTap(e);
        }
        wasPinching = false;
      } else if (activePointers.size === 1) {
        // Seamless transition back to single-finger rotation without jump
        const remaining = activePointers.values().next().value;
        lastX = downX = remaining.x;
        lastY = downY = remaining.y;
        dragging = true;
      }
    }

    function onWheel(e) {
      e.preventDefault();
      e.stopPropagation();
      // Smooth continuous exponential wheel zoom
      const zoomFactor = Math.pow(0.998, -e.deltaY);
      camera.fov = Math.max(15, Math.min(95, camera.fov * zoomFactor));
      camera.updateProjectionMatrix();
    }

    function onTouchMove(e) {
      // Prevent browser default pinch-to-zoom or page scrolling
      if (e.cancelable) {
        e.preventDefault();
      }
    }

    function handleTap(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;

      const v = new THREE.Vector3();

      // Check for planet / celestial body selection first
      if (planetsMetaRef.current && planetsMetaRef.current.length > 0) {
        let bestPlanet = null;
        let bestPlanetDist = 48; // tap distance tolerance in pixels

        for (const p of planetsMetaRef.current) {
          v.copy(p.pos);
          v.project(camera);
          if (v.z < -1 || v.z > 1) continue;
          const sx = (v.x * 0.5 + 0.5) * rect.width;
          const sy = (-v.y * 0.5 + 0.5) * rect.height;
          const d = Math.hypot(sx - tapX, sy - tapY);
          if (d < bestPlanetDist) {
            bestPlanetDist = d;
            bestPlanet = p;
          }
        }

        if (bestPlanet) {
          // Deactivate any active constellation highlight
          if (constellationGroupRef.current?.userData?.bySymbol) {
            const bySymbol = constellationGroupRef.current.userData.bySymbol;
            for (const key of Object.keys(bySymbol)) {
              bySymbol[key].lineObj.visible = false;
              bySymbol[key].glowObj.visible = false;
              if (bySymbol[key].nameSprite) {
                bySymbol[key].nameSprite.visible = false;
              }
            }
          }
          activeCenteredSymbolRef.current = null;
          selectedConstellationSymbolRef.current = null;
          lastTappedStarIdRef.current = null;
          showingStarNameRef.current = false;

          // Smoothly center the camera on the tapped planet
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, -1),
            bestPlanet.pos.clone().normalize()
          );
          const targetEuler = new THREE.Euler().setFromQuaternion(targetQuat, 'YXZ');
          cameraTweenRef.current = {
            startYaw: yawRef.current,
            startPitch: pitchRef.current,
            targetYaw: targetEuler.y,
            targetPitch: Math.max(-1.45, Math.min(1.45, targetEuler.x)),
            startTime: performance.now(),
            duration: 700,
          };

          // Make planet name visible on the bottom center badge
          showNameLabel(bestPlanet.displayName);
          return;
        }
      }

      const positions = starPositionsRef.current;
      const meta = starMetaRef.current;
      if (!positions || !meta.length) return;

      let bestIdx = -1;
      let bestDist = 48;

      for (let i = 0; i < meta.length; i++) {
        v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        v.project(camera);
        if (v.z < -1 || v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * rect.width;
        const sy = (-v.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - tapX, sy - tapY);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      // If no star was hit directly, check if user tapped near any constellation line
      if (bestIdx === -1) {
        const bySymbol = constellationGroupRef.current?.userData?.bySymbol;
        if (bySymbol) {
          let bestLineConstellation = null;
          let minLineDist = 48;

          const pA = new THREE.Vector3();
          const pB = new THREE.Vector3();

          for (const symbol of Object.keys(bySymbol)) {
            const entry = bySymbol[symbol];
            if (!entry.lineSegments) continue;

            for (const seg of entry.lineSegments) {
              pA.copy(seg.p1).project(camera);
              if (pA.z < -1 || pA.z > 1) continue;
              pB.copy(seg.p2).project(camera);
              if (pB.z < -1 || pB.z > 1) continue;

              const x1 = (pA.x * 0.5 + 0.5) * rect.width;
              const y1 = (-pA.y * 0.5 + 0.5) * rect.height;
              const x2 = (pB.x * 0.5 + 0.5) * rect.width;
              const y2 = (-pB.y * 0.5 + 0.5) * rect.height;

              const d = distToSegment(tapX, tapY, x1, y1, x2, y2);
              if (d < minLineDist) {
                minLineDist = d;
                bestLineConstellation = { symbol, name: entry.name };
              }
            }
          }

          if (bestLineConstellation) {
            selectConstellation(bestLineConstellation.symbol, bestLineConstellation.name, true);
            selectedConstellationSymbolRef.current = bestLineConstellation.symbol;
            lastTappedStarIdRef.current = null;
            showingStarNameRef.current = false;
            showNameLabel(bestLineConstellation.name);
            return;
          }
        }
        return;
      }

      const starMeta = meta[bestIdx];
      const raHours = starMeta.raDeg < 0 ? (starMeta.raDeg + 360) / 15 : starMeta.raDeg / 15;
      const info = Astronomy.Constellation(raHours, starMeta.decDeg);
      const starName = getStarDisplayName(starMeta, starNamesRef.current, info);

      // Check if this constellation is ALREADY the selected constellation
      const isAlreadySelectedConstellation =
        selectedConstellationSymbolRef.current === info.symbol;

      if (!isAlreadySelectedConstellation) {
        // First click on this constellation:
        // 1. Reveal constellation lines & glow, and center camera
        selectConstellation(info.symbol, info.name, true);
        selectedConstellationSymbolRef.current = info.symbol;
        lastTappedStarIdRef.current = null;
        showingStarNameRef.current = false;

        // 2. Display ONLY the actual constellation name without triggering star names
        showNameLabel(info.name);
        return;
      }

      // Second time: the user is clicking on a star in the currently selected constellation!
      const combinedLabel = starName && !starName.includes(info.name)
        ? `${starName} • ${info.name}`
        : (starName || info.name);

      // If clicking on the exact same star again while its label is active, toggle pure star name & combined title
      if (lastTappedStarIdRef.current === starMeta.id) {
        if (!showingStarNameRef.current) {
          showNameLabel(starName);
          showingStarNameRef.current = true;
        } else {
          showNameLabel(combinedLabel);
          showingStarNameRef.current = false;
        }
        return;
      }

      // First time clicking this specific star in the active constellation:
      lastTappedStarIdRef.current = starMeta.id;
      showingStarNameRef.current = false;
      showNameLabel(combinedLabel);
    }

    function selectConstellation(symbol, name, shouldTween = true) {
      const bySymbol = constellationGroupRef.current?.userData?.bySymbol;
      if (bySymbol && bySymbol[symbol]) {
        const entry = bySymbol[symbol];

        for (const key of Object.keys(bySymbol)) {
          const isTarget = key === symbol;
          bySymbol[key].lineObj.visible = isTarget;
          bySymbol[key].glowObj.visible = isTarget;
          if (bySymbol[key].nameSprite) {
            bySymbol[key].nameSprite.visible = isTarget;
          }
        }
        activeCenteredSymbolRef.current = symbol;

        if (shouldTween) {
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, -1),
            entry.centroid.clone().normalize()
          );
          const targetEuler = new THREE.Euler().setFromQuaternion(targetQuat, 'YXZ');
          cameraTweenRef.current = {
            startYaw: yawRef.current,
            startPitch: pitchRef.current,
            targetYaw: targetEuler.y,
            targetPitch: Math.max(-1.45, Math.min(1.45, targetEuler.x)),
            startTime: performance.now(),
            duration: 700,
          };
        }
      } else {
        activeCenteredSymbolRef.current = symbol;
      }
    }

    function showNameLabel(name) {
      if (!labelRef.current) return;
      labelRef.current.textContent = name;
      labelRef.current.style.opacity = 1;
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
      labelTimeoutRef.current = setTimeout(() => {
        if (labelRef.current) labelRef.current.style.opacity = 0;
      }, 3000);
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });

    let rafId;
    const forward = new THREE.Vector3();
    function animate() {

      const tween = cameraTweenRef.current;
      if (tween) {
        const elapsed = performance.now() - tween.startTime;
        const progress = Math.min(1, elapsed / tween.duration);
        const eased = easeInOutCubic(progress);
        yawRef.current = lerpAngle(tween.startYaw, tween.targetYaw, eased);
        pitchRef.current = tween.startPitch + (tween.targetPitch - tween.startPitch) * eased;
        if (progress >= 1) cameraTweenRef.current = null;
      }

      camera.rotation.y = yawRef.current;
      camera.rotation.x = pitchRef.current;
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(forward);

      if (!cameraTweenRef.current) {
        const bySymbol = constellationGroupRef.current.userData.bySymbol;
        if (bySymbol) {
          let bestSymbol = null;
          let bestDot = 0.82;
          for (const symbol of Object.keys(bySymbol)) {
            const dot = forward.dot(bySymbol[symbol].centroid);
            if (dot > bestDot) {
              bestDot = dot;
              bestSymbol = symbol;
            }
          }
          if (bestSymbol !== activeCenteredSymbolRef.current) {
            if (activeCenteredSymbolRef.current && bySymbol[activeCenteredSymbolRef.current]) {
              bySymbol[activeCenteredSymbolRef.current].lineObj.visible = false;
              bySymbol[activeCenteredSymbolRef.current].glowObj.visible = false;
              if (bySymbol[activeCenteredSymbolRef.current].nameSprite) {
                bySymbol[activeCenteredSymbolRef.current].nameSprite.visible = false;
              }
            }
            if (bestSymbol) {
              bySymbol[bestSymbol].lineObj.visible = true;
              bySymbol[bestSymbol].glowObj.visible = true;
              if (bySymbol[bestSymbol].nameSprite) {
                bySymbol[bestSymbol].nameSprite.visible = true;
              }
            }
            activeCenteredSymbolRef.current = bestSymbol;
            if (selectedConstellationSymbolRef.current && bestSymbol !== selectedConstellationSymbolRef.current) {
              selectedConstellationSymbolRef.current = null;
              lastTappedStarIdRef.current = null;
            }
          }
        }
      }

      // Centered main focus view names (min 5 to max 12 names near screen center)
      const allTargets = [];

      const planetTargets = planetTargetsRef.current;
      if (planetTargets) {
        for (const target of planetTargets) {
          const dot = forward.dot(target.dir);
          if (dot > 0.5) {
            allTargets.push({ target, dot });
          } else {
            target.nameSprite.visible = false;
          }
        }
      }

      const starTargets = starTargetsRef.current;
      if (starTargets) {
        for (const target of starTargets) {
          const dot = forward.dot(target.dir);
          if (dot > 0.5) {
            allTargets.push({ target, dot });
          } else {
            target.nameSprite.visible = false;
          }
        }
      }

      if (allTargets.length > 0) {
        allTargets.sort((a, b) => b.dot - a.dot);

        // Filter to primary center focus zone (dot > 0.78), bounded between 5 and 12 names
        const primaryFocusCount = allTargets.filter((item) => item.dot > 0.78).length;
        const targetCount = Math.min(allTargets.length, Math.max(5, Math.min(12, primaryFocusCount)));

        const activeSet = new Set(allTargets.slice(0, targetCount).map((item) => item.target));
        for (const item of allTargets) {
          item.target.nameSprite.visible = activeSet.has(item.target);
        }
      }

      // Subtle twinkle: gently modulate brightness per star, not size --
      // each star has its OWN speed and intensity (not just phase offset),
      // so the field feels organically alive rather than uniformly pulsing.
      // Guards against a timing race (React's dev-mode double-effect can
      // briefly recreate the geometry before its color attribute is set).
      const baseColors = starBaseColorsRef.current;
      const phases = starPhasesRef.current;
      const freqs = starFreqsRef.current;
      const amps = starAmpsRef.current;
      const colorAttr = starPointsRef.current?.geometry?.attributes?.color;
      if (baseColors && phases && freqs && amps && colorAttr) {
        const liveColors = colorAttr.array;
        const t = performance.now() / 1000;
        for (let i = 0; i < phases.length; i++) {
          const factor = 1 + amps[i] * Math.sin(t * freqs[i] + phases[i]);
          liveColors[i * 3] = baseColors[i * 3] * factor;
          liveColors[i * 3 + 1] = baseColors[i * 3 + 1] * factor;
          liveColors[i * 3 + 2] = baseColors[i * 3 + 2] * factor;
        }
        colorAttr.needsUpdate = true;
      }



      renderer.render(scene, camera);

      if (headingRef.current) {
        const rawDeg = (-yawRef.current * 180) / Math.PI;
        const normalizedDeg = ((rawDeg % 360) + 360) % 360;
        const roundedDeg = Math.round(normalizedDeg) % 360;
        headingRef.current.textContent = `${roundedDeg}° ${headingLabel(normalizedDeg)}`;
      }
      if (sunBadgeRef.current) {
        const alt = sunAltitudeRef.current;
        sunBadgeRef.current.textContent = alt > 0
          ? `SUN: +${alt.toFixed(1)}°`
          : `SUN: ${alt.toFixed(1)}°`;
      }
      rafId = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!starsJson || !observer || !time || !starPointsRef.current) return;

    const stars = computeStarPositions(starsJson, observer, time, magLimit);
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const phases = new Float32Array(stars.length);
    const freqs = new Float32Array(stars.length);
    const amps = new Float32Array(stars.length);
    const meta = new Array(stars.length);

    stars.forEach((star, i) => {
      const v = altAzToVector3(star.altitude, star.azimuth);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      const below = star.altitude < 0;
      const brightness = Math.max(0.5, 1 - star.mag / 6) * (below ? 0.55 : 1);
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness * (below ? 0.92 : 1);
      colors[i * 3 + 2] = Math.min(1, brightness * (below ? 1.1 : 1.02));

      meta[i] = { id: star.id, raDeg: star.raDeg, decDeg: star.decDeg, mag: star.mag };
      phases[i] = Math.random() * Math.PI * 2;
      freqs[i] = 0.3 + Math.random() * 0.7; // each star pulses at its own slow speed
      amps[i] = 0.04 + Math.random() * 0.06; // and its own gentle intensity (4-10%)
    });

    const geometry = starPointsRef.current.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    starMetaRef.current = meta;
    starPositionsRef.current = positions;
    starBaseColorsRef.current = colors.slice(); // a separate copy, so twinkle never overwrites the original
    starPhasesRef.current = phases;
    starFreqsRef.current = freqs;
    starAmpsRef.current = amps;

    const scene = sceneRef.current;
    if (scene) {
      scene.children = scene.children.filter((c) => !c.userData.isCelestialBody);
      planetTargetsRef.current = [];
      starTargetsRef.current = [];

      const planetsList = [];
      CELESTIAL_BODIES.forEach(({ body, name, color, size }) => {
        const eq = Astronomy.Equator(body, time, observer, true, true);
        const hz = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');

        const dir = altAzToVector3(hz.altitude, hz.azimuth, 1).normalize();
        const opacity = hz.altitude > 0 ? 1 : 0.35;

        if (body === Astronomy.Body.Sun) {
          sunAltitudeRef.current = hz.altitude;
          sunDirRef.current = dir;
        }

        // 3D planet mesh
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(size, 24, 24),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
        );
        mesh.position.copy(altAzToVector3(hz.altitude, hz.azimuth, SPHERE_RADIUS * 0.95));
        mesh.userData.isCelestialBody = true;
        scene.add(mesh);

        // 3D white font name label
        const nameSprite = createPlanetNameSprite(name);
        nameSprite.position.copy(altAzToVector3(hz.altitude + 1.5, hz.azimuth, SPHERE_RADIUS * 0.94));
        nameSprite.material.opacity = 1;
        nameSprite.visible = false;
        nameSprite.userData.isCelestialBody = true;
        scene.add(nameSprite);

        planetTargetsRef.current.push({ dir, nameSprite });

        const displayName = name.charAt(0) + name.slice(1).toLowerCase();
        planetsList.push({
          name,
          displayName,
          pos: mesh.position.clone(),
          dir,
        });
      });
      planetsMetaRef.current = planetsList;

      // Additional star names (e.g. Sirius, Betelgeuse, Rigel, Vega, Polaris)
      stars.forEach((star) => {
        const nameInfo = starNamesJson ? starNamesJson[star.id] : null;
        const rawName = nameInfo && typeof nameInfo === 'object' ? nameInfo.name : (typeof nameInfo === 'string' ? nameInfo : null);
        if (rawName && rawName.trim().length > 0) {
          const starName = rawName.trim().toUpperCase();
          const dir = altAzToVector3(star.altitude, star.azimuth, 1).normalize();

          const nameSprite = createPlanetNameSprite(starName);
          nameSprite.position.copy(altAzToVector3(star.altitude + 1.2, star.azimuth, SPHERE_RADIUS * 0.94));
          nameSprite.material.opacity = 1;
          nameSprite.visible = false;
          nameSprite.userData.isCelestialBody = true;
          scene.add(nameSprite);

          starTargetsRef.current.push({ dir, nameSprite });
        }
      });
    }
  }, [starsJson, starNamesJson, observer, time, magLimit]);

  useEffect(() => {
    if (!constellationLinesJson || !observer || !time || !constellationGroupRef.current) return;

    const group = constellationGroupRef.current;
    group.clear();
    const bySymbol = {};
    const nameLookup = {};
    if (constellationNamesJson) {
      for (const f of constellationNamesJson.features) {
        nameLookup[f.id] = f.properties?.name ?? f.id;
      }
    }

    for (const feature of constellationLinesJson.features) {
      const linePositions = [];
      const allPoints = [];
      for (const segment of feature.geometry.coordinates) {
        const points3D = segment.map(([raDeg, decDeg]) => {
          const { altitude, azimuth } = starAltAz([raDeg, decDeg], observer, time);
          return altAzToVector3(altitude, azimuth);
        });
        allPoints.push(...points3D);
        for (let i = 0; i < points3D.length - 1; i++) {
          linePositions.push(points3D[i].x, points3D[i].y, points3D[i].z);
          linePositions.push(points3D[i + 1].x, points3D[i + 1].y, points3D[i + 1].z);
        }
      }
      if (linePositions.length === 0) continue;

      const centroid = new THREE.Vector3();
      for (const p of allPoints) centroid.add(p);
      centroid.divideScalar(allPoints.length).normalize();

      const posArray = new Float32Array(linePositions);

      const coreGeom = new THREE.BufferGeometry();
      coreGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      const coreMat = new THREE.LineBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.9 });
      const lineObj = new THREE.LineSegments(coreGeom, coreMat);
      lineObj.visible = false;

      const glowGeom = new THREE.BufferGeometry();
      glowGeom.setAttribute('position', new THREE.BufferAttribute(posArray.slice(), 3));
      const glowMat = new THREE.LineBasicMaterial({
        color: 0xffa94d,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
      });
      const glowObj = new THREE.LineSegments(glowGeom, glowMat);
      glowObj.visible = false;

      const constName = nameLookup[feature.id] || feature.id;
      const nameSprite = createConstellationNameSprite(constName);
      nameSprite.position.copy(centroid.clone().multiplyScalar(SPHERE_RADIUS * 0.95));
      nameSprite.visible = false;

      group.add(lineObj);
      group.add(glowObj);
      group.add(nameSprite);

      const lineSegments = [];
      for (let i = 0; i < linePositions.length; i += 6) {
        lineSegments.push({
          p1: new THREE.Vector3(linePositions[i], linePositions[i + 1], linePositions[i + 2]),
          p2: new THREE.Vector3(linePositions[i + 3], linePositions[i + 4], linePositions[i + 5]),
        });
      }

      bySymbol[feature.id] = {
        lineObj,
        glowObj,
        nameSprite,
        centroid,
        name: constName,
        lineSegments,
      };
    }

    group.userData.bySymbol = bySymbol;
  }, [constellationLinesJson, constellationNamesJson, observer, time]);

  const formattedTime = now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '';
  const formattedDate = now ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase() : '';
  const lat = coords?.latitude ?? 51.4769;
  const lon = coords?.longitude ?? -0.0005;

  return (
    <div className="planetarium-viewport-wrapper">
      {/* LAYER 1: Dedicated 3D Star Map Viewport Container */}
      <div className="skydome-3d-layer">
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            cursor: 'grab',
            touchAction: 'none',
          }}
        />
      </div>

      {/* LAYER 2: Fixed Planetarium Top Header Overlay (Stationary & Independent) */}
      <header className="app-header-still planetarium-fixed-header">
        <div className="planetarium-header-group left-group">
          {onBackToMenu && (
            <button className="btn-menu-back" onClick={onBackToMenu}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              MENU
            </button>
          )}

          <div className="header-location-spec">
            <span className="spec-label">OBSERVER LAT/LON:</span>
            <span className="spec-value">{lat.toFixed(2)}°, {lon.toFixed(2)}°</span>
          </div>
        </div>

        <div className="planetarium-header-group center-group">
          <div ref={headingRef} className="heading-badge">
            0° N
          </div>
          <div ref={sunBadgeRef} className="mag-spec-badge" style={{ color: initialSun.altitude > 0 ? '#ffd27a' : 'rgba(255, 233, 199, 0.6)' }}>
            SUN: {initialSun.altitude > 0 ? `+${initialSun.altitude.toFixed(1)}°` : `${initialSun.altitude.toFixed(1)}°`}
          </div>
          <div className="mag-spec-badge">
            MAG LIMIT: {magLimit}
          </div>
        </div>

        <div className="planetarium-header-group right-group header-time-display">
          <span className="time-val">{formattedTime} UTC</span>
          <span className="date-val">{formattedDate}</span>
        </div>
      </header>

      {/* LAYER 3: Fixed Selected Star / Constellation Name Overlay */}
      <div className="selected-star-overlay-container">
        <div
          ref={labelRef}
          className="selected-star-badge"
        />
      </div>


    </div>
  );
}

function headingLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45);
  const normalizedIndex = ((index % 8) + 8) % 8;
  return dirs[normalizedIndex] || 'N';
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function getStarDisplayName(starMeta, starNamesJson, constellationInfo) {
  const starId = starMeta?.id;
  const cName = constellationInfo?.name || '';
  if (!starId || !starNamesJson) {
    return cName ? `Star in ${cName}` : 'Star';
  }

  const info = starNamesJson[starId];
  if (!info) {
    return cName ? `Star in ${cName}` : `HIP ${starId}`;
  }

  if (typeof info === 'string' && info.trim()) {
    return info.trim();
  }

  if (info.name && info.name.trim()) {
    return info.name.trim();
  }

  if (info.bayer) {
    return cName ? `${info.bayer} ${cName}` : `${info.bayer} (${info.c || ''})`;
  }

  if (info.flam) {
    return cName ? `${info.flam} ${cName}` : `${info.flam} (${info.c || ''})`;
  }

  if (info.desig) {
    return cName ? `${info.desig} ${cName}` : info.desig;
  }

  if (info.hd) return info.hd;
  if (info.hip) return info.hip;

  return `HIP ${starId}`;
}
