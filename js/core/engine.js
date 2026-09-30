/* Tempo's chess rules. Plain JavaScript, no chess library or dependencies.
 * Squares are indexed a8 = 0 ... h1 = 63. Pieces have stable animation IDs.
 * The engine is DOM-independent so legal moves can be verified separately.
 */
(function installTempoChess() {
  "use strict";
  const FILES = "abcdefgh";
  const TYPES = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  const other = (color) => (color === "w" ? "b" : "w");
  const rank = (square) => Math.floor(square / 8);
  const file = (square) => square % 8;
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const name = (square) => FILES[file(square)] + (8 - rank(square));
  const square = (notation) =>
    (8 - Number(notation[1])) * 8 + FILES.indexOf(notation[0]);
  const KNIGHT = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  const DIAGONAL = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const STRAIGHT = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  function initialState() {
    const board = Array(64).fill(null);
    const order = "rnbqkbnr";
    for (let c = 0; c < 8; c++) {
      board[c] = { type: order[c], color: "b", id: "b-back-" + c };
      board[8 + c] = { type: "p", color: "b", id: "b-pawn-" + c };
      board[48 + c] = { type: "p", color: "w", id: "w-pawn-" + c };
      board[56 + c] = { type: order[c], color: "w", id: "w-back-" + c };
    }
    return {
      board,
      turn: "w",
      castle: { w: { k: true, q: true }, b: { k: true, q: true } },
      ep: -1,
      halfmove: 0,
      fullmove: 1,
    };
  }

  function copyState(state) {
    return {
      ...state,
      board: state.board.slice(),
      castle: { w: { ...state.castle.w }, b: { ...state.castle.b } },
    };
  }

  // Attacked squares include pinned pieces, as required for king moves/castling.
  function attacked(state, target, by) {
    const { board } = state,
      r = rank(target),
      c = file(target);
    const pawnRow = r - (by === "w" ? -1 : 1);
    for (const dc of [-1, 1]) {
      if (inside(pawnRow, c + dc)) {
        const p = board[pawnRow * 8 + c + dc];
        if (p && p.color === by && p.type === "p") return true;
      }
    }
    for (const [dr, dc] of KNIGHT) {
      if (!inside(r + dr, c + dc)) continue;
      const p = board[(r + dr) * 8 + c + dc];
      if (p && p.color === by && p.type === "n") return true;
    }
    for (const [dr, dc] of [...DIAGONAL, ...STRAIGHT]) {
      for (let step = 1; inside(r + dr * step, c + dc * step); step++) {
        const p = board[(r + dr * step) * 8 + c + dc * step];
        if (!p) continue;
        if (
          p.color === by &&
          (p.type === "q" ||
            (p.type === "k" && step === 1) ||
            (p.type === "b" && dr !== 0 && dc !== 0) ||
            (p.type === "r" && (dr === 0 || dc === 0)))
        )
          return true;
        break;
      }
    }
    return false;
  }

  function inCheck(state, color = state.turn) {
    const king = state.board.findIndex(
      (p) => p && p.color === color && p.type === "k",
    );
    return king < 0 || attacked(state, king, other(color));
  }

  function pseudoMoves(state, from) {
    const { board } = state,
      p = board[from],
      moves = [];
    if (!p) return moves;
    const r = rank(from),
      c = file(from);
    function add(to, extra = {}) {
      const target = board[to];
      if (target && (target.color === p.color || target.type === "k")) return;
      if (p.type === "p" && (rank(to) === 0 || rank(to) === 7)) {
        for (const promotion of ["q", "r", "b", "n"])
          moves.push({ from, to, ...extra, promotion });
      } else moves.push({ from, to, ...extra });
    }
    if (p.type === "p") {
      const dr = p.color === "w" ? -1 : 1,
        next = r + dr,
        start = p.color === "w" ? 6 : 1;
      if (inside(next, c) && !board[next * 8 + c]) {
        add(next * 8 + c);
        if (r === start && !board[(r + 2 * dr) * 8 + c])
          add((r + 2 * dr) * 8 + c, { doublePawn: true });
      }
      for (const dc of [-1, 1]) {
        if (!inside(next, c + dc)) continue;
        const to = next * 8 + c + dc;
        if (board[to] && board[to].color !== p.color) add(to);
        const victim = board[r * 8 + c + dc];
        if (
          to === state.ep &&
          !board[to] &&
          victim &&
          victim.type === "p" &&
          victim.color !== p.color
        )
          add(to, { enPassant: true });
      }
    } else if (p.type === "n" || p.type === "k") {
      for (const [dr, dc] of p.type === "n"
        ? KNIGHT
        : [...DIAGONAL, ...STRAIGHT]) {
        if (inside(r + dr, c + dc)) add((r + dr) * 8 + c + dc);
      }
      const home = p.color === "w" ? 60 : 4;
      if (p.type === "k" && from === home && !inCheck(state, p.color)) {
        for (const side of ["k", "q"]) {
          if (!state.castle[p.color][side]) continue;
          const rookSquare = home + (side === "k" ? 3 : -4),
            rook = board[rookSquare];
          const path =
            side === "k"
              ? [home + 1, home + 2]
              : [home - 1, home - 2, home - 3];
          const transit =
            side === "k" ? [home + 1, home + 2] : [home - 1, home - 2];
          if (
            rook &&
            rook.type === "r" &&
            rook.color === p.color &&
            path.every((s) => !board[s]) &&
            transit.every((s) => !attacked(state, s, other(p.color)))
          )
            add(home + (side === "k" ? 2 : -2), { castle: side });
        }
      }
    } else {
      const directions =
        p.type === "b"
          ? DIAGONAL
          : p.type === "r"
            ? STRAIGHT
            : [...DIAGONAL, ...STRAIGHT];
      for (const [dr, dc] of directions) {
        for (let step = 1; inside(r + dr * step, c + dc * step); step++) {
          const to = (r + dr * step) * 8 + c + dc * step;
          add(to);
          if (board[to]) break;
        }
      }
    }
    return moves;
  }

  function applyMove(state, move) {
    const next = copyState(state),
      p = state.board[move.from];
    const captureSquare = move.enPassant
      ? move.to + (p.color === "w" ? 8 : -8)
      : move.to;
    const captured = state.board[captureSquare];
    next.board[move.from] = null;
    if (move.enPassant) next.board[captureSquare] = null;
    next.board[move.to] = move.promotion ? { ...p, type: move.promotion } : p;
    if (move.castle) {
      const rookFrom = move.from + (move.castle === "k" ? 3 : -4),
        rookTo = move.from + (move.castle === "k" ? 1 : -1);
      next.board[rookTo] = next.board[rookFrom];
      next.board[rookFrom] = null;
    }
    if (p.type === "k") next.castle[p.color] = { k: false, q: false };
    for (const [home, color, side] of [
      [0, "b", "q"],
      [7, "b", "k"],
      [56, "w", "q"],
      [63, "w", "k"],
    ]) {
      if (move.from === home || captureSquare === home)
        next.castle[color][side] = false;
    }
    next.ep = move.doublePawn ? (move.from + move.to) / 2 : -1;
    next.halfmove = p.type === "p" || captured ? 0 : state.halfmove + 1;
    next.fullmove = state.fullmove + (state.turn === "b" ? 1 : 0);
    next.turn = other(state.turn);
    return next;
  }

  function legalMoves(state, from = null) {
    const result = [];
    for (let s = 0; s < 64; s++) {
      if (from !== null && s !== from) continue;
      const p = state.board[s];
      if (!p || p.color !== state.turn) continue;
      for (const move of pseudoMoves(state, s))
        if (!inCheck(applyMove(state, move), p.color)) result.push(move);
    }
    return result;
  }

  function positionKey(state) {
    const placement = state.board
      .map((p) => (p ? p.color + p.type : "-"))
      .join("");
    const castling = ["w", "b"]
      .map(
        (c) =>
          (state.castle[c].k ? "k" : "-") + (state.castle[c].q ? "q" : "-"),
      )
      .join("");
    // An unusable en-passant square must not distinguish repeated positions.
    const ep =
      state.ep >= 0 && legalMoves(state).some((m) => m.enPassant)
        ? state.ep
        : "-";
    return placement + state.turn + castling + ep;
  }

  function insufficientMaterial(state) {
    const pieces = state.board
      .map((p, s) => (p ? { ...p, square: s } : null))
      .filter((p) => p && p.type !== "k");
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && ["b", "n"].includes(pieces[0].type)) return true;
    if (pieces.every((p) => p.type === "b")) {
      const colors = new Set(
        pieces.map((p) => (rank(p.square) + file(p.square)) % 2),
      );
      return colors.size === 1;
    }
    return false;
  }

  function san(state, move, next, allLegal) {
    const p = state.board[move.from],
      capture = !!state.board[move.to] || !!move.enPassant;
    let text = "";
    if (move.castle) text = move.castle === "k" ? "O-O" : "O-O-O";
    else {
      if (p.type !== "p") {
        text = p.type.toUpperCase();
        const alternatives = allLegal.filter(
          (m) =>
            m.from !== move.from &&
            m.to === move.to &&
            state.board[m.from].type === p.type,
        );
        if (alternatives.length) {
          if (!alternatives.some((m) => file(m.from) === file(move.from)))
            text += FILES[file(move.from)];
          else if (!alternatives.some((m) => rank(m.from) === rank(move.from)))
            text += 8 - rank(move.from);
          else text += name(move.from);
        }
      } else if (capture) text += FILES[file(move.from)];
      if (capture) text += "x";
      text += name(move.to);
      if (move.promotion) text += "=" + move.promotion.toUpperCase();
    }
    if (inCheck(next)) text += legalMoves(next).length ? "+" : "#";
    return text;
  }

  class Game {
    constructor() {
      this.reset();
    }
    reset() {
      this.state = initialState();
      this.history = [];
      this.snapshots = [];
      this.result = null;
      this.keys = [positionKey(this.state)];
    }
    moves(from = null) {
      return this.result ? [] : legalMoves(this.state, from);
    }
    move(from, to, promotion) {
      if (this.status().over) return null;
      const available = legalMoves(this.state);
      const options = available.filter((m) => m.from === from && m.to === to);
      if (!options.length) return null;
      if (options.some((m) => m.promotion) && !promotion)
        return { needsPromotion: true, options };
      const move = options.find(
        (m) => !m.promotion || m.promotion === promotion,
      );
      if (!move) return null;
      const before = this.state,
        next = applyMove(before, move),
        piece = before.board[from];
      const captureSquare = move.enPassant
        ? to + (piece.color === "w" ? 8 : -8)
        : to;
      const entry = {
        ...move,
        piece,
        captured: before.board[captureSquare],
        san: san(before, move, next, available),
        color: before.turn,
        number: before.fullmove,
      };
      this.snapshots.push(before);
      this.history.push(entry);
      this.state = next;
      this.keys.push(positionKey(next));
      return entry;
    }
    undo() {
      if (!this.snapshots.length && !this.result) return false;
      if (this.result) {
        this.result = null;
        return true;
      }
      this.state = this.snapshots.pop();
      this.history.pop();
      this.keys.pop();
      return true;
    }
    claimable(state = this.state) {
      const current = state === this.state;
      const key = current
        ? this.keys[this.keys.length - 1]
        : positionKey(state);
      const repetitions =
        this.keys.filter((k) => k === key).length + (current ? 0 : 1);
      if (repetitions >= 3) return "Threefold repetition";
      if (state.halfmove >= 100) return "50-move rule";
      return null;
    }
    claimableMoves() {
      if (this.status().over) return [];
      return legalMoves(this.state).filter((m) =>
        this.claimable(applyMove(this.state, m)),
      );
    }
    claimDraw(intendedMove = null) {
      if (this.status().over) return false;
      let reason = this.claimable();
      if (!reason && intendedMove) {
        const legal = legalMoves(this.state).find(
          (m) =>
            m.from === intendedMove.from &&
            m.to === intendedMove.to &&
            m.promotion === intendedMove.promotion,
        );
        if (legal) reason = this.claimable(applyMove(this.state, legal));
      }
      if (!reason) return false;
      this.result = { over: true, winner: null, reason };
      return true;
    }
    agreeDraw() {
      if (!this.status().over)
        this.result = { over: true, winner: null, reason: "Draw by agreement" };
    }
    resign() {
      if (!this.status().over)
        this.result = {
          over: true,
          winner: other(this.state.turn),
          reason: "Resignation",
        };
    }
    status() {
      if (this.result) return { ...this.result, check: inCheck(this.state) };
      const check = inCheck(this.state),
        moves = legalMoves(this.state);
      if (!moves.length)
        return {
          over: true,
          check,
          winner: check ? other(this.state.turn) : null,
          reason: check ? "Checkmate" : "Stalemate",
        };
      if (insufficientMaterial(this.state))
        return {
          over: true,
          check,
          winner: null,
          reason: "Insufficient material",
        };
      const key = this.keys[this.keys.length - 1];
      if (this.keys.filter((k) => k === key).length >= 5)
        return {
          over: true,
          check,
          winner: null,
          reason: "Fivefold repetition",
        };
      if (this.state.halfmove >= 150)
        return { over: true, check, winner: null, reason: "75-move rule" };
      return {
        over: false,
        check,
        winner: null,
        reason: null,
        claim: this.claimable(),
      };
    }
    // FEN support is used to independently exercise tricky legal positions.
    load(fen) {
      const [placement, turn, rights, ep, half = "0", full = "1"] =
        fen.split(/\s+/);
      const board = [];
      let id = 0;
      for (const ch of placement.replaceAll("/", "")) {
        if (/\d/.test(ch)) board.push(...Array(Number(ch)).fill(null));
        else
          board.push({
            type: ch.toLowerCase(),
            color: ch === ch.toUpperCase() ? "w" : "b",
            id: "fen-" + id++,
          });
      }
      if (
        board.length !== 64 ||
        !["w", "b"].includes(turn) ||
        board.filter((p) => p?.type === "k" && p.color === "w").length !== 1 ||
        board.filter((p) => p?.type === "k" && p.color === "b").length !== 1
      )
        throw new Error("Invalid FEN");
      this.state = {
        board,
        turn,
        castle: {
          w: { k: rights.includes("K"), q: rights.includes("Q") },
          b: { k: rights.includes("k"), q: rights.includes("q") },
        },
        ep: ep === "-" ? -1 : square(ep),
        halfmove: Number(half),
        fullmove: Number(full),
      };
      this.history = [];
      this.snapshots = [];
      this.keys = [positionKey(this.state)];
      this.result = null;
    }
  }
  const api = {
    Game,
    initialState,
    legalMoves,
    applyMove,
    inCheck,
    attacked,
    positionKey,
    insufficientMaterial,
    name,
    square,
    TYPES,
    other,
  };
  // A self-contained worker also works when play.html is opened as a local file.
  api.workerSource = "(" + installTempoChess.toString() + ")();";
  globalThis.TempoChess = api;
})();
