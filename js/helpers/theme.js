/* Runs before styles load to avoid a light flash when dark mode is saved. */
(() => {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let saved = null;
  try {
    saved = localStorage.getItem("tempo-theme");
  } catch {}
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#151c1b" : "#f5f6f7");
    window.dispatchEvent(new Event("tempo-theme-change"));
  }
  apply(
    saved === "dark" || saved === "light"
      ? saved
      : media.matches
        ? "dark"
        : "light",
  );
  window.TempoTheme = {
    toggle() {
      saved =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("tempo-theme", saved);
      } catch {}
      apply(saved);
    },
  };
  media.addEventListener("change", (event) => {
    if (!saved) apply(event.matches ? "dark" : "light");
  });
})();
