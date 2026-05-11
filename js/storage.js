// localStorage wrapper for FormulaNote
// Stores notes as { id, title, lines[], variables[], updatedAt }

const KEY_NOTES = 'fn.notes.v1';
const KEY_ACTIVE = 'fn.activeNote.v1';
const KEY_SETTINGS = 'fn.settings.v1';

function uuid() {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function loadAllNotes() {
  try {
    const raw = localStorage.getItem(KEY_NOTES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllNotes(notes) {
  localStorage.setItem(KEY_NOTES, JSON.stringify(notes));
}

export function getActiveNoteId() {
  return localStorage.getItem(KEY_ACTIVE);
}

export function setActiveNoteId(id) {
  localStorage.setItem(KEY_ACTIVE, id);
}

export function createNote(title = '無題') {
  return {
    id: uuid(),
    title,
    lines: [''],
    variables: [],
    updatedAt: Date.now(),
  };
}

const DEFAULT_SETTINGS = {
  numberFormat: {
    useGrouping: true,         // thousand separator
    maxDecimals: 8,
    trimTrailingZeros: true,
  },
  theme: 'light',              // 'light' | 'dark'
  language: 'ja',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      numberFormat: { ...DEFAULT_SETTINGS.numberFormat, ...(parsed.numberFormat || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
}

export function getDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
