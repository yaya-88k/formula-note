// Custom on-screen keyboard with 3 swipeable pages.
// Each button responds to: tap (main), swipe-up (top label), swipe-down (bottom label).
// Horizontal swipe on the keyboard area changes pages.

const PAGES = ['num', 'var', 'fn'];

// Each button: { tap, up?, down?, label?, type? }
// label defaults to `tap`. type 'wide' makes the button span more.
const NUM_PAGE = [
  [
    { tap: '7' }, { tap: '8' }, { tap: '9' },
    { tap: '⌫', action: 'backspace' }, { tap: 'AC', action: 'clear' },
  ],
  [
    { tap: '4' }, { tap: '5' }, { tap: '6' },
    { tap: '(' }, { tap: ')' },
  ],
  [
    { tap: '1' }, { tap: '2' }, { tap: '3' },
    { tap: '×', insert: '*' }, { tap: '÷', insert: '/' },
  ],
  [
    { tap: '0' }, { tap: '.' }, { tap: ',' },
    { tap: '+' }, { tap: '-' },
  ],
  [
    { tap: '=' }, { tap: '%' }, { tap: 'mod', insert: ' mod ' },
    { tap: 'Ans', insert: 'ans' }, { tap: '↵', action: 'enter' },
  ],
];

// Function page with up/down swipe alternates.
const FN_PAGE = [
  [
    { tap: 'sin', up: 'asin', down: 'sinh', insertFn: true },
    { tap: 'cos', up: 'acos', down: 'cosh', insertFn: true },
    { tap: 'tan', up: 'atan', down: 'tanh', insertFn: true },
    { tap: '⌫', action: 'backspace' },
    { tap: '^' },
  ],
  [
    { tap: 'log', up: 'log2', down: 'ln', insertFn: true },
    { tap: 'exp', insertFn: true },
    { tap: 'mod', insert: ' mod ' },
    { tap: '(' },
    { tap: ')' },
  ],
  [
    { tap: 'round', up: 'rhup', down: 'rdown', insertFn: true },
    { tap: 'ceil', up: 'rup', insertFn: true },
    { tap: 'floor', insertFn: true },
    { tap: '!' },
    { tap: 'π', insert: 'π' },
  ],
  [
    { tap: 'abs', insertFn: true },
    { tap: '√', down: 'cbrt', insert: 'sqrt(', downInsert: 'cbrt(' },
    { tap: 'e', insert: 'e' },
    { tap: '←', action: 'cursorLeft' },
    { tap: '→', action: 'cursorRight' },
  ],
];

export class Keyboard {
  constructor(container, actions, options) {
    this.container = container;
    this.actions = actions; // { insert, backspace, clear, enter, cursorLeft, cursorRight, abc, hide, addVariable, removeVariable }
    this.options = options || {};
    this.getVariables = options.getVariables || (() => []);
    this.currentPage = 0;
    this.swipeStart = null;
    this.activeBtn = null;

    this.render();
    this.attachContainerGestures();
  }

  render() {
    this.container.innerHTML = `
      <div class="kb-tabbar">
        <div class="kb-tabs">
          <button class="kb-tab" data-page="0">123</button>
          <button class="kb-tab" data-page="1">変数</button>
          <button class="kb-tab" data-page="2">f(x)</button>
        </div>
        <button class="kb-abc" data-action="abc">ABC</button>
        <button class="kb-hide" data-action="hide" aria-label="キーボードを閉じる">⌨︎▾</button>
      </div>
      <div class="kb-pages">
        <div class="kb-page" data-page="0"></div>
        <div class="kb-page" data-page="1"></div>
        <div class="kb-page" data-page="2"></div>
      </div>
    `;

    this.tabbarEl = this.container.querySelector('.kb-tabbar');
    this.pagesEl = this.container.querySelector('.kb-pages');
    this.pageEls = this.container.querySelectorAll('.kb-page');

    this.renderPage(0, NUM_PAGE);
    this.renderVarPage();
    this.renderPage(2, FN_PAGE);

    this.container.querySelectorAll('.kb-tab').forEach(btn => {
      btn.addEventListener('click', () => this.setPage(parseInt(btn.dataset.page)));
    });

    this.container.querySelector('.kb-abc').addEventListener('click', () => {
      this.actions.abc && this.actions.abc();
    });
    this.container.querySelector('.kb-hide').addEventListener('click', () => {
      this.actions.hide && this.actions.hide();
    });

    this.setPage(0);
  }

