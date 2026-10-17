/**
 * Scene3D — the animated WebGL backdrop.
 *
 *   <Scene3D variant="hero" />     login / signup: a faceted "scanner" crystal
 *                                  with invoice cards orbiting through a scan
 *                                  beam; flagged ones flash red.
 *   <Scene3D variant="ambient" />  app background: a slow wire lattice and dust.
 *
 * three.js is imported lazily so it never blocks first paint. The scene
 * pauses when the tab is hidden, follows the light/dark theme, renders a
 * single still frame for prefers-reduced-motion, and renders nothing if
 * WebGL is unavailable (the CSS background still shows).
 */

import { useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";

const PALETTE = {
  dark:  { ink: 0x16160f, edge: 0xc4ef3a, bronze: 0xd08a52, flag: 0xff4d5e, dust: 0xe8e4d6, card: "#1d1c17", cardLine: "#5a594d" },
  light: { ink: 0xe9e6dc, edge: 0x5f7d0b, bronze: 0x9a552a, flag: 0xd61f45, dust: 0x45443c, card: "#fbfaf6", cardLine: "#c2c1b4" },
};

function invoiceTexture(THREE, colors, flagged) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 176;
  const g = c.getContext("2d");
  g.fillStyle = colors.card;
  g.beginPath(); g.roundRect(2, 2, 124, 172, 10); g.fill();
  g.strokeStyle = flagged ? "#ff4d5e" : "#c4ef3a";
  g.lineWidth = 3; g.stroke();
  g.fillStyle = colors.cardLine;
  g.fillRect(14, 18, 54, 9);                       // vendor name
  for (let i = 0; i < 6; i++) g.fillRect(14, 48 + i * 16, 100 - (i % 3) * 18, 5); // line items
  g.fillStyle = flagged ? "#ff4d5e" : "#c4ef3a";
  g.fillRect(70, 150, 44, 10);                     // total
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildScene(THREE, variant, colors) {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const animated = [];

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(colors.bronze, 18, 12);
  rim.position.set(-3, -1.5, 2);
  scene.add(rim);
  const glow = new THREE.PointLight(colors.edge, 10, 8);
  scene.add(glow);

  if (variant === "hero") {
    // Faceted crystal + glowing edges
    const geo = new THREE.IcosahedronGeometry(1.25, 1);
    const crystal = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: colors.ink, metalness: 0.75, roughness: 0.22, flatShading: true,
    }));
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: colors.edge, transparent: true, opacity: 0.9 }),
    );
    crystal.add(edges);
    group.add(crystal);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 2),
      new THREE.MeshBasicMaterial({ color: colors.edge, transparent: true, opacity: 0.9 }),
    );
    group.add(core);

    // Scan rings on different axes
    const rings = [1.75, 2.15, 2.6].map((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, i === 1 ? 0.012 : 0.006, 8, 160),
        new THREE.MeshBasicMaterial({ color: i === 1 ? colors.bronze : colors.edge, transparent: true, opacity: 0.55 }),
      );
      ring.rotation.x = Math.PI / 2 + i * 0.35;
      ring.rotation.y = i * 0.6;
      group.add(ring);
      return ring;
    });

    // Scan beam: a thin translucent fan sweeping around the crystal
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.03),
      new THREE.MeshBasicMaterial({ color: colors.edge, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    beam.position.x = 1.7;
    const beamPivot = new THREE.Group();
    beamPivot.add(beam);
    beamPivot.rotation.x = 0.35;
    group.add(beamPivot);

    // Invoice cards orbiting through the beam
    const cards = Array.from({ length: 9 }, (_, i) => {
      const flagged = i % 4 === 1;
      const mat = new THREE.MeshBasicMaterial({
        map: invoiceTexture(THREE, colors, flagged), transparent: true, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.58), mat);
      mesh.userData = {
        radius: 2.4 + (i % 3) * 0.45,
        speed: 0.18 + (i % 4) * 0.04,
        phase: (i / 9) * Math.PI * 2,
        tilt: 0.35 + (i % 2) * 0.25,
        flagged,
      };
      group.add(mesh);
      return mesh;
    });

    animated.push((t, camera) => {
      crystal.rotation.y = t * 0.25;
      crystal.rotation.x = Math.sin(t * 0.3) * 0.25;
      const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;
      core.scale.setScalar(pulse);
      glow.intensity = 8 + Math.sin(t * 2.4) * 4;
      rings.forEach((r, i) => { r.rotation.z = t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1); });
      beamPivot.rotation.y = t * 0.9;
      const beamAngle = (t * 0.9) % (Math.PI * 2);
      for (const card of cards) {
        const u = card.userData;
        const a = t * u.speed + u.phase;
        card.position.set(Math.cos(a) * u.radius, Math.sin(a) * u.radius * Math.sin(u.tilt) * 0.6, Math.sin(a) * u.radius * 0.55);
        card.lookAt(camera.position);
        // Cards light up as the beam passes them
        const cardAngle = Math.atan2(-card.position.z, card.position.x);
        const d = Math.abs(((cardAngle - beamAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const hit = Math.max(0, 1 - Math.abs(Math.PI - d) / 0.5);
        card.scale.setScalar(1 + hit * (u.flagged ? 0.35 : 0.15));
        card.material.opacity = 0.55 + hit * 0.45;
      }
    });
  } else {
    // Ambient: a large slow lattice sitting off to the side
    const geo = new THREE.IcosahedronGeometry(3.2, 1);
    const lattice = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: colors.edge, transparent: true, opacity: 0.16 }),
    );
    lattice.position.set(3.6, -0.8, -2);
    group.add(lattice);
    const inner = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.6, 0)),
      new THREE.LineBasicMaterial({ color: colors.bronze, transparent: true, opacity: 0.22 }),
    );
    inner.position.copy(lattice.position);
    group.add(inner);
    animated.push((t) => {
      lattice.rotation.y = t * 0.05;
      lattice.rotation.x = t * 0.03;
      inner.rotation.y = -t * 0.08;
      inner.rotation.z = t * 0.04;
    });
  }

  // Drifting dust
  const N = variant === "hero" ? 700 : 450;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: colors.dust, size: 0.025, transparent: true, opacity: variant === "hero" ? 0.55 : 0.35, sizeAttenuation: true,
  }));
  scene.add(dust);
  animated.push((t) => { dust.rotation.y = t * 0.012; dust.position.y = Math.sin(t * 0.2) * 0.15; });

  return { scene, group, animated };
}

