/* global React, ReactDOM, htm, Engine, QUESTIONS, CATS, SCENES */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const html = htm.bind(React.createElement);
const E = Engine;
const QBY = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const LETTERS = ["A", "B", "C", "D"];
const LS_KEY = "cdr-state-v1";

const MODES = {
  diag: { name: "Diagnostic", desc: "40 questions variées sur tous les thèmes. Correction après chaque question.", n: 40, feedback: true },
  target: { name: "Révision ciblée", desc: "25 questions tirées en priorité dans tes thèmes les plus faibles.", n: 25, feedback: true },
  errors: { name: "Mes erreurs", desc: "Toutes les questions ratées. Une question ne sort de la liste qu'après 3 bonnes réponses espacées.", feedback: true },
  hard: { name: "Questions difficiles", desc: "Exceptions, pièges, réponses multiples et petites différences d'énoncé.", n: 20, feedback: true },
  exam: { name: "Examen blanc", desc: "40 questions, 20 secondes chacune, aucune correction avant la fin. Réussite à 35/40.", n: 40, feedback: false },
  consolidate: { name: "Consolidation", desc: "Questions fragiles et révisions arrivées à échéance.", n: 25, feedback: true },
};

const SPRINT = [
  { title: "Session 1 — ce soir", total: 40, steps: [
    { id: "s1a", mode: "diag", min: 15, label: "Diagnostic", n: 40 },
    { id: "s1b", mode: "target", min: 15, label: "Questions ciblées", n: 30 },
    { id: "s1c", mode: "errors", min: 10, label: "Révision des erreurs" },
  ] },
  { title: "Session 2 — demain", total: 120, steps: [
    { id: "s2a", mode: "exam", min: 30, label: "Examen blanc et correction" },
    { id: "s2b", mode: "target", min: 30, label: "Questions ciblées", n: 50 },
    { id: "s2c", mode: "hard", min: 30, label: "Questions difficiles", n: 40 },
    { id: "s2d", mode: "consolidate", min: 30, label: "Révision et consolidation", n: 40 },
  ] },
];

