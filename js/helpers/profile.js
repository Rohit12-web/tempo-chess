/* Local profiles and progress. Runs entirely in the browser. */
(() => {
  "use strict";
  const PROFILES = "tempo-local-profiles",
    ACTIVE = "tempo-active-profile";
  let storageAvailable = true,
    memory = {},
    memoryDirty = false,
    user = null;
  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      storageAvailable = false;
      return null;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      storageAvailable = false;
      return false;
    }
  }
  function profiles() {
    const saved = read(PROFILES);
    return Array.isArray(saved)
      ? saved.filter(
          (p) =>
            p && typeof p.id === "string" && typeof p.username === "string",
        )
      : [];
  }
  function progress() {
    if (memoryDirty) return memory;
    const saved = user && read("tempo-local-progress:" + user.id);
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved
      : memory;
  }
  function update(fn) {
    if (!user) return;
    memory = fn(progress());
    const saved = write("tempo-local-progress:" + user.id, memory);
    memoryDirty = !saved;
    window.dispatchEvent(new Event("tempo-progress-change"));
    return saved;
  }
  function activate(id) {
    const found = profiles().find((p) => p.id === id);
    if (!found) throw Error("Choose an existing profile or create a new one.");
    if (!write(ACTIVE, id))
      throw Error(
        "Browser storage is unavailable. Allow local storage to save and use your profile.",
      );
    user = found;
    memory = {};
    memoryDirty = false;
    return user;
  }
  function newId() {
    return (
      globalThis.crypto?.randomUUID?.() ||
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2)
    );
  }
  function create(name) {
    const username = String(name).trim().replace(/\s+/g, " ");
    if (!/^[\p{L}\p{N} _.-]{2,24}$/u.test(username))
      throw Error(
        "Use 2–24 letters, numbers, spaces, dots, dashes or underscores.",
      );
    const saved = profiles();
    if (
      saved.some(
        (p) => p.username.toLocaleLowerCase() === username.toLocaleLowerCase(),
      )
    )
      throw Error(
        "That name already has a local profile. Choose it above to continue.",
      );
    const id = newId();
    if (!write(PROFILES, [...saved, { id, username }]))
      throw Error(
        "Browser storage is unavailable. Allow local storage to save your profile.",
      );
    return activate(id);
  }
  function rename(name) {
    if (!user) throw Error("Choose a profile first.");
    const username = String(name).trim().replace(/\s+/g, " "),
      saved = profiles();
    if (!/^[\p{L}\p{N} _.-]{2,24}$/u.test(username))
      throw Error(
        "Use 2–24 letters, numbers, spaces, dots, dashes or underscores.",
      );
    if (
      saved.some(
        (p) =>
          p.id !== user.id &&
          p.username.toLocaleLowerCase() === username.toLocaleLowerCase(),
      )
    )
      throw Error("That name already belongs to another profile.");
    if (!saved.some((p) => p.id === user.id))
      throw Error("This profile no longer exists. Choose a profile again.");
    const next = { ...user, username };
    if (
      !write(
        PROFILES,
        saved.map((p) => (p.id === user.id ? next : p)),
      )
    )
      throw Error("Could not save the name. Check browser storage.");
    user = next;
    window.dispatchEvent(new Event("tempo-profile-change"));
    return user;
  }
  function remove() {
    if (!user) throw Error("Choose a profile first.");
    const key = "tempo-local-progress:" + user.id,
      keys = [PROFILES, ACTIVE, key];
    const originals = new Map();
    try {
      for (const k of keys) originals.set(k, localStorage.getItem(k));
      localStorage.setItem(
        PROFILES,
        JSON.stringify(profiles().filter((p) => p.id !== user.id)),
      );
      localStorage.removeItem(key);
      localStorage.removeItem(ACTIVE);
    } catch {
      storageAvailable = false;
      for (const [k, value] of originals) {
        try {
          if (value === null) localStorage.removeItem(k);
          else localStorage.setItem(k, value);
        } catch {}
      }
      throw Error(
        "Could not delete the profile. Check browser storage and try again.",
      );
    }
    user = null;
    memory = {};
    memoryDirty = false;
    window.dispatchEvent(new Event("tempo-profile-change"));
  }
  const active = read(ACTIVE);
  user = profiles().find((p) => p.id === active) || null;
  const ready = Promise.resolve(user);
  function boot() {
    if (!user && document.body.dataset.profileRequired === "true") {
      location.replace("landing.html");
      return;
    }
    document
      .querySelectorAll("[data-username]")
      .forEach((el) => (el.textContent = user?.username || "Player"));
    document
      .querySelectorAll("[data-avatar]")
      .forEach(
        (el) =>
          (el.textContent = (user?.username || "P").slice(0, 1).toUpperCase()),
      );
    document.body.classList.remove("checking-profile");
    document.querySelectorAll("[data-switch-profile]").forEach((el) =>
      el.addEventListener("click", () => {
        location.href = "landing.html?profiles=1";
      }),
    );
    document.querySelectorAll("[data-theme-toggle]").forEach((el) => {
      const label = () => {
        el.textContent =
          document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
        el.setAttribute("aria-label", "Switch color theme");
      };
      el.addEventListener("click", () => TempoTheme.toggle());
      window.addEventListener("tempo-theme-change", label);
      label();
    });
  }
  globalThis.TempoProfile = {
    ready,
    profiles,
    create,
    activate,
    progress,
    update,
    rename,
    remove,
    newId,
    get user() {
      return user;
    },
    get storageAvailable() {
      return storageAvailable;
    },
    solved(id, assisted) {
      return update((p) => ({
        ...p,
        solved: [...new Set([...(p.solved || []), ...(assisted ? [] : [id])])],
        practiced: [...new Set([...(p.practiced || []), id])],
        lastPuzzle: id,
        lastPlayed: Date.now(),
      }));
    },
    rememberPuzzle(id) {
      update((p) => ({ ...p, lastPuzzle: id }));
    },
    recordGame(id, result) {
      update((p) => ({
        ...p,
        completedCount:
          (p.completedCount ?? (p.games || []).length) +
          ((p.games || []).some((g) => g.id === id) ? 0 : 1),
        games: [
          { id, ...result, date: Date.now() },
          ...(p.games || []).filter((g) => g.id !== id),
        ].slice(0, 50),
      }));
    },
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
