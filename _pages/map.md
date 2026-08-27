---
title: "Map"
permalink: /map/
layout: single
classes: wide
---

Places I've studied, worked, or spoken. Drag to spin, click a point.

<style>
  #globe-widget {
    --gw-bg: #08172E;
    --gw-fg: #DDD8B8;
    --gw-fg-muted: rgba(221, 216, 184, 0.55);
    --gw-panel-bg: rgba(8, 23, 46, 0.92);
    --gw-panel-border: rgba(221, 216, 184, 0.18);
    --gw-accent: #E77728;
    --gw-accent-border: rgba(231, 119, 40, 0.35);
    --gw-hint: rgba(221, 216, 184, 0.32);

    position: relative;
    width: 100%;
    height: min(70vh, 640px);
    min-height: 380px;
    background: var(--gw-bg);
    overflow: hidden;
    touch-action: pan-y;
    cursor: grab;
  }
  #globe-widget.dragging { cursor: grabbing; }
  #globe-widget canvas { display: block; width: 100% !important; height: 100% !important; }
  #globe-hint {
    position: absolute; left: 16px; bottom: 14px;
    font: 400 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .08em; text-transform: uppercase;
    color: var(--gw-hint); pointer-events: none;
    transition: opacity .4s ease;
  }
  #globe-tooltip {
    position: absolute; transform: translate(-50%, -170%);
    font: 500 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .04em; color: var(--gw-fg);
    background: var(--gw-panel-bg); border: 1px solid var(--gw-panel-border);
    padding: 7px 10px; border-radius: 4px; pointer-events: none;
    opacity: 0; transition: opacity .15s ease; white-space: nowrap;
  }
  #globe-popup {
    position: absolute; width: 330px; max-width: calc(100% - 32px);
    transform: translate(-50%, calc(-100% - 18px));
    background: var(--gw-panel-bg);
    border: 1px solid var(--gw-panel-border);
    border-radius: 8px; padding: 18px 20px 19px;
    color: var(--gw-fg); opacity: 0; visibility: hidden;
    transition: opacity .18s ease;
    backdrop-filter: blur(6px);
    box-shadow: 0 18px 40px -18px rgba(0,0,0,.9);
  }
  #globe-popup.open { opacity: 1; visibility: visible; }
  #globe-popup .gp-meta {
    font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .12em; text-transform: uppercase;
    color: var(--gw-fg-muted); margin-bottom: 9px;
  }
  #globe-popup .gp-title { font-size: 18px; font-weight: 600; line-height: 1.25; margin-bottom: 6px; }
  #globe-popup .gp-body { font-size: 14px; line-height: 1.5; color: var(--gw-fg-muted); text-wrap: pretty; }
  #globe-popup a.gp-link {
    display: inline-block; margin-top: 12px; font-size: 13px;
    color: var(--gw-accent); text-decoration: none; border-bottom: 1px solid var(--gw-accent-border);
  }
  #globe-popup a.gp-link:hover { border-bottom-color: var(--gw-accent); }
  #globe-popup .gp-close {
    position: absolute; top: 8px; right: 9px; width: 20px; height: 20px;
    display: grid; place-items: center; background: none; border: 0; cursor: pointer;
    color: var(--gw-fg-muted); font-size: 15px; line-height: 1; padding: 0;
  }
  #globe-popup .gp-close:hover { color: var(--gw-fg); }
  #globe-popup::after {
    content: ""; position: absolute; left: 50%; bottom: -5px; width: 9px; height: 9px;
    transform: translateX(-50%) rotate(45deg);
    background: var(--gw-panel-bg);
    border-right: 1px solid var(--gw-panel-border);
    border-bottom: 1px solid var(--gw-panel-border);
  }
</style>

<div id="globe-widget">
  <div id="globe-tooltip"></div>
  <div id="globe-popup">
    <button class="gp-close" aria-label="Close">×</button>
    <div class="gp-meta"></div>
    <div class="gp-title"></div>
    <div class="gp-body"></div>
    <a class="gp-link" href="#" target="_blank" rel="noopener">Open</a>
  </div>
  <div id="globe-hint">drag to spin &nbsp;·&nbsp; click a point</div>
</div>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.184.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.184.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/* ─── 1. POINTS ──────────────────────────────────────────────────────
   lat, lon in degrees. link is optional.                             */
