/* Original lightweight chess AI: iterative-deepening negamax + alpha-beta.
 * Runs in a Web Worker when available. No chess/AI library or external service.
 */
(function installTempoBot() {
  "use strict";
  const C = globalThis.TempoChess;
  const VALUE = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
  const MATE = 100000;
  const LEVELS = {
    easy: { depth: 1, time: 160 },
    medium: { depth: 3, time: 650 },
    hard: { depth: 5, time: 1700 },
  };
  const same = (a, b) =>
    a && b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;

  function evaluate(state) {
    let score = 0,
      material = 0;
    for (const p of state.board) if (p) material += VALUE[p.type];
    for (let s = 0; s < 64; s++) {
      const p = state.board[s];
      if (!p) continue;
      const row = Math.floor(s / 8),
        col = s % 8,
        advance = p.color === "w" ? 6 - row : row - 1;
      const center = 3.5 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) / 2;
      let value = VALUE[p.type];
      if (p.type === "p")
        value += advance * 8 + center * 5 + (advance > 3 ? advance * 8 : 0);
      if (p.type === "n")
        value +=
          center * 22 -
          (row === 0 || row === 7 || col === 0 || col === 7 ? 18 : 0);
      if (p.type === "b") value += center * 12;
      if (p.type === "r") value += advance * 2 + center * 3;
      if (p.type === "q") value += center * 4;
      if (p.type === "k")
        value +=
          material < 2400
            ? center * 22
            : -center * 12 +
              ((col === 6 || col === 2) && (row === 0 || row === 7) ? 35 : 0);
      score += (p.color === "w" ? 1 : -1) * value;
    }
    return score * (state.turn === "w" ? 1 : -1);
  }

  function search(state, options = {}) {
    const profile = LEVELS[options.level] || LEVELS.medium;
    const maxDepth = options.depth || profile.depth;
    const deadline = Date.now() + (options.time || profile.time);
    const all = C.legalMoves(state);
    if (!all.length) return { move: null, depth: 0, nodes: 0 };
    const history = options.keys || [];
    let nodes = 0,
      completed = 0,
      best = all[0],
      bestScore = -Infinity;
    const STOP = Symbol("time budget");

    function order(moves, position, preferred) {
      return moves
        .map((move) => {
          const attacker = position.board[move.from],
            victim = position.board[move.to];
          const value =
            (same(move, preferred) ? 100000 : 0) +
            (move.promotion ? VALUE[move.promotion] + 800 : 0) +
            (victim
              ? VALUE[victim.type] * 10 - VALUE[attacker.type]
              : move.enPassant
                ? 900
                : 0) +
            (move.castle ? 45 : 0);
          return { move, value };
        })
        .sort((a, b) => b.value - a.value)
        .map((x) => x.move);
    }

    function negamax(position, depth, alpha, beta, ply, qDepth = 0, path = []) {
      nodes++;
      if ((nodes & 127) === 0 && Date.now() > deadline) throw STOP;
      const moves = C.legalMoves(position),
        check = C.inCheck(position);
      if (!moves.length) return check ? -MATE + ply : 0;
      if (C.insufficientMaterial(position) || position.halfmove >= 100)
        return 0;
      // Penalize repeating a game position; avoid aimless perpetual shuffling.
      const key = C.positionKey(position);
      if (
        history.filter((k) => k === key).length +
          path.filter((k) => k === key).length >=
        2
      )
        return 0;
      if (depth <= 0) {
        const standing = evaluate(position);
        if (!check) {
          if (standing >= beta) return standing;
          alpha = Math.max(alpha, standing);
        }
        if (qDepth >= 3) return standing;
        const tactical = check
          ? moves
          : moves.filter(
              (m) => position.board[m.to] || m.enPassant || m.promotion,
            );
        if (!tactical.length) return standing;
        for (const move of order(tactical, position)) {
          const score = -negamax(
            C.applyMove(position, move),
            0,
            -beta,
            -alpha,
            ply + 1,
            qDepth + 1,
            [...path, key],
          );
          if (score >= beta) return score;
          alpha = Math.max(alpha, score);
        }
        return alpha;
      }
      for (const move of order(moves, position)) {
        const score = -negamax(
          C.applyMove(position, move),
          depth - 1,
          -beta,
          -alpha,
          ply + 1,
          0,
          [...path, key],
        );
        if (score >= beta) return score;
        alpha = Math.max(alpha, score);
      }
      return alpha;
    }

    for (let depth = 1; depth <= maxDepth; depth++) {
      let candidate = best,
        score = -Infinity,
        alpha = -Infinity;
      try {
        for (const move of order(all, state, best)) {
          if (Date.now() > deadline && completed) throw STOP;
          const result = -negamax(
            C.applyMove(state, move),
            depth - 1,
            -Infinity,
            -alpha,
            1,
          );
          if (result > score) {
            score = result;
            candidate = move;
          }
          alpha = Math.max(alpha, result);
        }
        best = candidate;
        bestScore = score;
        completed = depth;
        if (score > MATE - 100) break;
      } catch (error) {
        if (error !== STOP) throw error;
        break;
      }
    }
    return { move: best, score: bestScore, depth: completed, nodes };
  }
  const api = { search, evaluate, LEVELS };
  api.workerSource = "(" + installTempoBot.toString() + ")();";
  globalThis.TempoBot = api;
})();
