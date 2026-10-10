/* Administrator session adapter for the separate dashboard. */
(() => {
  "use strict";
  let account = null;
  const refresh = () => {
    account = TempoAuth.currentAccount();
    return account?.role === "admin";
  };
  globalThis.TempoAdminAuth = Object.freeze({
    configured: () => true,
    setup: () => Promise.reject(Error("Administrator setup is managed by login.html.")),
    login: (username, password) => TempoAuth.login(username, password).then((value) => {
      if (value.role !== "admin") throw Error("Only the administrator can open this dashboard.");
      account = value;
      return value;
    }),
    active: () => refresh(),
    account: () => (refresh() ? account : null),
    changePassword: (current, next) => TempoAuth.changePassword(account?.id, current, next),
    logout: () => { account = null; TempoAuth.logout(); },
  });
})();