const POINTS = [
  { lat: 48.1372, lon: 11.5756, meta: 'Munich, Germany',   title: 'LMU Munich',                    body: 'Postdoctoral researcher, data analytics and statistics in particle physics. PhD 2025.', link: 'https://lorenzgaertner.com/cv/' },
  { lat: 52.5186, lon: 13.3761, meta: 'Berlin, Germany',   title: 'German Bundestag',              body: 'Scientific advisor on energy, economic and technology policy.' },
  { lat: 48.2349, lon: 16.4166, meta: 'Vienna, Austria',   title: 'IAEA',                          body: 'Worked on fission–fusion synergies at the International Atomic Energy Agency.', link: 'https://conferences.iaea.org/event/285/contributions/22008/attachments/11960/19453/1.00-Virgili.pdf' },
  { lat: 46.2333, lon: 6.0557,  meta: 'Geneva, Switzerland', title: 'CERN',                        body: 'Taught at the Inverted CERN School of Computing.' },
  { lat: 36.1069, lon: 140.0844, meta: 'Tsukuba, Japan',   title: 'KEK (Belle II)',                body: 'Belle II StarterKit tutorials and Physics Week talks.', link: 'https://indico.belle2.org/event/12273/contributions/79673/' },
  { lat: 53.4808, lon: -2.2426, meta: 'Manchester, UK',    title: 'University of Manchester',      body: 'BSc Physics. Franz Mandl Prize for best theoretical physics graduate.' },
  { lat: 53.5753, lon: 9.8790,  meta: 'Hamburg, Germany',  title: 'DESY',                          body: 'CERN School of Computing and WLCG/HSF workshop talks.', link: 'https://indico.cern.ch/event/1369601/contributions/5867792/' },
  { lat: 35.9940, lon: -78.8986, meta: 'Durham, NC, USA',  title: 'Duke University',               body: 'Belle II Summer Workshop: talk and tutorial.', link: 'https://indico.belle2.org/event/8841/contributions/63802/' },
  { lat: 43.2965, lon: 5.3698,  meta: 'Marseille, France', title: 'IRN Terascale',                 body: 'Invited talk on reinterpretation of LHC results.', link: 'https://indico.in2p3.fr/event/30546/contributions/128802/' },
  { lat: 37.4189, lon: -122.2000, meta: 'Menlo Park, CA, USA', title: 'SLAC National Accelerator Laboratory', body: 'Scientist / software engineer for astrophysics. Extended the redMaPPer galaxy cluster finder with uncertainty estimation and masking corrections.' },
];

/* ─── 2. LOOK — site palette, swapped for the active dark/light skin ─
   theme-init.js sets html[data-theme] when the site toggle is used;
   colours below are derived from that skin's own background/text/
   accent tokens (see _sass/minimal-mistakes/skins/_dark.scss and
   _custom-light.scss) so the globe always matches the page around it. */
const THEMES = {
  dark:  { bg: '#08172E', land: '#DDD8B8', grid: '#5D6465', point: '#E77728' },
  light: { bg: '#DDD8B8', land: '#08172E', grid: '#888B81', point: '#E77728' },
};
const spinSpeed = 0.35;  // degrees-ish; 0 to stop
const tilt = 18;         // camera latitude, degrees

function siteTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
let currentTheme = siteTheme();
let theme = THEMES[currentTheme];

const wrap    = document.getElementById('globe-widget');
const tooltip = document.getElementById('globe-tooltip');
const popup   = document.getElementById('globe-popup');
const hint    = document.getElementById('globe-hint');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 0, 3.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setClearColor(theme.bg, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const globe = new THREE.Group();
scene.add(globe);

/* occluder — hides the far side of the mesh so the silhouette reads clean */
const occluder = new THREE.Mesh(
  new THREE.SphereGeometry(0.995, 64, 48),
  new THREE.MeshBasicMaterial({ color: theme.bg })
);
occluder.name = 'occluder';
globe.add(occluder);

/* lat/lon mesh */
function graticule(step = 15, r = 1.001) {
  const pts = [];
  const at = (lat, lon) => {
    const p = (90 - lat) * Math.PI / 180, t = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
  };
  for (let lat = -75; lat <= 75; lat += step)
    for (let lon = -180; lon < 180; lon += 3) { pts.push(at(lat, lon), at(lat, lon + 3)); }
  for (let lon = -180; lon < 180; lon += step)
    for (let lat = -90; lat < 90; lat += 3) { pts.push(at(lat, lon), at(lat + 3, lon)); }
  const g = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.55 })
  );
  g.name = 'graticule';
  return g;
}
const graticuleMesh = graticule();
globe.add(graticuleMesh);

