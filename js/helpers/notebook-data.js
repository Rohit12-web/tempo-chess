/* Profile-scoped notes. Positions are snapshots, never engine-generated advice. */
(() => {
  "use strict";
  const list = () =>
    (TempoProfile.progress().notebook || []).filter(
      (n) => n && typeof n.id === "string",
    );
  function save(draft) {
    if (!TempoProfile.user) throw Error("Choose a profile first.");
    const title = String(draft.title || "").trim(),
      note = String(draft.note || "").trim();
    if (!title || title.length > 80 || note.length > 4000)
      throw Error(
        "Add a title up to 80 characters and a note up to 4,000 characters.",
      );
    const fen = TempoGameData.fen(TempoGameData.position(draft.fen).state),
      all = list();
    const old = all.find((n) => n.id === draft.id);
    if (!old && all.length >= 200)
      throw Error(
        "Your notebook holds up to 200 positions. Remove an old note first.",
      );
    const item = {
      id: old?.id || draft.id || TempoProfile.newId(),
      title,
      note,
      fen,
      source: String(draft.source || "Personal note").slice(0, 100),
      createdAt: old?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    if (
      !TempoProfile.update((p) => ({
        ...p,
        notebook: [item, ...all.filter((n) => n.id !== item.id)],
      }))
    )
      throw Error(
        "Could not save this note to browser storage. Keep this page open and try again.",
      );
    return item;
  }
  function remove(id) {
    if (
      !TempoProfile.update((p) => ({
        ...p,
        notebook: list().filter((n) => n.id !== id),
      }))
    )
      throw Error("Could not save the deletion. Check browser storage.");
  }
  globalThis.TempoNotebook = Object.freeze({ list, save, remove });
})();
