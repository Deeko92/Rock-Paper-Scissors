// game.js — core rock-paper-scissors rules and sudden-death game logic.

const THROWS = ['rock', 'paper', 'scissors'];

const THROW_LABEL = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
const THROW_EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };

// True if throw x beats throw y.
function beats(x, y) {
  return (
    (x === 'rock' && y === 'scissors') ||
    (x === 'scissors' && y === 'paper') ||
    (x === 'paper' && y === 'rock')
  );
}

// Decide a single round. Player A is index 0, player B is index 1.
// Returns 'tie' | 'a' | 'b'.
function decideRound(aThrow, bThrow) {
  if (aThrow === bThrow) return 'tie';
  return beats(aThrow, bThrow) ? 'a' : 'b';
}

// Create a fresh in-progress game between two player ids.
function newGame(aId, bId) {
  return { playerIds: [aId, bId], rounds: [], over: false, winnerId: null };
}

// Apply a round to an in-progress game (mutates and returns it).
// Sudden death: a tie is recorded but play continues; the first decided round
// ends the game and its winner takes the game.
function playRound(game, aThrow, bThrow) {
  if (game.over) return game;
  const result = decideRound(aThrow, bThrow);
  game.rounds.push({ aThrow, bThrow, result });
  if (result !== 'tie') {
    game.over = true;
    game.winnerId = result === 'a' ? game.playerIds[0] : game.playerIds[1];
  }
  return game;
}

// Convert a finished in-progress game into a stored record.
function finalizeGame(game) {
  return {
    id: genId(),
    date: new Date().toISOString(),
    playerIds: game.playerIds.slice(),
    rounds: game.rounds.map((r) => ({ aThrow: r.aThrow, bThrow: r.bThrow, result: r.result })),
    winnerId: game.winnerId,
  };
}

function tieCount(game) {
  return game.rounds.filter((r) => r.result === 'tie').length;
}
