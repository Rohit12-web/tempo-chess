/* Small legal exercises for the rules that often surprise beginners. */
(() => {
  globalThis.TempoLessons = [
    {
      id: "castling",
      title: "Castle your king",
      fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      move: "e1g1",
      goal: "Castle on the kingside: move the king from e1 to g1.",
      intro:
        "Castling moves the king two squares and brings the rook beside it. Neither piece may have moved, the path must be clear, and the king cannot castle out of, through or into check.",
      why: "The king reaches g1 and the rook moves from h1 to f1. You only move the king; Tempo moves the rook for you.",
    },
    {
      id: "en-passant",
      title: "The passing pawn",
      fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
      move: "e5d6",
      goal: "Black just played d7–d5. Capture en passant with e5–d6.",
      intro:
        "A pawn that advances two squares can be captured as if it had advanced one. This special capture is available only on the very next move.",
      why: "Your pawn lands on d6 while the black pawn disappears from d5. The destination square was empty: that is what makes en passant unusual.",
    },
    {
      id: "promotion",
      title: "A pawn earns a promotion",
      fen: "7k/4P3/6K1/8/8/8/8/8 w - - 0 1",
      move: "e7e8q",
      goal: "Choose Queen, then move the pawn from e7 to e8.",
      intro:
        "A pawn reaching the last rank must become a queen, rook, bishop or knight. It cannot remain a pawn or become a king. A queen is often useful, but underpromotion sometimes matters.",
      why: "The pawn becomes a queen immediately. Here the queen checks along the eighth rank and your king covers the escape squares, so this promotion also gives checkmate.",
    },
    {
      id: "checkmate",
      title: "Check with no escape",
      fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1",
      move: "e1e8",
      goal: "Deliver checkmate with the rook.",
      intro:
        "Checkmate means the king is in check and there is no legal move that removes the check. The king is never captured.",
      why: "Re8# checks the king along the back rank. The rook controls that rank and Black’s own pawns block the other exits.",
    },
    {
      id: "stalemate",
      title: "Spot the stalemate trap",
      fen: "7k/5K2/8/8/6Q1/8/8/8 w - - 0 1",
      move: "g4g6",
      goal: "Deliberately play Qg6 to see why this is a draw.",
      intro:
        "Stalemate means the player to move is NOT in check but has no legal move. It is a draw even when the other side has far more material. This exercise deliberately demonstrates the mistake.",
      why: "After Qg6, Black’s king is not attacked on h8, but g8, g7 and h7 are all controlled. With no legal move, the game is stalemate. In a real winning position, avoid this trap.",
    },
  ];
})();
