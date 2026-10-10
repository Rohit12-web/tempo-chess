(() => {
  "use strict";
  const account = TempoAuth.currentAccount();
  document.querySelectorAll("[data-auth-link]").forEach((link) => {
    if (!account) return;
    link.textContent = account.role === "admin" ? "Open admin dashboard ↗" : "Open your dashboard ↗";
    link.href = account.role === "admin" ? "admin.html" : "index.html";
  });
  document.querySelectorAll("[data-login-link]").forEach((link) => {
    if (account) {
      link.textContent = account.role === "admin" ? "Admin dashboard" : "Log in";
      link.href = account.role === "admin" ? "admin.html" : "index.html";
    }
  });
})();
