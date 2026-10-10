(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const update = () => {
      button.textContent = document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
      button.setAttribute("aria-label", "Switch color theme");
    };
    button.addEventListener("click", () => TempoTheme.toggle());
    window.addEventListener("tempo-theme-change", update);
    update();
  });
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.passwordToggle);
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    });
  });
  const account = TempoAuth.currentAccount();
  if (account) location.replace(account.role === "admin" ? "admin.html" : TempoAuth.destination());
  const login = $("login-form");
  if (login) login.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = login.querySelector("button[type=submit]");
    const error = $("login-error");
    button.disabled = true; button.textContent = "Checking…"; error.textContent = "";
    try {
      const account = await TempoAuth.login($("login-username").value, $("login-password").value);
      location.replace(account.role === "admin" ? "admin.html" : TempoAuth.destination());
    } catch (reason) {
      error.textContent = reason.message;
      button.disabled = false; button.textContent = "Log in";
    }
  });
  const signup = $("signup-form");
  if (!signup) return;
  try {
    const profiles = TempoAuth.getLegacyProfiles();
    if (profiles.length) {
      const field = $("migration-field"), select = $("migration-profile");
      field.hidden = false;
      profiles.forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile.id; option.textContent = `${profile.username} (preserve this progress)`;
        select.append(option);
      });
    }
  } catch (reason) { $("signup-error").textContent = reason.message; }
  signup.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = signup.querySelector("button[type=submit]"), error = $("signup-error");
    button.disabled = true; button.textContent = "Creating…"; error.textContent = "";
    try {
      if ($("signup-password").value !== $("signup-confirm").value) throw Error("Passwords do not match.");
      const account = await TempoAuth.signup({
        displayName: $("signup-display").value,
        username: $("signup-username").value,
        password: $("signup-password").value,
        profileId: $("migration-profile")?.value || "",
      });
      location.replace(account.role === "admin" ? "admin.html" : "index.html");
    } catch (reason) {
      error.textContent = reason.message;
      button.disabled = false; button.textContent = "Create account";
    }
  });
})();
