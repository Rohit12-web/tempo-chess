/* One-move tactics and curated continuations share one cancellable controller. */
(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const C = TempoChess,
    P = TempoPuzzles,
    $ = (id) => document.getElementById(id);
  const board = new TempoStudyBoard($("puzzle-study-board"), attempt);
  let index = 0,
    game = null,
    cursor = 0,
    token = null,
    helped = false,
    solved = false,
    revealed = false,
    waiting = false,
    timer = null,
    visible = false;
  const puzzle = () => P[index],
    line = () => puzzle().line || [puzzle().solution];
  function cancel() {
    clearTimeout(timer);
    timer = null;
    waiting = false;
  }
  function tracked(kind) {
    const result = TempoPractice.record(puzzle().id, token, kind);
    if (!result.saved)
      $("puzzle-save-warning").textContent =
        "Progress could not be saved. Keep this page open; browser storage may be full.";
  }
  function load(i) {
    cancel();
    index = i;
    game = TempoGameData.position(puzzle().fen);
    cursor = 0;
    token = TempoPractice.start();
    helped = solved = revealed = false;
    $("puzzle-promotion").value = "q";
    TempoSelect.enhance($("puzzle-promotion-field"));
    $("puzzle-save-warning").textContent = "";
    $("puzzle-feedback").textContent = "";
    TempoProfile.rememberPuzzle(puzzle().id);
    render();
  }
  function render() {
    const p = puzzle(),
      total = P.length,
      hasMatches = pool().length > 0;
    board.render(
      game,
      hasMatches && !solved && !revealed && !waiting && cursor % 2 === 0,
    );
    $("puzzle-counter").textContent = `PUZZLE ${index + 1} OF ${total}`;
    $("puzzle-rating").textContent = p.difficulty;
    $("puzzle-theme").textContent = p.theme;
    $("puzzle-status").textContent = solved
      ? "Nicely spotted."
      : revealed
        ? "A line to remember."
        : waiting
          ? "The other side replies…"
          : `${game.state.turn === "w" ? "White" : "Black"} to move`;
    $("puzzle-detail").textContent =
      p.detail + (p.line ? " Follow the lesson’s sample continuation." : "");
    $("puzzle-progress").textContent =
      `${P.filter((p) => (TempoProfile.progress().solved || []).includes(p.id)).length} / ${total} solved without hints. ${TempoPractice.review().length} to review.`;
    $("puzzle-explanation").hidden = !(solved || revealed);
    $("puzzle-why").textContent = p.explanation;
    if (
      solved &&
      p.mate &&
      C.name(game.history.at(-1).from) + C.name(game.history.at(-1).to) !==
        line().at(-1).slice(0, 4)
    )
      $("puzzle-why").textContent =
        "Your continuation also delivers checkmate: the king is in check and has no legal escape.";
    $("puzzle-hint-button").disabled = $("puzzle-solution-button").disabled =
      solved || revealed || waiting || !hasMatches;
    $("puzzle-promotion-field").hidden = !(
      line()[cursor]?.length === 5 &&
      !solved &&
      !revealed
    );
    $("puzzle-line").replaceChildren();
    for (const m of game.history) {
      const label = document.createElement("span");
      label.className = "study-move";
      label.textContent = `${m.number}${m.color === "w" ? "." : "…"} ${m.san}`;
      $("puzzle-line").append(label);
    }
    board.board.classList.toggle("puzzle-success", solved);
    library();
    if (!hasMatches && !solved && !revealed)
      $("puzzle-feedback").textContent =
        $("puzzle-filter").value === "review"
          ? "Your review queue is empty. Choose All puzzles to practice."
          : "No puzzles match. Change the filters to continue.";
  }
  function move(uci) {
    const m = game.move(
      C.square(uci.slice(0, 2)),
      C.square(uci.slice(2, 4)),
      uci[4],
    );
    if (!m || m.needsPromotion)
      throw Error("The lesson move could not be played.");
    cursor++;
    TempoSound.play({ capture: !!m.captured });
  }
  function finish() {
    solved = true;
    tracked("solve");
    if (TempoProfile.solved(puzzle().id, helped) === false)
      $("puzzle-save-warning").textContent =
        "Progress could not be saved. Keep this page open.";
    render();
    $("puzzle-feedback").textContent = helped
      ? "Completed with help. Retry for a clean attempt."
      : "Combination complete.";
  }
  function reply() {
    if (
      !game ||
      solved ||
      revealed ||
      cursor % 2 === 0 ||
      cursor >= line().length ||
      !visible ||
      document.hidden ||
      timer
    )
      return;
    waiting = true;
    render();
    const activeToken = token;
    timer = setTimeout(() => {
      timer = null;
      if (activeToken !== token || !visible || document.hidden) return;
      waiting = false;
      try {
        move(line()[cursor]);
        render();
        $("puzzle-feedback").textContent = "Your turn. Finish the idea.";
      } catch (error) {
        $("puzzle-feedback").textContent = error.message;
      }
    }, 600);
  }
  function attempt(from, to) {
    if (
      !game ||
      solved ||
      revealed ||
      waiting ||
      cursor % 2 !== 0 ||
      !pool().length
    )
      return;
    const choices = game.moves(from).filter((m) => m.to === to);
    if (!choices.length) return;
    const m = choices.find(
      (m) => !m.promotion || m.promotion === $("puzzle-promotion").value,
    );
    if (!m) return;
    const uci = C.name(from) + C.name(to) + (m.promotion || ""),
      candidate = TempoGameData.position(TempoGameData.fen(game.state));
    candidate.move(from, to, m.promotion);
    const mate = puzzle().mate && candidate.status().reason === "Checkmate";
    if (uci !== line()[cursor] && !mate) {
      tracked("wrong");
      board.shake();
      $("puzzle-feedback").textContent = puzzle().line
        ? "That is legal, but this lesson follows a different continuation. Try again or use a hint."
        : "Not quite. Look for another idea.";
      library();
      return;
    }
    if (cursor + 1 < line().length && !mate) tracked("answer");
    move(uci);
    if (cursor === line().length || mate) finish();
    else {
      render();
      reply();
    }
  }
  function completed(id) {
    const p = TempoProfile.progress();
    return (p.practiced || []).includes(id) || (p.solved || []).includes(id);
  }
  function pool() {
    const p = TempoProfile.progress(),
      theme = $("puzzle-category").value,
      difficulty = $("puzzle-difficulty").value,
      filter = $("puzzle-filter").value,
      stats = TempoPractice.all();
    return P.map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          (!theme || p.category === theme) &&
          (!difficulty || p.difficulty === difficulty) &&
          (filter === "all" ||
            (filter === "new" && !completed(p.id)) ||
            (filter === "review" && stats[p.id]?.needsReview) ||
            (filter === "multi" && p.line) ||
            (filter === "solved" &&
              (TempoProfile.progress().solved || []).includes(p.id)) ||
            (filter === "practiced" &&
              completed(p.id) &&
              !(TempoProfile.progress().solved || []).includes(p.id))),
      )
      .map((x) => x.i);
  }
  function library() {
    const indices = pool(),
      progress = TempoProfile.progress();
    $("puzzle-library").replaceChildren();
    for (const i of indices) {
      const p = P[i],
        b = document.createElement("button");
      b.className = "puzzle-library-item";
      b.setAttribute("aria-current", String(i === index));
      const title = document.createElement("strong"),
        label = document.createElement("span");
      title.textContent = `${i + 1}. ${p.theme}`;
      label.textContent = `${p.line ? "Multi-move · " : ""}${p.difficulty} · ${TempoPractice.all()[p.id]?.needsReview ? "Review" : (progress.solved || []).includes(p.id) ? "Solved" : completed(p.id) ? "Practiced" : "New"}`;
      b.append(title, label);
      b.addEventListener("click", () => load(i));
      $("puzzle-library").append(b);
    }
    $("puzzle-library-note").textContent = indices.length
      ? `${indices.length} matching puzzles. Completed puzzles remain available under All puzzles.`
      : "No matching puzzles. Choose All puzzles, or practice a new position.";
    $("puzzle-next-button").disabled = !indices.length;
  }
  $("puzzle-next-button").addEventListener("click", () => {
    const indices = pool();
    if (!indices.length) return;
    const n = indices.indexOf(index);
    const ordered = [...indices.slice(n + 1), ...indices.slice(0, n + 1)];
    load(ordered.find((i) => !completed(P[i].id)) ?? ordered[0]);
  });
  $("puzzle-retry-button").addEventListener("click", () => load(index));
  $("puzzle-flip-button").addEventListener("click", () => board.flip());
  $("puzzle-hint-button").addEventListener("click", () => {
    if (solved || revealed || waiting) return;
    helped = true;
    tracked("hint");
    board.hint(C.square(line()[cursor].slice(0, 2)));
    $("puzzle-feedback").textContent =
      "Start with this piece. Where can it make a difference?";
  });
  $("puzzle-solution-button").addEventListener("click", () => {
    if (solved || revealed || waiting) return;
    cancel();
    helped = true;
    tracked("reveal");
    while (cursor < line().length) move(line()[cursor]);
    revealed = true;
    if (TempoProfile.solved(puzzle().id, true) === false)
      $("puzzle-save-warning").textContent =
        "Progress could not be saved. Keep this page open.";
    render();
    $("puzzle-feedback").textContent =
      "Full line shown. Read the explanation, then retry.";
  });
  $("puzzle-save-note").addEventListener("click", () => {
    if (game)
      TempoNotebookDialog.open(game, puzzle().theme, "Puzzle " + (index + 1));
  });
  for (const id of ["puzzle-category", "puzzle-difficulty", "puzzle-filter"])
    $(id).addEventListener("change", () => {
      const indices = pool();
      if (indices.length && !indices.includes(index)) load(indices[0]);
      else render();
    });
  const params = new URLSearchParams(location.search);
  if (params.get("review") === "1") $("puzzle-filter").value = "review";
  TempoSelect.enhance($("puzzle-filters"));
  TempoSelect.enhance($("puzzle-promotion-field"));
  function view(which) {
    visible = which === "puzzles";
    cancel();
    $("play-view").hidden = visible;
    $("puzzle-view").hidden = !visible;
    for (const name of ["play", "puzzles"]) {
      const active = name === which;
      $("tab-" + name).classList.toggle("active", active);
      $("tab-" + name).setAttribute("aria-selected", String(active));
      document
        .querySelector(`[data-nav="${name}"]`)
        ?.classList.toggle("active", active);
    }
    if (visible) {
      if (!game) {
        const indices = pool(),
          fresh = indices.find((i) => !completed(P[i].id));
        const requested = P.findIndex((p) => p.id === params.get("puzzle"));
        load(
          requested >= 0 && indices.includes(requested)
            ? requested
            : (fresh ?? indices[0] ?? 0),
        );
      }
      render();
      reply();
    }
    window.dispatchEvent(
      new CustomEvent("tempo-view-change", { detail: { view: which } }),
    );
  }
  for (const name of ["play", "puzzles"]) {
    $("tab-" + name).addEventListener("click", () => view(name));
    document
      .querySelector(`[data-nav="${name}"]`)
      .addEventListener("click", (e) => {
        e.preventDefault();
        view(name);
      });
  }
  document.addEventListener("visibilitychange", () => {
    cancel();
    if (!document.hidden && visible) {
      render();
      reply();
    }
  });
  window.addEventListener("pagehide", cancel);
  view(params.get("view") === "puzzles" ? "puzzles" : "play");
})();
