/* Browser-local accounts. This is a demonstration login, not public-site security. */
(() => {
  "use strict";

  const ACCOUNTS_KEY = "tempo-accounts-v1";
  const SESSION_KEY = "tempo-session-v1";
  const MIGRATION_KEY = "tempo-account-migration-v1";
  const LEGACY_PROFILES_KEY = "tempo-local-profiles";
  const ITERATIONS = 120000;
  const INITIAL_ADMIN = {
    version: 1,
    id: "tempo-admin-rohit",
    displayName: "Rohit",
    username: "Rohit",
    usernameNormalized: "rohit",
    role: "admin",
    password: {
      algorithm: "PBKDF2-SHA-256",
      iterations: ITERATIONS,
      keyLength: 256,
      salt: "4217f78a2dcd03f54512b95c2cfae415",
      hash: "59b9dc77edb0f5de53b0ca16aa32d0e3da5ec90ec93bf949b6d0ecbd876364f8",
    },
    createdAt: "2026-10-11T00:00:00.000Z",
  };
  const reserved = new Set(["rohit", "admin"]);
  let storageAvailable = true;

  function storageError() {
    return Error(
      "Browser storage is unavailable or full. Use localhost or HTTPS, allow site storage, and try again.",
    );
  }
  function read(key) {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch {
      storageAvailable = false;
      throw storageError();
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      throw Error("TempoChess found damaged local data and did not replace it.");
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
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      storageAvailable = false;
      throw storageError();
    }
  }
  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      throw storageError();
    }
  }
  function writeSession(value) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      return true;
    } catch {
      storageAvailable = false;
      return false;
    }
  }
  function removeSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      storageAvailable = false;
      throw storageError();
    }
  }
  function randomHex(length = 16) {
    if (!globalThis.crypto?.getRandomValues)
      throw Error(
        "Password setup requires Web Crypto. Open TempoChess on localhost or HTTPS.",
      );
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  function bytesFromHex(value) {
    return Uint8Array.from(value.match(/../g), (part) => parseInt(part, 16));
  }
  function hex(bytes) {
    return Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  async function hashPassword(password, salt, iterations = ITERATIONS) {
    if (!globalThis.crypto?.subtle)
      throw Error(
        "Password hashing requires Web Crypto. Open TempoChess on localhost or HTTPS.",
      );
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", iterations, salt: bytesFromHex(salt) },
      material,
      256,
    );
    return hex(new Uint8Array(bits));
  }
  function validPassword(password) {
    return typeof password === "string" && password.length >= 8 && password.length <= 128;
  }
  function validateAccountList(value) {
    if (!Array.isArray(value) || value.some((account) => !account?.id || !account?.username))
      throw Error("TempoChess account data is damaged and was not replaced.");
    return value;
  }
  function accountList() {
    const value = read(ACCOUNTS_KEY);
    if (value === null) return [];
    return validateAccountList(value);
  }
  function ensureAdministrator() {
    let accounts = accountList();
    if (!accounts.some((account) => account.role === "admin" && account.usernameNormalized === "rohit")) {
      accounts = [...accounts.filter((account) => account.usernameNormalized !== "admin"), INITIAL_ADMIN];
      if (!write(ACCOUNTS_KEY, accounts)) throw storageError();
      if (!write(MIGRATION_KEY, { version: 1, completedAt: Date.now() }))
        throw storageError();
    }
    return accounts;
  }
  function getAccounts() {
    return ensureAdministrator();
  }
  function getSession() {
    const value = readSession();
    return value && typeof value.accountId === "string" ? value : null;
  }
  function currentAccount() {
    const session = getSession();
    if (!session) return null;
    return getAccounts().find((account) => account.id === session.accountId) || null;
  }
  function destination() {
    const requested = new URLSearchParams(location.search).get("return");
    const allowed = new Set([
      "index.html",
      "play.html",
      "openings.html",
      "replay.html",
      "notebook.html",
      "statistics.html",
      "lessons.html",
    ]);
    if (!requested) return "index.html";
    try {
      const url = new URL(requested, location.href);
      if (url.origin !== location.origin || !allowed.has(url.pathname.split("/").pop()))
        return "index.html";
      return url.pathname.split("/").pop() + url.search + url.hash;
    } catch {
      return "index.html";
    }
  }
  function loginRedirect() {
    const current = location.pathname.split("/").pop();
    const query = current && current !== "landing.html" ? `?return=${encodeURIComponent(current + location.search)}` : "";
    location.replace("login.html" + query);
  }
  function requirePlayer() {
    const account = currentAccount();
    if (!account) {
      loginRedirect();
      return null;
    }
    if (account.role !== "player") {
      location.replace("admin.html");
      return null;
    }
    return account;
  }
  function requireAdmin() {
    const account = currentAccount();
    if (!account) {
      loginRedirect();
      return null;
    }
    if (account.role !== "admin") {
      location.replace("index.html?message=admin-only");
      return null;
    }
    return account;
  }
  function legacyProfiles() {
    const value = read(LEGACY_PROFILES_KEY);
    if (value === null) return [];
    if (!Array.isArray(value)) throw Error("Older profile data is damaged and was not replaced.");
    const accounts = accountList();
    return value.filter(
      (profile) =>
        profile &&
        typeof profile.id === "string" &&
        typeof profile.username === "string" &&
        !accounts.some((account) => account.id === profile.id),
    );
  }
  async function signup({ displayName, username, password, profileId }) {
    displayName = String(displayName).trim();
    username = String(username).trim();
    const normalized = username.toLocaleLowerCase();
    if (!displayName) throw Error("Enter a display name.");
    if (displayName.length > 80) throw Error("Display name must be 80 characters or fewer.");
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(username))
      throw Error("Username must be 3–24 letters, numbers, underscores or hyphens.");
    if (reserved.has(normalized)) throw Error("That username is reserved. Choose another username.");
    if (!validPassword(password)) throw Error("Password must be 8–128 characters.");
    const accounts = getAccounts();
    if (accounts.some((account) => account.usernameNormalized === normalized))
      throw Error("That username is already in use.");
    const legacy = profileId ? legacyProfiles().find((profile) => profile.id === profileId) : null;
    if (profileId && !legacy) throw Error("That older profile is no longer available to migrate.");
    const id = legacy?.id || `tempo-player-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
    const salt = randomHex();
    const account = {
      version: 1,
      id,
      displayName,
      username,
      usernameNormalized: normalized,
      role: "player",
      password: { algorithm: "PBKDF2-SHA-256", iterations: ITERATIONS, keyLength: 256, salt, hash: await hashPassword(password, salt) },
      createdAt: new Date().toISOString(),
    };
    if (!write(ACCOUNTS_KEY, [...accounts, account])) throw storageError();
    if (legacy) {
      const remaining = JSON.parse(JSON.stringify(read(LEGACY_PROFILES_KEY))).filter((profile) => profile.id !== legacy.id);
      if (!write(LEGACY_PROFILES_KEY, remaining)) throw storageError();
      if (!write(MIGRATION_KEY, { version: 1, lastProfileId: legacy.id, completedAt: Date.now() })) throw storageError();
    }
    establishSession(account);
    return account;
  }
  function establishSession(account) {
    if (!writeSession({ version: 1, accountId: account.id, issuedAt: Date.now() }))
      throw storageError();
  }
  async function login(username, password) {
    const account = getAccounts().find(
      (candidate) => candidate.usernameNormalized === String(username).trim().toLocaleLowerCase(),
    );
    if (!account || !validPassword(password)) throw Error("Incorrect username or password.");
    const actual = await hashPassword(password, account.password.salt, account.password.iterations);
    if (actual !== account.password.hash) throw Error("Incorrect username or password.");
    establishSession(account);
    return account;
  }
  function logout() {
    removeSession();
    window.dispatchEvent(new Event("tempo-auth-change"));
  }
  async function changePassword(accountId, current, next) {
    const account = getAccounts().find((candidate) => candidate.id === accountId);
    if (!account || account.role !== "admin") throw Error("Administrator access is required.");
    if (!validPassword(current) || !validPassword(next)) throw Error("Passwords must be 8–128 characters.");
    if (await hashPassword(current, account.password.salt, account.password.iterations) !== account.password.hash)
      throw Error("The current password is incorrect.");
    const salt = randomHex();
    const updated = { ...account, password: { algorithm: "PBKDF2-SHA-256", iterations: ITERATIONS, keyLength: 256, salt, hash: await hashPassword(next, salt) } };
    const accounts = getAccounts().map((candidate) => candidate.id === account.id ? updated : candidate);
    if (!write(ACCOUNTS_KEY, accounts)) throw storageError();
  }
  globalThis.TempoAuth = Object.freeze({
    accountList, currentAccount, destination, ensureAdministrator, getLegacyProfiles: legacyProfiles,
    signup, login, logout, requirePlayer, requireAdmin, changePassword,
    get storageAvailable() { return storageAvailable; },
  });
})();
