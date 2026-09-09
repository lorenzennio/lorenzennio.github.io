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
 *   - The search box narrows whatever the chips have selected. With no chip
 *     active it searches places too, so looking for "CERN" finds it without
 *     having to know it is filed under places.
 */
(function () {
  "use strict";

  var root = document.querySelector(".index");
  if (!root) return;

  var chips = Array.prototype.slice.call(root.querySelectorAll(".chip"));
  var rows = Array.prototype.slice.call(root.querySelectorAll(".index__row"));
  var countEl = root.querySelector("[data-index-count]");
  var globeEl = root.querySelector(".globe");
  var input = root.querySelector(".search-input");
  var emptyEl = root.querySelector(".index__empty");
  var resetBtn = root.querySelector(".index__reset");

  // Searchable text is the row's own rendered text -- number, year, category,
  // title and meta line -- so "2024", "talk" and "Belle II" all work without a
  // separate index to keep in step with the markup.
  var haystack = new WeakMap();
  rows.forEach(function (row) {
    haystack.set(row, (row.textContent || "").toLowerCase().replace(/\s+/g, " "));
  });

  // Hash uses the plural chip labels; the DOM uses singular kinds.
  var PLURAL = { paper: "papers", talk: "talks", project: "projects", role: "roles", place: "places" };
  var SINGULAR = {};
  Object.keys(PLURAL).forEach(function (k) { SINGULAR[PLURAL[k]] = k; });

  var CHECKED = "☒";
  var UNCHECKED = "☐";

  var active = readHash();
  var query = "";
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

  function matches(row) {
    return query === "" || haystack.get(row).indexOf(query) !== -1;
  }

  function isVisible(row) {
    var kind = row.dataset.kind;
    var none = Object.keys(active).length === 0;
    // Places are held back from the default view because they restate work
    // listed elsewhere -- but a search should still reach them.
    var kindOk = none ? (kind !== "place" || query !== "") : !!active[kind];
    return kindOk && matches(row);
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
    if (emptyEl) emptyEl.hidden = n !== 0;

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

  if (input) {
    input.addEventListener("input", function () {
      query = input.value.trim().toLowerCase();
      render();
    });
    // Escape clears the box rather than only clearing the browser's own
    // search-input affordance, which leaves the list filtered.
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value !== "") {
        input.value = "";
        query = "";
        render();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      active = {};
      query = "";
      if (input) input.value = "";
      writeHash();
      render();
    });
  }

  window.addEventListener("hashchange", function () {
    active = readHash();
    render();
  });

  render();
})();
