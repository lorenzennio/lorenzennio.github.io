# Single-Stylesheet Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the dark/light toggle's first-click network lag by merging the two compiled theme stylesheets into one, driven by CSS custom properties instead of a runtime `<link>` swap.

**Architecture:** A Jekyll `post_write` plugin (`_plugins/theme_css_merge.rb`) diffs the already-compiled `_site/assets/css/main.css` (dark) and `main-light.css` (light) after every build, replaces the color literals that differ between them with `var(--tv-N)`, prepends a small `:root{...}`/`[data-theme="light"]{...}` block, and drops `main-light.css` from the output. `assets/js/theme-init.js` shrinks to just setting the `data-theme` attribute and persisting the choice — no more `<link>` manipulation or network pre-fetch.

**Tech Stack:** Ruby (stdlib only — `minitest` for tests, no new gems), Jekyll 4.x hooks, vanilla JS.

**Spec:** `docs/superpowers/specs/2026-08-27-theme-css-merge-design.md`

## Global Constraints

- No new Gemfile dependencies — the merge logic and its tests use only Ruby's standard library (`minitest` ships with Ruby).
- The merge must raise (abort the build) on any non-color structural difference between the two compiled stylesheets — never silently ship a partial/wrong merge.
- `assets/css/main-light.scss` (the Sass source) is NOT touched — it must keep compiling so the plugin has a light-skin stylesheet to diff against.
- The plugin must work identically for local `bundle exec jekyll serve` and the CI `bundle exec jekyll build` (no CI workflow changes).

---

### Task 1: Pure CSS-merge module with unit tests

**Files:**
- Create: `_plugins/theme_css_merge.rb` (module portion only this task — no Jekyll hook yet)
- Test: `test/theme_css_merge_test.rb`

**Interfaces:**
- Produces: `ThemeCssMerge.merge(dark_css, light_css)` — returns a merged CSS string, raises `ThemeCssMerge::StructuralMismatch` (a `StandardError` subclass) if the two inputs differ in anything but color literals or a trailing sourcemap comment. This is what Task 2's Jekyll hook calls.

- [ ] **Step 1: Write the failing tests**

Create `test/theme_css_merge_test.rb`:

```ruby
# frozen_string_literal: true

require "minitest/autorun"
require_relative "../_plugins/theme_css_merge"

class ThemeCssMergeTest < Minitest::Test
  def test_identical_stylesheets_produce_unchanged_output_with_no_variables
    css = "body{color:#333;margin:0}"
    assert_equal css, ThemeCssMerge.merge(css, css)
  end

  def test_single_differing_hex_color_becomes_a_css_variable
    dark = "body{color:#08172e}"
    light = "body{color:#ddd8b8}"
    expected = ':root{--tv-0:#08172e}[data-theme="light"]{--tv-0:#ddd8b8}' \
               "body{color:var(--tv-0)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_repeated_same_color_pair_reuses_the_same_variable
    dark = "a{color:#08172e}b{color:#08172e}"
    light = "a{color:#ddd8b8}b{color:#ddd8b8}"
    expected = ':root{--tv-0:#08172e}[data-theme="light"]{--tv-0:#ddd8b8}' \
               "a{color:var(--tv-0)}b{color:var(--tv-0)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_identical_color_occurring_in_both_stays_a_literal
    dark = "a{color:#3b5998;background:#08172e}"
    light = "a{color:#3b5998;background:#ddd8b8}"
    expected = ':root{--tv-0:#08172e}[data-theme="light"]{--tv-0:#ddd8b8}' \
               "a{color:#3b5998;background:var(--tv-0)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_rgb_and_hsl_color_functions_are_detected
    dark = "a{color:rgb(1,2,3)}b{color:hsla(1,2%,3%,.5)}"
    light = "a{color:rgb(4,5,6)}b{color:hsla(7,8%,9%,.5)}"
    expected = ':root{--tv-0:rgb(1,2,3);--tv-1:hsla(1,2%,3%,.5)}' \
               '[data-theme="light"]{--tv-0:rgb(4,5,6);--tv-1:hsla(7,8%,9%,.5)}' \
               "a{color:var(--tv-0)}b{color:var(--tv-1)}"
    assert_equal expected, ThemeCssMerge.merge(dark, light)
  end

  def test_multiple_distinct_variable_pairs_get_distinct_names_in_first_seen_order
    dark = "a{color:#111;background:#222}"
    light = "a{color:#333;background:#444}"
    merged = ThemeCssMerge.merge(dark, light)
    assert_includes merged, "--tv-0:#111"
    assert_includes merged, "--tv-1:#222"
    assert_includes merged, "a{color:var(--tv-0);background:var(--tv-1)}"
  end

  def test_raises_on_non_color_text_mismatch
    dark = "a{color:#333}"
    light = "a{background:#333}"
    assert_raises(ThemeCssMerge::StructuralMismatch) do
      ThemeCssMerge.merge(dark, light)
    end
  end

  def test_sourcemap_comment_difference_is_ignored_and_stripped
    dark = "a{color:#333}\n/*# sourceMappingURL=main.css.map */"
    light = "a{color:#333}\n/*# sourceMappingURL=main-light.css.map */"
    assert_equal "a{color:#333}\n", ThemeCssMerge.merge(dark, light)
  end
end
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `ruby test/theme_css_merge_test.rb`
Expected: `LoadError` (`_plugins/theme_css_merge.rb` doesn't exist yet) — every test errors, none pass.

- [ ] **Step 3: Write the module**

Create `_plugins/theme_css_merge.rb`:

```ruby
# frozen_string_literal: true