/* country outlines, decoded straight from a TopoJSON world atlas */
const latLonToVec3 = (lat, lon, r = 1.006) => {
  const p = (90 - lat) * Math.PI / 180, t = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
};

let landMat = null;
fetch(ATLAS_URL)
  .then(r => r.json())
  .then(topo => {
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const pts = [];
    for (const arc of topo.arcs) {
      let x = 0, y = 0, prev = null;
      for (const [dx, dy] of arc) {
        x += dx; y += dy;
        const v = latLonToVec3(y * sy + ty, x * sx + tx);
        if (prev) pts.push(prev, v);
        prev = v;
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: theme.land, transparent: true, opacity: 0.9 });
    landMat = mat;
    const land = new THREE.LineSegments(geo, mat);
    land.name = 'countries';
    globe.add(land);
    /* two hairline-offset copies read as one thicker stroke */
    [[0.0022, 0], [0, 0.0022]].forEach(([rx, ry], k) => {
      const c = new THREE.LineSegments(geo, mat);
      c.rotation.set(rx, ry, 0);
      c.name = 'countries-weight-' + k;
      globe.add(c);
    });
  })
  .catch(() => {}); /* offline: the mesh globe still renders */

/* points */
const markerGeo = new THREE.SphereGeometry(0.0105, 16, 12);
const markerMat = new THREE.MeshBasicMaterial({ color: theme.point });
const haloMat = new THREE.MeshBasicMaterial({ color: theme.point, transparent: true, opacity: 0.3, depthWrite: false });
/* invisible, larger hit-target sphere used only for raycasting — the
   visible dot is too small on screen to click reliably */
const hitGeo = new THREE.SphereGeometry(0.05, 12, 8);
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const markers = [];
POINTS.forEach((d, i) => {
  const pos = latLonToVec3(d.lat, d.lon, 1.012);
  const m = new THREE.Mesh(markerGeo, markerMat);
  m.position.copy(pos);
  m.name = 'point-' + i;
  m.userData = { d, i };
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), haloMat);
  halo.position.copy(pos);
  halo.name = 'point-halo-' + i;
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.position.copy(pos);
  hit.name = 'point-hit-' + i;
  globe.add(m, halo, hit);
  markers.push({ mesh: m, halo, hit, data: d, base: pos.clone() });
});

/* live theme switching — re-applied whenever the site's own dark/light
   toggle (assets/js/theme-init.js) flips html[data-theme] */
