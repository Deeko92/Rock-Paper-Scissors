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
  // History-screen state:
  historyView: 'calendar', // 'calendar' | 'list'
  calCursor: null,         // Date for the first of the month being viewed
  selectedDay: null,       // 'YYYY-MM-DD' of the opened day, or null
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

function playerEmoji(id) {
  const p = state.data.players.find((x) => x.id === id);
  return p && p.emoji ? p.emoji : '';
}

// "🦊 Chris" for display headers and banners.
function playerLabel(id) {
  const e = playerEmoji(id);
  return (e ? e + ' ' : '') + playerName(id);
}

function getSetting(key) {
  return state.data.settings ? state.data.settings[key] : undefined;
}

// Emoji choices for the per-player picker (superset of the defaults).
const EMOJI_CHOICES = [
  '🦊', '🐼', '🐯', '🐸', '🦁', '🐵', '🐺', '🦄', '🐶', '🐱', '🐮', '🐷',
  '🐔', '🐧', '🦋', '🐙', '🦖', '🤖', '👽', '😎', '🔥', '⭐', '👑', '💎',
];

const TAUNTS = [
  '{name} reigns supreme! 👑',
  'Bow before {name}.',
  '{name} called it.',
  'Was that even close?',
  '{name} is on another level.',
  'Better luck next time!',
  'GG — {name} takes it.',
  'Textbook. {name} wins.',
  '{name} reads minds, apparently.',
  'Total domination by {name}.',
];
function randomTaunt(id) {
  const t = TAUNTS[(Math.random() * TAUNTS.length) | 0];
  return t.replace('{name}', playerName(id));
}

// Dependency-free confetti burst on a throwaway full-screen canvas.
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#0ea5e9', '#f97316', '#a855f7', '#22c55e', '#eab308', '#ef4444', '#ec4899'];
  const parts = [];
  for (let i = 0; i < 130; i++) {
    parts.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      r: 4 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0],
      vx: -2.5 + Math.random() * 5,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
    });
  }
  const start = performance.now();
  const duration = 1800;
  function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

// Short ascending victory chime via WebAudio (no asset files). Respects the
// sound setting. The submit tap is the user gesture that unlocks audio.
function playWinSound() {
  if (!getSetting('sound')) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ac.destination);
      const t0 = ac.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    });
    setTimeout(() => ac.close(), 900);
  } catch (e) {
    /* audio not available — ignore */
  }
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
    launchConfetti();
    playWinSound();
  }
  renderPlay();
}

