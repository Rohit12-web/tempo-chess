/* Explicit update and delete actions for the selected browser-local profile. */
(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const $ = (id) => document.getElementById(id);
  const input = $("profile-name"),
    status = $("profile-status"),
    dialog = $("delete-profile-dialog");
  input.value = TempoProfile.user.username;
  $("rename-profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const profile = TempoProfile.rename(input.value);
      input.value = profile.username;
      document
        .querySelectorAll("[data-username]")
        .forEach((el) => (el.textContent = profile.username));
      document
        .querySelectorAll("[data-avatar]")
        .forEach(
          (el) => (el.textContent = profile.username.slice(0, 1).toUpperCase()),
        );
      status.textContent = "Name updated. Your progress is unchanged.";
    } catch (error) {
      status.textContent = error.message;
    }
  });
  $("delete-profile").addEventListener("click", () => {
    $("delete-profile-description").textContent =
      `You are deleting “${TempoProfile.user.username}”.`;
    $("delete-profile-error").textContent = "";
    dialog.showModal();
  });
  $("cancel-delete-profile").addEventListener("click", () => dialog.close());
  $("confirm-delete-profile").addEventListener("click", () => {
    try {
      TempoProfile.remove();
      location.replace("landing.html?profiles=1");
    } catch (error) {
      $("delete-profile-error").textContent = error.message;
    }
  });
})();