# Merges the compiled dark and light theme stylesheets into one, replacing
# the color values that differ between skins with CSS custom properties.
# See docs/superpowers/specs/2026-08-27-theme-css-merge-design.md.
#
# main.css (dark) and main-light.css (light) are ~90% identical compiled
# output from the same Sass partials -- only a couple dozen color literals
# differ. Rather than shipping both stylesheets and swapping which one is
# linked at runtime, this rewrites main.css in place with `var(--tv-N)` in
# place of the differing literals, prepends the two small variable blocks,
# and (via the Jekyll hook below) drops main-light.css from the build
# output entirely.
module ThemeCssMerge
  # Matches a CSS color literal: #hex, rgb()/rgba(), or hsl()/hsla().
  COLOR_PATTERN = /
    \#[0-9a-fA-F]{3,8}\b
    | hsla?\([^)]*\)
    | rgba?\([^)]*\)
  /x.freeze

  SOURCEMAP_COMMENT = %r{/\*# sourceMappingURL=[^*]*\*/\s*\z}.freeze

  StructuralMismatch = Class.new(StandardError)

  Segment = Struct.new(:kind, :value) # kind is :text or :color

  # Tokenizes CSS into alternating text/color segments.
  def self.tokenize(css)
    segments = []
    pos = 0
    css.scan(COLOR_PATTERN) do
      m = Regexp.last_match
      segments << Segment.new(:text, css[pos...m.begin(0)])
      segments << Segment.new(:color, m[0])
      pos = m.end(0)
    end
    segments << Segment.new(:text, css[pos..])
    segments
  end

  def self.strip_sourcemap_comment(css)
    css.sub(SOURCEMAP_COMMENT, "")
  end

  # Merges dark_css and light_css into a single stylesheet. Raises
  # StructuralMismatch if the two differ in anything other than color
  # literals and the trailing sourcemap comment.
  def self.merge(dark_css, light_css)
    dark_segments = tokenize(strip_sourcemap_comment(dark_css))
    light_segments = tokenize(strip_sourcemap_comment(light_css))

    if dark_segments.length != light_segments.length
      raise StructuralMismatch,
            "dark and light stylesheets tokenize into a different number " \
            "of segments (#{dark_segments.length} vs #{light_segments.length}) " \
            "-- they diverge in more than just color values"
    end

    var_names = {} # [dark_value, light_value] => "--tv-N"
    merged_parts = []

    dark_segments.zip(light_segments).each do |dark_seg, light_seg|
      if dark_seg.kind != light_seg.kind
        raise StructuralMismatch,
              "segment kind mismatch: #{dark_seg.kind} vs #{light_seg.kind}"
      end

      if dark_seg.kind == :text
        if dark_seg.value != light_seg.value
          raise StructuralMismatch,
                "non-color text differs between dark and light stylesheets: " \
                "#{dark_seg.value.inspect} vs #{light_seg.value.inspect}"
        end
        merged_parts << dark_seg.value
      elsif dark_seg.value == light_seg.value
        merged_parts << dark_seg.value
      else
        key = [dark_seg.value, light_seg.value]
        var_names[key] ||= "--tv-#{var_names.size}"
        merged_parts << "var(#{var_names[key]})"
      end
    end

    return merged_parts.join if var_names.empty?

    root_block = var_names.map { |(dark_v, _light_v), name| "#{name}:#{dark_v}" }.join(";")
    light_block = var_names.map { |(_dark_v, light_v), name| "#{name}:#{light_v}" }.join(";")

    ":root{#{root_block}}[data-theme=\"light\"]{#{light_block}}#{merged_parts.join}"
  end
end
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `ruby test/theme_css_merge_test.rb`
Expected: `7 runs, ..., 0 failures, 0 errors`

- [ ] **Step 5: Commit**

```bash
git add _plugins/theme_css_merge.rb test/theme_css_merge_test.rb
git commit -m "Add ThemeCssMerge module: merge dark/light CSS via custom properties"
```

---

### Task 2: Wire the Jekyll `post_write` hook and verify against a real build

**Files:**
- Modify: `_plugins/theme_css_merge.rb` (append hook registration; Task 1's module code is unchanged)

**Interfaces:**
- Consumes: `ThemeCssMerge.merge(dark_css, light_css)` from Task 1, and `ThemeCssMerge::StructuralMismatch`.
- Produces: nothing new consumed by later tasks — this is the integration point.

- [ ] **Step 1: Append the hook registration**

Add to the end of `_plugins/theme_css_merge.rb` (after the `module ThemeCssMerge ... end` block). Guarded by `defined?(Jekyll)` because `test/theme_css_merge_test.rb` (Task 1) loads this same file via `require_relative` without loading Jekyll — without the guard, running the tests would raise `NameError: uninitialized constant Jekyll::Hooks`:

```ruby
if defined?(Jekyll)
  Jekyll::Hooks.register(:site, :post_write) do |site|
    css_dir = File.join(site.dest, "assets", "css")
    dark_path = File.join(css_dir, "main.css")
    light_path = File.join(css_dir, "main-light.css")

    next unless File.exist?(dark_path) && File.exist?(light_path)

    merged = ThemeCssMerge.merge(File.read(dark_path), File.read(light_path))
    File.write(dark_path, merged)

    [light_path, "#{light_path}.map", "#{dark_path}.map"].each do |path|
      File.delete(path) if File.exist?(path)
    end
  end
end
```

- [ ] **Step 2: Run the unit tests to confirm nothing broke**

Run: `ruby test/theme_css_merge_test.rb`
Expected: still `7 runs, ..., 0 failures, 0 errors`.

- [ ] **Step 3: Run a real Jekyll build and verify the merge happened**

Run:
```bash
bundle exec jekyll build
```
Expected: build succeeds (exit 0), no `ThemeCssMerge::StructuralMismatch` raised.

Then verify the output:
```bash
grep -c "var(--tv-" _site/assets/css/main.css
grep -o ':root{[^}]*}' _site/assets/css/main.css | head -c 200
test -f _site/assets/css/main-light.css && echo "BUG: main-light.css still present" || echo "OK: main-light.css removed"
test -f _site/assets/css/main-light.css.map && echo "BUG: main-light.css.map still present" || echo "OK: main-light.css.map removed"
```
Expected:
- First command prints a number > 0 (color variables were substituted).
- Second command prints a `:root{--tv-0:...;...}` block with real color values.
- Both `test` checks print `OK: ...`.

- [ ] **Step 4: Commit**

```bash
git add _plugins/theme_css_merge.rb
git commit -m "Wire ThemeCssMerge into a Jekyll post_write hook"
```

---

### Task 3: Simplify `assets/js/theme-init.js` to drop the stylesheet-swap mechanism

**Files:**
- Modify: `assets/js/theme-init.js` (full rewrite — see below)
- Modify: `_config.yml:12-13` (stale comment describing the old mechanism)

**Interfaces:**
- Produces: same DOM contract as before — `document.documentElement` gets `data-theme="dark"|"light"`, a `button.theme-toggle` is inserted into `#site-nav`. Nothing downstream (CSS in `_sass/minimal-mistakes/skins/*.scss` already targets `.theme-toggle` and doesn't reference the removed `<link>`-swap logic) changes its expectations.

- [ ] **Step 1: Rewrite theme-init.js**

Replace the full contents of `assets/js/theme-init.js` with:

```js
/*
 * Dark/light theme toggle.
 *
 * Both themes' colors live in one compiled stylesheet as CSS custom
 * properties (see _plugins/theme_css_merge.rb, which merges main.css and
 * main-light.css at build time and rewrites the colors that differ
 * between skins as `var(--tv-N)`, toggled by the `[data-theme="light"]`
 * selector). Toggling is therefore just flipping the `data-theme`
 * attribute -- no stylesheet swap, no network fetch.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "theme";

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  var currentTheme = getPreferredTheme();
  document.documentElement.setAttribute("data-theme", currentTheme);

  // Runs before the masthead exists, so the button is added once the DOM is ready.
  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.querySelector("#site-nav");
    var searchToggle = document.querySelector(".search__toggle");
    if (!nav) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.setAttribute("aria-label", "Toggle dark / light theme");
    button.innerHTML = '<i class="fas ' + (currentTheme === "light" ? "fa-moon" : "fa-sun") + '"></i>';

    button.addEventListener("click", function () {
      currentTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, currentTheme);
      document.documentElement.setAttribute("data-theme", currentTheme);
      button.innerHTML = '<i class="fas ' + (currentTheme === "light" ? "fa-moon" : "fa-sun") + '"></i>';
    });

    if (searchToggle && searchToggle.parentNode === nav) {
      nav.insertBefore(button, searchToggle);
    } else {
      var menuToggle = nav.querySelector(".greedy-nav__toggle");
      nav.insertBefore(button, menuToggle || null);
    }
  });
})();
```

- [ ] **Step 2: Update the stale `_config.yml` comment**

In `_config.yml`, replace:
```yaml
# Loaded in <head>; swaps the stylesheet between main.css (dark) and
# main-light.css (light) based on stored preference / OS preference.
head_scripts:
```
with:
```yaml
# Loaded in <head>; sets data-theme (dark/light) on <html> from stored
# preference / OS preference before first paint. Actual color switching
# is CSS custom properties baked into main.css by
# _plugins/theme_css_merge.rb -- see that file and
# docs/superpowers/specs/2026-08-27-theme-css-merge-design.md.
head_scripts:
```

- [ ] **Step 3: Rebuild and confirm no leftover references**

Run:
```bash
bundle exec jekyll build
grep -rn "main-light\|darkHref\|lightHref" _site/assets/js/theme-init.js assets/js/theme-init.js
```
Expected: the `grep` prints nothing (no matches, exit code 1) — confirms the old dual-stylesheet logic is fully gone from both source and compiled output.

- [ ] **Step 4: Commit**

```bash
git add assets/js/theme-init.js _config.yml
git commit -m "Simplify theme-init.js: drop stylesheet-swap mechanism"
```

---

### Task 4: End-to-end browser verification that the toggle is instant with zero network dependency

**Files:**
- None modified — this task only verifies Tasks 1-3 with a real browser, closing the loop on the original bug report.

**Interfaces:**
- Consumes: the built `_site/` output from Tasks 2 and 3.

- [ ] **Step 1: Serve the built site locally**

```bash
bundle exec jekyll build
cd _site && python3 -m http.server 4444 &
cd -
```

- [ ] **Step 2: Drive a headless browser against it and measure toggle latency**

This reproduces the original bug's measurement (root-cause session used the same technique against the live site and measured multi-second delays under throttled network — see the spec's Problem section) to confirm it's now gone.

```bash
/snap/bin/chromium --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9334 \
  --user-data-dir=/tmp/theme-verify-profile about:blank &
sleep 2

node -e '
const BROWSER_WS_URL = "http://localhost:9334/json/version";
(async () => {
  const { webSocketDebuggerUrl } = await (await fetch(BROWSER_WS_URL)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let nid = 1;
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = nid++;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      const onMsg = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id === id) {
          ws.removeEventListener("message", onMsg);
          msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        }
      };
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify(payload));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  // Throttle hard -- worse than the "Slow 4G" profile that showed the
  // original bug taking ~5s to warm its cache.
  await send("Network.emulateNetworkConditions", {
    offline: false, latency: 400,
    downloadThroughput: 400 * 1024 / 8, uploadThroughput: 200 * 1024 / 8,
  }, sessionId);
  const dclFired = new Promise((resolve) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Page.domContentEventFired" && msg.sessionId === sessionId) {
        ws.removeEventListener("message", onMsg);
        resolve();
      }
    };
    ws.addEventListener("message", onMsg);
  });
  await send("Page.navigate", { url: "http://localhost:4444/" }, sessionId);
  await dclFired;
  const result = await send("Runtime.evaluate", {
    expression: `(function(){
      const btn = document.querySelector(".theme-toggle");
      if (!btn) return { error: "no .theme-toggle button found" };
      const initialTheme = document.documentElement.getAttribute("data-theme");
      const initialColor = getComputedStyle(document.body).color;
      const t0 = performance.now();
      btn.click();
      return new Promise((resolve) => {
        (function poll(){
          const c = getComputedStyle(document.body).color;
          if (c !== initialColor) {
            resolve({
              ms: performance.now() - t0,
              themeBefore: initialTheme,
              themeAfter: document.documentElement.getAttribute("data-theme"),
              colorBefore: initialColor, colorAfter: c,
            });
            return;
          }
          if (performance.now() - t0 > 5000) { resolve({ timeout: true }); return; }
          requestAnimationFrame(poll);
        })();
      });
    })()`,
    awaitPromise: true, returnByValue: true,
  }, sessionId);
  console.log(JSON.stringify(result.result.value, null, 2));
  await send("Target.closeTarget", { targetId });
  ws.close();
  process.exit(0);
})();
'
```

Expected output: a JSON object with `"timeout"` absent, `"ms"` well under 100 (typically single-digit-to-low-double-digit ms — this is now pure style recalculation, no network round trip, even under the 400ms-RTT/400kbps throttle applied above), and `themeBefore`/`themeAfter`/`colorBefore`/`colorAfter` showing the theme and computed color actually flipped.

If `"ms"` is instead in the hundreds or thousands, or `"timeout": true` appears, the fix did not eliminate the network dependency — stop and re-check Task 2's hook output (`_site/assets/css/main.css` must contain `var(--tv-` and there must be no `_site/assets/css/main-light.css`) and Task 3's `theme-init.js` (must contain no `fetch(` or `.setAttribute("href"`).

- [ ] **Step 3: Clean up**

```bash
pkill -f "remote-debugging-port=9334"
pkill -f "http.server 4444"
rm -rf /tmp/theme-verify-profile
```

- [ ] **Step 4: No commit** — this task is verification-only, nothing to commit. If Step 2's check failed, go back and fix the relevant earlier task instead.
