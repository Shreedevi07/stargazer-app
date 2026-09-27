import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { computeStarPositions, starAltAz } from '../../astro/starPositions';
import { getSunPosition, getMoonPosition } from '../../astro/sunMoon';

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

/**
 * A smooth, continuous haze layer (NOT discrete points -- a filled surface)
 * representing daytime atmospheric brightening. Only covers the upper
 * hemisphere (y >= 0) -- never below the horizon, so the horizon stays the
 * true boundary. Vertex colors go from white at the horizon to black at the
 * zenith; with additive blending, "black" contributes nothing (invisible),
 * so it reads as a smooth wash of brightness low in the sky that fades
 * away completely higher up -- real atmospheric haze, not sparkle/glitter.
 * Starts fully transparent (invisible, matching the existing night look
 * exactly) and only fades in while the sun is genuinely above the horizon.
 */
function createHazeDome() {
  const radius = 65;
  // thetaLength = PI/2 restricts this to just the upper hemisphere.
  const geometry = new THREE.SphereGeometry(radius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const posAttr = geometry.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const t = Math.max(0, Math.min(1, y / radius)); // 0 at horizon, 1 at zenith
    // Nearly invisible right at the horizon, smoothly brightening up to full
    // white haze by the zenith -- reads as an overall bright daytime sky.
    const brightness = Math.pow(t, 0.7);
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0, // starts invisible -- night looks exactly like today
    side: THREE.BackSide, // camera sits at the center looking outward
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

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
  observer,
  time,
  magLimit = 4.5,
}) {
  const containerRef = useRef(null);
  const headingRef = useRef(null);
  const labelRef = useRef(null);
  const labelTimeoutRef = useRef(null);

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
  const dustPointsRef = useRef(null); // daytime white-dust atmospheric layer
  const sunAltitudeRef = useRef(-90); // tracked each data update, read every frame to fade dust in/out

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(createBackgroundSphere());

    const hazeDome = createHazeDome();
    scene.add(hazeDome);
    dustPointsRef.current = hazeDome;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 200);
    camera.position.set(0, 0, 0);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ringPoints = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(Math.sin(a) * SPHERE_RADIUS, 0, Math.cos(a) * SPHERE_RADIUS));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPoints),
      new THREE.LineBasicMaterial({ color: 0xffdcb4, transparent: true, opacity: 0.3 })
    );
    scene.add(ring);

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

    let dragging = false;
    let lastX = 0, lastY = 0;
    let downX = 0, downY = 0;
    const sensitivity = 0.004;

    function onPointerDown(e) {
      dragging = true;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      cameraTweenRef.current = null;
      yawRef.current -= dx * sensitivity;
      pitchRef.current = Math.max(-1.45, Math.min(1.45, pitchRef.current - dy * sensitivity));
    }
    function onPointerUp(e) {
      dragging = false;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 8) handleTap(e);
    }

    function handleTap(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;

      const positions = starPositionsRef.current;
      const meta = starMetaRef.current;
      if (!positions || !meta.length) return;

      const v = new THREE.Vector3();
      let bestIdx = -1;
      let bestDist = 32;

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
      if (bestIdx === -1) return;

      const starMeta = meta[bestIdx];
      const raHours = starMeta.raDeg < 0 ? (starMeta.raDeg + 360) / 15 : starMeta.raDeg / 15;
      const info = Astronomy.Constellation(raHours, starMeta.decDeg);
      selectConstellation(info.symbol, info.name);
    }

    function selectConstellation(symbol, name) {
      const bySymbol = constellationGroupRef.current.userData.bySymbol;
      if (!bySymbol || !bySymbol[symbol]) return;
      const entry = bySymbol[symbol];

      for (const key of Object.keys(bySymbol)) {
        const isTarget = key === symbol;
        bySymbol[key].lineObj.visible = isTarget;
        bySymbol[key].glowObj.visible = isTarget;
      }
      activeCenteredSymbolRef.current = symbol;

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

      showNameLabel(name);
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
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

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
          let bestDot = 0.9;
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
            }
            if (bestSymbol) {
              bySymbol[bestSymbol].lineObj.visible = true;
              bySymbol[bestSymbol].glowObj.visible = true;
            }
            activeCenteredSymbolRef.current = bestSymbol;
          }
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

      // Daytime dust layer: fully invisible at/below horizon (matches today's
      // look exactly), fades in smoothly as the sun climbs, capped subtle.
      if (dustPointsRef.current) {
        const dayFactor = Math.max(0, Math.min(1, sunAltitudeRef.current / 15));
        dustPointsRef.current.material.opacity = dayFactor * 0.5;
      }

      renderer.render(scene, camera);

      if (headingRef.current) {
        const deg = ((-yawRef.current * 180) / Math.PI + 360) % 360;
        headingRef.current.textContent = `${Math.round(deg)}° ${headingLabel(deg)}`;
      }
      rafId = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeChild(renderer.domElement);
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

      meta[i] = { raDeg: star.raDeg, decDeg: star.decDeg };
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

      const sun = getSunPosition({ observer, time });
      sunAltitudeRef.current = sun.altitude;
      const sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: sun.altitude > 0 ? 1 : 0.3 })
      );
      sunMesh.position.copy(altAzToVector3(sun.altitude, sun.azimuth, SPHERE_RADIUS * 0.95));
      sunMesh.userData.isCelestialBody = true;
      scene.add(sunMesh);

      const moon = getMoonPosition({ observer, time });
      const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xd8d8e0, transparent: true, opacity: moon.altitude > 0 ? 1 : 0.3 })
      );
      moonMesh.position.copy(altAzToVector3(moon.altitude, moon.azimuth, SPHERE_RADIUS * 0.95));
      moonMesh.userData.isCelestialBody = true;
      scene.add(moonMesh);
    }
  }, [starsJson, observer, time, magLimit]);

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

      group.add(lineObj);
      group.add(glowObj);

      bySymbol[feature.id] = {
        lineObj,
        glowObj,
        centroid,
        name: nameLookup[feature.id] || feature.id,
      };
    }

    group.userData.bySymbol = bySymbol;
  }, [constellationLinesJson, constellationNamesJson, observer, time]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab', touchAction: 'none', background: '#000' }}>
      <div
        ref={headingRef}
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          letterSpacing: '0.15em',
          color: 'rgba(255,233,199,0.8)',
          pointerEvents: 'none',
        }}
      >
        0° N
      </div>
      <div
        ref={labelRef}
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: '0.08em',
          color: '#ffe9c7',
          textShadow: '0 0 12px rgba(255,180,100,0.8)',
          opacity: 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function headingLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
