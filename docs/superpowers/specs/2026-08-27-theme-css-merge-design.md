# Single-stylesheet theme toggle (merge dark/light CSS into one file)

## Problem

The dark/light toggle (`assets/js/theme-init.js`) works by swapping which
compiled stylesheet is linked (`main.css` = dark skin, `main-light.css` =
light skin) — full ~71KB (~14KB gzip) compiled outputs, ~90% identical,
differing only in ~26 color values. The site pre-fetches the *other*
skin's stylesheet in the background on load to warm the cache before the
user can toggle.

Root-cause debugging (this session, headless-Chromium + CDP against the
live production site, throttled network conditions) confirmed: that
pre-fetch is bandwidth-bound. Under a mobile-realistic profile
(RTT 400ms / 400kbps), it can take up to ~5 seconds to land, because it
competes for bandwidth with the page's other resources (`main.min.js`,
Font Awesome CSS). If the user taps the toggle before it lands, the
toggle's own stylesheet swap blocks on that same network fetch — the
"first switch is laggy" symptom. Once cached (10-min `Cache-Control` on
GitHub Pages/Fastly), later toggles are instant — "then smooth." A
priority-hint fix (`<link rel=preload>` instead of `fetch()`) was tested
and made no measurable difference — it's bandwidth-bound, not a
scheduling problem.

## Approach

Verified against the current compiled output: `main.css` and
`main-light.css` are byte-identical except for color literals (hex /
`rgb()` / `hsla()`) and the sourcemap filename comment — same rules, same
order. 26 distinct (dark, light) color pairs account for every
difference.

So: merge the two compiled stylesheets into one, replacing the ~26
differing color literals with `var(--tv-N)`, and prepend a small
generated block:

```css
:root{--tv-0:#08172e;--tv-1:#3d4144; /* ...26 total... */ }
[data-theme="light"]{--tv-0:#ddd8b8;--tv-1:#fff; /* ... */ }
```

(measured: ~2.5KB uncompressed, well under 1KB gzip — negligible compared
to the ~14KB gzip second stylesheet it replaces). The toggle then becomes
purely `document.documentElement.setAttribute('data-theme', theme)`
against CSS already on the page. Zero network dependency, not just a
smaller one — the root cause is eliminated rather than mitigated.

### Where the merge runs

As a Jekyll plugin (`_plugins/theme_css_merge.rb`) registered on
`Jekyll::Hooks.register(:site, :post_write)`, not a separate CI step.
This repo builds via a full GitHub Actions workflow (not the restricted
GitHub Pages native build — see `.github/workflows/pages.yml` and commit
`a255de7`), so custom plugins are already fully supported. Running as a
Jekyll hook means:
- It runs identically for `jekyll build` (CI) and `jekyll serve` (local
  dev / live-reload) — no risk of local/prod drift, no separate command
  to remember, no CI workflow file changes needed.
- It only needs the already-written `_site/assets/css/main.css` and
  `_site/assets/css/main-light.css` as input, which `post_write`
  guarantees exist.

### Algorithm

1. Read `_site/assets/css/main.css` (dark, kept as the base) and
   `_site/assets/css/main-light.css` (light).
2. Tokenize both on `/#[0-9a-fA-F]{3,8}\b|hsla?\([^)]*\)|rgba?\([^)]*\)/`
   into alternating (literal-text, color) segments.
3. Walk both token streams in lockstep. Every non-color segment must
   match exactly between the two files (the sourcemap filename comment
   is the one expected exception, checked by name not blanket-ignored).
   **If any other non-color segment differs, abort the build** (raise,
   non-zero exit) with a clear message naming the mismatch — this is the
   safety net against a future skin change introducing a non-color
   difference that the merge can't safely reconcile. No silent
   fallback to shipping stale/wrong output.
4. For color segments: identical pairs stay as literals (no variable
   needed — this is most of the 116 distinct colors, e.g. the syntax
   highlighting palette, which doesn't vary by skin). Differing pairs
   get assigned a `--tv-N` (deduped by identical (dark,light) pair) and
   the dark file's literal is replaced with `var(--tv-N)`.
5. Prepend the generated `:root{...}[data-theme="light"]{...}` block,
   and strip the trailing `/*# sourceMappingURL=... */` comment (see
   Sourcemaps below).
6. Write the merged result back over `_site/assets/css/main.css`.
7. Delete `_site/assets/css/main-light.css` and `main-light.css.map`
   from the build output so they aren't shipped.

### Sourcemaps

The merge shifts character offsets (color literal → `var(--tv-N)` is a
different length), invalidating `main.css.map`'s exact positions.
Regenerating a correct merged sourcemap is out of scope for what this
buys on a personal site with no one debugging production CSS via
sourcemaps — the merge strips the sourcemap comment rather than shipping
a now-inaccurate map. `main.css.map` itself is left unreferenced in
`_site` (accepted as harmless dead output, or deleted alongside
`main-light.css.map` — implementer's call, no behavioral difference).

### `assets/js/theme-init.js`

Simplifies substantially: remove `darkHref`/`lightHref` computation, the
`applyTheme()` `link.setAttribute('href', …)` swap, and the entire
pre-fetch block (`fetch(alternateHref, …)`). What remains: read the
stored/OS-preferred theme, set `data-theme` on `<html>` synchronously
before first paint (unchanged timing — this is what already prevents a
flash of the wrong theme), create the toggle button, and on click flip
`data-theme` + persist to `localStorage`. No `<link>`/stylesheet handling
at all.

### `assets/css/main-light.scss`

Unchanged. Jekyll still needs to compile it — it's the input the plugin
diffs against. It's simply not shipped in the final `_site` output
anymore.

## Out of scope

- Regenerating a correct sourcemap for the merged file.
- Touching the vendor theme's Sass partials (not needed — the merge
  operates on already-correct compiled CSS, never on the Sass source).
- No-JS behavior is unchanged: without JS, `data-theme` is never set,
  `:root`'s defaults (dark, matching today's default) apply — same as
  today.

## Risks

- **Structural divergence risk (mitigated by design):** if a future skin
  edit introduces a non-color difference between the two compiled
  stylesheets, the build fails loudly rather than shipping broken output
  — verified safe for the *current* repo state (0 non-color mismatches
  found when this was checked).
- **Local dev crash on mismatch:** the same loud-failure behavior applies
  to `jekyll serve`, so a work-in-progress skin edit that trips the
  safety net will crash local live-reload until fixed. Accepted as the
  correct trade-off (matches "no silent regressions"); noted here so it
  isn't mistaken for a bug later.
