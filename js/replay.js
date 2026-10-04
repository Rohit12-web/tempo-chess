(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const $ = (id) => document.getElementById(id),
    id = new URLSearchParams(location.search).get("id");
  const saved = (TempoProfile.progress().games || []).find((g) => g.id === id);
  if (!saved || !Array.isArray(saved.moves)) {
    $("replay-error").hidden = false;
    $("replay-error").textContent = saved
      ? "This older result was saved before move recording was added. New completed games will have replays."
      : "This game is not available in the selected profile. Return Home to choose a recent game.";
    return;
  }
  let entries;
  try {
    entries = TempoGameData.restore(saved.moves).history;
  } catch {
    $("replay-error").hidden = false;
    $("replay-error").textContent =
      "This replay contains invalid moves and cannot be opened.";
    return;
  }
  const board = new TempoStudyBoard($("replay-board"));
  let cursor = 0,
    timer = null;
  $("replay-workspace").hidden = false;
  $("replay-summary").textContent =
    `${saved.mode === "bot" ? "vs Tempo" : "Two-player"} · ${saved.winner ? (saved.winner === "w" ? "White" : "Black") + " won" : "Draw"} · ${saved.reason}${saved.openingId ? " · Opening: " + (TempoOpenings.find((o) => o.id === saved.openingId)?.name || saved.openingId) : ""}`;
  entries.forEach((entry, i) => {
    const b = document.createElement("button");
    b.className = "study-move";
    b.textContent = `${entry.number}${entry.color === "w" ? "." : "…"} ${entry.san}`;
    b.addEventListener("click", () => {
      stop();
      seek(i + 1);
    });
    $("replay-moves").append(b);
  });
  function stop() {
    clearInterval(timer);
    timer = null;
    $("replay-auto").textContent = "Play replay";
  }
  function seek(index) {
    cursor = Math.max(0, Math.min(entries.length, index));
    const game = TempoGameData.restore(saved.moves.slice(0, cursor));
    board.render(game);
    $("replay-position").textContent =
      `${cursor} / ${entries.length} half-moves · ${cursor === entries.length ? "Final recorded position" : cursor ? "After " + entries[cursor - 1].san : "Starting position"}`;
    $("replay-turn").textContent =
      (game.state.turn === "w" ? "White" : "Black") + " to move";
    Array.from($("replay-moves").children).forEach((b, i) =>
      b.setAttribute("aria-current", String(i === cursor - 1)),
    );
    $("replay-first").disabled = $("replay-prev").disabled = cursor === 0;
    $("replay-last").disabled = $("replay-next").disabled =
      cursor === entries.length;
    if (cursor === entries.length) stop();
  }
  [
    ["replay-first", () => 0],
    ["replay-prev", () => cursor - 1],
    ["replay-next", () => cursor + 1],
    ["replay-last", () => entries.length],
  ].forEach(([id, target]) =>
    $(id).addEventListener("click", () => {
      stop();
      seek(target());
    }),
  );
  $("replay-auto").disabled = entries.length === 0;
  $("replay-auto").addEventListener("click", () => {
    if (timer) {
      stop();
      return;
    }
    if (cursor === entries.length) seek(0);
    $("replay-auto").textContent = "Pause";
    timer = setInterval(() => seek(cursor + 1), 900);
  });
  $("replay-save-note").addEventListener("click", () => {
    stop();
    TempoNotebookDialog.open(
      TempoGameData.restore(saved.moves.slice(0, cursor)),
      "After " + (cursor ? entries[cursor - 1].san : "the starting position"),
      "Game replay",
    );
  });
  $("replay-flip").addEventListener("click", () => board.flip());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  window.addEventListener("pagehide", stop);
  seek(0);
})();
