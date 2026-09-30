/* Shared animated board for opening lessons and read-only game replay. */
(() => {
  const C = TempoChess,
    glyph = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  class StudyBoard {
    constructor(host, onMove = null) {
      this.host = host;
      this.onMove = onMove;
      this.flipped = false;
      this.selected = null;
      this.nodes = new Map();
      this.focused = 52;
      this.interactive = false;
      this.suppress = 0;
      host.classList.add("board-frame");
      host.innerHTML =
        '<div class="rank-labels" aria-hidden="true"></div><div class="board" role="grid" aria-label="Study board. Arrow keys navigate; Enter selects."><div class="square-layer"></div><div class="piece-layer" aria-hidden="true"></div></div><div class="file-labels" aria-hidden="true"></div>';
      this.board = host.querySelector(".board");
      this.layer = host.querySelector(".piece-layer");
      this.squares();
      this.board.addEventListener("click", (event) => {
        if (performance.now() < this.suppress) return;
        const square = event.target.closest("[data-square]");
        if (square) this.click(Number(square.dataset.square));
      });
      this.board.addEventListener("keydown", (event) => {
        const el = event.target.closest("[data-square]");
        if (!el) return;
        const s = Number(el.dataset.square),
          v = this.visual(s),
          r = Math.floor(v / 8),
          c = v % 8,
          d = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
          }[event.key];
        if (d) {
          event.preventDefault();
          const nr = r + d[0],
            nc = c + d[1];
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;
          this.focused = this.visual(nr * 8 + nc);
          el.tabIndex = -1;
          const next = this.board.querySelector(
            `[data-square="${this.focused}"]`,
          );
          next.tabIndex = 0;
          next.focus({ preventScroll: true });
        }
        if (event.key === "Escape") {
          this.cancelDrag();
          this.selected = null;
          this.highlights();
        }
      });
      this.board.addEventListener("pointerdown", (e) => {
        const el = e.target.closest("[data-square]");
        if (!this.interactive || !el || e.button !== 0 || !e.isPrimary) return;
        const from = Number(el.dataset.square),
          p = this.game.state.board[from];
        if (p?.color !== this.game.state.turn) return;
        this.drag = {
          from,
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          el: this.nodes.get(p.id),
          active: false,
        };
      });
      this.board.addEventListener("pointermove", (e) => {
        const d = this.drag;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x,
          dy = e.clientY - d.y;
        if (!d.active && Math.hypot(dx, dy) < 5) return;
        if (!d.active) {
          d.active = true;
          this.selected = d.from;
          this.highlights();
          this.board.setPointerCapture(d.id);
          d.el.classList.add("dragging");
        }
        e.preventDefault();
        const v = this.visual(d.from);
        d.el.style.transform = `translate(calc(${(v % 8) * 100}% + ${dx}px),calc(${Math.floor(v / 8) * 100}% + ${dy}px)) scale(1.06)`;
      });
      this.board.addEventListener("pointerup", (e) => {
        const d = this.drag;
        if (!d || d.id !== e.pointerId) return;
        const rect = this.board.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX < rect.right &&
          e.clientY >= rect.top &&
          e.clientY < rect.bottom;
        const to = inside
          ? this.visual(
              Math.floor(((e.clientY - rect.top) / rect.height) * 8) * 8 +
                Math.floor(((e.clientX - rect.left) / rect.width) * 8),
            )
          : null;
        this.cancelDrag();
        if (d.active) {
          this.suppress = performance.now() + 350;
          e.preventDefault();
          if (to !== null && to !== d.from) this.attempt(d.from, to);
        }
      });
      ["pointercancel", "lostpointercapture"].forEach((type) =>
        this.board.addEventListener(type, () => this.cancelDrag()),
      );
      window.addEventListener("blur", () => this.cancelDrag());
    }
    visual(s) {
      return this.flipped ? 63 - s : s;
    }
    place(el, s) {
      const v = this.visual(s);
      el.style.removeProperty("transform");
      el.style.setProperty("--x", `${(v % 8) * 100}%`);
      el.style.setProperty("--y", `${Math.floor(v / 8) * 100}%`);
    }
    cancelDrag() {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      d.el.classList.remove("dragging");
      this.place(d.el, d.from);
      if (this.board.hasPointerCapture(d.id))
        this.board.releasePointerCapture(d.id);
    }
    squares() {
      const layer = this.host.querySelector(".square-layer");
      layer.replaceChildren();
      for (let r = 0; r < 8; r++) {
        const row = document.createElement("div");
        row.className = "board-rank";
        row.setAttribute("role", "row");
        for (let c = 0; c < 8; c++) {
          const s = this.visual(r * 8 + c),
            el = document.createElement("button");
          el.type = "button";
          el.className = "square" + ((r + c) % 2 ? " dark" : "");
          el.dataset.square = s;
          el.setAttribute("role", "gridcell");
          el.tabIndex = s === this.focused ? 0 : -1;
          row.append(el);
        }
        layer.append(row);
      }
      this.host.querySelector(".rank-labels").innerHTML = Array.from(
        { length: 8 },
        (_, i) => `<span>${this.flipped ? i + 1 : 8 - i}</span>`,
      ).join("");
      this.host.querySelector(".file-labels").innerHTML = Array.from(
        { length: 8 },
        (_, i) => `<span>${"abcdefgh"[this.flipped ? 7 - i : i]}</span>`,
      ).join("");
    }
    render(game, interactive = false) {
      this.cancelDrag();
      this.game = game;
      this.interactive = interactive;
      this.selected = null;
      const live = new Set();
      game.state.board.forEach((p, s) => {
        if (!p) return;
        live.add(p.id);
        let el = this.nodes.get(p.id);
        if (!el) {
          el = document.createElement("span");
          el.className = "piece " + (p.color === "w" ? "white" : "black");
          this.nodes.set(p.id, el);
          this.layer.append(el);
        }
        el.className = "piece " + (p.color === "w" ? "white" : "black");
        el.textContent = glyph[p.type];
        this.place(el, s);
      });
      for (const [id, el] of this.nodes)
        if (!live.has(id)) {
          this.nodes.delete(id);
          el.classList.add("captured");
          setTimeout(() => el.remove(), 220);
        }
      this.board.setAttribute("aria-readonly", String(!interactive));
      this.highlights();
    }
    highlights() {
      if (!this.game) return;
      const last = this.game.history.at(-1),
        moves = this.selected === null ? [] : this.game.moves(this.selected);
      this.board.querySelectorAll("[data-square]").forEach((el) => {
        const s = Number(el.dataset.square),
          p = this.game.state.board[s];
        el.classList.toggle("selected", this.selected === s);
        el.classList.toggle(
          "legal",
          moves.some((m) => m.to === s),
        );
        el.classList.toggle("capture", !!p && moves.some((m) => m.to === s));
        el.classList.toggle("last-move", last?.from === s || last?.to === s);
        el.setAttribute("aria-selected", String(this.selected === s));
        el.setAttribute(
          "aria-label",
          `${C.name(s)}, ${p ? (p.color === "w" ? "White " : "Black ") + C.TYPES[p.type] : "empty"}`,
        );
      });
    }
    click(s) {
      if (!this.interactive) return;
      if (
        this.selected !== null &&
        this.selected !== s &&
        this.game.moves(this.selected).some((m) => m.to === s)
      ) {
        this.attempt(this.selected, s);
        return;
      }
      this.selected =
        this.game.state.board[s]?.color === this.game.state.turn ? s : null;
      this.highlights();
    }
    attempt(from, to) {
      if (this.interactive) this.onMove?.(from, to);
      this.selected = null;
      this.highlights();
    }
    flip() {
      this.cancelDrag();
      this.flipped = !this.flipped;
      this.squares();
      if (this.game) this.render(this.game, this.interactive);
    }
    hint(from) {
      this.selected = from;
      this.highlights();
    }
    shake() {
      this.board.classList.remove("shake");
      void this.board.offsetWidth;
      this.board.classList.add("shake");
      setTimeout(() => this.board.classList.remove("shake"), 350);
    }
  }
  globalThis.TempoStudyBoard = StudyBoard;
})();