function renderPlay() {
  startGameIfNeeded();
  const panel = document.getElementById('tab-play');
  panel.innerHTML = '';

  const g = state.game;
  const aName = playerLabel(state.aId);
  const bName = playerLabel(state.bId);

  // Player pickers (only changeable before the game has any rounds).
  const pickerLocked = g.rounds.length > 0 && !g.over;
  const makeSelect = (cur, onChange) =>
    el(
      'select',
      { onchange: (e) => onChange(e.target.value), ...(pickerLocked ? { disabled: 'disabled' } : {}) },
      state.data.players.map((p) =>
        el('option', { value: p.id, ...(p.id === cur ? { selected: 'selected' } : {}) }, `${p.emoji ? p.emoji + ' ' : ''}${p.name}`)
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
        el('div', { class: 'big', text: playerLabel(g.winnerId) }),
        el('div', {
          class: 'muted',
          text: `${g.rounds.length} round${g.rounds.length === 1 ? '' : 's'}` +
            (ties ? ` · ${ties} tie${ties === 1 ? '' : 's'}` : ''),
        }),
        el('div', { class: 'taunt', text: randomTaunt(g.winnerId) }),
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

  // Achievements
  panel.appendChild(achievementsCard(s));

  // Per-player cards
  for (const p of s.playerList) {
    if (p.gamesPlayed === 0 && p.totalThrows === 0) continue;
    panel.appendChild(playerCard(p));
  }
}

function achievementsCard(s) {
  const ach = computeAchievements(state.data, s);
  const card = el('div', { class: 'card' }, [el('h2', { text: '🏅 Achievements' })]);
  for (const p of s.playerList) {
    if (p.gamesPlayed === 0 && p.totalThrows === 0) continue;
    const list = ach.byPlayer[p.id] || [];
    const earned = list.filter((a) => a.earned);
    const locked = list.filter((a) => !a.earned);
    const block = el('div', { class: 'ach-player' }, [
      el('div', { class: 'ach-name' }, [
        el('span', { text: `${playerEmoji(p.id) ? playerEmoji(p.id) + ' ' : ''}${p.name}` }),
        el('span', { class: 'ach-count', text: `${earned.length}/${ach.total}` }),
      ]),
    ]);
    block.appendChild(
      earned.length
        ? el('div', { class: 'ach-chips' }, earned.map((a) =>
            el('span', { class: 'ach-chip', title: a.desc, text: `${a.emoji} ${a.label}` })))
        : el('div', { class: 'muted', text: 'None yet — go win some games!' })
    );
    if (locked.length) {
      block.appendChild(el('div', { class: 'ach-chips' }, locked.map((a) =>
        el('span', { class: 'ach-chip locked', title: a.desc, text: `${a.emoji} ${a.label}` }))));
    }
    card.appendChild(block);
  }
  return card;
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
    const label = `${playerEmoji(p.id) ? playerEmoji(p.id) + ' ' : ''}${p.name}`;
    card.appendChild(kv(label, `${p.wins}–${p.losses}  ·  ${p.winPct}%  ·  streak ${p.currentStreak} (best ${p.longestStreak})`));
  }
  return card;
}

function playerCard(p) {
  const card = el('div', { class: 'card' }, [
    el('h2', { text: `${playerEmoji(p.id) ? playerEmoji(p.id) + ' ' : ''}${p.name}` }),
  ]);

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
        el('select', {
          class: 'emoji-select',
          title: 'Choose emoji',
          onchange: (e) => { p.emoji = e.target.value; persist(); render(); },
        }, EMOJI_CHOICES.map((em) =>
          el('option', { value: em, ...(em === p.emoji ? { selected: 'selected' } : {}) }, em)
        )),
        el('input', {
          type: 'color',
          class: 'color-input',
          value: p.color || '#0ea5e9',
          title: 'Player color',
          oninput: (e) => { p.color = e.target.value; },
          onchange: (e) => { p.color = e.target.value; persist(); render(); },
        }),
        el('input', {
          class: 'name-input',
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
        el('button', {
          class: 'del-player',
          text: '🗑',
          title: 'Delete player',
          onclick: () => deletePlayer(p),
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

  manage.appendChild(el('h3', { text: 'Options' }));
  manage.appendChild(
    el('button', {
      class: 'btn secondary',
      text: `${getSetting('sound') ? '🔊' : '🔇'} Win sound: ${getSetting('sound') ? 'On' : 'Off'}`,
      onclick: () => {
        state.data.settings.sound = !getSetting('sound');
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

  // No games yet → nothing more to show.
  if (state.data.games.length === 0) {
    panel.appendChild(el('div', { class: 'card muted center' }, 'No games recorded yet. Play a game!'));
    return;
  }

  // View toggle: calendar vs list.
  const toggleCard = el('div', { class: 'card' }, [
    el('div', { class: 'view-toggle' }, [
      el('button', {
        class: 'toggle-btn' + (state.historyView === 'calendar' ? ' active' : ''),
        text: '📅 Calendar',
        onclick: () => { state.historyView = 'calendar'; renderHistory(); },
      }),
      el('button', {
        class: 'toggle-btn' + (state.historyView === 'list' ? ' active' : ''),
        text: '📋 List',
        onclick: () => { state.historyView = 'list'; renderHistory(); },
      }),
    ]),
  ]);
  panel.appendChild(toggleCard);

  if (state.historyView === 'calendar') {
    panel.appendChild(calendarCard());
    const byDay = gamesByDay();
    if (state.selectedDay && byDay[state.selectedDay]) {
      panel.appendChild(dayDetailCard(state.selectedDay, byDay[state.selectedDay]));
    }
  } else {
    panel.appendChild(listCard());
  }
}

// All games for one calendar day, in time order.
function gamesByDay() {
  const map = {};
  for (const g of state.data.games) {
    const key = dateKey(new Date(g.date));
    (map[key] = map[key] || []).push(g);
  }
  for (const k of Object.keys(map)) map[k].sort((a, b) => (a.date < b.date ? -1 : 1));
  return map;
}

function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Per-player color: their chosen color, falling back to a palette by index.
const PLAYER_PALETTE = ['#0ea5e9', '#f97316', '#a855f7', '#22c55e', '#eab308', '#ef4444', '#14b8a6', '#ec4899'];
function playerColor(id) {
  const p = state.data.players.find((x) => x.id === id);
  if (p && p.color) return p.color;
  const idx = state.data.players.findIndex((x) => x.id === id);
  return PLAYER_PALETTE[(idx < 0 ? 0 : idx) % PLAYER_PALETTE.length];
}

// Remove a player. Keeps at least 2 players, and warns before orphaning any
// games the player already appears in (those stay in history as "(removed
// player)" since stats are derived from the raw games).
function deletePlayer(p) {
  if (state.data.players.length <= 2) {
    toast('You need at least 2 players');
    return;
  }
  const gameCount = state.data.games.filter(
    (g) => g.playerIds.includes(p.id) || g.winnerId === p.id
  ).length;
  if (gameCount > 0) {
    const ok = confirm(
      `${p.name} has ${gameCount} recorded game${gameCount === 1 ? '' : 's'}. ` +
      'Delete this player anyway? Their past games stay in history but will show as "(removed player)".'
    );
    if (!ok) return;
  }
  state.data.players = state.data.players.filter((x) => x.id !== p.id);
  // Fix up Play-screen selections if they pointed at the deleted player.
  if (state.aId === p.id || state.bId === p.id) {
    state.aId = state.data.players[0].id;
    state.bId = state.data.players[1] ? state.data.players[1].id : state.data.players[0].id;
    state.game = null;
  }
  persist();
  toast('Player deleted');
  renderHistory();
}

function listCard() {
  const games = state.data.games.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const card = el('div', { class: 'card' }, [el('h2', { text: `Game history (${games.length})` })]);
  games.forEach((g) => card.appendChild(historyItem(g)));
  card.appendChild(
    el('button', {
      class: 'btn danger',
      text: 'Clear all games',
      onclick: () => {
        if (confirm('Delete ALL recorded games? This cannot be undone (export first to keep a backup).')) {
          state.data.games = [];
          state.selectedDay = null;
          persist();
          renderHistory();
        }
      },
    })
  );
  return card;
}

// Month grid; each day with games shows a colored dot per game (by winner) and
// opens that day's games when tapped.
function calendarCard() {
  if (!state.calCursor) {
    const now = new Date();
    state.calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const year = state.calCursor.getFullYear();
  const month = state.calCursor.getMonth();
  const byDay = gamesByDay();
  const todayKey = dateKey(new Date());

  const card = el('div', { class: 'card' });

  const gotoMonth = (delta) => {
    state.calCursor = new Date(year, month + delta, 1);
    state.selectedDay = null;
    renderHistory();
  };
  card.appendChild(
    el('div', { class: 'cal-nav' }, [
      el('button', { class: 'cal-arrow', text: '‹', onclick: () => gotoMonth(-1) }),
      el('div', { class: 'cal-title', text: state.calCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }),
      el('button', { class: 'cal-arrow', text: '›', onclick: () => gotoMonth(1) }),
    ])
  );

  const dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  card.appendChild(el('div', { class: 'cal-grid cal-dow' }, dow.map((d) => el('div', { class: 'cal-dow-cell', text: d }))));

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(el('div', { class: 'cal-cell empty' }));

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayGames = byDay[key] || [];
    const classes = ['cal-cell'];
    if (dayGames.length) classes.push('has-games');
    if (key === todayKey) classes.push('today');
    if (key === state.selectedDay) classes.push('selected');

    const children = [el('div', { class: 'cal-day-num', text: String(d) })];
    if (dayGames.length) {
      const dots = el('div', { class: 'cal-dots' });
      const cap = 4;
      dayGames.slice(0, cap).forEach((g) =>
        dots.appendChild(el('span', { class: 'cal-dot', style: `background:${playerColor(g.winnerId)}` }))
      );
      if (dayGames.length > cap) dots.appendChild(el('span', { class: 'cal-more', text: `+${dayGames.length - cap}` }));
      children.push(dots);
    }

    const cell = el('div', { class: classes.join(' ') }, children);
    if (dayGames.length) {
      cell.addEventListener('click', () => {
        state.selectedDay = state.selectedDay === key ? null : key;
        renderHistory();
      });
    }
    cells.push(cell);
  }
  card.appendChild(el('div', { class: 'cal-grid' }, cells));

  // Color key, limited to players who have actually won games.
  const winners = new Set(state.data.games.map((g) => g.winnerId));
  const legendItems = state.data.players
    .filter((p) => winners.has(p.id))
    .map((p) =>
      el('span', { class: 'cal-legend-item' }, [
        el('span', { class: 'cal-dot', style: `background:${playerColor(p.id)}` }),
        el('span', { text: `${p.emoji ? p.emoji + ' ' : ''}${p.name}` }),
      ])
    );
  if (legendItems.length) card.appendChild(el('div', { class: 'cal-legend' }, legendItems));

  return card;
}

// One opened day: each game with its round-by-round replay.
function dayDetailCard(key, dayGames) {
  const card = el('div', { class: 'card' });
  const dateLabel = new Date(dayGames[0].date).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  card.appendChild(
    el('div', { class: 'day-detail-head' }, [
      el('h2', { text: dateLabel }),
      el('button', { class: 'day-close', text: '✕', title: 'Close', onclick: () => { state.selectedDay = null; renderHistory(); } }),
    ])
  );
  card.appendChild(el('div', { class: 'muted', text: `${dayGames.length} game${dayGames.length === 1 ? '' : 's'} this day` }));

  dayGames.forEach((g) => {
    const ties = g.rounds.filter((r) => r.result === 'tie').length;
    const time = new Date(g.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    card.appendChild(
      el('div', { class: 'day-game' }, [
        el('div', { class: 'day-game-head' }, [
          el('span', { class: 'winner', text: '🏆 ' + playerLabel(g.winnerId) }),
          el('span', { class: 'meta', text: `${time} · ${g.rounds.length} round${g.rounds.length === 1 ? '' : 's'} · ${ties} tie${ties === 1 ? '' : 's'}` }),
        ]),
        roundLog(g),
      ])
    );
  });
  return card;
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
      el('span', { class: 'winner', text: '🏆 ' + playerLabel(g.winnerId) }),
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
