/* Observed attempts only: no inferred scores for old completions. */
(() => {
  "use strict";
  const all = () => TempoProfile.progress().puzzleAttempts || {};
  const fresh = () => ({
    attempts: 0,
    solves: 0,
    firstSuccess: 0,
    wrongMoves: 0,
    hints: 0,
    reveals: 0,
    needsReview: false,
  });
  function start() {
    return TempoProfile.newId();
  }
  function record(id, token, kind) {
    if (!["answer", "wrong", "hint", "reveal", "solve"].includes(kind))
      throw Error("Unknown practice event.");
    let next;
    const saved = TempoProfile.update((p) => {
      const stats = { ...(p.puzzleAttempts || {}) },
        old = stats[id] || fresh();
      next = { ...old };
      const last =
        old.last?.token === token
          ? { ...old.last }
          : { token, wrong: 0, hints: 0, revealed: false, done: false };
      if (last.done) return p;
      if (old.last?.token !== token) next.attempts++;
      if (kind === "wrong") {
        last.wrong++;
        next.wrongMoves++;
        next.needsReview = true;
      }
      if (kind === "hint") {
        last.hints++;
        next.hints++;
        next.needsReview = true;
      }
      if (kind === "reveal") {
        last.revealed = true;
        last.done = true;
        next.reveals++;
        next.needsReview = true;
      }
      if (kind === "solve") {
        last.done = true;
        next.solves++;
        const clean = !last.wrong && !last.hints && !last.revealed;
        if (clean) next.firstSuccess++;
        next.needsReview = !clean;
      }
      next.last = last;
      next.updatedAt = Date.now();
      stats[id] = next;
      return { ...p, puzzleAttempts: stats };
    });
    return { saved, stats: next };
  }
  function review() {
    return TempoPuzzles.filter((p) => all()[p.id]?.needsReview);
  }
  function summary(puzzles = TempoPuzzles) {
    const result = {
      attempts: 0,
      solves: 0,
      firstSuccess: 0,
      wrongMoves: 0,
      hints: 0,
      reveals: 0,
      review: 0,
      themes: {},
    };
    for (const p of puzzles) {
      const s = all()[p.id];
      if (!s) continue;
      const t = (result.themes[p.category] ??= {
        attempts: 0,
        firstSuccess: 0,
        hints: 0,
      });
      for (const k of [
        "attempts",
        "solves",
        "firstSuccess",
        "wrongMoves",
        "hints",
        "reveals",
      ])
        result[k] += s[k] || 0;
      t.attempts += s.attempts;
      t.firstSuccess += s.firstSuccess;
      t.hints += s.hints;
      if (s.needsReview) result.review++;
    }
    return result;
  }
  globalThis.TempoPractice = Object.freeze({
    start,
    record,
    review,
    summary,
    all,
  });
})();
