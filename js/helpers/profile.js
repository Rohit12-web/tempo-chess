/* Compatibility API for the chess features, backed by TempoAuth accounts. */
(() => {
  "use strict";
  const PROFILES = "tempo-local-profiles";
  let user = null;
  let memory = {};
  let memoryDirty = false;
  let storageAvailable = true;

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
  function profileList() {
    const accounts = TempoAuth.accountList().filter((account) => account.role === "player");
    return accounts.map((account) => ({
      id: account.id,
      username: account.displayName,
      displayName: account.displayName,
      loginUsername: account.username,
    }));
  }
  function progress() {
    if (memoryDirty) return memory;
    const saved = user && read("tempo-local-progress:" + user.id);
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : memory;
  }
  function update(fn) {
    if (!user) return false;
    memory = fn(progress());
    const saved = write("tempo-local-progress:" + user.id, memory);
    memoryDirty = !saved;
    window.dispatchEvent(new Event("tempo-progress-change"));
    return saved;
  }
  function boot() {
    user = TempoAuth.requirePlayer();
    if (!user) return;
    memory = {};
    memoryDirty = false;
    document.querySelectorAll("[data-display-name], [data-username]").forEach((el) => {
      el.textContent = user.displayName;
    });
    document.querySelectorAll("[data-account-username]").forEach((el) => {
      el.textContent = "@" + user.username;
    });
    document.querySelectorAll("[data-avatar]").forEach((el) => {
      el.textContent = user.displayName.slice(0, 1).toUpperCase();
    });
    document.querySelectorAll("[data-logout]").forEach((el) => {
      el.addEventListener("click", () => {
        TempoAuth.logout();
        location.replace("login.html");
      });
    });
    document.body.classList.remove("checking-profile");
    document.querySelectorAll("[data-theme-toggle]").forEach((el) => {
      const label = () => {
        el.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
        el.setAttribute("aria-label", "Switch color theme");
      };
      el.addEventListener("click", () => TempoTheme.toggle());
      window.addEventListener("tempo-theme-change", label);
      label();
    });
  }
  window.addEventListener("pageshow", () => {
    if (document.body.dataset.profileRequired === "true" && !TempoAuth.currentAccount())
      TempoAuth.requirePlayer();
  });
  const ready = Promise.resolve().then(() => {
    user = TempoAuth.currentAccount();
    if (document.body.dataset.profileRequired === "true") boot();
    return user;
  });
  globalThis.TempoProfile = {
    ready,
    profiles: profileList,
    progress,
    update,
    newId: () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    get user() { return user; },
    get storageAvailable() { return storageAvailable && TempoAuth.storageAvailable; },
    rename(displayName) {
      if (!user) throw Error("Sign in before changing your display name.");
      displayName = String(displayName).trim();
      if (!displayName || displayName.length > 80) throw Error("Display name must be 1–80 characters.");
      const accounts = TempoAuth.accountList();
      const updated = { ...user, displayName };
      if (!write("tempo-accounts-v1", accounts.map((account) => account.id === user.id ? updated : account)))
        throw Error("Could not save the display name. Check browser storage.");
      user = updated;
      document.querySelectorAll("[data-display-name], [data-username]").forEach((el) => el.textContent = displayName);
      document.querySelectorAll("[data-avatar]").forEach((el) => el.textContent = displayName.slice(0, 1).toUpperCase());
      return user;
    },
    remove() {
      if (!user) throw Error("Sign in before deleting your account.");
      const accounts = TempoAuth.accountList();
      if (!write("tempo-accounts-v1", accounts.filter((account) => account.id !== user.id)))
        throw Error("Could not delete the account. Check browser storage and try again.");
      try {
        localStorage.removeItem("tempo-local-progress:" + user.id);
      } catch {
        throw Error("The account was updated, but its progress could not be removed.");
      }
      TempoAuth.logout();
      user = null;
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
    rememberPuzzle(id) { update((p) => ({ ...p, lastPuzzle: id })); },
    recordGame(id, result) {
      return update((p) => ({
        ...p,
        completedCount: (p.completedCount ?? (p.games || []).length) + ((p.games || []).some((g) => g.id === id) ? 0 : 1),
        games: [{ id, ...result, date: Date.now() }, ...(p.games || []).filter((g) => g.id !== id)].slice(0, 50),
      }));
    },
  };
})();
