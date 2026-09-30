/* Progressive enhancement: the original select still owns each form value. */
(() => {
  "use strict";
  const controls = new WeakMap();
  let active = null;

  function enhance(root = document) {
    root
      .querySelectorAll("select.setup-select, #profile-select")
      .forEach((select) => {
        if (controls.has(select)) {
          controls.get(select).sync();
          return;
        }
        const labels = Array.from(select.labels || []);
        const wrap = document.createElement("div"),
          button = document.createElement("button");
        const value = document.createElement("span"),
          arrow = document.createElement("span");
        const list = document.createElement("div");
        wrap.className = "select-menu";
        button.className = "select-trigger";
        button.type = "button";
        button.id = `${select.id}-control`;
        value.className = "select-value";
        arrow.className = "select-chevron";
        arrow.setAttribute("aria-hidden", "true");
        list.className = "select-options";
        list.id = `${select.id}-options`;
        list.hidden = true;
        button.setAttribute("role", "combobox");
        button.setAttribute("aria-haspopup", "listbox");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", list.id);
        list.setAttribute("role", "listbox");
        labels.forEach((label, i) => {
          label.id ||= `${select.id}-label-${i}`;
          label.htmlFor = button.id;
        });
        if (labels.length) {
          const ids = labels.map((label) => label.id).join(" ");
          button.setAttribute("aria-labelledby", ids);
          list.setAttribute("aria-labelledby", ids);
        } else {
          button.setAttribute(
            "aria-label",
            select.getAttribute("aria-label") || "Choose an option",
          );
          list.setAttribute("aria-label", button.getAttribute("aria-label"));
        }
        select.before(wrap);
        wrap.append(select, button, list);
        button.append(value, arrow);
        select.hidden = true;
        let current = -1,
          search = "",
          lastTyped = 0;
        const options = () => Array.from(select.options);

        function sync() {
          value.textContent =
            select.selectedOptions[0]?.textContent || "Choose an option";
          button.disabled = select.disabled || select.options.length === 0;
          list.replaceChildren();
          options().forEach((option, i) => {
            const row = document.createElement("div");
            row.className = "select-option";
            row.id = `${select.id}-option-${i}`;
            row.dataset.index = String(i);
            row.setAttribute("role", "option");
            row.setAttribute("aria-selected", String(option.selected));
            row.setAttribute("aria-disabled", String(option.disabled));
            row.textContent = option.textContent;
            list.append(row);
          });
        }
        function highlight(index) {
          current = index;
          Array.from(list.children).forEach((row, i) =>
            row.classList.toggle("is-active", i === index),
          );
          const row = list.children[index];
          if (row) {
            button.setAttribute("aria-activedescendant", row.id);
            // Scroll the list itself; scrollIntoView can unexpectedly move the dialog/page.
            if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
            else if (
              row.offsetTop + row.offsetHeight >
              list.scrollTop + list.clientHeight
            )
              list.scrollTop =
                row.offsetTop + row.offsetHeight - list.clientHeight;
          }
        }
        function close() {
          list.hidden = true;
          button.setAttribute("aria-expanded", "false");
          button.removeAttribute("aria-activedescendant");
          search = "";
          if (active?.button === button) active = null;
        }
        function position() {
          const rect = button.getBoundingClientRect(),
            viewport = window.visualViewport;
          const top = viewport?.offsetTop || 0,
            left = viewport?.offsetLeft || 0;
          const height = viewport?.height || window.innerHeight,
            width = viewport?.width || window.innerWidth;
          const below = top + height - rect.bottom - 12,
            above = rect.top - top - 12;
          const upwards =
            below < Math.min(240, list.scrollHeight) && above > below;
          const available = Math.max(
            40,
            Math.min(240, upwards ? above : below),
          );
          list.style.width = `${Math.min(rect.width, width - 24)}px`;
          list.style.maxHeight = `${available}px`;
          list.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - rect.width - 12))}px`;
          list.style.top = `${upwards ? rect.top - Math.min(list.scrollHeight, available) - 6 : rect.bottom + 6}px`;
        }
        function open() {
          if (button.disabled) return;
          active?.close();
          sync();
          list.hidden = false;
          button.setAttribute("aria-expanded", "true");
          active = { button, wrap, list, close, position };
          position();
          highlight(select.selectedIndex);
        }
        function commit(index) {
          if (!select.options[index] || select.options[index].disabled) return;
          const changed = select.selectedIndex !== index;
          select.selectedIndex = index;
          sync();
          close();
          button.focus({ preventScroll: true });
          if (changed) {
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        function step(direction) {
          const opts = options();
          for (
            let next = current + direction;
            next >= 0 && next < opts.length;
            next += direction
          )
            if (!opts[next].disabled) {
              highlight(next);
              break;
            }
        }
        button.addEventListener("click", () =>
          list.hidden ? open() : close(),
        );
        button.addEventListener("keydown", (event) => {
          const key = event.key;
          if (key === "Escape" && !list.hidden) {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (key === "Tab") {
            close();
            return;
          }
          if (
            ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(key)
          ) {
            event.preventDefault();
            if (list.hidden) {
              open();
              if (key !== "Home" && key !== "End") return;
            }
            if (key === "Enter" || key === " ") commit(current);
            else if (key === "Home") {
              current = -1;
              step(1);
            } else if (key === "End") {
              current = select.options.length;
              step(-1);
            } else step(key === "ArrowDown" ? 1 : -1);
          } else if (
            key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            if (list.hidden) open();
            const now = Date.now();
            search = now - lastTyped > 700 ? key : search + key;
            lastTyped = now;
            const query = search.toLocaleLowerCase(),
              opts = options();
            const repeated = Array.from(query).every((c) => c === query[0]);
            for (let offset = 1; offset <= opts.length; offset++) {
              const i = (current + offset + opts.length) % opts.length;
              if (
                !opts[i].disabled &&
                opts[i].textContent
                  .trim()
                  .toLocaleLowerCase()
                  .startsWith(repeated ? query[0] : query)
              ) {
                highlight(i);
                break;
              }
            }
          }
        });
        // Keep keyboard focus on the combobox while an option is tapped/clicked.
        list.addEventListener("pointerdown", (event) => {
          if (event.pointerType !== "touch") event.preventDefault();
        });
        list.addEventListener("click", (event) => {
          const row = event.target.closest(".select-option");
          if (row) commit(Number(row.dataset.index));
        });
        select.addEventListener("change", sync);
        wrap.addEventListener("focusout", (event) => {
          if (event.relatedTarget && !wrap.contains(event.relatedTarget))
            close();
        });
        controls.set(select, { sync });
        sync();
      });
  }
  document.addEventListener("pointerdown", (event) => {
    if (active && !active.wrap.contains(event.target)) active.close();
  });
  document.addEventListener(
    "close",
    (event) => {
      if (active && event.target.contains(active.wrap)) active.close();
    },
    true,
  );
  document.addEventListener(
    "cancel",
    (event) => {
      if (active && event.target.contains(active.wrap)) {
        event.preventDefault();
        active.close();
      }
    },
    true,
  );
  document.addEventListener(
    "scroll",
    (event) => {
      if (active && !active.list.contains(event.target)) active.position();
    },
    true,
  );
  window.addEventListener("resize", () => active?.close());
  window.addEventListener("blur", () => active?.close());
  window.visualViewport?.addEventListener("resize", () => active?.close());
  globalThis.TempoSelect = Object.freeze({ enhance });
})();
