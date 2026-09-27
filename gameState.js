// js/gameState.js
//
// The set of high-level states the game can be in. Kept as a plain frozen
// enum rather than a full state-machine class — with only a few states and
// simple linear transitions, Game itself is a clear enough place to own the
// transition logic.

TETRIS.GameState = Object.freeze({
  READY: 'READY', // waiting for the player's first input
  PLAYING: 'PLAYING', // active gameplay
  PAUSED: 'PAUSED', // suspended mid-game; resumes back to PLAYING
  GAME_OVER: 'GAME_OVER', // stack topped out (or a Sprint/Marathon target reached); waiting for restart
});
