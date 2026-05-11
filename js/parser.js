// Expression parser for FormulaNote
// Supports: basic arithmetic, implicit multiplication, variables,
// functions (sin/cos/log/etc.), constants (π, e), mod, !, ^, %
// Comments: // to end of line

const CONSTANTS = {
  'π': Math.PI,
  pi: Math.PI,
  e: Math.E,
};

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error('factorial: 非負整数のみ');
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  log: (x) => Math.log10(x),
  log2: (x) => Math.log2(x),
  ln: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: (x) => Math.round(x),
  ceil: Math.ceil,
  floor: Math.floor,
  rhup: (x) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5),
  rup: Math.ceil,
  rdown: Math.floor,
  nPr: (n, r) => factorial(n) / factorial(n - r),
  nCr: (n, r) => factorial(n) / (factorial(r) * factorial(n - r)),
  max: Math.max,
  min: Math.min,
};

function stripComment(input) {
  const i = input.indexOf('//');
  return i >= 0 ? input.slice(0, i) : input;
}

function tokenize(input) {
  input = stripComment(input);
  const tokens = [];
  let i = 0;
  const len = input.length;
  while (i < len) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }

    // number (including leading dot)
    if (/\d/.test(c) || (c === '.' && /\d/.test(input[i + 1] || ''))) {
      let s = '';
      let dotSeen = false;
      while (i < len) {
        const ch = input[i];
        if (/\d/.test(ch)) { s += ch; i++; }
        else if (ch === '.' && !dotSeen) { s += ch; dotSeen = true; i++; }
        else break;
      }
      tokens.push({ type: 'num', value: parseFloat(s) });
      continue;
    }

    // identifier (letters, π)
    if (/[A-Za-zπ_]/.test(c)) {
      let s = '';
      while (i < len && /[A-Za-zπ_0-9]/.test(input[i])) { s += input[i++]; }
      if (s === 'mod') tokens.push({ type: 'op', value: 'mod' });
      else tokens.push({ type: 'ident', value: s });
      continue;
    }

    // unicode operators normalized
    if (c === '×') { tokens.push({ type: 'op', value: '*' }); i++; continue; }
    if (c === '÷') { tokens.push({ type: 'op', value: '/' }); i++; continue; }
    if (c === '√') { tokens.push({ type: 'ident', value: 'sqrt' }); i++; continue; }
    if (c === '−') { tokens.push({ type: 'op', value: '-' }); i++; continue; }

    if ('+-*/^!%(),='.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }

    throw new Error(`不正な文字: ${c}`);
  }
  return tokens;
}

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  peek(off = 0) { return this.tokens[this.pos + off]; }
  consume() { return this.tokens[this.pos++]; }
  matchOp(v) {
    const t = this.peek();
    if (t && t.type === 'op' && t.value === v) return this.consume();
    return null;
  }
  expectOp(v) {
    if (!this.matchOp(v)) throw new Error(`'${v}' が必要`);
  }

  parseStatement() {
    // assignment: IDENT '=' expr
    const t0 = this.peek(0), t1 = this.peek(1);
    if (t0 && t0.type === 'ident' && t1 && t1.type === 'op' && t1.value === '=') {
      const name = t0.value;
      this.pos += 2;
      const expr = this.parseExpression();
      if (this.pos < this.tokens.length) throw new Error('式の後に余分なトークン');
      return { type: 'assign', name, expr };
    }
    const expr = this.parseExpression();
    if (this.pos < this.tokens.length) throw new Error('式の後に余分なトークン');
    return { type: 'expr', expr };
  }

  parseExpression() { return this.parseAddSub(); }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { type: 'binop', op: t.value, left, right };
      } else break;
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseMod();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.consume();
        const right = this.parseMod();
        left = { type: 'binop', op: t.value, left, right };
      } else break;
    }
    return left;
  }

  parseMod() {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && t.value === 'mod') {
        this.consume();
        const right = this.parseUnary();
        left = { type: 'binop', op: 'mod', left, right };
      } else break;
    }
    return left;
  }

  parseUnary() {
    const t = this.peek();
    if (t && t.type === 'op' && t.value === '-') {
      this.consume();
      return { type: 'neg', expr: this.parseUnary() };
    }
    if (t && t.type === 'op' && t.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePercent();
  }

  parsePercent() {
    let expr = this.parsePower();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && t.value === '%') {
        this.consume();
        expr = { type: 'percent', expr };
      } else break;
    }
    return expr;
  }

  parsePower() {
    const base = this.parseImplicit();
    const t = this.peek();
    if (t && t.type === 'op' && t.value === '^') {
      this.consume();
      const exp = this.parseUnary(); // right-assoc
      return { type: 'binop', op: '^', left: base, right: exp };
    }
    return base;
  }

  parseImplicit() {
    let left = this.parsePostfix();
    while (this.canStartImplicit()) {
      const right = this.parsePostfix();
      left = { type: 'binop', op: '*', left, right };
    }
    return left;
  }

  canStartImplicit() {
    const t = this.peek();
    if (!t) return false;
    if (t.type === 'num') return true;
    if (t.type === 'ident') return true;
    if (t.type === 'op' && t.value === '(') return true;
    return false;
  }

  parsePostfix() {
    let expr = this.parseAtom();
    while (true) {
      const t = this.peek();
      if (t && t.type === 'op' && t.value === '!') {
        this.consume();
        expr = { type: 'fact', expr };
      } else break;
    }
    return expr;
  }

  parseAtom() {
    const t = this.peek();
    if (!t) throw new Error('式が途中で終わっています');

    if (t.type === 'num') {
      this.consume();
      return { type: 'num', value: t.value };
    }

    if (t.type === 'ident') {
      this.consume();
      const n = this.peek();
      // Function call: only treat as call if the name is a registered function.
      // Otherwise an `a(expr)` form is an implicit multiplication.
      if (n && n.type === 'op' && n.value === '(' && (t.value in FUNCTIONS)) {
        this.consume();
        const args = [];
        if (!(this.peek() && this.peek().type === 'op' && this.peek().value === ')')) {
          args.push(this.parseExpression());
          while (this.peek() && this.peek().type === 'op' && this.peek().value === ',') {
            this.consume();
            args.push(this.parseExpression());
          }
        }
        this.expectOp(')');
        return { type: 'call', name: t.value, args };
      }
      // Prefix function (sqrt, cbrt): bind to next postfix expression without requiring parens.
      // e.g. √a, √16, ∛x
      if ((t.value === 'sqrt' || t.value === 'cbrt') && n
          && (n.type === 'num' || n.type === 'ident'
              || (n.type === 'op' && n.value === '('))) {
        const arg = this.parsePostfix();
        return { type: 'call', name: t.value, args: [arg] };
      }
      return { type: 'ident', name: t.value };
    }

    if (t.type === 'op' && t.value === '(') {
      this.consume();
      const e = this.parseExpression();
      this.expectOp(')');
      return e;
    }

    throw new Error(`予期しないトークン: ${t.value}`);
  }
}

