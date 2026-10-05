(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const $ = (id) => document.getElementById(id),
    board = new TempoStudyBoard($("note-board"));
  let selected = null;
  document.querySelector('[data-nav="notebook"]')?.classList.add("active");
  function list() {
    const q = $("note-search").value.toLocaleLowerCase(),
      items = TempoNotebook.list().filter((n) =>
        [n.title, n.note, n.source].join(" ").toLocaleLowerCase().includes(q),
      );
    $("note-list").replaceChildren();
    for (const n of items) {
      const b = document.createElement("button");
      b.className = "note-card";
      b.setAttribute("aria-pressed", String(n.id === selected?.id));
      const title = document.createElement("strong"),
        desc = document.createElement("small");
      title.textContent = n.title;
      desc.textContent =
        n.source + " · " + new Date(n.updatedAt).toLocaleDateString();
      b.append(title, desc);
      b.addEventListener("click", () => choose(n));
      $("note-list").append(b);
    }
    if (!items.length) {
      const p = document.createElement("p");
      p.textContent = q
        ? "No matching notes."
        : "Save a position from Puzzles or Replay, or start a new note.";
      $("note-list").append(p);
    }
  }
  function choose(note) {
    try {
      const game = TempoGameData.position(note.fen);
      selected = note;
      $("note-detail").hidden = false;
      $("note-title").value = note.title;
      $("note-text").value = note.note;
      $("note-source").textContent = note.source;
      board.render(game);
      list();
    } catch (error) {
      $("notebook-status").textContent = error.message;
    }
  }
  $("note-new").addEventListener("click", () =>
    TempoNotebookDialog.open(
      new TempoChess.Game(),
      "Starting position",
      "Personal note",
    ),
  );
  $("note-search").addEventListener("input", list);
  $("note-flip").addEventListener("click", () => board.flip());
  $("note-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      selected = TempoNotebook.save({
        ...selected,
        title: $("note-title").value,
        note: $("note-text").value,
      });
      list();
      $("notebook-status").textContent = "Note saved.";
    } catch (error) {
      $("notebook-status").textContent = error.message;
    }
  });
  $("note-delete").addEventListener("click", () => {
    if (!selected) return;
    $("note-delete-name").textContent = selected.title;
    $("note-delete-dialog").showModal();
  });
  $("note-keep").addEventListener("click", () =>
    $("note-delete-dialog").close(),
  );
  $("note-remove").addEventListener("click", () => {
    try {
      TempoNotebook.remove(selected.id);
      selected = null;
      $("note-detail").hidden = true;
      $("note-delete-dialog").close();
      list();
      $("notebook-status").textContent = "Note deleted.";
    } catch (error) {
      $("note-delete-dialog").close();
      $("notebook-status").textContent = error.message;
    }
  });
  window.addEventListener("tempo-progress-change", list);
  list();
})();
