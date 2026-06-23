// app.js — UI wiring: tabs, the Play flow, Stats and History rendering.

const state = {
  data: loadData(),
  activeTab: 'play',
  // Play-screen working state:
  aId: null,
  bId: null,
  game: null,        // in-progress game (from newGame)
  selA: null,        // currently selected throw for player A this round
  selB: null,
};

// Default the two pickers to the first two players.
state.aId = state.data.players[0].id;
state.bId = state.data.players[1].id;

function persist() {
  saveData(state.data);
}

function playerName(id) {
  const p = state.data.players.find((x) => x.id === id);
  return p ? p.name : '(unknown)';
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = el('div', { class: 'toast' });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------------- tabs ----------------
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  render();
}

document.querySelectorAll('.tab-btn').forEach((b) =>
  b.addEventListener('click', () => switchTab(b.dataset.tab))
);

function render() {
  if (state.activeTab === 'play') renderPlay();
  else if (state.activeTab === 'stats') renderStats();
  else if (state.activeTab === 'history') renderHistory();
}

// ---------------- Play ----------------
function startGameIfNeeded() {
  if (!state.game) {
    state.game = newGame(state.aId, state.bId);
    state.selA = null;
    state.selB = null;
  }
}

function throwButtons(which) {
  const selected = which === 'a' ? state.selA : state.selB;
  return el(
    'div',
    { class: 'throw-row' },
    THROWS.map((t) =>
      el(
        'button',
        {
          class: 'throw-btn' + (selected === t ? ' selected' : ''),
          onclick: () => {
            if (which === 'a') state.selA = t;
            else state.selB = t;
            renderPlay();
          },
        },
        [el('span', { text: THROW_EMOJI[t] }), el('span', { class: 'lbl', text: THROW_LABEL[t] })]
      )
    )
  );
}

function submitRound() {
  if (!state.selA || !state.selB) return;
  playRound(state.game, state.selA, state.selB);
  state.selA = null;
  state.selB = null;
  if (state.game.over) {
    state.data.games.push(finalizeGame(state.game));
    persist();
  }
  renderPlay();
}

function renderPlay() {
  startGameIfNeeded();
  const panel = document.getElementById('tab-play');
  panel.innerHTML = '';

  const g = state.game;
  const aName = playerName(state.aId);
  const bName = playerName(state.bId);

  // Player pickers (only changeable before the game has any rounds).
  const pickerLocked = g.rounds.length > 0 && !g.over;
  const makeSelect = (cur, onChange) =>
    el(
      'select',
      { onchange: (e) => onChange(e.target.value), ...(pickerLocked ? { disabled: 'disabled' } : {}) },
      state.data.players.map((p) =>
        el('option', { value: p.id, ...(p.id === cur ? { selected: 'selected' } : {}) }, p.name)
      )
    );

  const pickers = el('div', { class: 'player-pickers' }, [
    makeSelect(state.aId, (v) => {
      state.aId = v;
      state.game = null;
      renderPlay();
    }),
    makeSelect(state.bId, (v) => {
      state.bId = v;
      state.game = null;
      renderPlay();
    }),
  ]);

  const card = el('div', { class: 'card' }, [pickers]);

  if (g.over) {
    const ties = tieCount(g);
    card.appendChild(
      el('div', { class: 'winner-banner' }, [
        el('div', { text: '🏆 Winner' }),
        el('div', { class: 'big', text: playerName(g.winnerId) }),
        el('div', {
          class: 'muted',
          text: `${g.rounds.length} round${g.rounds.length === 1 ? '' : 's'}` +
            (ties ? ` · ${ties} tie${ties === 1 ? '' : 's'}` : ''),
        }),
      ])
    );
    card.appendChild(roundLog(g));
    card.appendChild(
      el('button', {
        class: 'btn',
        text: '↻ New game',
        onclick: () => {
          state.game = null;
          renderPlay();
        },
      })
    );
  } else {
    // round entry
    const tn = g.rounds.length + 1;
    card.appendChild(el('div', { class: 'center muted', text: `Round ${tn}` }));

    card.appendChild(
      el('div', { class: 'player-block' }, [
        el('div', { class: 'player-name', text: aName }),
        throwButtons('a'),
      ])
    );
    card.appendChild(
      el('div', { class: 'player-block' }, [
        el('div', { class: 'player-name', text: bName }),
        throwButtons('b'),
      ])
    );

    // status line: announce the previous tie, if any
    const last = g.rounds[g.rounds.length - 1];
    const status = el('div', { class: 'round-status' });
    if (last && last.result === 'tie') {
      status.className = 'round-status tie-flash';
      status.textContent = `Tie! (${tieCount(g)} so far) — throw again`;
    } else {
      status.textContent = 'Pick a throw for each player';
    }
    card.appendChild(status);

    card.appendChild(
      el('button', {
        class: 'btn',
        text: 'Submit round',
        ...(state.selA && state.selB ? {} : { disabled: 'disabled' }),
        onclick: submitRound,
      })
    );

    if (g.rounds.length > 0) card.appendChild(roundLog(g));
  }

  panel.appendChild(card);
}