// ───────── Persistance : localStorage + base de l'artifact ─────────
function loadLocal() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s && s.v === 1) return s; } catch (e) { /* stockage indisponible */ }
  return null;
}
function saveLocal(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

function validState(s) {
  return s && typeof s === "object" && s.v === 1 && s.q && typeof s.q === "object" && Array.isArray(s.sessions);
}

function useStore() {
  const [state, setState] = useState(() => {
    const s = loadLocal() || E.emptyState();
    return { ...E.emptyState(), ...s, settings: { ...E.emptyState().settings, ...(s.settings || {}) } };
  });
  const [sync, setSync] = useState("connecting");
  const dbRef = useRef(null), pending = useRef(null), flying = useRef(false), timer = useRef(null), lastRemote = useRef(0);

  const flush = useCallback(async () => {
    const db = dbRef.current; const s = pending.current;
    if (!db || !s || flying.current) return;
    pending.current = null; flying.current = true; setSync("saving");
    try {
      const { run, ...rest } = s;
      await db.doc("progress/main").set({ updated: s.updated, payload: JSON.stringify(rest) });
      lastRemote.current = s.updated; setSync("synced");
    } catch (e) {
      setSync(e && e.code === "quota_exceeded" ? "full" : "error");
    } finally {
      flying.current = false;
      if (pending.current) timer.current = setTimeout(flush, 1500);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const c = window.claude;
    if (!c || !c.use) { setSync("local"); return; }
    const to = setTimeout(() => alive && setSync((x) => (x === "connecting" ? "local" : x)), 10000);
    c.use("db").then(async (db) => {
      if (!alive) return;
      if (!db) { clearTimeout(to); setSync("local"); return; }
      dbRef.current = db;
      try {
        const snap = await db.doc("progress/main").get();
        clearTimeout(to);
        if (snap.exists) {
          const data = snap.data();
          const remote = JSON.parse(data.payload);
          setState((cur) => {
            if (validState(remote) && (remote.updated || 0) > (cur.updated || 0)) {
              const merged = { ...E.emptyState(), ...remote, run: cur.run };
              saveLocal(merged); return merged;
            }
            if ((cur.updated || 0) > (remote.updated || 0)) { pending.current = cur; setTimeout(flush, 500); }
            return cur;
          });
          lastRemote.current = data.updated || 0;
        } else {
          setState((cur) => { if (cur.updated) { pending.current = cur; setTimeout(flush, 500); } return cur; });
        }
        setSync("synced");
      } catch (e) { clearTimeout(to); setSync("error"); }
    }).catch(() => { clearTimeout(to); setSync("local"); });
    return () => { alive = false; };
  }, [flush]);

  const update = useCallback((fn) => {
    setState((cur) => {
      const next = typeof fn === "function" ? fn(cur) : fn;
      saveLocal(next);
      if (dbRef.current && next.updated !== cur.updated) {
        pending.current = next;
        clearTimeout(timer.current); timer.current = setTimeout(flush, 2500);
      }
      return next;
    });
  }, [flush]);

  useEffect(() => {
    const h = () => { if (document.visibilityState === "hidden" && pending.current) { clearTimeout(timer.current); flush(); } };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [flush]);

  return [state, update, sync];
}

// ───────── Utilitaires d'affichage ─────────
const pct = (x) => (x == null ? "—" : Math.round(x * 100) + " %");
const fmtDate = (t) => new Date(t).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
const fmtClock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function Scene({ id }) {
  if (!id || !SCENES[id]) return null;
  return html`<figure className="scene"><div dangerouslySetInnerHTML=${{ __html: SCENES[id]() }}></div><figcaption>Illustration schématique</figcaption></figure>`;
}

function Bar({ value, tone = "green", marker }) {
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return html`<div className="bar"><div className=${"bar-fill " + tone} style=${{ width: v * 100 + "%" }}></div>${marker != null && html`<div className="bar-marker" style=${{ left: marker * 100 + "%" }}></div>`}</div>`;
}

// ───────── Tableau de bord ─────────
function Dashboard({ state, go, start }) {
  const cs = useMemo(() => E.catStats(state, QUESTIONS, CATS), [state]);
  const prio = useMemo(() => E.priorityCats(state, QUESTIONS, CATS, 3), [state]);
  const ready = useMemo(() => E.readiness(state, QUESTIONS, CATS), [state]);
  const all = Object.values(state.q);
  const answered = all.reduce((a, s) => a + s.s, 0);
  const correct = all.reduce((a, s) => a + s.c, 0);
  const weak = QUESTIONS.filter((q) => E.isWeak(state.q[q.id])).length;
  const active = QUESTIONS.filter((q) => E.isActiveError(state.q[q.id])).length;
  const seen = all.filter((s) => s.s).length;
  const exams = state.sessions.filter((s) => s.mode === "exam");
  const recurring = QUESTIONS.filter((q) => (state.q[q.id] || {}).w >= 1)
    .sort((a, b) => state.q[b.id].w - state.q[a.id].w || state.q[b.id].last - state.q[a.id].last).slice(0, 8);
  const next = nextStep(state);
  const gap = Math.round((E.PASS - ready.score) * 10) / 10;

  return html`<div className="stack">
    ${state.run && html`<div className="card resume"><div><strong>Session en cours : ${MODES[state.run.mode].name}</strong><div className="muted">Question ${state.run.idx + 1} sur ${state.run.ids.length}</div></div><button className="btn primary" onClick=${() => go("quiz")}>Reprendre</button></div>`}

    <section className="hero card">
      <div className="hero-score">
        <div className="eyebrow">Score estimé à l'examen</div>
        <div className="big"><span className=${ready.score >= E.PASS ? "ok" : "warn"}>${ready.score.toFixed(1)}</span><small>/40</small></div>
        <div className="muted">${ready.score >= E.PASS ? "Au-dessus du seuil de 35. Consolide." : `Il manque environ ${gap.toFixed(1)} point${gap >= 2 ? "s" : ""} pour atteindre 35.`}${!ready.confident ? " Estimation encore fragile : réponds à au moins 60 questions." : ""}</div>
        <div className="gauge"><${Bar} value=${ready.score / 40} tone=${ready.score >= E.PASS ? "green" : "blue"} marker=${35 / 40} /><div className="gauge-labels"><span>0</span><span>35</span><span>40</span></div></div>
      </div>
      <div className="hero-next">
        <div className="eyebrow">Prochaine étape du sprint</div>
        ${next ? html`<div className="next-title">${next.step.label}</div><div className="muted">${next.session} · ${next.step.min} min</div><button className="btn primary" onClick=${() => start(next.step.mode, next.step)}>Lancer</button>`
          : html`<div className="next-title">Sprint terminé</div><div className="muted">Refais un examen blanc ou tes erreurs.</div><button className="btn primary" onClick=${() => start("exam")}>Examen blanc</button>`}
      </div>
    </section>

    <section className="card">
      <div className="card-head"><h2>À réviser en priorité</h2><button className="btn ghost sm" onClick=${() => start("target")}>Révision ciblée</button></div>
      <ol className="prio">${prio.map((p, i) => html`<li key=${p.key}>
        <span className="rank">${i + 1}</span>
        <div className="prio-body"><div className="prio-name">${CATS[p.key].name}</div>
        <div className="muted small">${p.att ? `${pct(p.acc)} de réussite sur ${p.att} réponses · ${p.active} erreur${p.active > 1 ? "s" : ""} active${p.active > 1 ? "s" : ""}` : `Pas encore travaillé · ${CATS[p.key].prior >= 2 ? "2 erreurs à l'examen" : CATS[p.key].prior >= 1 ? "1 erreur à l'examen" : "thème transversal"}`}</div></div>
        <button className="btn ghost sm" onClick=${() => start("target", null, p.key)}>Travailler</button></li>`)}</ol>
    </section>

    <section className="kpis">
      <div className="kpi card"><div className="kpi-v">${answered}</div><div className="kpi-l">réponses données</div></div>
      <div className="kpi card"><div className="kpi-v">${answered ? pct(correct / answered) : "—"}</div><div className="kpi-l">de réussite</div></div>
      <div className="kpi card"><div className="kpi-v">${weak}</div><div className="kpi-l">questions mal maîtrisées</div></div>
      <div className="kpi card"><div className="kpi-v">${seen}<small>/${QUESTIONS.length}</small></div><div className="kpi-l">questions vues</div></div>
    </section>

    <section className="card">
      <div className="card-head"><h2>Progression par thème</h2><span className="muted small">réussite · questions vues</span></div>
      <div className="themes">${Object.values(cs).map((o) => html`<div className="theme" key=${o.key}>
        <div className="theme-top"><span>${CATS[o.key].name}</span><span className="num">${o.att ? pct(o.acc) : "—"}</span></div>
        <${Bar} value=${o.acc} tone=${o.acc == null ? "blue" : o.acc >= 0.875 ? "green" : o.acc >= 0.7 ? "blue" : "red"} />
        <div className="muted small">${o.seen}/${o.n} vues${o.active ? ` · ${o.active} erreur${o.active > 1 ? "s" : ""} à retravailler` : ""}</div></div>`)}</div>
    </section>

    <div className="two">
      <section className="card">
        <div className="card-head"><h2>Examens blancs</h2><button className="btn ghost sm" onClick=${() => start("exam")}>Nouveau</button></div>
        ${exams.length ? html`<div className="exams">${exams.slice(-8).map((s) => html`<div className="exam-col" key=${s.id} title=${fmtDate(s.end)}>
          <div className="exam-bar-wrap"><div className=${"exam-bar " + (s.correct >= 35 ? "pass" : "fail")} style=${{ height: (s.correct / 40) * 100 + "%" }}></div><div className="exam-line"></div></div>
          <div className="num small">${s.correct}</div></div>`)}</div><div className="muted small">Ligne : seuil de 35/40.</div>`
          : html`<p className="muted">Aucun examen blanc pour l'instant. Le sprint en prévoit un demain.</p>`}
      </section>
      <section className="card">
        <div className="card-head"><h2>Erreurs récurrentes</h2><button className="btn ghost sm" disabled=${!active} onClick=${() => start("errors")}>Refaire (${active})</button></div>
        ${recurring.length ? html`<ul className="rec">${recurring.map((q) => html`<li key=${q.id}><span className=${"pill " + (state.q[q.id].ok ? "pill-ok" : "pill-bad")}>${state.q[q.id].w}×</span><div><div className="small">${q.q}</div><div className="memo-inline">${q.m}</div></div></li>`)}</ul>`
          : html`<p className="muted">Aucune erreur enregistrée.</p>`}
      </section>
    </div>

    <section className="card">
      <h2>Historique des sessions</h2>
      ${state.sessions.length ? html`<div className="table-wrap"><table><thead><tr><th>Date</th><th>Mode</th><th className="r">Score</th><th className="r">Durée</th></tr></thead><tbody>
        ${state.sessions.slice().reverse().slice(0, 15).map((s) => html`<tr key=${s.id}><td>${fmtDate(s.end)}</td><td>${MODES[s.mode] ? MODES[s.mode].name : s.mode}</td><td className="r num">${s.correct}/${s.n}</td><td className="r num">${fmtClock(s.end - s.start)}</td></tr>`)}
      </tbody></table></div>` : html`<p className="muted">Les sessions terminées apparaîtront ici.</p>`}
    </section>
  </div>`;
}

function nextStep(state) {
  for (const s of SPRINT) for (const st of s.steps) if (!state.sprint.done[st.id]) return { session: s.title, step: st };
  return null;
}

// ───────── Sprint ─────────
function Sprint({ state, update, start }) {
  const next = nextStep(state);
  const toggle = (id) => update((s) => ({ ...s, sprint: { ...s.sprint, done: { ...s.sprint.done, [id]: !s.sprint.done[id] } }, updated: Date.now() }));
  return html`<div className="stack">
    <section className="card intro">
      <h2>Sprint avant examen</h2>
      <p className="muted">Deux sessions guidées. Chaque étape lance le bon mode avec un minuteur. Une étape se coche toute seule quand tu termines sa série ; tu peux aussi la cocher à la main.</p>
      <label className="switch"><input id="steptimer" type="checkbox" checked=${state.settings.stepTimer} onChange=${(e) => update((s) => ({ ...s, settings: { ...s.settings, stepTimer: e.target.checked } }))} /> Afficher le minuteur des étapes</label>
    </section>
    ${SPRINT.map((sess) => {
      const done = sess.steps.filter((s) => state.sprint.done[s.id]).length;
      return html`<section className="card" key=${sess.title}>
        <div className="card-head"><h2>${sess.title}</h2><span className="muted small num">${done}/${sess.steps.length} · ${sess.total} min</span></div>
        <${Bar} value=${done / sess.steps.length} />
        <ol className="steps">${sess.steps.map((st) => {
          const isNext = next && next.step.id === st.id; const isDone = !!state.sprint.done[st.id];
          return html`<li key=${st.id} className=${(isDone ? "done " : "") + (isNext ? "next" : "")}>
            <button className="check" aria-label=${isDone ? "Décocher" : "Cocher"} onClick=${() => toggle(st.id)}>${isDone ? "✓" : ""}</button>
            <div className="step-body"><div className="step-title">${st.label}</div><div className="muted small">${st.min} min · ${MODES[st.mode].name}${st.n ? ` · jusqu'à ${st.n} questions` : ""}</div></div>
            <button className=${"btn sm " + (isNext ? "primary" : "ghost")} onClick=${() => start(st.mode, st)}>${isDone ? "Refaire" : "Lancer"}</button></li>`;
        })}</ol>
      </section>`;
    })}
  </div>`;
}

// ───────── Modes ─────────
function Modes({ state, start }) {
  const active = QUESTIONS.filter((q) => E.isActiveError(state.q[q.id])).length;
  const order = ["diag", "target", "errors", "hard", "exam"];
  return html`<div className="modes">${order.map((k, i) => html`<button className="card mode" key=${k} onClick=${() => start(k)} disabled=${k === "errors" && !active}>
    <div className="mode-n">Mode ${i + 1}</div><div className="mode-name">${MODES[k].name}${k === "errors" ? html` <span className="pill pill-bad">${active}</span>` : ""}</div>
    <div className="muted small">${k === "errors" && !active ? "Aucune erreur active pour l'instant." : MODES[k].desc}</div></button>`)}</div>`;
}

// ───────── Quiz ─────────
function Quiz({ state, update, finish, onQuit }) {
  const run = state.run;
  const mode = MODES[run.mode];
  const q = QBY[run.ids[run.idx]];
  const [chosen, setChosen] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const shownAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const deadline = useRef(Date.now() + 20000);
  const done = useRef(false);
  const examTimer = run.mode === "exam" && state.settings.examTimer;

  useEffect(() => { setChosen([]); setFeedback(null); shownAt.current = Date.now(); deadline.current = Date.now() + 20000; done.current = false; }, [run.idx, run.ids[run.idx]]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const validate = (forced) => {
    if (feedback || done.current) return;
    const sel = forced || chosen;
    if (!sel.length && !forced) return;
    done.current = true;
    const ms = Date.now() - shownAt.current;
    update((s) => {
      const r = E.recordAnswer(s, q, sel, ms);
      const rr = s.run;
      const results = rr.results.concat({ id: q.id, chosen: sel, ok: r.ok, ms });
      let ids = rr.ids, requeued = rr.requeued || {};
      if (!r.ok && mode.feedback && !requeued[q.id] && rr.mode !== "errors") {
        const pos = Math.min(ids.length, rr.idx + 5);
        ids = ids.slice(0, pos).concat(q.id, ids.slice(pos)); requeued = { ...requeued, [q.id]: true };
      }
      return { ...r.state, run: { ...rr, results, ids, requeued, answered: true } };
    });
    if (mode.feedback) setFeedback({ ok: E.isCorrect(q, sel), chosen: sel });
    else advance();
  };

  function advance() {
    update((s) => {
      const rr = s.run;
      if (rr.idx + 1 >= rr.ids.length) return s; // la fin est gérée par finish()
      return { ...s, run: { ...rr, idx: rr.idx + 1, answered: false } };
    });
    if (run.idx + 1 >= run.ids.length) finish();
  }

  // Temps écoulé à l'examen : validation automatique (réponse vide = fausse).
  useEffect(() => {
    if (examTimer && !feedback && !done.current && now > deadline.current) validate(chosen.length ? chosen : ["__none__"]);
  }, [now]); // eslint-disable-line

  const toggle = (i) => { if (feedback) return; setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : c.concat(i))); };

  useEffect(() => {
    const h = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const k = e.key.toUpperCase();
      const n = { "1": 0, "2": 1, "3": 2, "4": 3, A: 0, B: 1, C: 2, D: 3 }[k];
      if (n != null && n < q.o.length) { e.preventDefault(); toggle(n); }
      if (e.key === "Enter") { e.preventDefault(); feedback ? advance() : validate(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const progress = (run.idx + (feedback ? 1 : 0)) / run.ids.length;
  const stepLeft = run.stepEnds && state.settings.stepTimer ? run.stepEnds - now : null;
  const qLeft = examTimer ? deadline.current - now : null;
  const answeredCount = run.results.length;
  const okCount = run.results.filter((r) => r.ok).length;

  const optClass = (i) => {
    if (!feedback) return chosen.includes(i) ? "opt sel" : "opt";
    const good = q.a.includes(i), picked = feedback.chosen.includes(i);
    return "opt " + (good ? "good " : "") + (picked && !good ? "bad " : "") + (picked ? "picked" : "");
  };

  return html`<div className="quiz">
    <div className="quiz-top">
      <div className="quiz-meta"><span className="mode-tag">${mode.name}</span><span className="num muted">${run.idx + 1}/${run.ids.length}</span>
        ${mode.feedback && answeredCount ? html`<span className="num muted">· ${okCount}/${answeredCount} justes</span>` : ""}</div>
      <div className="timers">
        ${stepLeft != null && html`<span className=${"timer " + (stepLeft <= 0 ? "late" : "")} title="Temps restant pour l'étape">${stepLeft > 0 ? "Étape " + fmtClock(stepLeft) : "Temps de l'étape écoulé"}</span>`}
        ${qLeft != null && html`<span className=${"timer " + (qLeft < 5000 ? "late" : "")}>${fmtClock(qLeft)}</span>`}
      </div>
    </div>
    <${Bar} value=${progress} tone="blue" />
    ${stepLeft != null && stepLeft <= 0 && html`<div className="notice">Le temps prévu pour cette étape est écoulé. Termine ta question puis clique sur « Terminer » pour passer à l'étape suivante.</div>`}

    <article className="card qcard" key=${run.idx + q.id}>
      <div className="q-head"><span className="cat">${CATS[q.c].short}</span>${q.d === 3 ? html`<span className="pill pill-hard">difficile</span>` : ""}</div>
      <${Scene} id=${q.img} />
      <h2 className="q-text">${q.q}</h2>
      <div className="muted small hint">Une ou plusieurs bonnes réponses. Touches A–D ou 1–4, Entrée pour valider.</div>
      <div className="opts">${q.o.map((o, i) => html`<button key=${i} className=${optClass(i)} onClick=${() => toggle(i)} aria-pressed=${chosen.includes(i)}>
        <span className="letter">${LETTERS[i]}</span><span className="opt-text">${o}</span></button>`)}</div>

      ${feedback && html`<div className=${"feedback " + (feedback.ok ? "fb-ok" : "fb-bad")}>
        <div className="fb-title">${feedback.ok ? "Bonne réponse" : "Mauvaise réponse"}</div>
        <div className="fb-line"><span className="muted">Bonne réponse :</span> <strong>${q.a.map((i) => LETTERS[i]).join(", ")}</strong>${!feedback.ok ? html` · <span className="muted">ton choix :</span> <strong>${feedback.chosen.filter((x) => typeof x === "number").map((i) => LETTERS[i]).join(", ") || "aucun"}</strong>` : ""}</div>
        <p>${q.e}</p>
        ${q.t && html`<p className="trap"><strong>Piège :</strong> ${q.t}</p>`}
        <div className="memo">${q.m}</div>
        ${q.r && html`<div className="ref muted small">${q.r}</div>`}
        ${!feedback.ok && run.mode !== "errors" && html`<div className="muted small">Cette question reviendra dans quelques questions, puis dans tes révisions.</div>`}
      </div>`}
    </article>

    <div className="quiz-actions">
      <button className="btn ghost" onClick=${onQuit}>${answeredCount ? "Terminer" : "Quitter"}</button>
      ${feedback ? html`<button className="btn primary" onClick=${advance}>${run.idx + 1 >= run.ids.length ? "Voir le bilan" : "Suivante"}</button>`
        : html`<button className="btn primary" disabled=${!chosen.length} onClick=${() => validate()}>Valider</button>`}
    </div>
  </div>`;
}

// ───────── Bilan ─────────
function Results({ session, state, start, go }) {
  if (!session) return html`<div className="card"><p>Aucun bilan à afficher.</p></div>`;
  const isExam = session.mode === "exam";
  const ok = session.correct, n = session.n;
  const cats = Object.entries(session.byCat).map(([k, v]) => ({ k, ...v, r: v.c / v.n })).sort((a, b) => a.r - b.r);
  const weakC = cats.filter((c) => c.r < 0.8), strongC = cats.filter((c) => c.r >= 0.8);
  const wrongQs = session.wrong.map((id) => QBY[id]).filter(Boolean);
  const answers = session.answers || {};
  return html`<div className="stack">
    <section className="card hero-res">
      <div className="eyebrow">${MODES[session.mode].name} · ${fmtDate(session.end)}</div>
      <div className="big"><span className=${isExam ? (ok >= 35 ? "ok" : "warn") : ok / n >= 0.875 ? "ok" : "warn"}>${ok}</span><small>/${n}</small></div>
      ${isExam ? html`<div className=${"verdict " + (ok >= 35 ? "ok" : "warn")}>${ok >= 35 ? "Examen réussi (35 ou plus)" : `Échec : ${35 - ok} bonne${35 - ok > 1 ? "s" : ""} réponse${35 - ok > 1 ? "s" : ""} de plus pour réussir`}</div>`
        : html`<div className="muted">${pct(ok / n)} de réussite au premier essai · durée ${fmtClock(session.end - session.start)}</div>`}
      <div className="row-btns"><button className="btn primary" onClick=${() => go("home")}>Tableau de bord</button>${wrongQs.length ? html`<button className="btn ghost" onClick=${() => start("errors")}>Refaire mes erreurs</button>` : ""}</div>
    </section>
    <div className="two">
      <section className="card"><h2>Points faibles</h2>${weakC.length ? html`<ul className="plain">${weakC.map((c) => html`<li key=${c.k}><span>${CATS[c.k].name}</span><span className="num bad">${c.c}/${c.n}</span></li>`)}</ul>` : html`<p className="muted">Aucun thème sous 80 % dans cette série.</p>`}</section>
      <section className="card"><h2>Points forts</h2>${strongC.length ? html`<ul className="plain">${strongC.map((c) => html`<li key=${c.k}><span>${CATS[c.k].name}</span><span className="num good">${c.c}/${c.n}</span></li>`)}</ul>` : html`<p className="muted">Pas encore de thème à 80 %.</p>`}</section>
    </div>
    ${wrongQs.length > 0 && html`<section className="card"><h2>Règles à revoir</h2><ul className="rules">${wrongQs.map((q) => html`<li key=${q.id}>${q.m}</li>`)}</ul></section>`}
    <section className="card">
      <h2>${isExam ? "Correction complète" : "Mes erreurs de la série"}</h2>
      ${(isExam ? session.order || [] : session.wrong).map((id) => {
        const q = QBY[id]; if (!q) return null;
        const a = answers[id] || []; const good = E.isCorrect(q, a);
        return html`<details className=${"corr " + (good ? "c-ok" : "c-bad")} key=${id} open=${!good && !isExam}>
          <summary><span className=${"pill " + (good ? "pill-ok" : "pill-bad")}>${good ? "juste" : "faux"}</span> ${q.q}</summary>
          <${Scene} id=${q.img} />
          <ul className="corr-opts">${q.o.map((o, i) => html`<li key=${i} className=${(q.a.includes(i) ? "good " : "") + (a.includes(i) && !q.a.includes(i) ? "bad" : "")}><span className="letter">${LETTERS[i]}</span>${o}${a.includes(i) ? html` <em className="muted">(ton choix)</em>` : ""}</li>`)}</ul>
          <p>${q.e}</p>${q.t && html`<p className="trap"><strong>Piège :</strong> ${q.t}</p>`}<div className="memo">${q.m}</div>
        </details>`;
      })}
      ${!isExam && !wrongQs.length && html`<p className="muted">Aucune erreur. Bien joué.</p>`}
    </section>
  </div>`;
}

// ───────── Données ─────────
function Data({ state, update, sync }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [dl, setDl] = useState(null);
  const report = useMemo(() => E.assistantReport(state, QUESTIONS, CATS), [state]);
  useEffect(() => { if (window.claude && window.claude.use) window.claude.use("downloads").then(setDl).catch(() => {}); }, []);
  const exportJson = () => JSON.stringify({ ...state, run: undefined }, null, 0);

  const copy = async (t, label) => {
    try { await navigator.clipboard.writeText(t); setMsg(label + " copié."); }
    catch (e) { setText(t); setMsg("Copie automatique refusée : le texte est dans le champ ci-dessous, sélectionne-le et copie-le."); }
  };
  const doImport = (raw) => {
    try {
      const s = JSON.parse(raw);
      if (!validState(s)) throw new Error("format");
      update(() => ({ ...E.emptyState(), ...s, run: null, updated: Date.now() }));
      setMsg("Données importées : " + Object.keys(s.q).length + " questions et " + s.sessions.length + " sessions.");
    } catch (e) { setMsg("Import impossible : ce texte n'est pas une sauvegarde valide de l'application."); }
  };
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => doImport(r.result); r.readAsText(f); };
  const syncText = {
    connecting: "Connexion à la base de l'artifact…",
    synced: "Synchronisé : tes résultats sont enregistrés dans la base de l'artifact. Dans la conversation, demande « analyse mes résultats » et Claude les lira directement.",
    saving: "Enregistrement en cours…",
    local: "Sauvegarde locale uniquement (navigateur). La base de l'artifact n'est pas accessible dans cette vue : utilise « Copier le rapport » et colle-le dans la conversation.",
    error: "La base de l'artifact a refusé l'enregistrement. Tes données restent sauvegardées dans ce navigateur.",
    full: "La base de l'artifact est pleine. Exporte tes données puis réinitialise l'historique.",
  }[sync];

  return html`<div className="stack">
    <section className="card"><h2>Sauvegarde et synchronisation</h2>
      <div className=${"sync-box s-" + sync}><span className="dot"></span><span>${syncText}</span></div>
      <p className="muted small">Les données sont aussi gardées dans ce navigateur (localStorage). Tu peux fermer la page et revenir plus tard ; la base de l'artifact te permet de reprendre sur un autre appareil connecté au même compte.</p>
    </section>
    <section className="card"><h2>Rapport pour l'assistant</h2>
      <p className="muted small">Résumé compact de tes résultats, à coller dans la conversation si la synchronisation ne fonctionne pas.</p>
      <pre className="report">${report}</pre>
      <button className="btn primary" onClick=${() => copy(report, "Rapport")}>Copier le rapport</button>
    </section>
    <section className="card"><h2>Exporter / importer</h2>
      <div className="row-btns">
        <button className="btn ghost" onClick=${() => copy(exportJson(), "Sauvegarde")}>Copier la sauvegarde</button>
        ${dl && html`<button className="btn ghost" onClick=${() => dl.save({ filename: "code-route-sauvegarde.json", data: exportJson() }).then(() => setMsg("Fichier enregistré.")).catch(() => setMsg("Téléchargement annulé ou refusé."))}>Télécharger (.json)</button>`}
        <label className="btn ghost file">Importer un fichier<input id="importfile" type="file" accept=".json,application/json" onChange=${onFile} /></label>
      </div>
      <label className="muted small" htmlFor="importtext">Ou colle une sauvegarde ici :</label>
      <textarea id="importtext" rows="4" value=${text} onChange=${(e) => setText(e.target.value)} placeholder='{"v":1,...}'></textarea>
      <div className="row-btns"><button className="btn ghost" disabled=${!text.trim()} onClick=${() => doImport(text)}>Importer le texte</button></div>
      ${msg && html`<div className="notice">${msg}</div>`}
    </section>
    <section className="card"><h2>Réglages</h2>
      <label className="switch"><input id="examtimer" type="checkbox" checked=${state.settings.examTimer} onChange=${(e) => update((s) => ({ ...s, settings: { ...s.settings, examTimer: e.target.checked } }))} /> Limite de 20 secondes par question à l'examen blanc</label>
      <div className="row-btns">${confirmReset ? html`<span className="small">Tout effacer définitivement ?</span><button className="btn danger sm" onClick=${() => { update(() => ({ ...E.emptyState(), updated: Date.now() })); setConfirmReset(false); setMsg("Progression réinitialisée."); }}>Oui, effacer</button><button className="btn ghost sm" onClick=${() => setConfirmReset(false)}>Annuler</button>`
        : html`<button className="btn ghost sm" onClick=${() => setConfirmReset(true)}>Réinitialiser la progression</button>`}</div>
    </section>
  </div>`;
}

// ───────── Application ─────────
const VIEWS = [["home", "Accueil"], ["sprint", "Sprint"], ["modes", "Réviser"], ["data", "Données"]];

function App() {
  const [state, update, sync] = useStore();
  const [view, setView] = useState(() => {
    if (loadLocal() && loadLocal().run) return "quiz"; // reprise automatique d'une série interrompue
    const h = (location.hash || "").slice(1);
    return ["home", "sprint", "modes", "data"].includes(h) ? h : "home";
  });
  const [lastSession, setLastSession] = useState(null);
  const [toast, setToast] = useState("");

  const go = (v) => { setView(v); if (["home", "sprint", "modes", "data"].includes(v)) { try { history.replaceState(null, "", "#" + v); } catch (e) { location.hash = v; } } window.scrollTo(0, 0); };
  useEffect(() => { const h = () => { const v = location.hash.slice(1); if (["home", "sprint", "modes", "data"].includes(v)) setView(v); }; window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

  const start = (mode, step = null, onlyCat = null) => {
    let ids;
    if (onlyCat) {
      const sub = QUESTIONS.filter((q) => q.c === onlyCat);
      ids = E.buildSession("target", sub, state, CATS, 15).map((q) => q.id);
    } else {
      let m = mode;
      if (m === "errors" && !QUESTIONS.some((q) => E.isActiveError(state.q[q.id]))) { m = "consolidate"; setToast("Aucune erreur active : série de consolidation à la place."); }
      ids = E.buildSession(m, QUESTIONS, state, CATS, step && step.n).map((q) => q.id);
      mode = m;
    }
    if (!ids.length) { setToast("Aucune question disponible pour ce mode."); return; }
    const now = Date.now();
    update((s) => ({ ...s, run: { mode, ids, idx: 0, results: [], startedAt: now, stepId: step ? step.id : null, stepEnds: step ? now + step.min * 60000 : null, requeued: {} } }));
    setView("quiz"); window.scrollTo(0, 0);
  };

  const finish = useCallback(() => {
    update((s) => {
      const rr = s.run; if (!rr) return s;
      if (!rr.results.length) { setLastSession(null); return { ...s, run: null }; }
      const sum = E.summarize(rr.mode, rr.results, QUESTIONS, rr.startedAt);
      const answers = {}; for (const r of rr.results) if (!(r.id in answers)) answers[r.id] = r.chosen.filter((x) => typeof x === "number");
      const order = []; for (const r of rr.results) if (!order.includes(r.id)) order.push(r.id);
      const full = { ...sum, answers, order };
      setLastSession(full);
      const stored = { ...sum, wrong: sum.wrong.slice(0, 40) };
      const sprint = rr.stepId ? { ...s.sprint, done: { ...s.sprint.done, [rr.stepId]: true } } : s.sprint;
      return { ...s, run: null, sessions: s.sessions.concat(stored).slice(-80), sprint, updated: Date.now() };
    });
    setView("results"); window.scrollTo(0, 0);
  }, [update]);

  const activeErrors = QUESTIONS.filter((q) => E.isActiveError(state.q[q.id])).length;
  const showQuiz = view === "quiz" && state.run;

  return html`<div className="app">
    <header className="top">
      <div className="brand"><span className="logo" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 3 L29 26 H3 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 12 v7 M16 22 v1.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></span><span>Code<b>Sprint</b></span></div>
      <nav>${VIEWS.map(([k, l]) => html`<button key=${k} className=${"nav " + (view === k ? "on" : "")} onClick=${() => go(k)}>${l}${k === "modes" && activeErrors ? html`<span className="badge">${activeErrors}</span>` : ""}</button>`)}</nav>
      <span className=${"sync-dot s-" + sync} title=${"Synchronisation : " + sync}></span>
    </header>
    <main>
      ${showQuiz ? html`<${Quiz} state=${state} update=${update} finish=${finish} onQuit=${finish} />`
        : view === "results" && lastSession ? html`<${Results} session=${lastSession} state=${state} start=${start} go=${go} />`
        : view === "sprint" ? html`<${Sprint} state=${state} update=${update} start=${start} />`
        : view === "modes" ? html`<${Modes} state=${state} start=${start} />`
        : view === "data" ? html`<${Data} state=${state} update=${update} sync=${sync} />`
        : html`<${Dashboard} state=${state} go=${go} start=${start} />`}
    </main>
    <footer className="foot muted small">${QUESTIONS.length} questions originales, vérifiées sur les règles en vigueur fin 2026. Elles ne reproduisent pas les questions officielles.</footer>
    ${toast && html`<div className="toast" role="status">${toast}</div>`}
  </div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
