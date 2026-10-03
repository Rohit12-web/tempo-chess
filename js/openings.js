(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const $ = (id) => document.getElementById(id),
    C = TempoChess;
  let lesson = TempoOpenings[0],
    game = new C.Game(),
    cursor = 0,
    mode = "learn",
    side = "w",
    helped = false,
    timer = null,
    token = 0,
    done = false;
  const board = new TempoStudyBoard($("opening-board"), attempt);
  document.querySelector('[data-nav="openings"]').classList.add("active");
  const userTurn = () => side === "both" || game.state.turn === side;
  const notation = () => TempoGameData.restore(lesson.moves).history;
  function cancel() {
    token++;
    clearTimeout(timer);
    timer = null;
  }
  function library() {
    const p = TempoProfile.progress();
    $("opening-library").replaceChildren();
    for (const group of [
      "Open games",
      "Semi-open games",
      "Closed & semi-closed",
    ]) {
      const section = document.createElement("section"),
        title = document.createElement("h2");
      title.textContent = group;
      section.append(title);
      TempoOpenings.filter((o) => o.group === group).forEach((o) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "opening-card";
        b.setAttribute("aria-pressed", String(o.id === lesson.id));
        const name = document.createElement("strong"),
          desc = document.createElement("span"),
          badge = document.createElement("small");
        name.textContent = o.name;
        desc.textContent = o.subtitle;
        badge.textContent = (p.openingsCompleted || []).includes(o.id)
          ? "Practiced unaided ✓"
          : (p.openingsPracticed || []).includes(o.id)
            ? "Practiced with help"
            : "Explore opening";
        b.append(name, desc, badge);
        b.addEventListener("click", () => choose(o));
        section.append(b);
      });
      $("opening-library").append(section);
    }
    $("opening-progress").textContent =
      `${(p.openingsPracticed || []).length} / 9 practiced`;
  }
  function render() {
    $("opening-title").textContent = lesson.name;
    $("opening-group").textContent = lesson.group;
    $("opening-summary").textContent = lesson.summary;
    $("opening-side").textContent =
      cursor === lesson.moves.length
        ? "Line complete"
        : `${game.state.turn === "w" ? "White" : "Black"} to move`;
    $("opening-learn").classList.toggle("active", mode === "learn");
    $("opening-practice").classList.toggle("active", mode === "practice");
    $("opening-learn").setAttribute("aria-pressed", String(mode === "learn"));
    $("opening-practice").setAttribute(
      "aria-pressed",
      String(mode === "practice"),
    );
    $("opening-navigation").hidden = mode === "practice";
    $("opening-hint").hidden = mode !== "practice";
    $("opening-hint").disabled = done || !userTurn();
    $("opening-first").disabled = cursor === 0;
    $("opening-prev").disabled = cursor === 0;
    $("opening-next").disabled = cursor === lesson.moves.length;
    $("opening-note").textContent = cursor
      ? lesson.notes[cursor - 1]
      : "Start with the initial position. This line demonstrates one useful plan, not every possible response.";
    $("opening-play-panel").hidden = cursor !== lesson.moves.length;
    const entries = notation();
    $("opening-moves").replaceChildren();
    entries.forEach((m, i) => {
      if (mode === "practice" && i >= cursor) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "study-move";
      b.textContent = `${m.number}${m.color === "w" ? "." : "…"} ${m.san}`;
      b.setAttribute("aria-current", String(i === cursor - 1));
      b.disabled = mode === "practice";
      b.addEventListener("click", () => seek(i + 1));
      $("opening-moves").append(b);
    });
    board.render(game, mode === "practice" && !done && userTurn());
  }
  function choose(o) {
    cancel();
    lesson = o;
    side = o.side;
    $("opening-play-color").value = side;
    $("opening-colour").value = side;
    TempoSelect.enhance(document);
    mode = "learn";
    reset();
    TempoProfile.update((p) => ({ ...p, lastOpening: o.id }));
    library();
  }
  function seek(index) {
    cancel();
    cursor = index;
    game = TempoGameData.restore(lesson.moves.slice(0, cursor));
    render();
    $("opening-feedback").textContent =
      cursor === lesson.moves.length
        ? "You have seen the line. Switch to Practice to try it yourself."
        : `${cursor} of ${lesson.moves.length} half-moves shown.`;
  }
  function reset() {
    cancel();
    game = new C.Game();
    cursor = 0;
    helped = false;
    done = false;
    if (board.flipped !== (side === "b")) board.flip();
    $("opening-feedback").textContent =
      mode === "learn"
        ? "Explore the opening one move at a time."
        : `Practice ${side === "both" ? "both sides" : side === "w" ? "White" : "Black"}. Make the moves on the board.`;
    render();
    if (mode === "practice") reply();
  }
  function finish() {
    if (done) return;
    done = true;
    TempoProfile.update((p) => ({
      ...p,
      openingsPracticed: [
        ...new Set([...(p.openingsPracticed || []), lesson.id]),
      ],
      openingsCompleted: [
        ...new Set([
          ...(p.openingsCompleted || []),
          ...(helped ? [] : [lesson.id]),
        ]),
      ],
      lastOpening: lesson.id,
    }));
    render();
    library();
    $("opening-feedback").textContent = helped
      ? "Line completed with help. Start again to practice unaided."
      : "Nicely played. You completed this opening without hints.";
  }
  function advance() {
    const uci = lesson.moves[cursor];
    const entry = game.move(
      C.square(uci.slice(0, 2)),
      C.square(uci.slice(2, 4)),
      uci[4],
    );
    cursor++;
    TempoSound.play({ capture: !!entry.captured });
    render();
    if (cursor === lesson.moves.length) finish();
  }
  function reply() {
    if (
      mode !== "practice" ||
      done ||
      cursor === lesson.moves.length ||
      userTurn() ||
      document.hidden
    )
      return;
    const generation = token;
    timer = setTimeout(() => {
      timer = null;
      if (generation !== token || document.hidden) return;
      advance();
      if (!done) {
        $("opening-feedback").textContent = "Your turn. Continue the line.";
        reply();
      }
    }, 500);
  }
  function attempt(from, to) {
    if (mode !== "practice" || done || !userTurn()) return;
    const uci = C.name(from) + C.name(to),
      expected = lesson.moves[cursor];
    if (uci !== expected.slice(0, 4)) {
      const legal = game.moves(from).some((m) => m.to === to);
      $("opening-feedback").textContent = legal
        ? "That is a legal move, but this lesson follows a different continuation. Try again, or ask for a hint."
        : "That move is not legal here. Try another square.";
      board.shake();
      return;
    }
    advance();
    if (!done) {
      $("opening-feedback").textContent = userTurn()
        ? "Good. Continue the line."
        : "Good move. The other side replies…";
      reply();
    }
  }
  $("opening-learn").addEventListener("click", () => {
    mode = "learn";
    reset();
  });
  $("opening-practice").addEventListener("click", () => {
    mode = "practice";
    reset();
  });
  $("opening-first").addEventListener("click", () => seek(0));
  $("opening-prev").addEventListener("click", () =>
    seek(Math.max(0, cursor - 1)),
  );
  $("opening-next").addEventListener("click", () =>
    seek(Math.min(lesson.moves.length, cursor + 1)),
  );
  $("opening-restart").addEventListener("click", reset);
  $("opening-flip").addEventListener("click", () => board.flip());
  $("opening-colour").addEventListener("change", () => {
    side = $("opening-colour").value;
    reset();
  });
  $("opening-hint").addEventListener("click", () => {
    if (done || !userTurn()) return;
    helped = true;
    const entry = notation()[cursor];
    board.hint(entry.from);
    $("opening-feedback").textContent =
      `Try ${entry.san}: ${C.name(entry.from)} to ${C.name(entry.to)}. This attempt will count as helped practice.`;
  });
  document.addEventListener("visibilitychange", () => {
    cancel();
    if (!document.hidden) reply();
  });
  window.addEventListener("pagehide", cancel);
  $("opening-play").addEventListener("click", () => {
    if (cursor !== lesson.moves.length) return;
    const query = new URLSearchParams({
      mode: "bot",
      opening: lesson.id,
      color: $("opening-play-color").value,
      level: $("opening-play-level").value,
      time: $("opening-play-time").value,
    });
    location.href = "play.html?" + query;
  });
  const requested =
    new URLSearchParams(location.search).get("opening") ||
    TempoProfile.progress().lastOpening;
  choose(TempoOpenings.find((o) => o.id === requested) || TempoOpenings[0]);
})();
