/* The supplied move recording is bundled locally; no upload or synthesis. */
(() => {
  "use strict";
  const source = new URL(
    "../../assets/audio/move-self.mp3",
    document.currentScript.src,
  ).href;
  let audio = null;
  const enabled = () => globalThis.TempoProfile?.progress().sound === true;
  function stop() {
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* Metadata may not have loaded yet. */
    }
  }
  function play() {
    if (!enabled() || document.hidden) return;
    try {
      if (!audio) {
        audio = new Audio(source);
        audio.preload = "auto";
        audio.volume = 0.8;
      }
      const volume = TempoProfile.progress().volume;
      audio.volume = Number.isFinite(volume)
        ? Math.max(0, Math.min(1, volume))
        : 0.8;
      stop();
      const result = audio.play();
      if (result?.catch) result.catch(() => {});
    } catch {
      /* Missing or blocked audio must never interrupt chess. */
    }
  }
  window.addEventListener("tempo-progress-change", () => {
    if (!enabled()) stop();
    else if (audio) {
      const v = TempoProfile.progress().volume;
      audio.volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  window.addEventListener("pagehide", stop);
  globalThis.TempoSound = Object.freeze({ play });
})();
