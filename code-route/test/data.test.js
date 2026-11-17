// Tests Node : intégrité de la banque + moteur.
global.window = {};
require("../src/questions.js"); require("../src/scenes.js"); require("../src/engine.js");
const { QUESTIONS: Q, CATS, SCENES, Engine: E } = window;
let fail = 0; const check = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const ids = new Set(), texts = new Set();
for (const q of Q) {
  check(!ids.has(q.id), "id dupliqué " + q.id); ids.add(q.id);
  const key = q.q + "|" + (q.img || ""); check(!texts.has(key), "énoncé dupliqué " + q.id); texts.add(key);
  check(CATS[q.c], "catégorie " + q.id);
  check(q.id.startsWith(q.c), "préfixe " + q.id);
  check(q.o.length >= 2 && q.o.length <= 4, "nb options " + q.id);
  check(q.a.length >= 1 && q.a.every((i) => i >= 0 && i < q.o.length), "réponses " + q.id);
  check(new Set(q.a).size === q.a.length, "réponses dupliquées " + q.id);
  check(q.e && q.m && [1, 2, 3].includes(q.d), "champs " + q.id);
  check(new Set(q.o).size === q.o.length, "options dupliquées " + q.id);
  if (q.img) { check(SCENES[q.img], "image " + q.id); const svg = SCENES[q.img](); check(svg.startsWith("<svg") && !svg.includes("NaN") && !svg.includes("undefined"), "svg " + q.id); }
}
const per = {}; for (const q of Q) per[q.c] = (per[q.c] || 0) + 1;
console.log("Questions:", Q.length, per, "multi:", Q.filter((q) => q.a.length > 1).length, "images:", Q.filter((q) => q.img).length);
// Questions imposées
const must = { "CIR-01": [2], "USA-01": [0], "USA-03": [0], "USA-04": [1], "CIR-05": [1], "QUI-01": [0], "QUI-02": [1], "SIG-01": [1], "CIR-25": [0], "CIR-02": [1] };
for (const [id, a] of Object.entries(must)) check(JSON.stringify(Q.find((q) => q.id === id).a) === JSON.stringify(a), "imposée " + id);
// Correction multi-réponses
const m = Q.find((q) => q.id === "LEG-14");
check(E.isCorrect(m, [1, 0]), "multi ordre"); check(!E.isCorrect(m, [0]), "multi partiel"); check(!E.isCorrect(m, [0, 1, 2]), "multi en trop"); check(!E.isCorrect(m, []), "vide");
// Moteur
let s = E.emptyState(); const now = Date.now();
let r = E.recordAnswer(s, m, [0], 5000, now); s = r.state;
check(!r.ok && s.q["LEG-14"].box === 0 && s.q["LEG-14"].w === 1, "erreur enregistrée");
check(E.isActiveError(s.q["LEG-14"]), "erreur active");
s = E.recordAnswer(s, m, [0, 1], 4000, now + 1).state;
check(E.isActiveError(s.q["LEG-14"]), "toujours active après 1 bonne réponse");
s = E.recordAnswer(s, m, [0, 1], 4000, now + 2).state; s = E.recordAnswer(s, m, [0, 1], 4000, now + 3).state;
check(!E.isActiveError(s.q["LEG-14"]) && s.q["LEG-14"].box === 3, "sortie après 3 bonnes réponses");
const fresh = E.emptyState();
const r0 = E.readiness(fresh, Q, CATS); console.log("score estimé initial", r0.score);
check(Math.abs(r0.score - 33) < 1, "prior ≈ 33");
for (const mode of ["diag", "exam"]) { const b = E.buildSession(mode, Q, fresh, CATS); check(b.length === 40 && new Set(b.map((q) => q.id)).size === 40, mode + " 40 uniques"); }
for (const mode of ["target", "hard", "consolidate"]) { const b = E.buildSession(mode, Q, fresh, CATS); check(b.length >= 20 && new Set(b.map((q) => q.id)).size === b.length, mode + " taille " + b.length); }
// Le mode ciblé doit sur-représenter le thème le plus faible
let st = E.emptyState(); for (const q of Q.filter((q) => q.c === "EQU")) st = E.recordAnswer(st, q, [99], 3000).state;
for (const q of Q.filter((q) => q.c !== "EQU").slice(0, 60)) st = E.recordAnswer(st, q, q.a, 3000).state;
const prio = E.priorityCats(st, Q, CATS, 1)[0].key; check(prio === "EQU", "priorité EQU, obtenu " + prio);
const tgt = E.buildSession("target", Q, st, CATS); const equN = tgt.filter((q) => q.c === "EQU").length;
console.log("ciblé: EQU", equN, "/", tgt.length); check(equN >= 8, "ciblé concentre EQU");
const errs = E.buildSession("errors", Q, st, CATS); check(errs.length === 18 && errs.every((q) => q.c === "EQU"), "mode erreurs " + errs.length);
const sum = E.summarize("exam", [{ id: "LEG-01", ok: true }, { id: "LEG-02", ok: false }, { id: "LEG-02", ok: true }], Q, now - 1000);
check(sum.n === 2 && sum.correct === 1 && sum.wrong[0] === "LEG-02", "résumé premier essai");
console.log(fail ? fail + " ÉCHEC(S)" : "Tous les tests passent"); process.exit(fail ? 1 : 0);
