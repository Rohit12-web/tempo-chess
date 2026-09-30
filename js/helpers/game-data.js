/* Portable move lists rebuild legal state, including castling, en passant and repetition. */
(() => {
  "use strict";
  const C = TempoChess,
    times = [60, 180, 300, 600, 1800];
  const id = (value) =>
    typeof value === "string" && value.length > 0 && value.length <= 100;
  const text = (value, max = 100) =>
    typeof value === "string" ? value.slice(0, max) : "";
  function moves(game) {
    return game.history.map(
      (m) => C.name(m.from) + C.name(m.to) + (m.promotion || ""),
    );
  }
  function fen(state) {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let row = "",
        empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = state.board[r * 8 + c];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += p.color === "w" ? p.type.toUpperCase() : p.type;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    const rights =
      (state.castle.w.k ? "K" : "") +
      (state.castle.w.q ? "Q" : "") +
      (state.castle.b.k ? "k" : "") +
      (state.castle.b.q ? "q" : "");
    return `${rows.join("/")} ${state.turn} ${rights || "-"} ${state.ep < 0 ? "-" : C.name(state.ep)} ${state.halfmove} ${state.fullmove}`;
  }
  function position(value) {
    if (typeof value !== "string" || value.length > 120)
      throw Error("Invalid board position.");
    const parts = value.trim().split(/\s+/),
      rows = parts[0].split("/");
    if (
      parts.length !== 6 ||
      rows.length !== 8 ||
      !rows.every(
        (r) =>
          /^[prnbqkPRNBQK1-8]+$/.test(r) &&
          [...r].reduce((n, c) => n + (/[1-8]/.test(c) ? Number(c) : 1), 0) ===
            8,
      ) ||
      !["w", "b"].includes(parts[1]) ||
      !/^(-|K?Q?k?q?)$/.test(parts[2]) ||
      !/^(-|[a-h][36])$/.test(parts[3]) ||
      !/^\d+$/.test(parts[4]) ||
      !/^\d+$/.test(parts[5]) ||
      Number(parts[4]) > 10000 ||
      Number(parts[5]) < 1 ||
      Number(parts[5]) > 10000
    )
      throw Error("Invalid board position.");
    const g = new C.Game();
    g.load(value);
    if (
      g.state.board
        .slice(0, 8)
        .concat(g.state.board.slice(56))
        .some((p) => p?.type === "p") ||
      C.inCheck({ ...g.state, turn: C.other(g.state.turn) })
    )
      throw Error("This is not a legal board position.");
    for (const [right, king, rook, color] of [
      ["K", "e1", "h1", "w"],
      ["Q", "e1", "a1", "w"],
      ["k", "e8", "h8", "b"],
      ["q", "e8", "a8", "b"],
    ])
      if (parts[2].includes(right)) {
        const k = g.state.board[C.square(king)],
          r = g.state.board[C.square(rook)];
        if (
          k?.type !== "k" ||
          k.color !== color ||
          r?.type !== "r" ||
          r.color !== color
        )
          throw Error("Invalid castling rights.");
      }
    return g;
  }
  function restore(list) {
    if (!Array.isArray(list) || list.length > 1500)
      throw Error("Invalid or oversized move history.");
    const game = new C.Game();
    for (const uci of list) {
      if (typeof uci !== "string" || !/^([a-h][1-8]){2}[qrbn]?$/.test(uci))
        throw Error("Invalid move in saved game.");
      const entry = game.move(
        C.square(uci.slice(0, 2)),
        C.square(uci.slice(2, 4)),
        uci[4],
      );
      if (!entry || entry.needsPromotion)
        throw Error("Saved moves do not form a legal game.");
    }
    return game;
  }
  function opening(value, list) {
    if (!value) return null;
    const lesson = (globalThis.TempoOpenings || []).find((o) => o.id === value);
    if (
      !lesson ||
      !Array.isArray(list) ||
      lesson.moves.some((m, i) => list[i] !== m)
    )
      throw Error("Invalid opening setup in saved game.");
    return lesson.id;
  }
  function session(value) {
    if (
      !value ||
      value.version !== 1 ||
      !id(value.id) ||
      !["local", "bot"].includes(value.mode) ||
      !["w", "b"].includes(value.humanColor) ||
      !["easy", "medium", "hard"].includes(value.level) ||
      !times.includes(value.time)
    )
      throw Error("Unsupported saved game.");
    const clocks = {};
    for (const color of ["w", "b"]) {
      const t = value.clocks?.[color];
      if (!Number.isFinite(t) || t < 0 || t > value.time)
        throw Error("Invalid saved clock.");
      clocks[color] = t;
    }
    const game = restore(value.moves);
    const openingId = opening(value.openingId, value.moves);
    if (game.status().over) throw Error("This game is already complete.");
    return {
      version: 1,
      id: value.id,
      mode: value.mode,
      humanColor: value.humanColor,
      level: value.level,
      time: value.time,
      clocks,
      moves: moves(game),
      openingId,
      flipped: value.flipped === true,
      savedAt: Number.isFinite(value.savedAt) ? value.savedAt : Date.now(),
    };
  }
  function record(value) {
    if (
      !value ||
      !id(value.id) ||
      !["local", "bot"].includes(value.mode) ||
      ![null, "w", "b"].includes(value.winner)
    )
      throw Error("Invalid game result.");
    const out = {
      id: value.id,
      mode: value.mode,
      winner: value.winner,
      reason: text(value.reason),
      date: Number.isFinite(value.date) ? value.date : Date.now(),
    };
    // Older results deliberately remain visible without pretending they have replay data.
    if (value.moves !== undefined) {
      out.moves = moves(restore(value.moves));
      out.openingId = opening(value.openingId, value.moves);
      out.time = times.includes(value.time) ? value.time : 600;
      out.humanColor = value.humanColor === "b" ? "b" : "w";
      out.level = ["easy", "medium", "hard"].includes(value.level)
        ? value.level
        : "medium";
    }
    return out;
  }
  globalThis.TempoGameData = Object.freeze({
    moves,
    restore,
    session,
    record,
    fen,
    position,
  });
})();
