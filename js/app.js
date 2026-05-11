// FormulaNote main app

import { evaluateLine, evaluateLines, extractVariableNames } from './parser.js';
import * as Storage from './storage.js';
import { formatNumber } from './format.js';
import { Keyboard } from './keyboard.js';

const state = {
  notes: [],
  activeId: null,
  settings: Storage.loadSettings(),
  // Track which line input is focused
  focusedIndex: 0,
  // Keep cursor position for the focused input
  cursorPos: 0,
  keyboardVisible: true,
};

function activeNote() {
  return state.notes.find(n => n.id === state.activeId);
}

function init() {
  state.notes = Storage.loadAllNotes();
  if (state.notes.length === 0) {
    const n = Storage.createNote('メモ1');
    n.lines = [''];
    state.notes.push(n);
    state.activeId = n.id;
    persistNotes();
  } else {
    state.activeId = Storage.getActiveNoteId() || state.notes[0].id;
    if (!activeNote()) state.activeId = state.notes[0].id;
  }
  applyTheme();
  renderApp();
  setupKeyboard();
  bindHeader();
  bindMenu();
  bindSettings();
  registerServiceWorker();
}

function persistNotes() {
  const note = activeNote();
  if (note) note.updatedAt = Date.now();
  Storage.saveAllNotes(state.notes);
  Storage.setActiveNoteId(state.activeId);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme || 'light';
}

// ---------- Rendering ----------
function renderApp() {
  const note = activeNote();
  if (!note) return;
  document.getElementById('note-title').textContent = note.title;
  renderLines();
}

function renderLines() {
  const note = activeNote();
  const container = document.getElementById('lines');
  container.innerHTML = '';
  const results = evaluateLines(note.lines);

  note.lines.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className = 'line';
    row.dataset.index = idx;

    const num = document.createElement('div');
    num.className = 'line-num';
    num.textContent = idx + 1;
    row.appendChild(num);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'line-input';
    input.value = line;
    input.inputMode = 'none'; // suppress OS keyboard by default
    input.autocapitalize = 'none';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.index = idx;
    input.addEventListener('focus', (e) => onLineFocus(idx, e));
    input.addEventListener('input', () => onLineInput(idx, input));
    input.addEventListener('keydown', (e) => onLineKeyDown(idx, input, e));
    input.addEventListener('select', () => onLineSelect(idx, input));
    input.addEventListener('click', () => onLineSelect(idx, input));
    row.appendChild(input);

    const result = document.createElement('div');
    result.className = 'line-result';
    const r = results[idx];
    if (r.empty) {
      result.textContent = '';
    } else if (!r.ok) {
      result.textContent = 'エラー';
      result.classList.add('line-result-error');
      result.title = r.error;
    } else {
      result.textContent = formatNumber(r.result, state.settings);
      if (r.assigned) result.classList.add('line-result-assigned');
    }
    row.appendChild(result);

    container.appendChild(row);
  });

  // Focus the previously focused line if possible
  const inputs = container.querySelectorAll('.line-input');
  const focusIdx = Math.min(state.focusedIndex, inputs.length - 1);
  if (focusIdx >= 0 && inputs[focusIdx]) {
    inputs[focusIdx].focus();
    const pos = Math.min(state.cursorPos, inputs[focusIdx].value.length);
    inputs[focusIdx].setSelectionRange(pos, pos);
  }

  // After lines render, update variables from any IDENT = ... lines.
  syncAutoVariables();
  refreshKeyboardVariables();
}

function syncAutoVariables() {
  const note = activeNote();
  const detected = extractVariableNames(note.lines);
  let changed = false;
  for (const name of detected) {
    if (!note.variables.includes(name)) {
      note.variables.push(name);
      changed = true;
    }
  }
  if (changed) Storage.saveAllNotes(state.notes);
}

// ---------- Line input handlers ----------
function onLineFocus(idx, e) {
  state.focusedIndex = idx;
  const inp = e.target;
  state.cursorPos = inp.selectionStart ?? inp.value.length;
}

function onLineSelect(idx, input) {
  state.focusedIndex = idx;
  state.cursorPos = input.selectionStart ?? input.value.length;
}

function onLineInput(idx, input) {
  const note = activeNote();
  note.lines[idx] = input.value;
  state.cursorPos = input.selectionStart ?? input.value.length;
  persistNotes();
  // re-render results but preserve focus & cursor
  rerenderResults();
}

