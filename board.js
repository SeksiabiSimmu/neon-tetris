// js/board.js
//
// Owns the locked-block grid and everything about it: bounds/collision
// checks, writing a locked piece into the grid, and detecting/clearing full
// rows. Board has no idea what a "current piece" is — it only ever deals in
// plain {col, row} cell lists, which keeps it trivially testable.
//
// Rows above the visible board (row < 0) are treated as always free. This
// is what lets a piece spawn partly "above" the board and fall into view,
// without needing a separate hidden buffer array.

TETRIS.Board = class Board {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.grid = this.createEmptyGrid();
  }

  createEmptyGrid() {
    return Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
  }

  reset() {
    this.grid = this.createEmptyGrid();
  }

  isCellFree(col, row) {
    if (col < 0 || col >= this.cols) return false;
    if (row >= this.rows) return false;
    if (row < 0) return true; // above the visible board: unobstructed
    return this.grid[row][col] === null;
  }

  // cells: [{col, row}, ...]
  canPlace(cells) {
    return cells.every(({ col, row }) => this.isCellFree(col, row));
  }

  // Writes cells into the grid under the given color key (the piece type
  // letter). Cells above the visible board are silently skipped — there's
  // nowhere in the grid array to put them, and by the time this is called
  // the caller has already decided whether that's a game-over condition.
  lockCells(cells, colorKey) {
    cells.forEach(({ col, row }) => {
      if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        this.grid[row][col] = colorKey;
      }
    });
  }

  getFullRows() {
    const full = [];
    for (let row = 0; row < this.rows; row++) {
      if (this.grid[row].every((cell) => cell !== null)) full.push(row);
    }
    return full;
  }

  // A hole is an empty cell with a filled cell somewhere above it in the
  // same column — the standard Tetris "mistake" metric. General-purpose:
  // not tied to any one game mode, just a fact about the board.
  countHoles() {
    let holes = 0;
    for (let col = 0; col < this.cols; col++) {
      let seenFilled = false;
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] !== null) seenFilled = true;
        else if (seenFilled) holes += 1;
      }
    }
    return holes;
  }

  // Removes the given rows and drops everything above them down to fill
  // the gap, backfilling empty rows at the top.
  clearRows(rowIndexes) {
    if (rowIndexes.length === 0) return;
    const toClear = new Set(rowIndexes);
    this.grid = this.grid.filter((_, index) => !toClear.has(index));
    while (this.grid.length < this.rows) {
      this.grid.unshift(new Array(this.cols).fill(null));
    }
  }
};