function roundLog(g) {
  const log = el('div', { class: 'round-log' }, [el('h3', { text: 'Rounds' })]);
  g.rounds.forEach((r, i) => {
    const cls = r.result === 'tie' ? 'tie' : r.result === 'a' ? 'win-a' : 'win-b';
    const outcome =
      r.result === 'tie'
        ? 'Tie'
        : `${playerName(r.result === 'a' ? g.playerIds[0] : g.playerIds[1])} wins`;
    log.appendChild(
      el('div', { class: 'round-line ' + cls }, [
        el('span', { text: `R${i + 1}: ${THROW_EMOJI[r.aThrow]} vs ${THROW_EMOJI[r.bThrow]}` }),
        el('span', { text: outcome }),
      ])
    );
  });
  return log;
}

// ---------------- Stats ----------------
function distBar(counts, pcts) {
  const seg = (t) =>
    pcts[t] > 0
      ? el('span', { class: 'seg-' + t, style: `width:${pcts[t]}%`, text: `${pcts[t]}%` })
      : null;
  return el('div', { class: 'bar' }, THROWS.map(seg));
}

function renderStats() {
  const panel = document.getElementById('tab-stats');
  panel.innerHTML = '';
  const s = computeStats(state.data);

  if (s.global.totalGames === 0) {
    panel.appendChild(
      el('div', { class: 'card center muted' }, 'No games yet. Play a game to see stats!')
    );
    return;
  }

  // Global card
  const gl = s.global;
  const globalCard = el('div', { class: 'card' }, [el('h2', { text: 'Overall' })]);
  globalCard.appendChild(
    el('div', { class: 'stat-grid' }, [
      statBox(gl.totalGames, 'Games'),
      statBox(gl.totalRounds, 'Rounds'),
      statBox(gl.totalTies, 'Ties'),
      statBox(gl.avgRounds, 'Avg rounds/game'),
      statBox(gl.tieRate + '%', 'Tie rate'),
      statBox(gl.longestGame, 'Longest game'),
    ])
  );
  const matchupText = gl.topMatchup
    ? gl.topMatchup
        .split('|')
        .map((t) => THROW_LABEL[t])
        .join(' vs ') + ` (${gl.topMatchupCount}×)`
    : '—';
  globalCard.appendChild(
    el('div', {}, [
      kv('Most common matchup', matchupText),
      kv('Most decisive throw', gl.mostDecisiveThrow ? THROW_LABEL[gl.mostDecisiveThrow] : '—'),
    ])
  );
  panel.appendChild(globalCard);

  // Head-to-head win record (two-player framing)
  panel.appendChild(headToHeadCard(s));

  // Per-player cards
  for (const p of s.playerList) {
    if (p.gamesPlayed === 0 && p.totalThrows === 0) continue;
    panel.appendChild(playerCard(p));
  }
}

function statBox(num, lbl) {
  return el('div', { class: 'stat-box' }, [
    el('div', { class: 'num', text: String(num) }),
    el('div', { class: 'lbl', text: lbl }),
  ]);
}

function kv(k, v) {
  return el('div', { class: 'kv' }, [
    el('span', { class: 'k', text: k }),
    el('span', { class: 'v', text: String(v) }),
  ]);
}

function headToHeadCard(s) {
  const card = el('div', { class: 'card' }, [el('h2', { text: 'Win–Loss' })]);
  for (const p of s.playerList) {
    if (p.gamesPlayed === 0) continue;
    card.appendChild(kv(p.name, `${p.wins}–${p.losses}  ·  ${p.winPct}%  ·  streak ${p.currentStreak} (best ${p.longestStreak})`));
  }
  return card;
}