function onLineKeyDown(idx, input, e) {
  const note = activeNote();
  if (e.key === 'Enter') {
    e.preventDefault();
    // Split line at cursor and insert new line
    const cursorPos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, cursorPos);
    const after = input.value.slice(cursorPos);
    note.lines[idx] = before;
    note.lines.splice(idx + 1, 0, after);
    state.focusedIndex = idx + 1;
    state.cursorPos = 0;
    persistNotes();
    renderLines();
  } else if (e.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0 && idx > 0) {
    e.preventDefault();
    // Merge with previous line
    const prev = note.lines[idx - 1];
    const cur = note.lines[idx];
    note.lines[idx - 1] = prev + cur;
    note.lines.splice(idx, 1);
    state.focusedIndex = idx - 1;
    state.cursorPos = prev.length;
    persistNotes();
    renderLines();
  } else if (e.key === 'ArrowUp' && idx > 0) {
    e.preventDefault();
    state.focusedIndex = idx - 1;
    state.cursorPos = Math.min(state.cursorPos, note.lines[idx - 1].length);
    renderLines();
  } else if (e.key === 'ArrowDown' && idx < note.lines.length - 1) {
    e.preventDefault();
    state.focusedIndex = idx + 1;
    state.cursorPos = Math.min(state.cursorPos, note.lines[idx + 1].length);
    renderLines();
  }
}

// Re-evaluate results without rebuilding inputs (preserves focus/cursor)
function rerenderResults() {
  const note = activeNote();
  const results = evaluateLines(note.lines);
  const resultEls = document.querySelectorAll('#lines .line-result');
  resultEls.forEach((el, idx) => {
    const r = results[idx];
    el.classList.remove('line-result-error', 'line-result-assigned');
    if (!r || r.empty) {
      el.textContent = '';
      el.title = '';
    } else if (!r.ok) {
      el.textContent = 'エラー';
      el.classList.add('line-result-error');
      el.title = r.error;
    } else {
      el.textContent = formatNumber(r.result, state.settings);
      if (r.assigned) el.classList.add('line-result-assigned');
      el.title = '';
    }
  });
  syncAutoVariables();
}

// ---------- Keyboard wiring ----------
let keyboard = null;
function setupKeyboard() {
  const container = document.getElementById('keyboard');
  keyboard = new Keyboard(container, {
    insert: (text) => insertAtCursor(text),
    backspace: () => backspaceAtCursor(),
    clear: () => clearCurrentLine(),
    enter: () => insertNewLine(),
    cursorLeft: () => moveCursor(-1),
    cursorRight: () => moveCursor(1),
    abc: () => switchToOSKeyboard(),
    hide: () => hideKeyboard(),
    addVariable: () => addVariable(),
    removeVariable: (name) => removeVariable(name),
  }, {
    getVariables: () => (activeNote()?.variables || []),
  });
}

function getFocusedInput() {
  const inputs = document.querySelectorAll('#lines .line-input');
  const idx = Math.min(state.focusedIndex, inputs.length - 1);
  return inputs[idx] || null;
}

