(() => {
  "use strict";
  let dialog = null,
    draft = null;
  function open(game, title, source) {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "study-dialog";
      dialog.setAttribute("aria-labelledby", "save-note-heading");
      dialog.innerHTML =
        '<h2 id="save-note-heading">A position to remember.</h2><form id="save-note-form"><label for="save-note-title">Title</label><input class="study-input" id="save-note-title" maxlength="80" required><label for="save-note-text">What did you notice?</label><textarea class="study-input" id="save-note-text" rows="4" maxlength="4000"></textarea><p id="save-note-status" role="status"></p><div class="dialog-actions"><button type="button" class="dialog-secondary" id="save-note-cancel">Cancel</button><button type="submit" class="dialog-primary">Save note</button></div></form>';
      document.body.append(dialog);
      dialog
        .querySelector("#save-note-cancel")
        .addEventListener("click", () => dialog.close());
      dialog.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        try {
          TempoNotebook.save({
            ...draft,
            title: dialog.querySelector("#save-note-title").value,
            note: dialog.querySelector("#save-note-text").value,
          });
          dialog.close();
        } catch (error) {
          dialog.querySelector("#save-note-status").textContent = error.message;
        }
      });
    }
    draft = {
      id: TempoProfile.newId(),
      fen: TempoGameData.fen(game.state),
      source,
    };
    dialog.querySelector("#save-note-title").value = title.slice(0, 80);
    dialog.querySelector("#save-note-text").value = "";
    dialog.querySelector("#save-note-status").textContent =
      "Saved notes appear in Notebook.";
    dialog.showModal();
  }
  globalThis.TempoNotebookDialog = Object.freeze({ open });
})();
