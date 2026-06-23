// storage.js — load/save the single localStorage blob + export/import.
// Data is the single source of truth; all stats are derived from `games`.

const STORAGE_KEY = 'rps-data';
const DATA_VERSION = 1;

function genId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function defaultData() {
  return {
    version: DATA_VERSION,
    players: [
      { id: genId(), name: 'Player 1' },
      { id: genId(), name: 'Player 2' },
    ],
    games: [],
  };
}

// Returns the saved data, or a fresh default. Repairs missing fields so older
// or hand-imported blobs don't crash the app.
function loadData() {
  let data;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Could not parse saved data, starting fresh.', e);
    data = null;
  }
  if (!data || typeof data !== 'object') data = defaultData();
  if (!Array.isArray(data.players) || data.players.length < 2) {
    data.players = defaultData().players;
  }
  if (!Array.isArray(data.games)) data.games = [];
  data.version = DATA_VERSION;
  return data;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Trigger a download of the current data as a JSON backup file.
function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `rps-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Read a user-picked JSON file and return parsed data via a promise.
function importDataFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.games)) {
          throw new Error('File does not look like an RPS backup.');
        }
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