function insertAtCursor(text) {
  const input = getFocusedInput();
  if (!input) return;
  // If currently OS keyboard mode, switch back
  if (input.inputMode !== 'none') input.inputMode = 'none';
  input.focus();
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const v = input.value;
  input.value = v.slice(0, start) + text + v.slice(end);
  const newPos = start + text.length;
  input.setSelectionRange(newPos, newPos);
  state.cursorPos = newPos;
  // Dispatch input event to trigger our handler
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function backspaceAtCursor() {
  const input = getFocusedInput();
  if (!input) return;
  input.focus();
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  if (start === end) {
    if (start === 0) {
      // Merge into previous line
      const idx = state.focusedIndex;
      const note = activeNote();
      if (idx > 0) {
        const prev = note.lines[idx - 1];
        const cur = note.lines[idx];
        note.lines[idx - 1] = prev + cur;
        note.lines.splice(idx, 1);
        state.focusedIndex = idx - 1;
        state.cursorPos = prev.length;
        persistNotes();
        renderLines();
      }
      return;
    }
    input.value = input.value.slice(0, start - 1) + input.value.slice(start);
    input.setSelectionRange(start - 1, start - 1);
    state.cursorPos = start - 1;
  } else {
    input.value = input.value.slice(0, start) + input.value.slice(end);
    input.setSelectionRange(start, start);
    state.cursorPos = start;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function clearCurrentLine() {
  const input = getFocusedInput();
  if (!input) return;
  input.value = '';
  input.setSelectionRange(0, 0);
  state.cursorPos = 0;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertNewLine() {
  const note = activeNote();
  const idx = state.focusedIndex;
  const input = getFocusedInput();
  if (!input) return;
  const pos = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, pos);
  const after = input.value.slice(pos);
  note.lines[idx] = before;
  note.lines.splice(idx + 1, 0, after);
  state.focusedIndex = idx + 1;
  state.cursorPos = 0;
  persistNotes();
  renderLines();
}

function moveCursor(delta) {
  const input = getFocusedInput();
  if (!input) return;
  input.focus();
  const pos = input.selectionStart ?? 0;
  const note = activeNote();
  let newPos = pos + delta;
  let newIdx = state.focusedIndex;
  if (newPos < 0 && newIdx > 0) {
    newIdx -= 1;
    newPos = note.lines[newIdx].length;
  } else if (newPos > input.value.length && newIdx < note.lines.length - 1) {
    newIdx += 1;
    newPos = 0;
  } else {
    newPos = Math.max(0, Math.min(newPos, input.value.length));
  }
  state.focusedIndex = newIdx;
  state.cursorPos = newPos;
  if (newIdx !== state.focusedIndex || newIdx !== parseInt(input.dataset.index)) {
    renderLines();
  } else {
    input.setSelectionRange(newPos, newPos);
  }
  // re-fetch input after possible rerender
  const newInput = getFocusedInput();
  if (newInput) {
    newInput.focus();
    newInput.setSelectionRange(newPos, newPos);
  }
}

function switchToOSKeyboard() {
  const input = getFocusedInput();
  if (!input) return;
  input.inputMode = 'text';
  input.focus();
  // Hide custom keyboard to give space
  document.getElementById('keyboard').classList.add('kb-hidden');
}

function hideKeyboard() {
  document.getElementById('keyboard').classList.add('kb-hidden');
  state.keyboardVisible = false;
}

function showKeyboard() {
  document.getElementById('keyboard').classList.remove('kb-hidden');
  state.keyboardVisible = true;
  const input = getFocusedInput();
  if (input) input.inputMode = 'none';
}

function addVariable() {
  const name = window.prompt('変数名を入力してください（例: price）');
  if (!name) return;
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(trimmed)) {
    alert('変数名は英字またはアンダースコアで始まり、英数字のみが使えます。');
    return;
  }
  const note = activeNote();
  if (!note.variables.includes(trimmed)) {
    note.variables.push(trimmed);
    persistNotes();
    refreshKeyboardVariables();
  }
}

function removeVariable(name) {
  if (!confirm(`変数「${name}」を一覧から削除しますか？\n(式の中の使用箇所はそのままです)`)) return;
  const note = activeNote();
  note.variables = note.variables.filter(v => v !== name);
  persistNotes();
  refreshKeyboardVariables();
}

function refreshKeyboardVariables() {
  if (keyboard) keyboard.refreshVariables();
}

// ---------- Header buttons ----------
function bindHeader() {
  document.getElementById('btn-menu').addEventListener('click', () => toggleMenu(true));
  document.getElementById('btn-add-note').addEventListener('click', () => {
    const title = `メモ${state.notes.length + 1}`;
    const n = Storage.createNote(title);
    state.notes.push(n);
    state.activeId = n.id;
    state.focusedIndex = 0;
    state.cursorPos = 0;
    persistNotes();
    renderApp();
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    persistNotes();
    flashStatus('保存しました');
  });
  document.getElementById('btn-settings').addEventListener('click', () => toggleSettings(true));

  // Show keyboard when tapping on note area while it's hidden
  document.getElementById('lines').addEventListener('click', () => {
    if (!state.keyboardVisible) showKeyboard();
  });
}

function flashStatus(text) {
  const s = document.getElementById('status');
  s.textContent = text;
  s.classList.add('status-visible');
  setTimeout(() => s.classList.remove('status-visible'), 1200);
}

// ---------- Side menu (note list) ----------
function toggleMenu(open) {
  const menu = document.getElementById('menu');
  const backdrop = document.getElementById('backdrop');
  if (open) {
    renderMenu();
    menu.classList.add('menu-open');
    backdrop.classList.add('backdrop-visible');
  } else {
    menu.classList.remove('menu-open');
    backdrop.classList.remove('backdrop-visible');
  }
}

function bindMenu() {
  document.getElementById('backdrop').addEventListener('click', () => {
    toggleMenu(false);
    toggleSettings(false);
  });
}

function renderMenu() {
  const list = document.getElementById('menu-list');
  list.innerHTML = '';
  state.notes.forEach(n => {
    const item = document.createElement('div');
    item.className = 'menu-item';
    if (n.id === state.activeId) item.classList.add('menu-item-active');

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = n.title;
    item.appendChild(title);

    const del = document.createElement('button');
    del.className = 'menu-del';
    del.textContent = '×';
    del.title = '削除';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.notes.length === 1) {
        alert('最後のメモは削除できません。');
        return;
      }
      if (!confirm(`「${n.title}」を削除しますか？`)) return;
      state.notes = state.notes.filter(x => x.id !== n.id);
      if (state.activeId === n.id) state.activeId = state.notes[0].id;
      state.focusedIndex = 0;
      state.cursorPos = 0;
      persistNotes();
      renderApp();
      renderMenu();
    });
    item.appendChild(del);

    item.addEventListener('click', () => {
      state.activeId = n.id;
      state.focusedIndex = 0;
      state.cursorPos = 0;
      persistNotes();
      renderApp();
      toggleMenu(false);
    });
    list.appendChild(item);
  });

  // Note title editor for active note
  const editor = document.getElementById('menu-title-edit');
  const activeName = activeNote()?.title || '';
  editor.value = activeName;
  editor.oninput = () => {
    const n = activeNote();
    if (n) {
      n.title = editor.value || '無題';
      persistNotes();
      document.getElementById('note-title').textContent = n.title;
    }
  };
}