function evaluate(node, ctx) {
  switch (node.type) {
    case 'num': return node.value;
    case 'ident':
      if (node.name in ctx) return ctx[node.name];
      if (node.name in CONSTANTS) return CONSTANTS[node.name];
      throw new Error(`未定義の変数: ${node.name}`);
    case 'neg': return -evaluate(node.expr, ctx);
    case 'fact': return factorial(evaluate(node.expr, ctx));
    case 'percent': return evaluate(node.expr, ctx) / 100;
    case 'binop': {
      const l = evaluate(node.left, ctx);
      const r = evaluate(node.right, ctx);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '^': return Math.pow(l, r);
        case 'mod': return ((l % r) + r) % r;
      }
      throw new Error(`不明な演算子: ${node.op}`);
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`未定義の関数: ${node.name}`);
      const args = node.args.map(a => evaluate(a, ctx));
      return fn(...args);
    }
  }
  throw new Error(`不明なノード: ${node.type}`);
}

// Public API: evaluate a single line with given context.
// Returns: { ok: bool, result?: number, assigned?: string, error?: string, empty?: bool }
// Mutates ctx on successful assignment.
export function evaluateLine(input, ctx) {
  const trimmed = stripComment(input).trim();
  if (trimmed === '') return { ok: true, empty: true };
  try {
    const tokens = tokenize(input);
    if (tokens.length === 0) return { ok: true, empty: true };
    const parser = new Parser(tokens);
    const stmt = parser.parseStatement();
    if (stmt.type === 'assign') {
      const value = evaluate(stmt.expr, ctx);
      if (!Number.isFinite(value) && !Number.isNaN(value)) {
        // allow infinity, just store
      }
      ctx[stmt.name] = value;
      return { ok: true, result: value, assigned: stmt.name };
    }
    const value = evaluate(stmt.expr, ctx);
    return { ok: true, result: value };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Evaluate a list of lines in order, returning array of per-line results.
// Variables defined on a line are visible to subsequent lines.
// A redefinition shadows previous definitions for lines below.
export function evaluateLines(lines) {
  const ctx = {};
  return lines.map(line => evaluateLine(line, ctx));
}

// For introspection: extract all identifiers that look like variable assignments,
// useful for the variable keyboard page.
export function extractVariableNames(lines) {
  const names = new Set();
  for (const line of lines) {
    try {
      const tokens = tokenize(line);
      if (tokens.length >= 2 && tokens[0].type === 'ident'
          && tokens[1].type === 'op' && tokens[1].value === '=') {
        if (!(tokens[0].value in FUNCTIONS) && !(tokens[0].value in CONSTANTS)) {
          names.add(tokens[0].value);
        }
      }
    } catch { /* ignore */ }
  }
  return Array.from(names);
}