  renderPage(pageIdx, layout) {
    const pageEl = this.pageEls[pageIdx];
    pageEl.innerHTML = '';
    for (const row of layout) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      for (const cell of row) {
        rowEl.appendChild(this.createButton(cell));
      }
      pageEl.appendChild(rowEl);
    }
  }

  renderVarPage() {
    const pageEl = this.pageEls[1];
    pageEl.innerHTML = '';
    const variables = this.getVariables();

    // Layout: 5 columns per row, with [+ 追加] button always last
    const cells = variables.map(name => ({
      tap: name,
      insert: name,
      varName: name,
    }));
    cells.push({ tap: '＋', action: 'addVariable' });

    // Add backspace and cursor controls in the last row similar to other pages
    const trailing = [
      { tap: '⌫', action: 'backspace' },
      { tap: '←', action: 'cursorLeft' },
      { tap: '→', action: 'cursorRight' },
    ];

    const cols = 5;
    // Build rows: first fill variable cells + add button, then ensure trailing row
    const allCells = [...cells];
    while (allCells.length % cols !== 0) {
      allCells.push({ tap: '', spacer: true });
    }
    // Insert a separator row with cursor controls
    const rows = [];
    for (let i = 0; i < allCells.length; i += cols) {
      rows.push(allCells.slice(i, i + cols));
    }
    // Ensure at least one row of controls at bottom
    rows.push([
      { tap: '', spacer: true },
      { tap: '', spacer: true },
      ...trailing,
    ]);

    for (const row of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      for (const cell of row) {
        rowEl.appendChild(this.createButton(cell));
      }
      pageEl.appendChild(rowEl);
    }
  }

  createButton(cell) {
    const btn = document.createElement('div');
    btn.className = 'kb-btn';
    if (cell.spacer) { btn.classList.add('kb-spacer'); return btn; }
    if (cell.action) btn.classList.add('kb-btn-action');

    if (cell.up) {
      const sub = document.createElement('span');
      sub.className = 'kb-alt kb-alt-up';
      sub.textContent = cell.up;
      btn.appendChild(sub);
    }
    const main = document.createElement('span');
    main.className = 'kb-main';
    main.textContent = cell.label || cell.tap;
    btn.appendChild(main);
    if (cell.down) {
      const sub = document.createElement('span');
      sub.className = 'kb-alt kb-alt-down';
      sub.textContent = cell.down;
      btn.appendChild(sub);
    }

    btn._cell = cell;
    this.attachButtonGestures(btn);
    return btn;
  }

  attachButtonGestures(btn) {
    let startX = 0, startY = 0, startT = 0, moved = false, fired = false;
    const THRESHOLD_TAP = 12;
    const THRESHOLD_SWIPE = 28;
    const THRESHOLD_PAGE = 55;

    const onStart = (x, y) => {
      startX = x; startY = y; startT = Date.now();
      moved = false; fired = false;
      btn.classList.add('kb-btn-pressed');
    };
    const onEnd = (x, y, cancel) => {
      btn.classList.remove('kb-btn-pressed');
      if (fired || cancel) return;
      const dx = x - startX;
      const dy = y - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);

      // Horizontal swipe → let container handle page change
      if (adx > THRESHOLD_PAGE && adx > ady * 1.5) {
        this.handlePageSwipe(dx);
        fired = true;
        return;
      }
      // Vertical swipe for alternates
      if (ady > THRESHOLD_SWIPE && ady > adx * 1.3) {
        if (dy < 0) this.fireButton(btn, 'up');
        else this.fireButton(btn, 'down');
        fired = true;
        return;
      }
      // Tap
      if (adx < THRESHOLD_TAP && ady < THRESHOLD_TAP) {
        this.fireButton(btn, 'tap');
        fired = true;
      }
    };

    btn.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    btn.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      onEnd(t.clientX, t.clientY, false);
    });
    btn.addEventListener('touchcancel', () => onEnd(0, 0, true));

    // Mouse support for desktop testing
    btn.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    btn.addEventListener('mouseup', (e) => onEnd(e.clientX, e.clientY, false));
    btn.addEventListener('mouseleave', () => onEnd(0, 0, true));

    // Long-press on variable buttons → remove
    let lpTimer = null;
    btn.addEventListener('touchstart', () => {
      if (btn._cell && btn._cell.varName) {
        lpTimer = setTimeout(() => {
          this.actions.removeVariable && this.actions.removeVariable(btn._cell.varName);
          fired = true;
        }, 600);
      }
    }, { passive: true });
    const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    btn.addEventListener('touchend', cancelLP);
    btn.addEventListener('touchmove', cancelLP);
    btn.addEventListener('touchcancel', cancelLP);
  }

  fireButton(btn, direction) {
    const cell = btn._cell;
    if (!cell) return;
    let text = null;
    let action = null;

    if (direction === 'up' && cell.up) {
      text = cell.insertFn ? cell.up + '(' : (cell.upInsert || cell.up);
    } else if (direction === 'down' && cell.down) {
      text = cell.insertFn ? cell.down + '(' : (cell.downInsert || cell.down);
    } else {
      // tap
      if (cell.action) {
        action = cell.action;
      } else if (cell.insertFn) {
        text = cell.tap + '(';
      } else if (cell.insert !== undefined) {
        text = cell.insert;
      } else {
        text = cell.tap;
      }
    }

    if (action) {
      const fn = this.actions[action];
      if (fn) fn();
      return;
    }
    if (text !== null) {
      this.actions.insert && this.actions.insert(text);
    }
  }

  attachContainerGestures() {
    // Track swipes on the pages area for page change
    let sx = 0, sy = 0, tracking = false;
    this.pagesEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; tracking = true;
    }, { passive: true });
    this.pagesEl.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      // Only handle if it wasn't already caught by a button
      // (buttons set their own page swipe via handlePageSwipe; this is a fallback for empty area)
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        this.handlePageSwipe(dx);
      }
    });
  }

  handlePageSwipe(dx) {
    if (dx < 0) this.setPage(Math.min(this.currentPage + 1, PAGES.length - 1));
    else this.setPage(Math.max(this.currentPage - 1, 0));
  }

  setPage(idx) {
    this.currentPage = idx;
    this.pageEls.forEach((el, i) => {
      el.classList.toggle('kb-page-active', i === idx);
    });
    this.container.querySelectorAll('.kb-tab').forEach(t => {
      t.classList.toggle('kb-tab-active', parseInt(t.dataset.page) === idx);
    });
    if (idx === 1) this.renderVarPage();
  }

  refreshVariables() {
    if (this.currentPage === 1) this.renderVarPage();
  }
}
