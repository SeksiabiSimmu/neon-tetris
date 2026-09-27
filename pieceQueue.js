// js/pieceQueue.js
//
// Generates the sequence of upcoming piece types using the standard
// "7-bag" randomizer: every bag contains each of the 7 pieces exactly once,
// shuffled, so the player can never go more than 12 pieces without seeing
// a particular type. Plain uniform randomness feels much streakier and
// worse in practice, so this is worth having even in the foundation phase.

TETRIS.PieceQueue = class PieceQueue {
  constructor() {
    this.types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    this.queue = [];
    this.refill();
    this.refill();
  }

  shuffledBag() {
    const bag = [...this.types];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  refill() {
    this.queue.push(...this.shuffledBag());
  }

  // Consumes and returns the next piece type.
  next() {
    if (this.queue.length <= this.types.length) this.refill();
    return this.queue.shift();
  }

  // Returns the next `count` types without consuming them, for the preview panel.
  peek(count) {
    while (this.queue.length < count + this.types.length) this.refill();
    return this.queue.slice(0, count);
  }

  reset() {
    this.queue = [];
    this.refill();
    this.refill();
  }
};
