(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const $ = (id) => document.getElementById(id),
    C = TempoChess,
    lessons = TempoLessons;
  let index = 0,
    game,
    done = false;
  const board = new TempoStudyBoard($("lesson-board"), attempt);
  document.querySelector('[data-nav="lessons"]')?.classList.add("active");
  function library() {
    const completed = TempoProfile.progress().lessonsCompleted || [];
    $("lesson-progress").textContent =
      `${lessons.filter((l) => completed.includes(l.id)).length} / ${lessons.length} completed`;
    $("lesson-library").replaceChildren();
    lessons.forEach((l, i) => {
      const b = document.createElement("button");
      b.className = "opening-card";
      b.setAttribute("aria-pressed", String(index === i));
      const title = document.createElement("strong"),
        detail = document.createElement("small");
      title.textContent = l.title;
      detail.textContent = completed.includes(l.id)
        ? "Completed ✓"
        : "Try this lesson";
      b.append(title, detail);
      b.addEventListener("click", () => load(i));
      $("lesson-library").append(b);
    });
  }
  function load(i) {
    index = i;
    done = false;
    const l = lessons[i];
    game = TempoGameData.position(l.fen);
    $("lesson-title").textContent = l.title;
    $("lesson-intro").textContent = l.intro;
    $("lesson-goal").textContent = l.goal;
    $("lesson-why").hidden = true;
    $("lesson-feedback").textContent = "Try the move on the board.";
    $("lesson-turn").textContent = "White to move";
    $("lesson-promotion-field").hidden = l.id !== "promotion";
    $("lesson-promotion").value = "q";
    TempoSelect.enhance($("lesson-promotion-field"));
    $("lesson-hint").disabled = false;
    board.render(game, true);
    library();
  }
  function attempt(from, to) {
    if (done) return;
    const l = lessons[index],
      moves = game.moves(from).filter((m) => m.to === to);
    if (!moves.length) return;
    const m = moves.find(
      (m) => !m.promotion || m.promotion === $("lesson-promotion").value,
    );
    const uci = C.name(from) + C.name(to) + (m?.promotion || "");
    if (uci !== l.move) {
      board.shake();
      $("lesson-feedback").textContent =
        "That is legal, but try the move described in this lesson.";
      return;
    }
    const entry = game.move(from, to, m.promotion);
    TempoSound.play({ capture: !!entry.captured });
    done = true;
    board.render(game, false);
    $("lesson-why").hidden = false;
    $("lesson-why").textContent = l.why;
    $("lesson-hint").disabled = true;
    $("lesson-turn").textContent = game.status().over
      ? game.status().reason
      : "Move complete";
    const saved = TempoProfile.update((p) => ({
      ...p,
      lessonsCompleted: [...new Set([...(p.lessonsCompleted || []), l.id])],
    }));
    $("lesson-feedback").textContent = saved
      ? "Lesson complete. Read why the move works."
      : "Lesson complete, but progress could not be saved. Check browser storage.";
    library();
  }
  $("lesson-reset").addEventListener("click", () => load(index));
  $("lesson-next").addEventListener("click", () =>
    load((index + 1) % lessons.length),
  );
  $("lesson-flip").addEventListener("click", () => board.flip());
  $("lesson-hint").addEventListener("click", () => {
    board.hint(C.square(lessons[index].move.slice(0, 2)));
    $("lesson-feedback").textContent = lessons[index].goal;
  });
  load(0);
})();
