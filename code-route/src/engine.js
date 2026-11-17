// Moteur pur (sans DOM) : statistiques, répétition espacée, sélection des questions, scores.
// Testable sous Node : window.Engine.
(function () {
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  // Intervalles Leitner adaptés à une révision sur 24 h.
  const INTERVALS = [0, 10 * MIN, 1 * HOUR, 5 * HOUR, 1 * DAY, 3 * DAY];
  // Répartition d'un test de 40 questions par thème.
  const EXAM_MIX = { LEG: 6, CON: 5, CIR: 7, QUI: 5, USA: 5, EQU: 5, SIG: 5, SEC: 2 };
  const PASS = 35;

  const emptyState = () => ({ v: 1, q: {}, sessions: [], sprint: { done: {} }, settings: { examTimer: true, stepTimer: true }, updated: 0 });

  const shuffle = (arr, rnd = Math.random) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const isCorrect = (question, chosen) => sameSet([...new Set(chosen)].sort(), question.a.slice().sort());

  const stat = (state, id) => state.q[id] || null;

  // Enregistre une réponse. Retourne le nouvel état (immuable).
  function recordAnswer(state, question, chosen, ms, now = Date.now()) {
    const ok = isCorrect(question, chosen);
    const prev = state.q[question.id] || { s: 0, c: 0, w: 0, box: 0, due: 0, rt: 0, last: 0, ok: null, hist: [] };
    const s = prev.s + 1;
    let box;
    if (ok) box = prev.s === 0 ? 3 : Math.min(5, prev.box + 1); // première réponse juste : déjà connue
    else box = 0;
    const rt = Math.round(prev.rt ? prev.rt * 0.6 + ms * 0.4 : ms);
    const hist = (prev.hist || []).concat(ok ? 1 : 0).slice(-8);
    const next = { s, c: prev.c + (ok ? 1 : 0), w: prev.w + (ok ? 0 : 1), box, due: now + INTERVALS[box], rt, last: now, ok, hist };
    return { ok, state: { ...state, q: { ...state.q, [question.id]: next }, updated: now } };
  }

  // Niveau de maîtrise 0-100.
  function mastery(st) {
    if (!st || !st.s) return null;
    const recent = st.hist && st.hist.length ? st.hist.reduce((a, b) => a + b, 0) / st.hist.length : st.c / st.s;
    const m = (st.box / 5) * 0.6 + recent * 0.4;
    return Math.round((st.ok ? m : Math.min(m, 0.3)) * 100);
  }

  const isActiveError = (st) => !!st && st.w > 0 && (st.box < 3 || st.ok === false);
  const isWeak = (st) => !!st && st.s > 0 && (st.ok === false || st.box < 3);

  // Statistiques par thème.
  function catStats(state, questions, cats) {
    const out = {};
    for (const k of Object.keys(cats)) out[k] = { key: k, n: 0, att: 0, c: 0, w: 0, seen: 0, weak: 0, active: 0 };
    for (const q of questions) {
      const o = out[q.c]; if (!o) continue;
      o.n++;
      const st = state.q[q.id];
      if (st && st.s) { o.seen++; o.att += st.s; o.c += st.c; o.w += st.w; if (isWeak(st)) o.weak++; if (isActiveError(st)) o.active++; }
    }
    for (const k of Object.keys(out)) {
      const o = out[k], prior = cats[k].prior || 0;
      // Taux d'erreur estimé : erreurs observées + a priori issu du résultat officiel (33/40).
      o.errRate = (o.w + prior * 1.2 + 0.4) / (o.att + 6);
      o.acc = o.att ? o.c / o.att : null;
      // Probabilité de réussite estimée : a priori calé pour redonner ≈ 33/40 sans aucune réponse.
      const p0 = 0.9 - prior * 0.075;
      o.pSuccess = (o.c + p0 * 4) / (o.att + 4);
      o.weakness = o.errRate + o.active * 0.04;
    }
    return out;
  }

  function priorityCats(state, questions, cats, n = 3) {
    const cs = catStats(state, questions, cats);
    return Object.values(cs).sort((a, b) => b.weakness - a.weakness).slice(0, n);
  }

  // Estimation du score à l'examen (/40) à partir des thèmes et des examens blancs récents.
  function readiness(state, questions, cats) {
    const cs = catStats(state, questions, cats);
    const total = Object.values(EXAM_MIX).reduce((a, b) => a + b, 0);
    let est = 0;
    for (const [k, n] of Object.entries(EXAM_MIX)) est += n * Math.max(0, Math.min(1, cs[k].pSuccess));
    est = (est / total) * 40;
    const exams = state.sessions.filter((s) => s.mode === "exam" && s.n === 40).slice(-3);
    if (exams.length) {
      const avg = exams.reduce((a, s) => a + s.correct, 0) / exams.length;
      est = est * 0.5 + avg * 0.5;
    }
    const answered = Object.values(state.q).reduce((a, s) => a + s.s, 0);
    return { score: Math.round(est * 10) / 10, answered, exams: exams.length, confident: answered >= 60 };
  }

  // Sélection pondérée.
  function scoreFor(q, state, cs, now, opts = {}) {
    const st = state.q[q.id];
    let sc = Math.random() * 1.5;
    sc += (cs[q.c] ? cs[q.c].weakness : 0.2) * 8;
    if (!st || !st.s) sc += opts.preferNew ? 3 : 1.2;
    else {
      if (st.ok === false) sc += 3.5;
      if (st.due <= now) sc += 2;
      else sc -= 2.5 * (st.box / 5);
      if (st.box >= 4 && st.ok) sc -= 3;
    }
    if (opts.hard) sc += q.d * 1.5 + (q.t ? 1 : 0) + (q.a.length > 1 ? 1 : 0);
    return sc;
  }

  function pickMix(questions, state, cats, mix, opts = {}) {
    const now = Date.now();
    const cs = catStats(state, questions, cats);
    let picked = [];
    for (const [c, n] of Object.entries(mix)) {
      const pool = questions.filter((q) => q.c === c);
      const ranked = pool
        .map((q) => {
          const st = state.q[q.id];
          let s = Math.random() * 2;
          if (opts.preferUnseen && (!st || !st.s)) s += 3;
          if (opts.leastRecent && st) s -= Math.min(3, (now - st.last) < HOUR ? 3 : 0);
          if (opts.hardShare && q.d === 3) s += 1;
          if (opts.weighted) s += scoreFor(q, state, cs, now) * 0.3;
          return { q, s };
        })
        .sort((a, b) => b.s - a.s);
      picked = picked.concat(ranked.slice(0, n).map((x) => x.q));
    }
    return shuffle(picked);
  }

  function buildSession(mode, questions, state, cats, n) {
    const now = Date.now();
    const cs = catStats(state, questions, cats);
    if (mode === "diag") return pickMix(questions, state, cats, EXAM_MIX, { preferUnseen: true });
    if (mode === "exam") return pickMix(questions, state, cats, EXAM_MIX, { leastRecent: true, hardShare: true });
    if (mode === "errors") {
      const errs = questions.filter((q) => isActiveError(state.q[q.id]));
      return shuffle(errs).sort((a, b) => (state.q[a.id].ok === false ? 0 : 1) - (state.q[b.id].ok === false ? 0 : 1));
    }
    let pool = questions, opts = {};
    if (mode === "hard") { pool = questions.filter((q) => q.d === 3 || q.t || q.a.length > 1); opts.hard = true; }
    if (mode === "consolidate") {
      const weak = questions.filter((q) => { const st = state.q[q.id]; return st && st.s && (isWeak(st) || st.due <= now); });
      pool = weak.length >= 10 ? weak : questions;
    }
    const ranked = pool.map((q) => ({ q, s: scoreFor(q, state, cs, now, opts) })).sort((a, b) => b.s - a.s);
    const size = n || (mode === "hard" ? 20 : 25);
    // Limite par thème pour garder de la variété (sauf mode ciblé où l'on concentre).
    const cap = mode === "target" ? Math.ceil(size * 0.45) : Math.ceil(size * 0.35);
    const per = {}; const out = [];
    for (const { q } of ranked) {
      if (out.length >= size) break;
      per[q.c] = per[q.c] || 0;
      if (per[q.c] >= cap) continue;
      per[q.c]++; out.push(q);
    }
    return shuffle(out);
  }

  // Résumé d'une session terminée.
  function summarize(mode, results, questions, startedAt, now = Date.now()) {
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
    const firsts = []; const seen = new Set();
    for (const r of results) { if (seen.has(r.id)) continue; seen.add(r.id); firsts.push(r); }
    const byCat = {};
    for (const r of firsts) {
      const c = byId[r.id].c; byCat[c] = byCat[c] || { n: 0, c: 0 };
      byCat[c].n++; if (r.ok) byCat[c].c++;
    }
    return {
      id: "s" + now.toString(36), mode, start: startedAt, end: now,
      n: firsts.length, correct: firsts.filter((r) => r.ok).length,
      byCat, wrong: firsts.filter((r) => !r.ok).map((r) => r.id),
    };
  }

  // Texte compact pour l'assistant.
  function assistantReport(state, questions, cats) {
    const cs = catStats(state, questions, cats);
    const r = readiness(state, questions, cats);
    const lines = [];
    lines.push(`Révision code de la route — rapport du ${new Date().toLocaleString("fr-FR")}`);
    lines.push(`Score estimé : ${r.score}/40 (objectif 35). Réponses données : ${r.answered}.`);
    lines.push("Par thème (réussite / tentatives / erreurs actives) :");
    for (const o of Object.values(cs)) lines.push(`- ${cats[o.key].name} : ${o.acc == null ? "—" : Math.round(o.acc * 100) + " %"} / ${o.att} / ${o.active}`);
    const ex = state.sessions.filter((s) => s.mode === "exam");
    if (ex.length) lines.push("Examens blancs : " + ex.map((s) => `${s.correct}/${s.n}`).join(", "));
    const rec = questions.filter((q) => (state.q[q.id] || {}).w >= 1).sort((a, b) => state.q[b.id].w - state.q[a.id].w).slice(0, 15);
    if (rec.length) {
      lines.push("Questions ratées (nb d'erreurs, dernière réponse) :");
      for (const q of rec) { const st = state.q[q.id]; lines.push(`- ${q.id} (${st.w}×, ${st.ok ? "réussie" : "ratée"}) ${q.q}`); }
    }
    return lines.join("\n");
  }

  window.Engine = { INTERVALS, EXAM_MIX, PASS, emptyState, shuffle, isCorrect, recordAnswer, mastery, isActiveError, isWeak, catStats, priorityCats, readiness, buildSession, summarize, assistantReport, stat };
})();
