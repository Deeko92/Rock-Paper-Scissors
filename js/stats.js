// stats.js — derive every stat from the raw games array. Nothing is stored.

function emptyThrowCounts() {
  return { rock: 0, paper: 0, scissors: 0 };
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

// Returns the key with the highest count, or null if all zero. Ties broken by
// THROWS order for determinism.
function topThrow(counts) {
  let best = null;
  let bestN = 0;
  for (const t of THROWS) {
    if (counts[t] > bestN) {
      bestN = counts[t];
      best = t;
    }
  }
  return best;
}

// Build a fresh per-player accumulator.
function newPlayerStat(player) {
  return {
    id: player.id,
    name: player.name,
    throws: emptyThrowCounts(),       // every throw they made, across all rounds
    opening: emptyThrowCounts(),      // throw on round 1 of each game
    wins: 0,
    losses: 0,
    luckyThrows: emptyThrowCounts(),  // throw they won the deciding round with
    longestStreak: 0,
    currentStreak: 0,                 // streak as of the most recent game
    afterTieSwitch: 0,                // changed throw after a tie
    afterTieRepeat: 0,                // repeated throw after a tie
  };
}

// Main entry point. Returns { players: {id->stat}, playerList: [...], global }.
function computeStats(data) {
  const byId = {};
  for (const p of data.players) byId[p.id] = newPlayerStat(p);

  // Ensure stats exist even for players referenced only by old games.
  const ensure = (pid) => {
    if (!byId[pid]) byId[pid] = newPlayerStat({ id: pid, name: '(removed player)' });
    return byId[pid];
  };

  const games = data.games.slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  let totalRounds = 0;
  let totalTies = 0;
  let longestGame = 0;          // most rounds in a single game
  let longestGameTies = 0;
  const matchups = {};          // "rock|scissors" (sorted) -> count
  const decisiveThrows = emptyThrowCounts(); // winning throw of deciding rounds

  // Track streaks in chronological order.
  const streakState = {};       // pid -> running streak

  for (const g of games) {
    const aId = g.playerIds[0];
    const bId = g.playerIds[1];
    const aStat = ensure(aId);
    const bStat = ensure(bId);

    totalRounds += g.rounds.length;
    if (g.rounds.length > longestGame) {
      longestGame = g.rounds.length;
      longestGameTies = g.rounds.filter((r) => r.result === 'tie').length;
    }

    g.rounds.forEach((r, idx) => {
      aStat.throws[r.aThrow]++;
      bStat.throws[r.bThrow]++;
      if (idx === 0) {
        aStat.opening[r.aThrow]++;
        bStat.opening[r.bThrow]++;
      }
      if (r.result === 'tie') totalTies++;

      // unordered matchup key
      const key = [r.aThrow, r.bThrow].sort().join('|');
      matchups[key] = (matchups[key] || 0) + 1;

      // after-a-tie tendency: compare this round's throw to the previous one
      // when the previous round was a tie.
      const prev = g.rounds[idx - 1];
      if (prev && prev.result === 'tie') {
        aStat[r.aThrow === prev.aThrow ? 'afterTieRepeat' : 'afterTieSwitch']++;
        bStat[r.bThrow === prev.bThrow ? 'afterTieRepeat' : 'afterTieSwitch']++;
      }
    });

    // game outcome (sudden death => exactly one winner, no tied games)
    if (g.winnerId) {
      const winStat = ensure(g.winnerId);
      const loserId = g.winnerId === aId ? bId : aId;
      winStat.wins++;
      ensure(loserId).losses++;

      const deciding = g.rounds[g.rounds.length - 1];
      const winThrow = g.winnerId === aId ? deciding.aThrow : deciding.bThrow;
      winStat.luckyThrows[winThrow]++;
      decisiveThrows[winThrow]++;

      // streaks
      for (const pid of g.playerIds) {
        if (pid === g.winnerId) {
          streakState[pid] = (streakState[pid] || 0) + 1;
        } else {
          streakState[pid] = 0;
        }
        const s = ensure(pid);
        s.currentStreak = streakState[pid];
        if (streakState[pid] > s.longestStreak) s.longestStreak = streakState[pid];
      }
    }
  }

  // Finalize derived per-player numbers.
  const playerList = data.players.map((p) => {
    const s = byId[p.id];
    s.name = p.name; // keep names current
    const totalThrows = s.throws.rock + s.throws.paper + s.throws.scissors;
    const totalOpenings = s.opening.rock + s.opening.paper + s.opening.scissors;
    const games = s.wins + s.losses;
    return {
      ...s,
      totalThrows,
      throwPct: {
        rock: pct(s.throws.rock, totalThrows),
        paper: pct(s.throws.paper, totalThrows),
        scissors: pct(s.throws.scissors, totalThrows),
      },
      openingPct: {
        rock: pct(s.opening.rock, totalOpenings),
        paper: pct(s.opening.paper, totalOpenings),
        scissors: pct(s.opening.scissors, totalOpenings),
      },
      gamesPlayed: games,
      winPct: pct(s.wins, games),
      favoriteThrow: topThrow(s.throws),
      favoriteOpening: topThrow(s.opening),
      luckyThrow: topThrow(s.luckyThrows),
    };
  });

  // Most common matchup.
  let topMatchup = null;
  let topMatchupN = 0;
  for (const [key, n] of Object.entries(matchups)) {
    if (n > topMatchupN) {
      topMatchupN = n;
      topMatchup = key;
    }
  }

  const totalGames = games.length;
  return {
    playerList,
    byId,
    global: {
      totalGames,
      totalRounds,
      totalTies,
      tieRate: pct(totalTies, totalRounds),
      avgRounds: totalGames > 0 ? Math.round((totalRounds / totalGames) * 10) / 10 : 0,
      longestGame,
      longestGameTies,
      topMatchup,            // e.g. "rock|scissors" or null
      topMatchupCount: topMatchupN,
      mostDecisiveThrow: topThrow(decisiveThrows),
      decisiveThrows,
    },
  };
}
