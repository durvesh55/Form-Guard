/**
 * regexToEnglish.js — turns an HTML `pattern` attribute into plain English.
 *
 *   [0-9]{6}               -> "exactly 6 digits"
 *   [6-9][0-9]{9}          -> "1 digit from 6 to 9, then 9 digits"
 *   [A-Z]{5}[0-9]{4}[A-Z]  -> "5 uppercase letters, then 4 digits, then 1 uppercase letter"
 *   (?=.*\d)(?=.*[A-Z]).{8,} -> "at least 8 characters; must contain at least one digit; ..."
 *
 * It is a small hand-written parser, NOT a full regex engine. It supports the
 * features that real form patterns use: character classes, \d \w \s, ., literal
 * characters, quantifiers (? * + {n} {n,} {n,m}), groups, alternation (|) and
 * lookaheads (?=...) (?!...). Anything it cannot understand falls back to
 * "must match the format: <pattern>" — it never throws.
 */
(function (root) {
  'use strict';

  // ---------- 1. PARSER: pattern string -> list of "atoms" ----------

  function parse(src) {
    let i = 0;

    function parseAlternation() {
      const branches = [parseSequence()];
      while (src[i] === '|') { i++; branches.push(parseSequence()); }
      return branches;
    }

    function parseSequence() {
      const atoms = [];
      while (i < src.length && src[i] !== '|' && src[i] !== ')') {
        const atom = parseAtom();
        if (!atom) continue;
        const q = parseQuantifier();
        atom.min = q.min; atom.max = q.max;
        atoms.push(atom);
      }
      return atoms;
    }

    function parseAtom() {
      const c = src[i];
      if (c === '^' || c === '$') { i++; return null; }           // anchors: ignore
      if (c === '(') {
        i++;
        if (src.startsWith('?=', i) || src.startsWith('?!', i)) {   // lookahead
          const negative = src[i + 1] === '!';
          i += 2;
          const branches = parseAlternation();
          expect(')');
          return { type: 'look', negative, branches };
        }
        if (src.startsWith('?:', i)) i += 2;                         // non-capturing
        else if (src.startsWith('?<', i)) i = src.indexOf('>', i) + 1; // named group
        const branches = parseAlternation();
        expect(')');
        return { type: 'group', branches };
      }
      if (c === '[') return parseClass();
      if (c === '\\') { i += 2; return escapeAtom(src[i - 1]); }
      if (c === '.') { i++; return { type: 'any' }; }
      if ('*+?{'.includes(c)) throw new Error('quantifier without target');
      i++;
      return { type: 'lit', ch: c };
    }

    function expect(ch) {
      if (src[i] !== ch) throw new Error(`expected ${ch}`);
      i++;
    }

    function parseClass() {
      i++; // skip [
      let negated = false;
      if (src[i] === '^') { negated = true; i++; }
      const items = [];
      let first = true;
      while (i < src.length && (src[i] !== ']' || first)) {
        first = false;
        let ch = src[i];
        if (ch === '\\') {
          const e = src[i + 1]; i += 2;
          if ('dDwWsS'.includes(e)) { items.push({ esc: e }); continue; }
          ch = e;
        } else i++;
        // range a-b ?
        if (src[i] === '-' && src[i + 1] && src[i + 1] !== ']') {
          let to = src[i + 1]; i += 2;
          if (to === '\\') { to = src[i]; i++; }
          items.push({ from: ch, to });
        } else items.push({ ch });
      }
      expect(']');
      return { type: 'class', negated, items };
    }

    function parseQuantifier() {
      let min = 1, max = 1;
      const c = src[i];
      if (c === '?') { min = 0; max = 1; i++; }
      else if (c === '*') { min = 0; max = Infinity; i++; }
      else if (c === '+') { min = 1; max = Infinity; i++; }
      else if (c === '{') {
        const m = /^\{(\d+)(,(\d*))?\}/.exec(src.slice(i));
        if (m) {
          min = +m[1];
          max = m[2] ? (m[3] === '' ? Infinity : +m[3]) : min;
          i += m[0].length;
        }
      } else return { min, max };
      if (src[i] === '?') i++; // lazy modifier — irrelevant for meaning
      return { min, max };
    }

    const result = parseAlternation();
    if (i < src.length) throw new Error('unbalanced )');
    return result;
  }

  function escapeAtom(e) {
    if ('dDwWsS'.includes(e)) return { type: 'class', negated: false, items: [{ esc: e }] };
    return { type: 'lit', ch: e };
  }

  // ---------- 2. DESCRIBE: atoms -> English ----------

  const isFull = (it, a, b) => it.from === a && it.to === b;

  /** Returns { one: 'digit', many: 'digits' } for a character class. */
  function describeClass(atom) {
    let digits = false, upper = false, lower = false, underscore = false, space = false;
    const extras = [];
    for (const it of atom.items) {
      if (it.esc === 'd' || isFull(it, '0', '9')) digits = true;
      else if (it.esc === 'w') { digits = upper = lower = underscore = true; }
      else if (it.esc === 's') space = true;
      else if (it.esc) extras.push(`non-${{ D: 'digit', W: 'word', S: 'space' }[it.esc]} character`);
      else if (isFull(it, 'A', 'Z')) upper = true;
      else if (isFull(it, 'a', 'z')) lower = true;
      else if (it.from) {
        const kind = /\d/.test(it.from) ? 'digit' : /[A-Z]/.test(it.from) ? 'uppercase letter'
          : /[a-z]/.test(it.from) ? 'lowercase letter' : 'character';
        extras.push(`${kind} from ${it.from} to ${it.to}`);
      } else if (it.ch === ' ') space = true;
      else if (it.ch === '_') underscore = true;
      else extras.push(`"${it.ch}"`);
    }
    if (underscore) extras.push('"_"');
    if (space) extras.push('space');

    let head = '';
    if (upper && lower && digits) head = 'letter or digit';
    else if (upper && lower) head = 'letter';
    else if (upper && digits) head = 'uppercase letter or digit';
    else if (lower && digits) head = 'lowercase letter or digit';
    else if (upper) head = 'uppercase letter';
    else if (lower) head = 'lowercase letter';
    else if (digits) head = 'digit';

    // A class made only of 3+ symbols, e.g. [!@#$%] -> "special character (one of ! @ # $ %)"
    const symbols = extras.filter((x) => /^".+"$/.test(x));
    if (!head && symbols.length >= 3 && symbols.length === extras.length) {
      const list = symbols.map((s) => s.slice(1, -1)).join(' ');
      const one = atom.negated ? `character other than ${list}` : `special character (one of ${list})`;
      return { one, many: one.replace('character', 'characters') };
    }

    const parts = head ? [head, ...extras] : extras;
    let one = parts.length <= 1 ? (parts[0] || 'character')
      : parts.slice(0, -1).join(', ') + ' or ' + parts[parts.length - 1];
    if (atom.negated) return { one: `character other than a ${one}`, many: `characters other than ${pluralize(one)}` };
    return { one, many: pluralize(one) };
  }

  function pluralize(phrase) {
    // "uppercase letter or digit" -> "uppercase letters or digits"
    return phrase.replace(/\b(letter|digit|character|space)\b(?!s)/g, '$1s');
  }

  function nounFor(atom) {
    switch (atom.type) {
      case 'class': return describeClass(atom);
      case 'any': return { one: 'character', many: 'characters' };
      case 'lit': return { one: `"${atom.ch}"`, many: `"${atom.ch}"`, literal: true };
      case 'group': {
        const inner = describeBranches(atom.branches, false);
        return { one: `(${inner})`, many: `(${inner})`, group: true };
      }
      default: return { one: '?', many: '?' };
    }
  }

  function quantity(atom, noun, alone) {
    const { min, max } = atom;
    if (noun.group) {
      if (min === 1 && max === 1) return noun.one.slice(1, -1);
      if (min === 0 && max === 1) return `optionally ${noun.one}`;
      if (min === max) return `${noun.one} repeated ${min} times`;
      return `${noun.one} repeated ${min}${max === Infinity ? ' or more' : ` to ${max}`} times`;
    }
    if (noun.literal) {
      if (min === 1 && max === 1) return `the character ${noun.one}`;
      if (min === 0 && max === 1) return `an optional ${noun.one}`;
    }
    const n = (k) => (k === 1 ? noun.one : noun.many);
    if (min === max) return `${alone ? 'exactly ' : ''}${min} ${n(min)}`;
    if (min === 0 && max === 1) return `an optional ${noun.one}`;
    if (min === 0 && max === Infinity) return `any number of ${noun.many}`;
    if (min === 1 && max === Infinity) return `one or more ${noun.many}`;
    if (max === Infinity) return `at least ${min} ${n(min)}`;
    if (min === 0) return `up to ${max} ${n(max)}`;
    return `${min} to ${max} ${noun.many}`;
  }

  /** Merge consecutive single literal characters: "+","9","1" -> "+91" */
  function mergeLiterals(atoms) {
    const out = [];
    for (const a of atoms) {
      const prev = out[out.length - 1];
      if (a.type === 'lit' && a.min === 1 && a.max === 1 && prev && prev.type === 'lit'
          && prev.min === 1 && prev.max === 1) {
        prev.ch += a.ch;
      } else out.push({ ...a });
    }
    return out;
  }

  function describeLook(atom) {
    const seq = atom.branches[0].filter((a) => !(a.type === 'any' && a.min === 0));
    const target = seq[seq.length - 1];
    const noun = target ? nounFor(target).one : 'character';
    const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';
    return atom.negative ? `must not contain ${article} ${noun}` : `must contain at least one ${noun}`;
  }

  function describeSequence(atoms, topLevel) {
    const looks = atoms.filter((a) => a.type === 'look').map(describeLook);
    const body = mergeLiterals(atoms.filter((a) => a.type !== 'look'));
    const alone = body.length === 1;
    const parts = body.map((a) => quantity(a, nounFor(a), alone));
    let text = parts.join(', then ');
    if (topLevel && looks.length) text = [text, ...looks].filter(Boolean).join('; ');
    return text;
  }

  function describeBranches(branches, topLevel) {
    const texts = branches.map((b) => describeSequence(b, topLevel));
    return texts.length === 1 ? texts[0] : 'either ' + texts.join(', or ');
  }

  // ---------- 3. LENGTH: min/max total characters the pattern allows ----------

  function lengthOf(branches) {
    let min = Infinity, max = 0;
    for (const seq of branches) {
      let sMin = 0, sMax = 0;
      for (const a of seq) {
        if (a.type === 'look') continue;
        const inner = a.type === 'group' ? lengthOf(a.branches)
          : { min: a.type === 'lit' ? a.ch.length : 1, max: a.type === 'lit' ? a.ch.length : 1 };
        sMin += inner.min * a.min;
        sMax += inner.max * a.max;
      }
      min = Math.min(min, sMin); max = Math.max(max, sMax);
    }
    return { min: min === Infinity ? 0 : min, max: isNaN(max) ? Infinity : max };
  }

  /**
   * Public API.
   * @param {string} pattern  value of the HTML pattern attribute
   * @returns {{ text: string, minLength: number, maxLength: number, understood: boolean }}
   */
  function regexToEnglish(pattern) {
    if (!pattern) return { text: '', minLength: 0, maxLength: Infinity, understood: false };
    try {
      new RegExp(pattern); // invalid regex -> catch
      const tree = parse(pattern);
      const text = describeBranches(tree, true);
      const len = lengthOf(tree);
      return { text: text || `must match the format: ${pattern}`, minLength: len.min, maxLength: len.max, understood: !!text };
    } catch (e) {
      return { text: `must match the format: ${pattern}`, minLength: 0, maxLength: Infinity, understood: false };
    }
  }

  const api = { regexToEnglish };
  root.FormGuard = root.FormGuard || {};
  root.FormGuard.regexToEnglish = regexToEnglish;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