export default function Scene3D({ variant = "ambient", className = "" }) {
  const hostRef = useRef(null);
  const { dark } = useTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      if (disposed) return;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL: keep the CSS background
      }
      const colors = PALETTE[dark ? "dark" : "light"];
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(variant === "hero" ? 42 : 50, 1, 0.1, 100);
      camera.position.set(0, 0, variant === "hero" ? 7.5 : 8);
      const { scene, group, animated } = buildScene(THREE, variant, colors);

      const resize = () => {
        const w = host.clientWidth || 1, h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const pointer = { x: 0, y: 0 };
      const onMove = (e) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const clock = new THREE.Clock();
      let frame = 0;
      let last = 0;
      const minFrameMs = variant === "hero" ? 0 : 33; // ambient at ~30fps

      const render = (now = 0) => {
        if (!reduced) frame = requestAnimationFrame(render);
        if (document.hidden || now - last < minFrameMs) return;
        last = now;
        const t = reduced ? 4 : clock.getElapsedTime();
        // Parallax: the whole scene leans toward the cursor
        group.rotation.y += ((pointer.x * 0.35) - group.rotation.y) * 0.04;
        group.rotation.x += ((pointer.y * 0.2) - group.rotation.x) * 0.04;
        animated.forEach((fn) => fn(t, camera));
        renderer.render(scene, camera);
      };
      render();

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        window.removeEventListener("pointermove", onMove);
        scene.traverse((o) => {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); });
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => { /* failed to load three: keep CSS background */ });

    return () => { disposed = true; cleanup(); };
  }, [variant, dark]);

  return <div ref={hostRef} aria-hidden="true" className={`scene3d scene3d--${variant} ${className}`} />;
}
