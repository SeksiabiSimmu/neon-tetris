// js/piece.js
//
// A Piece knows only its own type, rotation state, and position — it has no
// idea whether it's allowed to be where it is. Collision rules live on
// Board; decisions about whether to accept a move live on Game.

TETRIS.Piece = class Piece {
  constructor(type) {
    this.type = type;
    this.rotation = 0;
    this.col = TETRIS.CONFIG.SPAWN_COL;
    this.row = TETRIS.CONFIG.SPAWN_ROW;
  }

  // Returns the absolute board cells this piece occupies, as {col, row}
  // pairs. Accepts optional overrides so callers (Game, Renderer) can ask
  // "what cells would this piece occupy at a different position/rotation?"
  // without mutating the piece — used for collision checks, ghost-piece
  // projection, and wall-kick attempts.
  getCells(col = this.col, row = this.row, rotation = this.rotation) {
    return TETRIS.SHAPES[this.type][rotation].map(([dCol, dRow]) => ({
      col: col + dCol,
      row: row + dRow,
    }));
  }
};
