(() => {
  const layouts = {
    start: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
    hero: "r1bq1rk1/ppp2ppp/2n1pn2/3p4/3P4/2PBPN2/PP3PPP/RNBQ1RK1",
    puzzle: "6k1/5ppp/8/8/8/8/8/4R2K",
  };
  const glyph = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  document.querySelectorAll("[data-preview]").forEach((board) => {
    const rows = layouts[board.dataset.preview].split("/");
    rows.forEach((row, r) => {
      let c = 0;
      for (const char of row)
        for (let n = 0; n < (Number(char) || 1); n++) {
          const square = document.createElement("span");
          square.className = "mini-square" + ((r + c) % 2 ? " dark" : "");
          if (!Number(char)) {
            square.textContent = glyph[char.toLowerCase()];
            if (char === char.toUpperCase()) square.classList.add("white");
          }
          if (board.dataset.preview === "hero" && r === 5 && c === 5)
            square.classList.add("mark");
          board.append(square);
          c++;
        }
    });
  });
})();
