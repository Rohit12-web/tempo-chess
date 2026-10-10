const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const root = path.resolve(__dirname, "..");

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
    raw(key) { return values.get(key) || null; },
  };
}

function load(file, extras = {}) {
  const localStorage = extras.localStorage || storage();
  const sessionStorage = extras.sessionStorage || storage();
  const context = {
    console,
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    URL,
    URLSearchParams,
    Event: class Event {},
    localStorage,
    sessionStorage,
    location: {
      pathname: "/tempo-chess/" + (extras.page || "login.html"),
      search: extras.search || "",
      href: "https://tempo.test/tempo-chess/" + (extras.page || "login.html") + (extras.search || ""),
      origin: "https://tempo.test",
      replace(value) { this.replaced = value; },
    },
    window: {
      dispatchEvent() {},
      addEventListener() {},
    },
    document: { body: { dataset: {} } },
    ...extras,
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  return { context, localStorage, sessionStorage };
}

async function authSuite() {
  const local = storage();
  const session = storage();
  const { context, localStorage, sessionStorage } = load("js/helpers/auth.js", {
    localStorage: local,
    sessionStorage: session,
  });
  const auth = context.TempoAuth;

  assert.equal(auth.currentAccount(), null);
  await assert.rejects(() => auth.login("Rohit", "wrong-password"), /Incorrect username or password/);
  const admin = await auth.login("ROHIT", "rohit@128");
  assert.equal(admin.role, "admin");
  assert.equal(JSON.parse(sessionStorage.raw("tempo-session-v1")).password, undefined);
  assert.match(localStorage.raw("tempo-accounts-v1"), /PBKDF2-SHA-256/);
  assert.doesNotMatch(localStorage.raw("tempo-accounts-v1"), /rohit@128/);
  auth.logout();
  assert.equal(auth.currentAccount(), null);
  await auth.login("Rohit", "rohit@128");
  const before = JSON.parse(localStorage.raw("tempo-accounts-v1")).find((account) => account.role === "admin");
  await assert.rejects(() => auth.changePassword(before.id, "bad-current", "new-password"));
  await assert.rejects(() => auth.changePassword(before.id, "rohit@128", "short"), /8–128/);
  await auth.changePassword(before.id, "rohit@128", "new-password");
  const after = JSON.parse(localStorage.raw("tempo-accounts-v1")).find((account) => account.role === "admin");
  assert.notEqual(after.password.salt, before.password.salt);
  assert.notEqual(after.password.hash, before.password.hash);
  auth.logout();
  await assert.rejects(() => auth.login("Rohit", "rohit@128"), /Incorrect username or password/);
  await auth.login("Rohit", "new-password");
  auth.logout();

  await assert.rejects(() => auth.signup({
    displayName: "Player",
    username: "Rohit",
    password: "password123",
  }), /reserved/);
  const first = await auth.signup({
    displayName: "First Player",
    username: "Player_One",
    password: "password123",
  });
  assert.equal(first.role, "player");
  const profileScript = fs.readFileSync(path.join(root, "js/helpers/profile.js"), "utf8");
  context.document = {
    body: { dataset: {} },
    querySelectorAll() { return []; },
  };
  vm.runInNewContext(profileScript, context, { filename: "js/helpers/profile.js" });
  await context.TempoProfile.ready;
  context.TempoProfile.update((progress) => ({ ...progress, notebook: [{ id: "note-1" }], solved: ["tactic-1"] }));
  auth.logout();
  const second = await auth.signup({
    displayName: "Second Player",
    username: "player_two",
    password: "password123",
  });
  const secondContext = load("js/helpers/auth.js", { localStorage, sessionStorage }).context;
  secondContext.document = { body: { dataset: {} }, querySelectorAll() { return []; } };
  vm.runInNewContext(profileScript, secondContext, { filename: "js/helpers/profile.js" });
  await secondContext.TempoProfile.ready;
  secondContext.TempoProfile.update((progress) => ({ ...progress, notebook: [{ id: "note-2" }], solved: ["tactic-2"] }));
  assert.deepEqual(JSON.parse(localStorage.raw(`tempo-local-progress:${first.id}`)).notebook, [{ id: "note-1" }]);
  assert.deepEqual(JSON.parse(localStorage.raw(`tempo-local-progress:${second.id}`)).notebook, [{ id: "note-2" }]);
  assert.notEqual(first.id, second.id);
  const playerRoute = load("js/helpers/auth.js", { localStorage, sessionStorage, page: "admin.html" });
  assert.equal(playerRoute.context.TempoAuth.requireAdmin(), null);
  assert.equal(playerRoute.context.location.replaced, "index.html?message=admin-only");
  auth.logout();
  const signedOutRoute = load("js/helpers/auth.js", { localStorage, sessionStorage, page: "index.html" });
  assert.equal(signedOutRoute.context.TempoAuth.requirePlayer(), null);
  assert.equal(signedOutRoute.context.location.replaced, "login.html?return=index.html");
  await assert.rejects(() => auth.login("player_one", "wrong-password"), /Incorrect username or password/);
  await assert.rejects(() => auth.signup({
    displayName: "Duplicate",
    username: "PLAYER_ONE",
    password: "password123",
  }), /already in use/);

  const returnContext = load("js/helpers/auth.js", {
    localStorage: local,
    sessionStorage: session,
    search: "?return=play.html%3Fview%3Dpuzzles%26puzzle%3Dcustom-1",
  });
  assert.equal(returnContext.context.TempoAuth.destination(), "play.html?view=puzzles&puzzle=custom-1");
  const unsafe = load("js/helpers/auth.js", {
    localStorage: local,
    sessionStorage: session,
    search: "?return=https%3A%2F%2Fevil.test%2F",
  });
  assert.equal(unsafe.context.TempoAuth.destination(), "index.html");
  assert.equal(unsafe.context.TempoAuth.destination.call({}), "index.html");
}

async function migrationSuite() {
  const local = storage();
  const session = storage();
  local.setItem("tempo-local-profiles", JSON.stringify([
    { id: "legacy-rohit", username: "Rohit" },
    { id: "legacy-player", username: "Old Player" },
  ]));
  local.setItem("tempo-local-progress:legacy-player", JSON.stringify({ solved: ["tactic-1"] }));
  const { context } = load("js/helpers/auth.js", { localStorage: local, sessionStorage: session });
  const auth = context.TempoAuth;
  const migrated = await auth.signup({
    displayName: "Migrated Player",
    username: "migrated",
    password: "password123",
    profileId: "legacy-player",
  });
  assert.equal(migrated.id, "legacy-player");
  assert.deepEqual(JSON.parse(local.raw("tempo-local-progress:legacy-player")), { solved: ["tactic-1"] });
  assert.equal(auth.currentAccount().role, "player");
  auth.logout();
  assert.equal(auth.getLegacyProfiles().some((profile) => profile.id === "legacy-player"), false);
  await assert.rejects(() => auth.signup({
    displayName: "Second Claim",
    username: "second_claim",
    password: "password123",
    profileId: "legacy-player",
  }), /no longer available/);
  const rohits = auth.getLegacyProfiles().filter((profile) => profile.id === "legacy-rohit");
  assert.equal(rohits.length, 1);
  assert.equal(auth.accountList().some((account) => account.id === "legacy-rohit" && account.role === "admin"), false);
  assert.equal(local.raw("tempo-active-profile"), null);
}

function customPuzzleSuite() {
  const local = storage();
  const builtIn = { id: "builtin-1" };
  const loaded = load("js/core/engine.js", {
    localStorage: local,
    Event: class Event {},
  });
  const context = loaded.context;
  context.TempoPuzzles = [builtIn];
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/helpers/game-data.js"), "utf8"), context, {
    filename: "js/helpers/game-data.js",
  });
  context.TempoAdminAuth = { active: () => true };
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/helpers/custom-puzzles.js"), "utf8"), context, {
    filename: "js/helpers/custom-puzzles.js",
  });
  const puzzles = context.TempoCustomPuzzles;
  const input = {
    theme: "Test puzzle",
    category: "Fork",
    difficulty: "Beginner",
    detail: "Find the move.",
    explanation: "A test explanation.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    line: ["e2e4"],
    published: false,
  };
  const draft = puzzles.save(input);
  assert.equal(draft.published, false);
  assert.equal(context.TempoPuzzles.length, 1);
  const published = puzzles.save({ ...draft, published: true });
  assert.equal(published.published, true);
  assert.equal(context.TempoPuzzles.length, 2);
  assert.equal(context.TempoPuzzles[1].custom, true);
  assert.throws(() => puzzles.validate({ ...input, fen: "not a fen" }), /Invalid board position/);
  assert.throws(() => puzzles.validate({ ...input, line: ["bad"] }), /not legal/);
  assert.throws(() => puzzles.validate({ ...input, category: "Invalid" }), /theme and difficulty/);
  puzzles.remove(published.id);
  assert.equal(context.TempoPuzzles.length, 1);
  assert.equal(puzzles.list().length, 0);
  assert.deepEqual(context.TempoPuzzles[0], builtIn);

  const failingStorage = {
    getItem: local.getItem,
    setItem() { throw new Error("quota"); },
    removeItem: local.removeItem,
  };
  const failedContext = load("js/helpers/custom-puzzles.js", {
    localStorage: failingStorage,
    TempoPuzzles: [builtIn],
    TempoChess: { square(value) { return value; } },
    TempoAdminAuth: { active: () => true },
    TempoGameData: {
      position() {
        return {
          state: {},
          status() { return { over: false, reason: "" }; },
          move() { return { san: "e4" }; },
        };
      },
      fen() { return "start fen"; },
    },
    Event: class Event {},
  }).context;
  assert.throws(() => failedContext.TempoCustomPuzzles.save(input), /Could not save custom puzzles/);
}

(async () => {
  await authSuite();
  await migrationSuite();
  customPuzzleSuite();
  console.log("admin/auth/migration tests passed");
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
