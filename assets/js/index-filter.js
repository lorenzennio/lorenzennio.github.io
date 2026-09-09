/*
 * The index's filter chips.
 *
 * Rules:
 *   - No chip active is the same as "all": every work row shows, places do not.
 *   - Chips are additive -- papers + projects shows both. Clicking "all"
 *     clears the selection.
 *   - `places` is the odd one: it reveals the place rows AND mounts the globe,
 *     dynamically importing three.js at that moment rather than on first paint.
 *   - Visible rows renumber 01..NN, so the last number is always the count of
 *     what you are looking at. That is the point of the whole device.
 *   - Selection lives in the URL hash (#papers,projects) so a filtered view is
 *     linkable and survives a reload.
 */
(function () {
  "use strict";

  var root = document.querySelector(".index");
  if (!root) return;

  var chips = Array.prototype.slice.call(root.querySelectorAll(".chip"));
  var rows = Array.prototype.slice.call(root.querySelectorAll(".index__row"));
  var countEl = root.querySelector("[data-index-count]");
  var globeEl = root.querySelector(".globe");

  // Hash uses the plural chip labels; the DOM uses singular kinds.
  var PLURAL = { paper: "papers", talk: "talks", project: "projects", role: "roles", place: "places" };
  var SINGULAR = {};
  Object.keys(PLURAL).forEach(function (k) { SINGULAR[PLURAL[k]] = k; });

  var CHECKED = "☒";
  var UNCHECKED = "☐";

  var active = readHash();
  var globeLoaded = false;

  function readHash() {
    var set = {};
    window.location.hash.replace(/^#/, "").split(",").forEach(function (name) {
      var kind = SINGULAR[name.trim()];
      if (kind) set[kind] = true;
    });
    return set;
  }

  function writeHash() {
    var names = Object.keys(active).map(function (k) { return PLURAL[k]; });
    var hash = names.length ? "#" + names.sort().join(",") : "";
    // replaceState, not location.hash: filtering should not stack up history
    // entries the back button has to walk through.
    history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  }

  function isVisible(row) {
    var kind = row.dataset.kind;
    var none = Object.keys(active).length === 0;
    return none ? kind !== "place" : !!active[kind];
  }

  function render() {
    var none = Object.keys(active).length === 0;

    chips.forEach(function (chip) {
      var filter = chip.dataset.filter;
      var on = filter === "all" ? none : !!active[filter];
      chip.setAttribute("aria-pressed", String(on));
      var box = chip.querySelector(".box");
      if (box) box.textContent = on ? CHECKED : UNCHECKED;
    });

    var n = 0;
    rows.forEach(function (row) {
      var show = isVisible(row);
      row.hidden = !show;
      if (!show) return;
      n += 1;
      var numberEl = row.querySelector(".index__n");
      if (numberEl) numberEl.textContent = String(n).padStart(2, "0");
    });

    if (countEl) countEl.textContent = String(n);

    if (globeEl) {
      var wantGlobe = !!active.place;
      globeEl.hidden = !wantGlobe;
      if (wantGlobe) mountGlobe();
    }
  }

  // three.js and the world atlas are several hundred KB between them. Nobody
  // who never opens `places` should pay for that, so the import happens here,
  // once, on first activation.
  function mountGlobe() {
    if (globeLoaded) return;
    globeLoaded = true;

    var src = globeEl.dataset.src;
    if (!src) return;

    import(src)
      .then(function (mod) {
        mod.init(globeEl, rows.filter(function (r) { return r.dataset.kind === "place"; }));
      })
      .catch(function (err) {
        globeLoaded = false; // let a later click retry
        console.error("globe failed to load", err);
      });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var filter = chip.dataset.filter;
      if (filter === "all") {
        active = {};
      } else if (active[filter]) {
        delete active[filter];
      } else {
        active[filter] = true;
      }
      writeHash();
      render();
    });
  });

  // Clicking a place row turns the globe on if it is off, then focuses that
  // point -- so a place row behaves the same whether you arrived via the chip
  // or straight from a filtered view that already included places.
  rows.forEach(function (row) {
    if (row.dataset.kind !== "place") return;
    var trigger = row.querySelector(".index__link");
    if (!trigger) return;

    trigger.addEventListener("click", function () {
      if (!active.place) {
        active.place = true;
        writeHash();
        render();
      }
      document.dispatchEvent(new CustomEvent("place:focus", {
        detail: { lat: parseFloat(row.dataset.lat), lon: parseFloat(row.dataset.lon) }
      }));
    });
  });

  window.addEventListener("hashchange", function () {
    active = readHash();
    render();
  });

  render();
})();
