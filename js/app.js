(async () => {
  "use strict";
  if (!(await TempoProfile.ready)) return;
  const C = globalThis.TempoChess;
  const game = new C.Game();
  const $ = (id) => document.getElementById(id);
  const glyph = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const whiteGlyph = { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" };
  const colors = { w: "White", b: "Black" };
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const pieceNodes = new Map();
  let selected = null,
    selectedMoves = [],
    flipped = false,
    showHints = TempoProfile.progress().showHints !== false,
    sound = TempoProfile.progress().sound === true;
  let drag = null,
    suppressClickUntil = 0,
    focusedSquare = 52,
    pendingPromotion = null;
  let resultTimer = null,
    toastTimer = null,
    claimMode = false;
  let playMode = "local",
    humanColor = "w",
    botLevel = "medium",
    botThinking = false;
  let timeControl = 600,
    clocks = { w: 600, b: 600 },
    clockInterval = null,
    lastTick = null;
  let botWorker = null,
    botObjectURL = null,
    botTimer = null,
    botJob = 0;
  let puzzleActive = false,
    persistenceReady = false,
    navigationApproved = false,
    lastAutosave = 0;
  let gameId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    savedResult = "";
  const safeName = String(TempoProfile.user?.username || "You").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
  let openingId = null,
    setupPly = 0;
  let status = game.status();
  const board = $("board"),
    dialog = $("game-dialog");

  const icon = (id, cls = "icon") =>
    `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const visualIndex = (s) => (flipped ? 63 - s : s);
  const logicalIndex = (s) => (flipped ? 63 - s : s);
  const levelNames = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const playerTitle = (color) =>
    playMode === "bot"
      ? (color === humanColor ? safeName : "Tempo") + " · " + colors[color]
      : color === "w"
        ? safeName + " · White"
        : "Player 2 · Black";
  function canPlay() {
    return (
      !status.over &&
      !pendingPromotion &&
      (playMode === "local" ||
        (playMode === "bot" && !botThinking && game.state.turn === humanColor))
    );
  }

  function makeSquares() {
    $("square-layer").replaceChildren();
    for (let r = 0; r < 8; r++) {
      const row = document.createElement("div");
      row.className = "board-rank";
      row.setAttribute("role", "row");
      for (let c = 0; c < 8; c++) {
        const s = logicalIndex(r * 8 + c),
          button = document.createElement("button");
        button.type = "button";
        button.className = "square" + ((r + c) % 2 ? " dark" : "");
        button.dataset.square = s;
        button.setAttribute("role", "gridcell");
        button.tabIndex = s === focusedSquare ? 0 : -1;
        row.append(button);
      }
      $("square-layer").append(row);
    }
    $("rank-labels").innerHTML = Array.from(
      { length: 8 },
      (_, i) => `<span>${flipped ? i + 1 : 8 - i}</span>`,
    ).join("");
    $("file-labels").innerHTML = Array.from(
      { length: 8 },
      (_, i) => `<span>${"abcdefgh"[flipped ? 7 - i : i]}</span>`,
    ).join("");
  }

  function placePiece(el, s) {
    const v = visualIndex(s);
    el.style.setProperty("--x", `${(v % 8) * 100}%`);
    el.style.setProperty("--y", `${Math.floor(v / 8) * 100}%`);
    el.style.removeProperty("transform");
  }

  function renderPieces() {
    const live = new Set();
    game.state.board.forEach((piece, s) => {
      if (!piece) return;
      live.add(piece.id);
      let el = pieceNodes.get(piece.id);
      if (!el) {
        el = document.createElement("span");
        el.className = "piece " + (piece.color === "w" ? "white" : "black");
        el.dataset.piece = piece.id;
        el.textContent = glyph[piece.type];
        el.dataset.type = piece.type;
        pieceNodes.set(piece.id, el);
        $("piece-layer").append(el);
      }
      el.classList.remove("captured");
      if (el.dataset.type !== piece.type) {
        el.textContent = glyph[piece.type];
        el.dataset.type = piece.type;
        el.classList.add("promoting");
        setTimeout(() => el.classList.remove("promoting"), 380);
      }
      el.dataset.square = s;
      placePiece(el, s);
      el.classList.toggle("selected-piece", s === selected);
    });
    for (const [id, el] of pieceNodes) {
      if (live.has(id)) continue;
      el.classList.add("captured");
      setTimeout(() => {
        if (el.classList.contains("captured")) {
          el.remove();
          if (pieceNodes.get(id) === el) pieceNodes.delete(id);
        }
      }, 220);
    }
  }

  function renderHighlights() {
    const last = game.history.at(-1);
    const checkSquare = status.check
      ? game.state.board.findIndex(
          (p) => p?.type === "k" && p.color === game.state.turn,
        )
      : -1;
    for (const el of $("square-layer").querySelectorAll(".square")) {
      const s = Number(el.dataset.square),
        p = game.state.board[s],
        moves = selectedMoves.filter((m) => m.to === s);
      el.classList.toggle("selected", selected === s);
      el.classList.toggle(
        "last-move",
        !!last && (last.from === s || last.to === s),
      );
      el.classList.toggle("legal", showHints && moves.length > 0);
      el.classList.toggle(
        "capture",
        moves.length > 0 && (!!p || moves.some((m) => m.enPassant)),
      );
      el.classList.toggle("check", s === checkSquare);
      el.setAttribute("aria-selected", String(selected === s));
      el.setAttribute(
        "aria-label",
        `${C.name(s)}${p ? ", " + colors[p.color] + " " + C.TYPES[p.type] : ", empty"}${selected === s ? ", selected" : ""}${moves.length ? ", legal destination" : ""}${s === checkSquare ? ", in check" : ""}`,
      );
    }
    for (const el of pieceNodes.values())
      el.classList.toggle(
        "selected-piece",
        Number(el.dataset.square) === selected,
      );
  }

  function capturedBy(color) {
    return game.history
      .filter((m) => m.color === color && m.captured)
      .map((m) => m.captured)
      .sort((a, b) => values[a.type] - values[b.type]);
  }

  function renderPlayer(id, color) {
    const active = !status.over && game.state.turn === color;
    const captured = capturedBy(color);
    const advantage =
      captured.reduce((n, p) => n + values[p.type], 0) -
      capturedBy(C.other(color)).reduce((n, p) => n + values[p.type], 0);
    const pieces = game.state.board.filter((p) => p?.color === color).length;
    $(id).innerHTML =
      `<div class="player-avatar is-${color === "w" ? "white" : "black"}" aria-hidden="true">${whiteGlyph.k}</div><div><div class="player-name">${playerTitle(color)}</div><div class="player-description">${playMode === "bot" && color !== humanColor ? levelNames[botLevel] + " computer" : pieces + " pieces on the board"}</div></div><div class="player-captures" aria-label="Captured: ${captured.length ? captured.map((p) => C.TYPES[p.type]).join(", ") : "none"}">${captured.map((p) => glyph[p.type]).join("")}${advantage > 0 ? `<span class="material-advantage">+${advantage}</span>` : ""}</div>${timeControl ? `<div class="player-clock" id="clock-${color}">${formatClock(clocks[color])}</div>` : active ? '<span class="player-badge">TO MOVE</span>' : status.over ? `<span class="player-inactive">${status.winner === color ? "Winner" : status.winner ? "Good game" : "Draw"}</span>` : '<span class="player-inactive">Ready</span>'}`;
  }

  function renderHistory() {
    const list = $("move-list");
    list.replaceChildren();
    $("history-empty").hidden = game.history.length > 0;
    const rows = new Map();
    game.history.forEach((m, i) => {
      let row = rows.get(m.number);
      if (!row) {
        row = document.createElement("li");
        row.className = "move-row";
        row.setAttribute("aria-label", `Move ${m.number}`);
        row.innerHTML = `<span class="move-number">${m.number}.</span><span class="move-notation white-move"></span><span class="move-notation black-move"></span>`;
        list.append(row);
        rows.set(m.number, row);
      }
      const span = row.querySelector(
        m.color === "w" ? ".white-move" : ".black-move",
      );
      span.textContent = m.san;
      span.setAttribute("aria-label", `${colors[m.color]}: ${m.san}`);
      if (i === game.history.length - 1) span.classList.add("latest");
    });
    const count = game.history.length;
    $("move-count").textContent = `${count} ${count === 1 ? "move" : "moves"}`;
    $("history-scroll").scrollTop = $("history-scroll").scrollHeight;
  }

  function render() {
    status = game.status();
    if (persistenceReady && status.over) {
      const key = JSON.stringify(status);
      if (key !== savedResult) {
        savedResult = key;
        TempoProfile.recordGame(gameId, {
          mode: playMode,
          winner: status.winner,
          reason: status.reason,
          moves: TempoGameData.moves(game),
          openingId,
          time: timeControl,
          humanColor,
          level: botLevel,
        });
        clearSaved();
      }
    } else savedResult = "";
    renderPieces();
    renderHighlights();
    renderHistory();
    renderPlayer("top-player", flipped ? "w" : "b");
    renderPlayer("bottom-player", flipped ? "b" : "w");
    $("turn-counter").textContent =
      "TURN " + String(game.state.fullmove).padStart(2, "0");
    $("turn-symbol").textContent = status.over
      ? status.winner
        ? glyph.k
        : "½"
      : game.state.turn === "w"
        ? whiteGlyph.k
        : glyph.k;
    $("game-status").textContent = status.over
      ? status.winner
        ? `${colors[status.winner]} wins`
        : "A drawn game"
      : claimMode
        ? "Choose your move"
        : `${colors[game.state.turn]} to move`;
    $("game-detail").textContent = status.over
      ? status.reason
      : claimMode
        ? "Select the move for your draw claim."
        : status.check
          ? "Your king is in check."
          : status.claim
            ? `${status.claim}. A draw can be claimed.`
            : game.history.length
              ? "The next move is yours."
              : "Every game starts with a possibility.";
    $("live-dot").classList.toggle("ended", status.over);
    $("undo-button").disabled = game.history.length === 0 && !game.result;
    $("resign-button").disabled = status.over;
    $("draw-button").disabled = status.over;
    $("draw-button").innerHTML =
      icon("draw") + (status.claim ? "Claim draw" : "Agree draw");
    renderMode();
    renderClocks();
    saveGame();
  }

  function renderMode() {
    $("mode-label").textContent =
      playMode === "bot" ? "Play with bot" : "Local two-player";
    $("mode-button")
      .querySelector("use")
      .setAttribute("href", "#i-" + (playMode === "bot" ? "bot" : "people"));
    $("play-kicker").textContent =
      playMode === "bot" ? "VS COMPUTER" : "IN PLAY";
    $("live-dot").classList.toggle("thinking", botThinking);
    $("new-game-button").innerHTML = "New game" + icon("arrow");
    $("new-game-button").disabled = false;
    if (playMode === "bot") {
      $("undo-button").disabled =
        game.history.length <= setupPly ||
        (!game.history.slice(setupPly).some((m) => m.color === humanColor) &&
          !game.result);
      $("draw-button").innerHTML =
        icon("draw") + (status.claim ? "Claim draw" : "Offer draw");
      $("draw-button").disabled = status.over || botThinking;
      if (botThinking) {
        $("game-status").textContent = "Tempo is thinking";
        $("game-detail").textContent =
          levelNames[botLevel] + " · Finding the next move…";
      } else if (!status.over && !claimMode) {
        $("game-detail").textContent = status.check
          ? "Your king is in check."
          : status.claim
            ? `${status.claim}. You can claim a draw.`
            : "Your move. Take your time.";
      }
    }
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2800);
  }

  function playSound(capture = false, ending = false) {
    if (sound) TempoSound.play({ capture, ending });
  }

  function clearSelection() {
    selected = null;
    selectedMoves = [];
  }

  function clearSaved() {
    if (TempoProfile.progress().activeGame?.id === gameId)
      TempoProfile.update((p) => ({ ...p, activeGame: null }));
  }
  function saveGame() {
    if (!persistenceReady || status.over) return true;
    if (!game.history.length) {
      clearSaved();
      return true;
    }
    const activeGame = {
      version: 1,
      id: gameId,
      mode: playMode,
      humanColor,
      level: botLevel,
      time: timeControl,
      clocks: { ...clocks },
      moves: TempoGameData.moves(game),
      openingId,
      flipped,
      savedAt: Date.now(),
    };
    const saved = TempoProfile.update((p) => ({ ...p, activeGame }));
    const note = $("game-save-status");
    if (note)
      note.textContent = saved
        ? "Saved on this browser · Clocks pause while you are away."
        : "Could not save. Keep this page open; browser storage may be full or blocked.";
    return saved;
  }
  function restoreSaved(saved) {
    const restored = TempoGameData.restore(saved.moves);
    Object.assign(game, restored);
    openingId = saved.openingId || null;
    setupPly = openingId
      ? TempoOpenings.find((o) => o.id === openingId)?.moves.length || 0
      : 0;
    gameId = saved.id;
    playMode = saved.mode;
    humanColor = saved.humanColor;
    botLevel = saved.level;
    timeControl = saved.time;
    clocks = { ...saved.clocks };
    flipped = saved.flipped;
    $("caption-right").textContent = `${formatClock(timeControl)} per side`;
    status = game.status();
  }
  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  function stopClockTicking() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
    lastTick = null;
  }
  function startClockTicking() {
    if (
      clockInterval ||
      !timeControl ||
      status.over ||
      document.hidden ||
      puzzleActive ||
      dialog.open
    )
      return;
    lastTick = performance.now();
    clockInterval = setInterval(tickClock, 100);
  }
  function tickClock() {
    if (!clockInterval) return;
    if (!timeControl || status.over) {
      stopClockTicking();
      return;
    }
    const now = performance.now();
    if (lastTick == null) {
      lastTick = now;
      return;
    }
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const turn = game.state.turn;
    clocks[turn] = Math.max(0, clocks[turn] - dt);
    if (clocks[turn] <= 0) {
      clocks[turn] = 0;
      handleFlagFall(turn);
    }
    renderClocks();
    if (now - lastAutosave >= 1000) {
      lastAutosave = now;
      saveGame();
    }
  }
  function handleFlagFall(color) {
    stopClockTicking();
    cancelBot();
    game.result = { over: true, winner: C.other(color), reason: "Time out" };
    clearSelection();
    render();
    playSound(false, true);
    resultTimer = setTimeout(showResult, 300);
  }
  function setupClocks(time) {
    stopClockTicking();
    timeControl = [60, 180, 300, 600, 1800].includes(Number(time))
      ? Number(time)
      : 600;
    clocks = { w: timeControl, b: timeControl };
    $("caption-right").textContent = `${formatClock(timeControl)} per side`;
    status = game.status();
    if (timeControl) startClockTicking();
  }
  function renderClocks() {
    const wEl = $("clock-w"),
      bEl = $("clock-b");
    if (wEl) {
      wEl.textContent = formatClock(clocks.w);
      wEl.classList.toggle("low-time", clocks.w < 30);
      wEl.classList.toggle(
        "active-clock",
        game.state.turn === "w" && !status.over,
      );
    }
    if (bEl) {
      bEl.textContent = formatClock(clocks.b);
      bEl.classList.toggle("low-time", clocks.b < 30);
      bEl.classList.toggle(
        "active-clock",
        game.state.turn === "b" && !status.over,
      );
    }
  }
  window.addEventListener("tempo-view-change", (event) => {
    puzzleActive = event.detail.view === "puzzles";
    if (puzzleActive) {
      tickClock();
      stopClockTicking();
      cancelBot();
      clearTimeout(resultTimer);
    } else {
      startClockTicking();
      if (!puzzleActive) maybeBot();
    }
  });

  function select(s) {
    selected = s;
    selectedMoves = claimMode
      ? game.claimableMoves().filter((m) => m.from === s)
      : game.moves(s);
    renderHighlights();
  }

  function makeMove(from, to, promotion) {
    if (!canPlay()) return false;
    tickClock();
    if (game.status().over) return false;
    clearTimeout(resultTimer);
    if (claimMode) {
      const options = game
        .claimableMoves()
        .filter((m) => m.from === from && m.to === to);
      if (!options.length) {
        toast("That move does not make a draw claim possible.");
        return false;
      }
      if (options.some((m) => m.promotion) && !promotion) {
        showPromotion(from, to);
        return true;
      }
      const move = options.find((m) => m.promotion === promotion);
      if (!move || !game.claimDraw(move)) return false;
      claimMode = false;
      clearSelection();
      render();
      showResult();
      return true;
    }
    const entry = game.move(from, to, promotion);
    if (!entry) return false;
    if (entry.needsPromotion) {
      showPromotion(from, to);
      return true;
    }
    pendingPromotion = null;
    clearSelection();
    render();
    playSound(!!entry.captured, status.over);
    if (status.over) resultTimer = setTimeout(showResult, 550);
    else maybeBot();
    return true;
  }

  function onSquareClick(s) {
    if (status.over) {
      toast("Start a new game, or undo to keep exploring.");
      return;
    }
    if (pendingPromotion) return;
    if (!canPlay()) {
      toast("Let Tempo finish its move.");
      return;
    }
    if (selected !== null && selectedMoves.some((m) => m.to === s)) {
      makeMove(selected, s);
      return;
    }
    const p = game.state.board[s];
    if (p?.color === game.state.turn) {
      if (s === selected) {
        clearSelection();
        renderHighlights();
      } else select(s);
    } else {
      clearSelection();
      renderHighlights();
    }
  }

  board.addEventListener("click", (event) => {
    if (performance.now() < suppressClickUntil) return;
    const square = event.target.closest("[data-square]");
    if (!square) return;
    onSquareClick(Number(square.dataset.square));
  });

  function squareAt(x, y) {
    const rect = board.getBoundingClientRect();
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom)
      return null;
    return logicalIndex(
      Math.floor(((y - rect.top) / rect.height) * 8) * 8 +
        Math.floor(((x - rect.left) / rect.width) * 8),
    );
  }

  function clearDropTarget() {
    for (const el of board.querySelectorAll(".drop-target"))
      el.classList.remove("drop-target");
  }

  function cancelDrag() {
    if (!drag) return;
    if (drag.el) {
      drag.el.classList.remove("dragging");
      placePiece(drag.el, drag.from);
    }
    const id = drag.id;
    drag = null;
    clearDropTarget();
    if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
  }

  board.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || !canPlay()) return;
    const target = event.target.closest("[data-square]");
    if (!target) return;
    const from = Number(target.dataset.square),
      p = game.state.board[from];
    if (p?.color !== game.state.turn) return;
    drag = {
      from,
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      el: pieceNodes.get(p.id),
      active: false,
    };
  });

  board.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.active && Math.hypot(dx, dy) < 5) return;
    if (!drag.active) {
      drag.active = true;
      select(drag.from);
      board.setPointerCapture(event.pointerId);
      drag.el.classList.add("dragging");
    }
    event.preventDefault();
    const v = visualIndex(drag.from);
    drag.el.style.transform = `translate(calc(${(v % 8) * 100}% + ${dx}px), calc(${Math.floor(v / 8) * 100}% + ${dy}px)) scale(1.07)`;
    clearDropTarget();
    const to = squareAt(event.clientX, event.clientY);
    if (selectedMoves.some((m) => m.to === to))
      board
        .querySelector(`[data-square="${to}"]`)
        ?.classList.add("drop-target");
  });

  board.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const { from, active } = drag,
      to = squareAt(event.clientX, event.clientY);
    cancelDrag();
    if (active) {
      suppressClickUntil = performance.now() + 350;
      event.preventDefault();
      if (to !== null && to !== from) {
        if (!makeMove(from, to)) {
          renderHighlights();
          toast("That piece can’t move there.");
        }
      }
    }
  });
  board.addEventListener("pointercancel", cancelDrag);
  board.addEventListener("lostpointercapture", cancelDrag);
  window.addEventListener("blur", cancelDrag);
  window.addEventListener("resize", cancelDrag);

  board.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-square]");
    if (!target) return;
    const s = Number(target.dataset.square),
      v = visualIndex(s),
      r = Math.floor(v / 8),
      c = v % 8;
    const delta = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[event.key];
    if (delta) {
      event.preventDefault();
      const nr = r + delta[0],
        nc = c + delta[1];
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;
      focusedSquare = logicalIndex(nr * 8 + nc);
      target.tabIndex = -1;
      const next = board.querySelector(`[data-square="${focusedSquare}"]`);
      next.tabIndex = 0;
      next.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      claimMode = false;
      clearSelection();
      render();
    }
    // Enter and Space use the native button click behavior.
  });

  function openDialog(html) {
    if (dialog.open) dialog.close();
    tickClock();
    stopClockTicking();
    if (botThinking) cancelBot();
    $("dialog-content").innerHTML = html;
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }
  $("dialog-close").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeDialog();
  });
  dialog.addEventListener("close", () => {
    pendingPromotion = null;
    if (timeControl && !status.over) startClockTicking();
    if (!puzzleActive) maybeBot();
  });

  function showPromotion(from, to) {
    pendingPromotion = { from, to };
    openDialog(
      `<div class="dialog-eyebrow">A WELL-EARNED UPGRADE</div><h2 id="dialog-title">Choose your piece.</h2><p>Your pawn has reached the other side. What will it become?</p><div class="promotion-options">${["q", "r", "b", "n"].map((type) => `<button class="promotion-option" data-promote="${type}"><span class="promotion-icon" aria-hidden="true">${game.state.turn === "w" ? whiteGlyph[type] : glyph[type]}</span><span class="promotion-label">${C.TYPES[type][0].toUpperCase() + C.TYPES[type].slice(1)}</span></button>`).join("")}</div>`,
    );
    for (const button of dialog.querySelectorAll("[data-promote]"))
      button.addEventListener("click", () => {
        const type = button.dataset.promote;
        closeDialog();
        pendingPromotion = null;
        makeMove(from, to, type);
      });
    dialog.querySelector('[data-promote="q"]').focus();
  }

  function newGame() {
    cancelBot();
    clearSaved();
    openingId = null;
    setupPly = 0;
    gameId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    savedResult = "";
    clearTimeout(resultTimer);
    cancelDrag();
    game.reset();
    clearSelection();
    pendingPromotion = null;
    claimMode = false;
    closeDialog();
    setupClocks(timeControl);
    render();
    toast("A fresh board. White moves first.");
    maybeBot();
  }

  function confirmNewGame() {
    if (!game.history.length || status.over) {
      newGame();
      return;
    }
    openDialog(
      '<div class="dialog-eyebrow">BACK TO SQUARE ONE</div><h2 id="dialog-title">Start a fresh game?</h2><p>Your current game and move history will be cleared.</p><div class="dialog-actions"><button class="dialog-secondary" id="keep-playing">Keep playing</button><button class="dialog-primary" id="confirm-new">New game</button></div>',
    );
    $("keep-playing").addEventListener("click", closeDialog);
    $("confirm-new").addEventListener("click", newGame);
  }

  function showResult() {
    if (!game.status().over) return;
    const title = status.winner
      ? `${colors[status.winner]} takes the game.`
      : "An evenly matched ending.";
    openDialog(
      `<div class="result-icon" aria-hidden="true">${status.winner ? whiteGlyph.k : "½"}</div><div class="dialog-eyebrow">${status.reason.toUpperCase()}</div><h2 id="dialog-title">${title}</h2><p>${status.winner ? "Well played. There’s always another move in the next game." : "The game ends in a draw. A fresh board is a fresh possibility."}</p><div class="dialog-actions"><button class="dialog-secondary" id="review-board">View board</button><button class="dialog-primary" id="play-again">Play again</button></div>`,
    );
    $("review-board").addEventListener("click", closeDialog);
    $("play-again").addEventListener("click", newGame);
  }

  function showRules() {
    openDialog(
      '<div class="dialog-eyebrow">THE ESSENTIALS</div><h2 id="dialog-title">A minute to settle in.</h2><p>Choose Local or Computer from the mode menu. White always moves first.</p><ul class="rules-list"><li><strong>Pick a piece.</strong> Click or tap to see its legal destinations, then choose one. You can also drag and drop.</li><li><strong>Protect your king.</strong> Check means your king is under attack. Checkmate ends the game.</li><li><strong>The special moves are here.</strong> Castle by moving your king two squares. En passant works immediately after a double pawn move. Promotion lets you pick a queen, rook, bishop, or knight.</li><li><strong>Play at your pace.</strong> Undo takes back one local move, or your turn and the bot’s reply. Flip changes your view.</li><li><strong>Draws.</strong> Stalemate and insufficient material end the game. Claim threefold repetition or the 50-move rule from the draw control. Fivefold repetition and 75 moves are automatic draws.</li><li><strong>Make it yours.</strong> The moon or sun button switches themes and remembers your choice. The computer has three difficulty levels and can play either color.</li><li><strong>Keyboard friendly.</strong> Tab to the board, use arrow keys to explore, Enter or Space to select, and Escape to clear selection.</li></ul><div class="dialog-actions"><button class="dialog-primary" id="rules-done">Back to the board</button></div>',
    );
    $("rules-done").addEventListener("click", closeDialog);
  }

  $("new-game-button").addEventListener("click", confirmNewGame);
  $("undo-button").addEventListener("click", () => {
    if (game.history.length <= setupPly) {
      toast("The opening setup stays on the board.");
      return;
    }
    cancelBot();
    clearTimeout(resultTimer);
    cancelDrag();
    claimMode = false;
    clearSelection();
    pendingPromotion = null;
    if (playMode === "bot") {
      game.result = null;
      if (game.history.length > setupPly)
        do {
          game.undo();
        } while (
          game.history.length > setupPly &&
          game.state.turn !== humanColor
        );
      render();
      playSound();
      toast("Your turn again. Try another move.");
      maybeBot();
      return;
    }
    if (game.undo()) {
      render();
      playSound();
      toast("Taken back. Try another move.");
    }
  });
  $("flip-button").addEventListener("click", () => {
    cancelDrag();
    flipped = !flipped;
    makeSquares();
    render();
    $("flip-button").setAttribute(
      "aria-label",
      `Flip board. ${flipped ? "Black" : "White"} is at the bottom.`,
    );
  });
  $("hints-toggle").addEventListener("change", (event) => {
    showHints = event.target.checked;
    TempoProfile.update((p) => ({ ...p, showHints }));
    renderHighlights();
  });
  function renderSound() {
    for (const button of document.querySelectorAll("[data-sound-toggle]")) {
      button.textContent = sound ? "On" : "Off";
      button.setAttribute("aria-pressed", String(sound));
    }
  }
  document.querySelectorAll("[data-sound-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      sound = !sound;
      TempoProfile.update((p) => ({ ...p, sound }));
      renderSound();
      playSound();
    }),
  );
  $("help-button").addEventListener("click", showRules);
  $("rules-button").addEventListener("click", showRules);
  $("resign-button").addEventListener("click", () => {
    if (status.over) return;
    const resignColor = playMode === "local" ? game.state.turn : humanColor;
    openDialog(
      `<div class="dialog-eyebrow">CALL IT A GAME</div><h2 id="dialog-title">Resign as ${colors[resignColor]}?</h2><p>${colors[C.other(resignColor)]} will win this game.</p><div class="dialog-actions"><button class="dialog-secondary" id="cancel-resign">Keep playing</button><button class="dialog-primary" id="confirm-resign">Resign</button></div>`,
    );
    $("cancel-resign").addEventListener("click", closeDialog);
    $("confirm-resign").addEventListener("click", () => {
      closeDialog();
      if (game.status().over) {
        showResult();
        return;
      }
      cancelBot();
      game.result = {
        over: true,
        winner: C.other(resignColor),
        reason: "Resignation",
      };
      clearSelection();
      render();
      playSound(false, true);
      showResult();
    });
  });
  $("draw-button").addEventListener("click", () => {
    if (status.over) return;
    const ourTurn = playMode === "local" || game.state.turn === humanColor;
    const claim = ourTurn && game.claimable(),
      intended = ourTurn && !claim && game.claimableMoves().length > 0;
    openDialog(
      `<div class="dialog-eyebrow">SHARE THE POINT</div><h2 id="dialog-title">${claim ? "Claim a draw?" : "Agree to a draw?"}</h2><p>${claim ? `${claim} applies to this position. You can end the game as a draw.` : "If both players agree, this game will end in a draw."}</p>${intended ? "<p>You can also claim a draw by declaring your next move.</p>" : ""}<div class="dialog-actions"><button class="dialog-secondary" id="cancel-draw">Keep playing</button><button class="dialog-primary" id="confirm-draw">${claim ? "Claim draw" : "We both agree"}</button></div>${intended ? '<button class="intended-draw-button" id="intended-draw">Declare a move and claim draw</button>' : ""}`,
    );
    $("cancel-draw").addEventListener("click", closeDialog);
    if (playMode !== "local") {
      if (!claim) {
        $("dialog-title").textContent = "Offer a draw?";
        dialog.querySelector("p").textContent =
          "Tempo will consider a draw in an equal position after move 15.";
      }
      $("confirm-draw").textContent = claim ? "Claim draw" : "Offer draw";
    }
    $("confirm-draw").addEventListener("click", () => {
      closeDialog();

      if (
        playMode === "bot" &&
        !claim &&
        (game.history.length < 30 ||
          Math.abs(TempoBot.evaluate(game.state)) > 80)
      ) {
        toast("Tempo declines the draw. Let’s keep playing.");
        return;
      }
      cancelBot();
      if (claim) game.claimDraw();
      else game.agreeDraw();
      claimMode = false;
      clearSelection();
      render();
      showResult();
    });
    $("intended-draw")?.addEventListener("click", () => {
      closeDialog();
      claimMode = true;
      clearSelection();
      render();
      toast("Choose the move that creates the draw. Escape cancels.");
    });
  });

  function destroyBotWorker() {
    botWorker?.terminate();
    botWorker = null;
    if (botObjectURL) {
      URL.revokeObjectURL(botObjectURL);
      botObjectURL = null;
    }
  }
  function cancelBot() {
    botJob++;
    clearTimeout(botTimer);
    destroyBotWorker();
    botThinking = false;
  }

  function maybeBot() {
    if (puzzleActive || dialog.open || document.hidden) return;
    if (
      playMode !== "bot" ||
      game.state.turn === humanColor ||
      game.status().over ||
      botThinking
    )
      return;
    if (game.claimable()) {
      game.claimDraw();
      render();
      resultTimer = setTimeout(showResult, 400);
      return;
    }
    botThinking = true;
    clearSelection();
    render();
    const id = ++botJob,
      position = C.positionKey(game.state);
    const state = game.state,
      options = { level: botLevel, keys: game.keys.slice(0, -1) };
    const valid = () =>
      id === botJob &&
      playMode === "bot" &&
      C.positionKey(game.state) === position &&
      !game.status().over;
    const finish = (result) => {
      if (!valid()) return;
      destroyBotWorker();
      botThinking = false;
      tickClock();
      if (game.status().over) return;
      const move = result.move || game.moves()[0];
      if (move) {
        const entry = game.move(move.from, move.to, move.promotion);
        render();
        if (entry && !entry.needsPromotion)
          playSound(!!entry.captured, status.over);
      } else render();
      if (status.over) resultTimer = setTimeout(showResult, 500);
    };
    const fallback = () => {
      if (!valid()) return;
      destroyBotWorker();
      botTimer = setTimeout(() => {
        if (!valid()) return;
        try {
          finish(TempoBot.search(state, { ...options, time: 220 }));
        } catch {
          finish({ move: game.moves()[0] });
        }
      }, 30);
    };
    botTimer = setTimeout(() => {
      if (!valid()) return;
      if (!window.Worker) {
        fallback();
        return;
      }
      try {
        if (location.protocol === "file:") {
          const handler =
            "self.onmessage=event=>{const {id,state,options}=event.data;try{self.postMessage({id,...TempoBot.search(state,options)});}catch{self.postMessage({id,error:'Search failed'});}};";
          botObjectURL = URL.createObjectURL(
            new Blob([C.workerSource, TempoBot.workerSource, handler], {
              type: "text/javascript",
            }),
          );
          botWorker = new Worker(botObjectURL);
        } else botWorker = new Worker("js/core/bot-worker.js");
        botWorker.onmessage = (event) => {
          if (event.data.id !== id) return;
          if (event.data.error) fallback();
          else finish(event.data);
        };
        botWorker.onerror = (event) => {
          event.preventDefault();
          fallback();
        };
        botWorker.postMessage({ id, state, options });
      } catch {
        fallback();
      }
    }, 180);
  }

  function switchMode(mode, options = {}) {
    cancelBot();
    clearSaved();
    clearTimeout(resultTimer);
    cancelDrag();
    stopClockTicking();
    openingId = null;
    setupPly = 0;
    playMode = mode === "bot" ? "bot" : "local";
    humanColor = options.color === "b" ? "b" : "w";
    botLevel = options.level || "medium";
    flipped = playMode === "bot" && humanColor === "b";
    gameId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    savedResult = "";
    game.reset();
    clearSelection();
    pendingPromotion = null;
    claimMode = false;
    makeSquares();
    closeDialog();
    setupClocks(Number(options.time) || 600);
    render();
    maybeBot();
  }

  function showModeDialog() {
    const current = playMode;
    openDialog(
      `<div class="dialog-eyebrow">FIND YOUR OPPONENT</div><h2 id="dialog-title">Your kind of game.</h2><div class="mode-tabs" aria-label="Game mode"><button class="mode-tab" data-mode="local" aria-pressed="${current === "local"}">${icon("people")}Local</button><button class="mode-tab" data-mode="bot" aria-pressed="${current === "bot"}">${icon("bot")}Computer</button></div><div id="mode-options"></div>`,
    );
    function options(mode) {
      for (const tab of dialog.querySelectorAll("[data-mode]"))
        tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
      const panel = $("mode-options");
      const timeOptions =
        '<option value="60">1 minute</option><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option><option value="1800">30 minutes</option>';
      panel.innerHTML =
        mode === "bot"
          ? `<p class="mode-explainer">An opponent on your device, ready when you are.</p><div class="setup-fields"><div><label class="field-label" for="bot-level">Difficulty</label><select class="setup-select" id="bot-level"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div><div><label class="field-label" for="bot-color">Your pieces</label><select class="setup-select" id="bot-color"><option value="w">White · Move first</option><option value="b">Black · Move second</option></select></div><div><label class="field-label" for="time-control">Time control</label><select class="setup-select" id="time-control">${timeOptions}</select></div></div><button class="dialog-primary start-mode" id="start-selected">Play with Tempo</button>`
          : `<p class="mode-explainer">Two players on this device. White moves first, then take turns.</p><div class="setup-fields"><div><label class="field-label" for="time-control">Time control</label><select class="setup-select" id="time-control">${timeOptions}</select></div></div><button class="dialog-primary start-mode" id="start-selected">Start local game</button>`;
      if (mode === "bot") {
        $("bot-level").value = botLevel;
        $("bot-color").value = humanColor;
      }
      $("time-control").value = String(timeControl);
      TempoSelect.enhance(panel);
      $("start-selected").addEventListener("click", () =>
        switchMode(mode, {
          color: $("bot-color")?.value,
          level: $("bot-level")?.value,
          time: $("time-control")?.value,
        }),
      );
    }
    for (const tab of dialog.querySelectorAll("[data-mode]"))
      tab.addEventListener("click", () => options(tab.dataset.mode));
    options(current);
  }

  $("mode-button").addEventListener("click", () => {
    if (game.history.length && !status.over) {
      openDialog(
        `<div class="dialog-eyebrow">CHANGE OF PACE</div><h2 id="dialog-title">Change game mode?</h2><p>Starting another mode clears the current game.</p><div class="dialog-actions"><button class="dialog-secondary" id="stay-mode">Keep playing</button><button class="dialog-primary" id="change-mode">Choose mode</button></div>`,
      );
      $("stay-mode").addEventListener("click", closeDialog);
      $("change-mode").addEventListener("click", showModeDialog);
    } else showModeDialog();
  });
  function renderTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    $("theme-button").innerHTML = icon(dark ? "sun" : "moon");
    $("theme-button").title = dark
      ? "Switch to light mode"
      : "Switch to dark mode";
    $("theme-button").setAttribute("aria-label", $("theme-button").title);
    $("theme-button").setAttribute("aria-pressed", String(dark));
  }
  $("theme-button").addEventListener("click", () => TempoTheme.toggle());
  window.addEventListener("tempo-theme-change", renderTheme);
  window.addEventListener("tempo-progress-change", () => {
    sound = TempoProfile.progress().sound === true;
    renderSound();
  });
  $("hints-toggle").checked = showHints;
  renderSound();
  const params = new URLSearchParams(location.search),
    requested = params.get("mode");
  puzzleActive = params.get("view") === "puzzles";
  let saved = null;
  try {
    const candidate = TempoProfile.progress().activeGame;
    if (candidate) saved = TempoGameData.session(candidate);
  } catch {
    toast(
      "This saved game could not be restored. Your other progress is safe.",
    );
  }
  if (saved) restoreSaved(saved);
  else {
    playMode = requested === "bot" ? "bot" : "local";
    setupClocks(params.get("time") || TempoProfile.progress().time || 600);
  }
  persistenceReady = true;
  makeSquares();
  render();
  renderTheme();
  const requestedOpening = TempoOpenings.find(
    (o) => o.id === params.get("opening"),
  );
  function startOpening() {
    cancelBot();
    clearTimeout(resultTimer);
    stopClockTicking();
    clearSaved();
    const lesson = requestedOpening;
    Object.assign(game, TempoGameData.restore(lesson.moves));
    openingId = lesson.id;
    setupPly = lesson.moves.length;
    playMode = "bot";
    humanColor = params.get("color") === "b" ? "b" : "w";
    botLevel = ["easy", "medium", "hard"].includes(params.get("level"))
      ? params.get("level")
      : "medium";
    flipped = humanColor === "b";
    gameId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    savedResult = "";
    clearSelection();
    pendingPromotion = null;
    claimMode = false;
    status = game.status();
    closeDialog();
    setupClocks(params.get("time") || 600);
    makeSquares();
    render();
    saveGame();
    toast(
      "Continue the " + lesson.name + ". Opening moves are kept in the replay.",
    );
    maybeBot();
  }
  if (requestedOpening && !puzzleActive) {
    openDialog(
      '<div class="dialog-eyebrow">FROM THEORY TO PLAY</div><h2 id="dialog-title">Continue this opening?</h2><p id="opening-start-detail"></p><div class="dialog-actions"><button class="dialog-secondary" id="opening-start-cancel">' +
        (saved ? "Keep saved game" : "Cancel") +
        '</button><button class="dialog-primary" id="opening-start-confirm">' +
        (saved ? "Replace & play opening" : "Play opening") +
        "</button></div>",
    );
    $("opening-start-detail").textContent =
      (saved ? "This replaces your unfinished match. " : "") +
      "Start after the complete " +
      requestedOpening.name +
      " lesson, with fresh clocks. Your selected side and difficulty will be used.";
    $("opening-start-cancel").addEventListener("click", closeDialog);
    $("opening-start-confirm").addEventListener("click", startOpening);
  } else if (saved && !puzzleActive) {
    openDialog(
      '<div class="dialog-eyebrow">RIGHT WHERE YOU LEFT OFF</div><h2 id="dialog-title">Your board is waiting.</h2><p>Your moves, opponent settings and remaining time are saved. The clock starts when you continue.</p><div class="dialog-actions"><button class="dialog-secondary" id="saved-new">Start a new game</button><button class="dialog-primary" id="saved-continue">Continue saved game</button></div>',
    );
    $("saved-continue").addEventListener("click", closeDialog);
    $("saved-new").addEventListener("click", () => {
      openDialog(
        '<div class="dialog-eyebrow">A FRESH START</div><h2 id="dialog-title">Replace the saved game?</h2><p>This clears the unfinished match. Your completed results and learning progress stay safe.</p><div class="dialog-actions"><button class="dialog-secondary" id="saved-keep">Keep playing</button><button class="dialog-primary" id="saved-replace">Replace game</button></div>',
      );
      $("saved-keep").addEventListener("click", closeDialog);
      $("saved-replace").addEventListener("click", () => {
        switchMode(requested === "bot" ? "bot" : "local", {
          time: params.get("time") || timeControl,
        });
        showModeDialog();
      });
    });
  } else if (!saved && requested === "bot" && !puzzleActive) showModeDialog();
  else if (!puzzleActive) {
    startClockTicking();
    maybeBot();
  }
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      if (
        link &&
        (link.dataset.nav === "play" ||
          link.dataset.nav === "puzzles" ||
          link.target === "_blank" ||
          event.ctrlKey ||
          event.metaKey)
      )
        return;
      if (!game.history.length || status.over) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const destination = link.href;
      openDialog(
        '<div class="dialog-eyebrow">A LITTLE PAUSE</div><h2 id="dialog-title">Leave the board?</h2><p id="leave-detail">Your current game will be saved here, with the clocks paused.</p><div class="dialog-actions"><button class="dialog-secondary" id="leave-stay">Keep playing</button><button class="dialog-primary" id="leave-confirm">Save & leave</button></div>',
      );
      $("leave-stay").addEventListener("click", closeDialog);
      $("leave-confirm").addEventListener("click", () => {
        if (!saveGame()) {
          $("leave-detail").textContent =
            "Saving failed. Free some browser storage and try again. Closing this page may lose the latest moves.";
          return;
        }
        navigationApproved = true;
        location.href = destination;
      });
    },
    true,
  );
  window.addEventListener("beforeunload", (event) => {
    tickClock();
    saveGame();
    if (!navigationApproved && game.history.length && !status.over) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      tickClock();
      saveGame();
      stopClockTicking();
      cancelBot();
    } else if (!puzzleActive && !dialog.open) {
      startClockTicking();
      maybeBot();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
  window.addEventListener("pagehide", () => {
    tickClock();
    saveGame();
    stopClockTicking();
    cancelBot();
  });
})();