function playerCard(p) {
  const card = el('div', { class: 'card' }, [el('h2', { text: p.name })]);

  card.appendChild(
    el('div', { class: 'stat-grid' }, [
      statBox(`${p.wins}–${p.losses}`, 'Record'),
      statBox(p.winPct + '%', 'Win rate'),
      statBox(p.longestStreak, 'Best streak'),
      statBox(p.totalThrows, 'Total throws'),
    ])
  );

  const legend = el('div', { class: 'legend' }, [
    el('span', { class: 'l-rock', text: 'Rock' }),
    el('span', { class: 'l-paper', text: 'Paper' }),
    el('span', { class: 'l-scissors', text: 'Scissors' }),
  ]);

  card.appendChild(el('h3', { text: 'Throw distribution' }));
  card.appendChild(legend);
  card.appendChild(distBar(p.throws, p.throwPct));

  card.appendChild(el('h3', { text: 'Opening move (round 1)' }));
  card.appendChild(distBar(p.opening, p.openingPct));

  card.appendChild(
    el('div', {}, [
      kv('Favorite throw', p.favoriteThrow ? THROW_LABEL[p.favoriteThrow] : '—'),
      kv('Favorite opener', p.favoriteOpening ? THROW_LABEL[p.favoriteOpening] : '—'),
      kv('Lucky (winning) throw', p.luckyThrow ? THROW_LABEL[p.luckyThrow] : '—'),
      kv('After a tie', `${p.afterTieSwitch} switched · ${p.afterTieRepeat} repeated`),
    ])
  );
  return card;
}

// ---------------- History ----------------
function renderHistory() {
  const panel = document.getElementById('tab-history');
  panel.innerHTML = '';

  // Manage card: names + data backup
  const manage = el('div', { class: 'card' }, [el('h2', { text: 'Players' })]);
  state.data.players.forEach((p) => {
    manage.appendChild(
      el('div', { class: 'name-edit-row' }, [
        el('input', {
          value: p.name,
          maxlength: '24',
          oninput: (e) => {
            p.name = e.target.value || p.name;
          },
          onchange: (e) => {
            p.name = (e.target.value || '').trim() || p.name;
            persist();
            toast('Name saved');
          },
        }),
      ])
    );
  });
  manage.appendChild(
    el('button', {
      class: 'btn secondary',
      text: '+ Add player',
      onclick: () => {
        state.data.players.push({ id: genId(), name: 'Player ' + (state.data.players.length + 1) });
        persist();
        renderHistory();
      },
    })
  );

  manage.appendChild(el('h3', { text: 'Backup' }));
  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json',
    style: 'display:none',
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const imported = await importDataFromFile(file);
        state.data = imported;
        state.aId = state.data.players[0].id;
        state.bId = state.data.players[1] ? state.data.players[1].id : state.data.players[0].id;
        state.game = null;
        persist();
        toast('Data imported');
        renderHistory();
      } catch (err) {
        toast('Import failed: ' + err.message);
      }
    },
  });
  manage.appendChild(
    el('div', { class: 'data-buttons' }, [
      el('button', { class: 'btn secondary', text: '⬇ Export', onclick: () => exportData(state.data) }),
      el('button', { class: 'btn secondary', text: '⬆ Import', onclick: () => fileInput.click() }),
    ])
  );
  manage.appendChild(fileInput);
  panel.appendChild(manage);

  // Games list
  const games = state.data.games.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const listCard = el('div', { class: 'card' }, [
    el('h2', { text: `Game history (${games.length})` }),
  ]);

  if (games.length === 0) {
    listCard.appendChild(el('div', { class: 'muted', text: 'No games recorded yet.' }));
  } else {
    games.forEach((g) => listCard.appendChild(historyItem(g)));
    listCard.appendChild(
      el('button', {
        class: 'btn danger',
        text: 'Clear all games',
        onclick: () => {
          if (confirm('Delete ALL recorded games? This cannot be undone (export first to keep a backup).')) {
            state.data.games = [];
            persist();
            renderHistory();
          }
        },
      })
    );
  }
  panel.appendChild(listCard);
}

function historyItem(g) {
  const ties = g.rounds.filter((r) => r.result === 'tie').length;
  const d = new Date(g.date);
  const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const deciding = g.rounds[g.rounds.length - 1];
  const decidingStr = deciding
    ? `${THROW_EMOJI[deciding.aThrow]} ${THROW_LABEL[deciding.aThrow]} vs ${THROW_EMOJI[deciding.bThrow]} ${THROW_LABEL[deciding.bThrow]}`
    : '';

  return el('div', { class: 'history-item' }, [
    el('div', { class: 'row1' }, [
      el('span', { class: 'winner', text: '🏆 ' + playerName(g.winnerId) }),
      el('button', {
        class: 'del',
        text: '🗑',
        title: 'Delete this game',
        onclick: () => {
          state.data.games = state.data.games.filter((x) => x.id !== g.id);
          persist();
          renderHistory();
        },
      }),
    ]),
    el('div', { class: 'meta', text: `${dateStr} · ${g.rounds.length} round${g.rounds.length === 1 ? '' : 's'} · ${ties} tie${ties === 1 ? '' : 's'}` }),
    el('div', { class: 'throws', text: 'Decided by: ' + decidingStr }),
  ]);
}

// ---------------- boot ----------------
render();

// Register a tiny service worker for offline use, if available.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
