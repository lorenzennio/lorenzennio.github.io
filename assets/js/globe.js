/*
 * The places globe.
 *
 * Was 320 lines inline in _pages/map.md. Now an ES module that index-filter.js
 * imports on demand, the first time the `places` filter is switched on -- so
 * three.js and the world atlas are never fetched by a visitor who does not
 * ask for them.
 *
 * Two things changed in the move:
 *   - Points come from the place rows in the DOM (their data-lat/data-lon/...
 *     attributes), which come from _data/places.yml. The list and the sphere
 *     cannot drift apart because there is only one source.
 *   - Colours are read from the site's own CSS custom properties rather than
 *     duplicated as hex literals, so the globe follows the stylesheet -- and
 *     the dark/light toggle -- without a second palette to keep in sync.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const SPIN_SPEED = 0.35; // 0 to stop
const TILT = 18;         // camera latitude, degrees
const MARGIN = 1.1;      // 1 = globe touches the edges

const latLonToVec3 = (lat, lon, r = 1.006) => {
  const p = ((90 - lat) * Math.PI) / 180;
  const t = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(p) * Math.cos(t),
    r * Math.cos(p),
    r * Math.sin(p) * Math.sin(t)
  );
};

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  return { bg: v("--bg"), land: v("--fg"), grid: v("--muted"), point: v("--accent") };
}

// Each place row carries everything the globe needs as data attributes.
function readPoints(rows) {
  return rows
    .map((row) => ({
      lat: parseFloat(row.dataset.lat),
      lon: parseFloat(row.dataset.lon),
      meta: row.dataset.where || "",
      title: row.dataset.title || "",
      body: row.dataset.body || "",
      link: row.dataset.link || ""
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

let started = false;

export function init(wrap, placeRows) {
  if (started) return;
  started = true;

  const points = readPoints(placeRows);
  const tooltip = wrap.querySelector(".globe__tooltip");
  const popup = wrap.querySelector(".globe__popup");
  const hint = wrap.querySelector(".globe__hint");

  let theme = palette();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 3.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(theme.bg, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  wrap.appendChild(renderer.domElement);

  const globe = new THREE.Group();
  scene.add(globe);

  /* occluder -- hides the far side of the mesh so the silhouette reads clean */
  const occluder = new THREE.Mesh(
    new THREE.SphereGeometry(0.995, 64, 48),
    new THREE.MeshBasicMaterial({ color: theme.bg })
  );
  globe.add(occluder);

  /* lat/lon mesh */
  function graticule(step = 15, r = 1.001) {
    const pts = [];
    const at = (lat, lon) => latLonToVec3(lat, lon, r);
    for (let lat = -75; lat <= 75; lat += step)
      for (let lon = -180; lon < 180; lon += 3) pts.push(at(lat, lon), at(lat, lon + 3));
    for (let lon = -180; lon < 180; lon += step)
      for (let lat = -90; lat < 90; lat += 3) pts.push(at(lat, lon), at(lat + 3, lon));
    return new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.55 })
    );
  }
  const graticuleMesh = graticule();
  globe.add(graticuleMesh);

  /* country outlines, decoded straight from a TopoJSON world atlas */
  let landMat = null;
  fetch(ATLAS_URL)
    .then((r) => r.json())
    .then((topo) => {
      const [sx, sy] = topo.transform.scale;
      const [tx, ty] = topo.transform.translate;
      const pts = [];
      for (const arc of topo.arcs) {
        let x = 0;
        let y = 0;
        let prev = null;
        for (const [dx, dy] of arc) {
          x += dx;
          y += dy;
          const v = latLonToVec3(y * sy + ty, x * sx + tx);
          if (prev) pts.push(prev, v);
          prev = v;
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      landMat = new THREE.LineBasicMaterial({ color: theme.land, transparent: true, opacity: 0.9 });
      globe.add(new THREE.LineSegments(geo, landMat));
      /* two hairline-offset copies read as one thicker stroke */
      [[0.0022, 0], [0, 0.0022]].forEach(([rx, ry]) => {
        const c = new THREE.LineSegments(geo, landMat);
        c.rotation.set(rx, ry, 0);
        globe.add(c);
      });
    })
    .catch(() => {}); /* offline: the mesh globe still renders */

  /* points */
  const markerGeo = new THREE.SphereGeometry(0.0105, 16, 12);
  const markerMat = new THREE.MeshBasicMaterial({ color: theme.point });
  const haloMat = new THREE.MeshBasicMaterial({
    color: theme.point, transparent: true, opacity: 0.3, depthWrite: false
  });
  /* invisible, larger hit-target sphere used only for raycasting -- the
     visible dot is too small on screen to click reliably */
  const hitGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const markers = points.map((d) => {
    const pos = latLonToVec3(d.lat, d.lon, 1.012);
    const mesh = new THREE.Mesh(markerGeo, markerMat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), haloMat);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    [mesh, halo, hit].forEach((m) => m.position.copy(pos));
    globe.add(mesh, halo, hit);
    return { mesh, halo, hit, data: d, base: pos.clone() };
  });

  /* live theme switching -- the site toggle flips html[data-theme], and every
     colour here is derived from the stylesheet, so re-reading is enough */
  function applyTheme() {
    theme = palette();
    renderer.setClearColor(theme.bg, 1);
    occluder.material.color.set(theme.bg);
    graticuleMesh.material.color.set(theme.grid);
    if (landMat) landMat.color.set(theme.land);
    markerMat.color.set(theme.point);
    haloMat.color.set(theme.point);
  }
  new MutationObserver(applyTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  /* controls */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.autoRotate = true;
  controls.autoRotateSpeed = SPIN_SPEED;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI - 0.35;
  camera.position.setFromSphericalCoords(3.5, ((90 - TILT) * Math.PI) / 180, Math.PI * 0.35);
  controls.update();

  let selected = null;
  controls.addEventListener("start", () => {
    wrap.classList.add("is-dragging");
    hint.style.opacity = 0;
  });
  controls.addEventListener("end", () => wrap.classList.remove("is-dragging"));

  /* picking */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hover = null;
  let downXY = null;

  /* a point is pickable only while it faces the camera */
  function facing(mk) {
    const world = mk.base.clone().applyMatrix4(globe.matrixWorld);
    const normal = world.clone().normalize();
    return normal.dot(camera.position.clone().sub(world).normalize()) > 0.08;
  }

  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(markers.map((m) => m.hit), false)[0];
    if (!hit) return null;
    const mk = markers.find((m) => m.hit === hit.object);
    return facing(mk) ? mk : null;
  }

  renderer.domElement.addEventListener("pointermove", (ev) => {
    const mk = pick(ev);
    if (mk !== hover) {
      hover = mk;
      wrap.style.cursor = mk ? "pointer" : "";
    }
    if (hover && hover !== selected) {
      tooltip.textContent = hover.data.meta;
      tooltip.style.opacity = 1;
    } else {
      tooltip.style.opacity = 0;
    }
  });
  renderer.domElement.addEventListener("pointerdown", (ev) => {
    downXY = [ev.clientX, ev.clientY];
  });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!downXY) return;
    const moved = Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]);
    downXY = null;
    if (moved > 6) return; // that was a drag, not a click
    const mk = pick(ev);
    if (mk) open(mk);
    else close();
  });

  function open(mk) {
    selected = mk;
    popup.querySelector(".gp-meta").textContent = mk.data.meta || "";
    popup.querySelector(".gp-title").textContent = mk.data.title || "";
    popup.querySelector(".gp-body").textContent = mk.data.body || "";
    const link = popup.querySelector(".gp-link");
    if (mk.data.link) {
      link.href = mk.data.link;
      link.style.display = "inline-block";
    } else {
      link.style.display = "none";
    }
    popup.classList.add("is-open");
    tooltip.style.opacity = 0;
    hint.style.opacity = 0;
    controls.autoRotate = false;
  }
  function close() {
    selected = null;
    popup.classList.remove("is-open");
    controls.autoRotate = SPIN_SPEED !== 0;
  }
  popup.querySelector(".gp-close").addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  /* clicking a place row in the index flies the camera to that point and
     opens it -- see assets/js/index-filter.js */
  let flyTo = null;
  let flyTarget = null;
  document.addEventListener("place:focus", (ev) => {
    const { lat, lon } = ev.detail;
    const mk = markers.find((m) => m.data.lat === lat && m.data.lon === lon);
    if (!mk) return;
    close();
    controls.autoRotate = false;
    flyTo = mk.base.clone().applyMatrix4(globe.matrixWorld).normalize();
    flyTarget = mk;
  });

  /* layout + loop */
  function resize() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const dist = MARGIN / Math.sin(Math.min(vFov, hFov) / 2);
    controls.target.set(0, 0, 0);
    camera.position.setLength(dist);
    camera.updateProjectionMatrix();
    controls.minDistance = dist;
    controls.maxDistance = dist;
    controls.update();
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  const proj = new THREE.Vector3();
  function screenPos(mk) {
    proj.copy(mk.base).applyMatrix4(globe.matrixWorld).project(camera);
    return {
      x: (proj.x * 0.5 + 0.5) * wrap.clientWidth,
      y: (-proj.y * 0.5 + 0.5) * wrap.clientHeight
    };
  }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(wrap);

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;

    if (flyTo) {
      const dist = camera.position.length();
      camera.position.lerp(flyTo.clone().multiplyScalar(dist), 0.12).setLength(dist);
      if (camera.position.clone().normalize().dot(flyTo) > 0.9995) {
        const arrived = flyTarget;
        flyTo = null;
        flyTarget = null;
        if (arrived) open(arrived);
      }
    }

    controls.update();

    const t = performance.now() * 0.001;
    markers.forEach((mk) => {
      const on = facing(mk);
      const s = on ? 1 : 0.001;
      mk.mesh.scale.setScalar(s);
      mk.hit.scale.setScalar(s);
      mk.halo.scale.setScalar(on ? 1 + 0.25 * Math.sin(t * 1.6 + mk.base.x * 3) : 0.001);
    });

    if (hover && hover !== selected && facing(hover)) {
      const p = screenPos(hover);
      tooltip.style.left = p.x + "px";
      tooltip.style.top = p.y + "px";
    } else if (tooltip.style.opacity !== "0") {
      tooltip.style.opacity = 0;
    }

    if (selected) {
      if (!facing(selected)) close();
      else {
        const p = screenPos(selected);
        popup.style.left = p.x + "px";
        popup.style.top = p.y + "px";
      }
    }

    renderer.render(scene, camera);
  }
  tick();
}