// ---------- Settings panel ----------
function toggleSettings(open) {
  const panel = document.getElementById('settings-panel');
  const backdrop = document.getElementById('backdrop');
  if (open) {
    syncSettingsForm();
    panel.classList.add('settings-open');
    backdrop.classList.add('backdrop-visible');
  } else {
    panel.classList.remove('settings-open');
    backdrop.classList.remove('backdrop-visible');
  }
}

function bindSettings() {
  document.getElementById('settings-close').addEventListener('click', () => toggleSettings(false));

  document.getElementById('set-grouping').addEventListener('change', (e) => {
    state.settings.numberFormat.useGrouping = e.target.checked;
    Storage.saveSettings(state.settings);
    rerenderResults();
  });
  document.getElementById('set-trim').addEventListener('change', (e) => {
    state.settings.numberFormat.trimTrailingZeros = e.target.checked;
    Storage.saveSettings(state.settings);
    rerenderResults();
  });
  document.getElementById('set-decimals').addEventListener('input', (e) => {
    const v = Math.max(0, Math.min(15, parseInt(e.target.value) || 0));
    state.settings.numberFormat.maxDecimals = v;
    document.getElementById('set-decimals-val').textContent = v;
    Storage.saveSettings(state.settings);
    rerenderResults();
  });
  document.getElementById('set-theme').addEventListener('change', (e) => {
    state.settings.theme = e.target.value;
    Storage.saveSettings(state.settings);
    applyTheme();
  });
  document.getElementById('set-reset').addEventListener('click', () => {
    if (!confirm('設定を初期値に戻しますか？')) return;
    state.settings = Storage.getDefaultSettings();
    Storage.saveSettings(state.settings);
    syncSettingsForm();
    applyTheme();
    rerenderResults();
  });
}

function syncSettingsForm() {
  document.getElementById('set-grouping').checked = state.settings.numberFormat.useGrouping;
  document.getElementById('set-trim').checked = state.settings.numberFormat.trimTrailingZeros;
  document.getElementById('set-decimals').value = state.settings.numberFormat.maxDecimals;
  document.getElementById('set-decimals-val').textContent = state.settings.numberFormat.maxDecimals;
  document.getElementById('set-theme').value = state.settings.theme;
}

// ---------- Service Worker ----------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', init);
