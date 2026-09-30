/* Small, shared browser-local board preferences. */
(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const main = document.querySelector("main");
  if (!main) return;
  const panel = document.createElement("details");
  panel.className = "board-preferences";
  panel.innerHTML =
    '<summary>Board & sound</summary><div class="preference-controls"><button class="pill secondary" id="pref-sound" aria-pressed="false">Sound off</button><label for="pref-volume">Volume <output id="pref-volume-label"></output><input id="pref-volume" type="range" min="0" max="100" step="5"></label><label class="contrast-option"><input id="pref-contrast" type="checkbox"> High-contrast board</label></div><p id="pref-status" role="status"></p>';
  main.prepend(panel);
  const $ = (id) => panel.querySelector("#" + id);
  function render() {
    const p = TempoProfile.progress();
    $("pref-sound").textContent = p.sound ? "Sound on" : "Sound off";
    $("pref-sound").setAttribute("aria-pressed", String(p.sound === true));
    $("pref-volume").value = Math.round(
      (Number.isFinite(p.volume) ? p.volume : 0.8) * 100,
    );
    $("pref-volume-label").textContent = $("pref-volume").value + "%";
    $("pref-contrast").checked = p.boardContrast === true;
    document.documentElement.dataset.boardContrast = p.boardContrast
      ? "high"
      : "standard";
  }
  function save(fields) {
    const saved = TempoProfile.update((p) => ({ ...p, ...fields }));
    $("pref-status").textContent = saved
      ? ""
      : "Could not save preferences. Check browser storage.";
  }
  $("pref-sound").addEventListener("click", () => {
    save({ sound: !TempoProfile.progress().sound });
    TempoSound?.play();
  });
  $("pref-volume").addEventListener("input", () => {
    $("pref-volume-label").textContent = $("pref-volume").value + "%";
  });
  $("pref-volume").addEventListener("change", () => {
    save({ volume: Number($("pref-volume").value) / 100 });
    TempoSound?.play();
  });
  $("pref-contrast").addEventListener("change", () =>
    save({ boardContrast: $("pref-contrast").checked }),
  );
  window.addEventListener("tempo-progress-change", render);
  render();
})();
