(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    dialog = $("profile-dialog");
  function refresh() {
    const saved = TempoProfile.profiles(),
      select = $("profile-select");
    select.replaceChildren();
    $("saved-profiles").hidden = saved.length === 0;
    saved.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.username;
      select.append(option);
    });
    if (TempoProfile.user) select.value = TempoProfile.user.id;
    TempoSelect.enhance(dialog);
  }
  function open() {
    refresh();
    $("profile-error").textContent = "";
    dialog.showModal();
    if (!$("saved-profiles").hidden) $("profile-select-control").focus();
    else $("username").focus();
  }
  document
    .querySelectorAll("[data-profile-open]")
    .forEach((button) => button.addEventListener("click", open));
  dialog
    .querySelector(".close-profile")
    .addEventListener("click", () => dialog.close());
  $("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    $("profile-error").textContent = "";
    try {
      TempoProfile.create($("username").value);
      location.href = "index.html";
    } catch (error) {
      $("profile-error").textContent = error.message;
      refresh();
    }
  });
  $("continue-profile").addEventListener("click", () => {
    try {
      TempoProfile.activate($("profile-select").value);
      location.href = "index.html";
    } catch (error) {
      $("profile-error").textContent = error.message;
      refresh();
    }
  });
  if (new URLSearchParams(location.search).get("profiles") === "1") open();
})();