function applyTheme(name) {
  theme = THEMES[name] || THEMES.dark;
  wrap.style.setProperty('--gw-bg', theme.bg);
  const light = name === 'light';
  wrap.style.setProperty('--gw-fg', light ? '#08172E' : '#DDD8B8');
  wrap.style.setProperty('--gw-fg-muted', light ? 'rgba(8, 23, 46, 0.55)' : 'rgba(221, 216, 184, 0.55)');
  wrap.style.setProperty('--gw-panel-bg', light ? 'rgba(221, 216, 184, 0.94)' : 'rgba(8, 23, 46, 0.92)');
  wrap.style.setProperty('--gw-panel-border', light ? 'rgba(8, 23, 46, 0.16)' : 'rgba(221, 216, 184, 0.18)');
  wrap.style.setProperty('--gw-hint', light ? 'rgba(8, 23, 46, 0.32)' : 'rgba(221, 216, 184, 0.32)');
  wrap.style.setProperty('--gw-accent-border', light ? 'rgba(231, 119, 40, 0.4)' : 'rgba(231, 119, 40, 0.35)');

  renderer.setClearColor(theme.bg, 1);
  occluder.material.color.set(theme.bg);
  graticuleMesh.material.color.set(theme.grid);
  if (landMat) landMat.color.set(theme.land);
  markerMat.color.set(theme.point);
  haloMat.color.set(theme.point);
}
applyTheme(currentTheme);
new MutationObserver(() => {
  const t = siteTheme();
  if (t !== currentTheme) { currentTheme = t; applyTheme(currentTheme); }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* controls */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.55;
controls.autoRotate = true;
controls.autoRotateSpeed = spinSpeed;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = Math.PI - 0.35;
camera.position.setFromSphericalCoords(3.5, (90 - tilt) * Math.PI / 180, Math.PI * 0.35);
controls.update();

let dragging = false, selected = null;
controls.addEventListener('start', () => { dragging = true; wrap.classList.add('dragging'); hint.style.opacity = 0; });
controls.addEventListener('end', () => { dragging = false; wrap.classList.remove('dragging'); });

/* picking */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hover = null, downXY = null;

function pick(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(markers.map(m => m.hit), false)[0];
  if (!hit) return null;
  const mk = markers.find(m => m.hit === hit.object);
  return facing(mk) ? mk : null;
}
/* a point is pickable only while it faces the camera */
function facing(mk) {
  const world = mk.base.clone().applyMatrix4(globe.matrixWorld);
  const normal = world.clone().normalize();
  return normal.dot(camera.position.clone().sub(world).normalize()) > 0.08;
}

renderer.domElement.addEventListener('pointermove', ev => {
  const mk = pick(ev);
  if (mk !== hover) {
    hover = mk;
    wrap.style.cursor = mk ? 'pointer' : '';
  }
  if (hover && hover !== selected) {
    tooltip.textContent = hover.data.meta;
    tooltip.style.opacity = 1;
  } else tooltip.style.opacity = 0;
});
renderer.domElement.addEventListener('pointerdown', ev => { downXY = [ev.clientX, ev.clientY]; });
renderer.domElement.addEventListener('pointerup', ev => {
  if (!downXY) return;
  const moved = Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]);
  downXY = null;
  if (moved > 6) return;                 // that was a drag, not a click
  const mk = pick(ev);
  mk ? open(mk) : close();
});

function open(mk) {
  selected = mk;
  popup.querySelector('.gp-meta').textContent = mk.data.meta || '';
  popup.querySelector('.gp-title').textContent = mk.data.title || '';
  popup.querySelector('.gp-body').textContent = mk.data.body || '';
  const link = popup.querySelector('.gp-link');
  if (mk.data.link) { link.href = mk.data.link; link.style.display = 'inline-block'; }
  else link.style.display = 'none';
  popup.classList.add('open');
  tooltip.style.opacity = 0;
  hint.style.opacity = 0;
  controls.autoRotate = false;
}
function close() {
  selected = null;
  popup.classList.remove('open');
  controls.autoRotate = spinSpeed !== 0;
}
popup.querySelector('.gp-close').addEventListener('click', close);
window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

/* layout + loop */
const MARGIN = 1.1;               // 1 = globe touches the edges
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dist = MARGIN / Math.sin(Math.min(vFov, hFov) / 2);
  controls.target.set(0, 0, 0);
  camera.position.setLength(dist);
  camera.updateProjectionMatrix();
  controls.minDistance = controls.maxDistance = dist;
  controls.update();
}
new ResizeObserver(resize).observe(wrap);
resize();

const proj = new THREE.Vector3();
function screenPos(mk) {
  proj.copy(mk.base).applyMatrix4(globe.matrixWorld).project(camera);
  return { x: (proj.x * 0.5 + 0.5) * wrap.clientWidth, y: (-proj.y * 0.5 + 0.5) * wrap.clientHeight };
}

let raf, visible = true;
const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
io.observe(wrap);

function tick() {
  raf = requestAnimationFrame(tick);
  if (!visible) return;
  controls.update();

  const t = performance.now() * 0.001;
  markers.forEach(mk => {
    const on = facing(mk);
    const s = on ? 1 : 0.001;
    mk.mesh.scale.setScalar(s);
    mk.hit.scale.setScalar(s);
    mk.halo.scale.setScalar(on ? 1 + 0.25 * Math.sin(t * 1.6 + mk.base.x * 3) : 0.001);
  });

  if (hover && hover !== selected && facing(hover)) {
    const p = screenPos(hover);
    tooltip.style.left = p.x + 'px';
    tooltip.style.top = p.y + 'px';
  } else if (tooltip.style.opacity !== '0') tooltip.style.opacity = 0;

  if (selected) {
    if (!facing(selected)) close();
    else {
      const p = screenPos(selected);
      popup.style.left = p.x + 'px';
      popup.style.top = p.y + 'px';
    }
  }
  renderer.render(scene, camera);
}
tick();
</script>
