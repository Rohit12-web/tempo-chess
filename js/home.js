(async () => {
  if (!(await TempoProfile.ready)) return;
  document.querySelector('[data-nav="home"]').classList.add("active");
  const $ = (id) => document.getElementById(id);
  function render() {
    const p = TempoProfile.progress(),
      solved = TempoPuzzles.filter((x) =>
        (p.solved || []).includes(x.id),
      ).length,
      games = p.games || [],
      total = TempoPuzzles.length;
    $("puzzle-count").textContent = `${solved} / ${total} solved`;
    $("solved-stat").textContent = solved;
    $("games-stat").textContent = p.completedCount ?? games.length;
    $("practice-stat").textContent = (p.practiced || []).length;
    $("puzzle-progress-bar").style.width = (solved / total) * 100 + "%";
    $("puzzle-progress-bar").parentElement.setAttribute(
      "aria-valuenow",
      solved,
    );
    $("home-opening-progress").textContent =
      `${(p.openingsPracticed || []).length} / 9 practiced`;
    $("resume-card").hidden = true;
    try {
      if (p.activeGame) {
        const active = TempoGameData.session(p.activeGame);
        $("resume-card").hidden = false;
        $("resume-detail").textContent =
          `${active.mode === "bot" ? "vs Tempo" : "Two-player"} · ${active.moves.length} half-moves saved · Clocks paused`;
      }
    } catch {}
    $("home-review-count").textContent =
      TempoPractice.review().length +
      " positions to review. Save useful ideas in your notebook.";
    const query = $("recent-search").value.trim().toLocaleLowerCase(),
      mode = $("recent-mode").value,
      result = $("recent-result").value;
    const filtered = games.filter(
      (g) =>
        (mode === "all" || g.mode === mode) &&
        (result === "all" ||
          (result === "draw" ? g.winner === null : g.winner === result)) &&
        [
          g.reason,
          g.mode,
          TempoOpenings.find((o) => o.id === g.openingId)?.name || "",
          g.winner === null
            ? "Draw"
            : g.winner === "w"
              ? "White won"
              : "Black won",
          new Date(g.date).toLocaleDateString(),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query),
    );
    $("recent-empty").textContent = games.length
      ? "No games match these filters."
      : "A fresh page. Finish a game and it will appear here.";
    $("recent-empty").hidden = filtered.length > 0;
    $("recent-list").replaceChildren();
    filtered.forEach((game) => {
      const li = document.createElement("li"),
        label = document.createElement("span"),
        when = document.createElement("small");
      label.textContent = `${game.mode === "bot" ? "vs Tempo" : "Two-player"} · ${game.winner ? (game.winner === "w" ? "White" : "Black") + " won" : "Draw"}`;
      when.textContent = new Date(game.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      li.append(label, when);
      if (Array.isArray(game.moves)) {
        const link = document.createElement("a");
        link.href = "replay.html?id=" + encodeURIComponent(game.id);
        link.textContent = "Replay ↗";
        li.append(link);
      } else {
        const note = document.createElement("small");
        note.className = "old-result";
        note.textContent = "Older result · no move record";
        li.append(note);
      }
      $("recent-list").append(li);
    });
    if (!TempoProfile.storageAvailable)
      $("storage-note").textContent =
        "Browser storage is unavailable. Progress will only last for this page session.";
  }
  document.querySelectorAll("[data-time]").forEach((button) =>
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-time]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      $("start-local").href =
        `play.html?mode=local&time=${button.dataset.time}`;
      $("start-bot").href = `play.html?mode=bot&time=${button.dataset.time}`;
      TempoProfile.update((p) => ({ ...p, time: Number(button.dataset.time) }));
    }),
  );
  const time = TempoProfile.progress().time || 600;
  document
    .querySelector(
      `[data-time="${[60, 180, 300, 600, 1800].includes(time) ? time : 600}"]`,
    )
    .click();
  $("recent-search").addEventListener("input", render);
  for (const id of ["recent-mode", "recent-result"])
    $(id).addEventListener("change", render);
  TempoSelect.enhance(document);
  render();
  window.addEventListener("tempo-progress-change", render);
})();
