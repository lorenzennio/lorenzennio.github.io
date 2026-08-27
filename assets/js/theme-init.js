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
