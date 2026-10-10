(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const $ = (id) => document.getElementById(id);
  document.querySelector('[data-nav="statistics"]')?.classList.add("active");
  function render() {
    globalThis.TempoCustomPuzzles?.refresh();
    const s = TempoPractice.summary(),
      percent = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
    $("practice-metrics").replaceChildren();
    for (const [value, label] of [
      [s.attempts, "Recorded attempts"],
      [percent(s.firstSuccess, s.attempts), "First-attempt success"],
      [s.hints, "Hints requested"],
      [s.wrongMoves, "Incorrect answers"],
      [s.reveals, "Solutions revealed"],
      [s.review, "Positions to review"],
    ]) {
      const card = document.createElement("div");
      card.className = "feature-card metric";
      const n = document.createElement("strong"),
        text = document.createElement("span");
      n.textContent = value;
      text.textContent = label;
      card.append(n, text);
      $("practice-metrics").append(card);
    }
    $("practice-themes").replaceChildren();
    for (const [name, t] of Object.entries(s.themes)) {
      const tr = document.createElement("tr");
      for (const text of [
        name,
        t.attempts,
        t.firstSuccess,
        percent(t.firstSuccess, t.attempts),
        t.hints,
      ]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }
      $("practice-themes").append(tr);
    }
    $("practice-empty").textContent = s.attempts
      ? "Only attempts recorded in this edition are shown."
      : "No recorded attempts yet. Try a puzzle to begin; previous completions remain saved.";
    $("practice-review").replaceChildren();
    for (const p of TempoPractice.review()) {
      const a = document.createElement("a");
      a.className = "puzzle-library-item";
      a.href =
        "play.html?view=puzzles&review=1&puzzle=" + encodeURIComponent(p.id);
      a.textContent = p.theme;
      $("practice-review").append(a);
    }
    if (!s.review)
      $("practice-review").textContent =
        "Nothing needs review yet. Try a new puzzle or revisit your collection.";
  }
  render();
  window.addEventListener("tempo-progress-change", render);
})();
