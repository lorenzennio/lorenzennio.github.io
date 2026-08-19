/*
 * Dark/light theme toggle.
 *
 * The site's compiled stylesheets are picked by config at build time
 * (_config.yml: minimal_mistakes_skin), so switching at runtime means
 * swapping which compiled stylesheet is linked, not flipping CSS
 * variables -- the theme derives borders/links/code-block colors from
 * the skin's base colors via Sass `mix()` at compile time.
 *
 * - main.css       = dark skin  (_sass/minimal-mistakes/skins/_dark.scss)
 * - main-light.css = light skin (_sass/minimal-mistakes/skins/_custom-light.scss)
 */
(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var link = document.querySelector('link[href*="assets/css/main"]');
  if (!link) return;

  var darkHref = link.getAttribute("href").replace("main-light.css", "main.css");
  var lightHref = darkHref.replace("main.css", "main-light.css");

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    link.setAttribute("href", theme === "light" ? lightHref : darkHref);
    document.documentElement.setAttribute("data-theme", theme);
  }

  var currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  // Runs before the masthead exists, so the button is added once the DOM is ready.
  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.querySelector("#site-nav");
    var searchToggle = document.querySelector(".search__toggle");
    if (!nav) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "search__toggle theme-toggle";
    button.setAttribute("aria-label", "Toggle dark / light theme");
    button.innerHTML = '<i class="fas ' + (currentTheme === "light" ? "fa-moon" : "fa-sun") + '"></i>';

    button.addEventListener("click", function () {
      currentTheme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, currentTheme);
      applyTheme(currentTheme);
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
