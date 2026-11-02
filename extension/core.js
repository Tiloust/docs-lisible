/* Docs Lisible - moteur de mise en forme (source unique).
 * Ne supprime jamais de mots : seuls les symboles Markdown (#, -, 1., **, *) sont retirés. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DocsLisible = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var THEMES = {
    rouge: { h1: '#B71C1C', h2: '#B71C1C', h3: '#000000' },
    noir: { h1: '#000000', h2: '#000000', h3: '#000000' },
    bleu: { h1: '#1F3864', h2: '#1F3864', h3: '#000000' }
  };
  var DEFAULTS = {
    theme: 'rouge', stripMarkdown: true, detectHeadings: true, boldLabels: true,
    styleSources: true, styleCitations: true, spacing: true, bodySize: null, fontFamily: null
  };
  var SIZES = { 1: 20, 2: 16, 3: 13 };
  var SPACE = { 1: [18, 6], 2: [14, 4], 3: [10, 3] };
  var GRAY = '#6B6B6B';

  var RE_MD_H = /^(#{1,6})\s+(?=\S)/;
  var RE_BUL = /^([ \t]*)([-*\u2022\u2023\u25E6\u25AA\u2013]|\d+[.)])[ \t]+(?=\S)/;
  var RE_NUM = /^\s*\d+[.)]\s+\S/;
  var RE_ROMAN = /^[IVX]{1,5}\s*[.\-\u2013\u2014)]\s+\S/;
  var RE_LETTER = /^[A-H]\s*[.)]\s+\S/;
  var RE_SEC = /^(chapitre|partie|section|volet|titre|td|cm)\s+[\dIVX]+/i;
  var RE_KW = /^(introduction|conclusion|probl\u00e9matique|sommaire|r\u00e9sum\u00e9|bibliographie|annexes?)\s*:?$/i;
  var RE_SRC = /^(\[\d+\]|(sources?|r\u00e9f(\u00e9rences?)?|bibliographie|cf\.?|voir aussi)\s*:|https?:\/\/\S+$)/i;
  var RE_CIT = /\[(?:[a-z]+:)?\d+(?:\s*[,\-\u2013]\s*\d+)*\]/gi;

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return { color: { rgbColor: { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 } } };
  }
  function pt(v) { return { magnitude: v, unit: 'PT' }; }
  function width(ws) { return ws.replace(/\t/g, '    ').length; }

  function collect(content, out) {
    (content || []).forEach(function (el) {
      if (el.paragraph) {
        var t = '';
        (el.paragraph.elements || []).forEach(function (e) {
          t += e.textRun ? e.textRun.content : new Array(e.endIndex - e.startIndex + 1).join('\uFFFC');
        });
        out.push({
          start: el.startIndex || 0, end: el.endIndex, text: t.replace(/\n$/, ''),
          named: (el.paragraph.paragraphStyle || {}).namedStyleType || 'NORMAL_TEXT',
          listed: !!el.paragraph.bullet
        });
      } else if (el.table) {
        el.table.tableRows.forEach(function (r) {
          r.tableCells.forEach(function (c) { collect(c.content, out); });
        });
      }
    });
    return out;
  }

  function headingLevel(t) {
    if (/^\*\*([^*]+)\*\*\s*:?$/.test(t) && t.length <= 100) return 3;
    if (t.length > 140 || /[.;,]$/.test(t)) return 0;
    if (RE_ROMAN.test(t) || RE_SEC.test(t) || RE_KW.test(t)) return 1;
    if (RE_LETTER.test(t)) return 2;
    var letters = t.replace(/[^A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/g, '');
    if (letters.length >= 4 && t.length <= 80 && t === t.toUpperCase()) return 1;
    return 0;
  }

  function inline(text, from, strip) {
    var edits = [], bolds = [], italics = [], m;
    if (strip) {
      var masked = text.split(''), sub = text.slice(from);
      var reB = /\*\*([^*\s](?:[^*]*[^*\s])?)\*\*/g;
      while ((m = reB.exec(sub))) {
        var i = from + m.index, n = m[1].length;
        edits.push({ pos: i, del: 2, ins: '' }, { pos: i + 2 + n, del: 2, ins: '' });
        bolds.push([i + 2, i + 2 + n]);
        for (var k = i; k < i + n + 4; k++) masked[k] = '\u0000';
      }
      var s2 = masked.join('');
      var reI = /(^|[\s(\u00AB"\u201C])([*_])([^\s*_](?:[^*_\n]*[^\s*_])?)\2(?=$|[\s).,;:!?\u00BB"\u201D])/g;
      reI.lastIndex = Math.max(0, from - 1);
      while ((m = reI.exec(s2))) {
        var o = m.index + m[1].length, len = m[3].length;
        edits.push({ pos: o, del: 1, ins: '' }, { pos: o + 1 + len, del: 1, ins: '' });
        italics.push([o + 1, o + 1 + len]);
      }
    }
    return { edits: edits, bolds: bolds, italics: italics };
  }

  function plan(paras, o) {
    var infos = [], n = paras.length;
    function nz(idx, dir) {
      for (var j = idx + dir; j >= 0 && j < n; j += dir) if (paras[j].text.trim()) return paras[j];
      return null;
    }
    for (var i = 0; i < n; i++) {
      var p = paras[i], line = p.text, t = line.trim(), m, lv;
      if (!t) continue;
      var inf = { p: p, kind: 'body', level: 0, from: 0, listKind: null, indent: 0, markLen: 0 };
      if (p.named !== 'NORMAL_TEXT' || p.listed) inf.kind = 'keep';
      else if ((m = RE_MD_H.exec(line))) { inf.kind = 'h'; inf.level = Math.min(m[1].length, 3); inf.from = m[0].length; inf.markLen = m[0].length; }
      else if (o.styleSources && RE_SRC.test(t)) inf.kind = 'src';
      else if ((m = RE_BUL.exec(line))) {
        var numeric = /\d/.test(m[2]), pv = nz(i, -1), nx = nz(i, 1);
        var short = t.length <= 90 && !/[.;,:]$/.test(t);
        if (numeric && o.detectHeadings && short && !(pv && RE_NUM.test(pv.text)) && !(nx && RE_NUM.test(nx.text))) {
          inf.kind = 'h'; inf.level = 3;
        } else {
          inf.kind = 'li'; inf.listKind = numeric ? 'num' : 'bul';
          inf.from = m[0].length; inf.markLen = m[0].length; inf.indent = width(m[1]);
        }
      } else if (o.detectHeadings && (lv = headingLevel(t))) { inf.kind = 'h'; inf.level = lv; }
      else if (t.length <= 70 && /:$/.test(t)) inf.kind = 'label';
      if (inf.from >= line.length) { inf.kind = 'keep'; inf.markLen = 0; inf.from = 0; }
      infos.push(inf);
    }
    return infos;
  }

  function makeMapper(edits) {
    var ends = [], cum = [], t = 0;
    edits.forEach(function (e) { ends.push(e.pos + e.del); t += e.ins.length - e.del; cum.push(t); });
    return function (i) {
      var lo = 0, hi = ends.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (ends[mid] <= i) lo = mid + 1; else hi = mid; }
      return i + (lo ? cum[lo - 1] : 0);
    };
  }

  function buildRequests(doc, options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    var th = THEMES[o.theme] || THEMES.rouge;
    var paras = collect(doc.body && doc.body.content, []);
    var infos = plan(paras, o);
    var edits = [], pst = [], tst = [], stats = { titres: 0, puces: 0, sources: 0, gras: 0, italiques: 0, citations: 0, paragraphes: 0 };

    infos.forEach(function (inf) {
      var p = inf.p, s = p.start, e = p.end, textEnd = e - 1;
      if (inf.markLen && (inf.kind === 'h' || inf.kind === 'li') && !(inf.kind === 'li')) {
        if (o.stripMarkdown) edits.push({ pos: s, del: inf.markLen, ins: '' });
      }
      var inl = inline(p.text, inf.from, o.stripMarkdown);
      inl.edits.forEach(function (x) { edits.push({ pos: s + x.pos, del: x.del, ins: '' }); });
      inl.bolds.forEach(function (b) { tst.push({ s: s + b[0], e: s + b[1], st: { bold: true }, f: 'bold' }); stats.gras++; });
      inl.italics.forEach(function (b) { tst.push({ s: s + b[0], e: s + b[1], st: { italic: true }, f: 'italic' }); stats.italiques++; });

      if (o.styleCitations && inf.kind !== 'src') {
        var m, re = new RegExp(RE_CIT.source, 'gi');
        while ((m = re.exec(p.text))) {
          if (m.index < inf.from) continue;
          tst.push({ s: s + m.index, e: s + m.index + m[0].length, st: { fontSize: pt(8), foregroundColor: rgb(GRAY), baselineOffset: 'SUPERSCRIPT' }, f: 'fontSize,foregroundColor,baselineOffset' });
          stats.citations++;
        }
      }

      if (inf.kind === 'h') {
        stats.titres++;
        var L = inf.level, key = 'h' + L;
        pst.push({ s: s, e: e, key: 'H' + L, st: { namedStyleType: 'HEADING_' + L, spaceAbove: pt(SPACE[L][0]), spaceBelow: pt(SPACE[L][1]), keepWithNext: true }, f: 'namedStyleType,spaceAbove,spaceBelow,keepWithNext' });
        tst.push({ s: s + inf.from, e: textEnd, st: { bold: true, fontSize: pt(SIZES[L]), foregroundColor: rgb(th[key]) }, f: 'bold,fontSize,foregroundColor' });
      } else if (inf.kind === 'src') {
        stats.sources++;
        pst.push({ s: s, e: e, key: 'SRC', st: { spaceAbove: pt(0), spaceBelow: pt(8) }, f: 'spaceAbove,spaceBelow' });
        tst.push({ s: s, e: textEnd, st: { fontSize: pt(9), italic: true, foregroundColor: rgb(GRAY) }, f: 'fontSize,italic,foregroundColor' });
      } else if (inf.kind === 'li') {
        stats.puces++;
        pst.push({ s: s, e: e, key: 'LI', st: { spaceBelow: pt(3) }, f: 'spaceBelow' });
        if (o.boldLabels && o.stripMarkdown !== null) {
          var content = p.text.slice(inf.from), lm = /^([^:\n]{2,45}?)\s?:(?=\s)/.exec(content);
          if (lm && !/^[*_]/.test(content) && !/[.!?]/.test(lm[1]) && !/^https?$/i.test(lm[1])) {
            tst.push({ s: s + inf.from, e: s + inf.from + lm[1].length, st: { bold: true }, f: 'bold' });
          }
        }
      } else if (inf.kind === 'label' || inf.kind === 'body') {
        stats.paragraphes++;
        if (inf.kind === 'label') tst.push({ s: s, e: textEnd, st: { bold: true }, f: 'bold' });
        if (o.spacing) pst.push({ s: s, e: e, key: 'BODY', st: { lineSpacing: 115, spaceBelow: pt(6) }, f: 'lineSpacing,spaceBelow' });
        var ts = {}, tf = [];
        if (o.bodySize) { ts.fontSize = pt(o.bodySize); tf.push('fontSize'); }
        if (o.fontFamily) { ts.weightedFontFamily = { fontFamily: o.fontFamily }; tf.push('weightedFontFamily'); }
        if (tf.length) tst.push({ s: s, e: textEnd, st: ts, f: tf.join(','), merge: true });
      }
    });

    var groups = [], cur = null, stack = [];
    infos.forEach(function (inf) {
      if (inf.kind !== 'li') { cur = null; return; }
      if (!cur || cur.end !== inf.p.start) { cur = { start: inf.p.start, end: inf.p.end, num: inf.listKind === 'num' }; stack = []; groups.push(cur); }
      while (stack.length && stack[stack.length - 1] > inf.indent) stack.pop();
      if (!stack.length || stack[stack.length - 1] < inf.indent) stack.push(inf.indent);
      inf.level = Math.min(stack.length - 1, 7);
      cur.end = inf.p.end;
      if (o.stripMarkdown) {
        edits.push({ pos: inf.p.start, del: inf.markLen, ins: new Array(inf.level + 1).join('\t') });
      }
    });

    edits.sort(function (a, b) { return a.pos - b.pos; });
    var map = makeMapper(edits);
    var reqs = [];
    for (var i = edits.length - 1; i >= 0; i--) {
      var ed = edits[i];
      if (ed.del > 0) reqs.push({ deleteContentRange: { range: { startIndex: ed.pos, endIndex: ed.pos + ed.del } } });
      if (ed.ins) reqs.push({ insertText: { location: { index: ed.pos }, text: ed.ins } });
    }
    function merge(list, gap) {
      var out = [];
      list.forEach(function (x) {
        var l = out[out.length - 1];
        if (l && l.key && x.key === l.key && x.s - l.e <= gap && x.s >= l.e) l.e = x.e; else out.push(Object.assign({}, x));
      });
      return out;
    }
    merge(pst.sort(function (a, b) { return a.s - b.s; }), 0).forEach(function (x) {
      reqs.push({ updateParagraphStyle: { range: { startIndex: map(x.s), endIndex: map(x.e) }, paragraphStyle: x.st, fields: x.f } });
    });
    var tsorted = tst.sort(function (a, b) { return a.s - b.s; });
    tsorted.forEach(function (x) { if (x.merge) x.key = 'T' + x.f; });
    merge(tsorted, 1).forEach(function (x) {
      var a = map(x.s), b = map(x.e);
      if (b > a) reqs.push({ updateTextStyle: { range: { startIndex: a, endIndex: b }, textStyle: x.st, fields: x.f } });
    });
    for (var g = groups.length - 1; g >= 0; g--) {
      reqs.push({ createParagraphBullets: { range: { startIndex: map(groups[g].start), endIndex: map(groups[g].end) }, bulletPreset: groups[g].num ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE' } });
    }
    return { requests: reqs, stats: stats };
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  return { buildRequests: buildRequests, chunk: chunk, THEMES: THEMES, DEFAULTS: DEFAULTS };
});
