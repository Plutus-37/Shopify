// Test de bout en bout (Playwright) : SHOTS=<dossier> node test/e2e.js
const { chromium } = require("playwright");
const path = require("path");
const SHOTS = process.env.SHOTS || path.resolve(__dirname);
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const url = "file://" + path.resolve(__dirname, "../dist/index.html");
  const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) process.exitCode = 1; };
  const currentId = (p) => p.evaluate(() => { const s = JSON.parse(localStorage.getItem("cdr-state-v1")); return s.run.ids[s.run.idx]; });
  const getQ = (p, id) => p.evaluate((id) => window.QUESTIONS.find((x) => x.id === id), id);

  await page.goto(url);
  await page.waitForSelector(".hero", { timeout: 20000 });
  ok((await page.textContent(".big")).includes("32.8"), "tableau de bord + score estimé initial");
  await page.screenshot({ path: SHOTS + "/dash.png" });

  // Diagnostic : 3 réponses dont 1 fausse volontaire
  await page.click("nav >> text=Réviser");
  await page.click(".mode >> nth=0");
  for (let i = 0; i < 3; i++) {
    await page.waitForSelector(".qcard");
    const id = await currentId(page); const q = await getQ(page, id);
    const pick = i === 0 ? [...Array(q.o.length).keys()].filter((k) => !q.a.includes(k)).slice(0, 1) : q.a;
    for (const k of pick) await page.click(`.opt >> nth=${k}`);
    await page.click("button:has-text('Valider')");
    await page.waitForSelector(".feedback");
    const fb = await page.textContent(".fb-title");
    ok(fb === (i === 0 ? "Mauvaise réponse" : "Bonne réponse"), `correction question ${i + 1} (${id}) : ${fb}`);
    if (i === 0) await page.screenshot({ path: SHOTS + "/feedback.png", fullPage: true });
    await page.click("button:has-text('Suivante')");
  }
  const st0 = await page.evaluate(() => JSON.parse(localStorage.getItem("cdr-state-v1")));
  ok(st0.run.ids.length === 41, "question ratée réinsérée plus loin dans la série");

  await page.reload();
  await page.waitForSelector(".qcard");
  ok((await page.textContent(".quiz-meta")).includes("4/41"), "série reprise à la bonne question après rechargement");
  await page.click("button:has-text('Terminer')");
  await page.waitForSelector(".hero-res");
  ok((await page.textContent(".hero-res .big")).replace(/\s/g, "") === "2/3", "bilan 2/3");

  // Examen blanc complet, minuteur désactivé, toutes les réponses justes
  await page.click("nav >> text=Données");
  await page.uncheck("#examtimer");
  await page.click("nav >> text=Réviser");
  await page.click(".mode >> nth=4");
  for (let i = 0; i < 40; i++) {
    await page.waitForSelector(".qcard");
    const q = await getQ(page, await currentId(page));
    for (const k of q.a) await page.click(`.opt >> nth=${k}`);
    if (i === 0) ok(!(await page.isVisible(".feedback")), "aucune correction pendant l'examen");
    await page.click("button:has-text('Valider')");
  }
  await page.waitForSelector(".hero-res");
  ok((await page.textContent(".verdict")).includes("réussi"), "examen réussi : " + (await page.textContent(".hero-res .big")));
  ok((await page.$$(".corr")).length === 40, "correction complète des 40 questions");
  await page.click("button:has-text('Tableau de bord')");
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("cdr-state-v1")));
  ok(st.sessions.length === 2 && st.sessions[1].correct === 40 && st.sessions[1].n === 40, "historique sauvegardé");
  ok((await page.textContent(".kpis")).includes("43"), "compteur de réponses = 43");
  ok((await page.textContent(".exams")).includes("40"), "examen dans le graphique");
  await page.screenshot({ path: SHOTS + "/dash-after.png", fullPage: true });

  // Mode erreurs : 1 erreur active
  await page.click("nav >> text=Réviser");
  await page.click(".mode >> nth=2");
  await page.waitForSelector(".qcard");
  ok((await page.textContent(".quiz-meta")).includes("1/1"), "mode erreurs : 1 question");
  await page.click("button:has-text('Quitter')");

  // Export / import
  await page.click("nav >> text=Données");
  const exported = await page.evaluate(() => JSON.stringify({ ...JSON.parse(localStorage.getItem("cdr-state-v1")), run: undefined }));
  await page.click("button:has-text('Réinitialiser')");
  await page.click("button:has-text('Oui, effacer')");
  await page.fill("#importtext", exported);
  await page.click("button:has-text('Importer le texte')");
  ok((await page.textContent(".notice")).includes("2 sessions"), "import d'une sauvegarde");

  // Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(url);
  await mp.waitForSelector(".hero");
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "pas de défilement horizontal (accueil mobile)");
  await mp.screenshot({ path: SHOTS + "/mobile-dash.png", fullPage: true });
  await mp.click("nav >> text=Sprint");
  await mp.click(".steps li.next .btn");
  await mp.waitForSelector(".qcard");
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "pas de défilement horizontal (quiz mobile)");
  ok(await mp.isVisible(".timer"), "minuteur d'étape visible");
  await mp.screenshot({ path: SHOTS + "/mobile-quiz.png", fullPage: true });

  ok(errors.length === 0, "aucune erreur JavaScript " + errors.join(" | "));
  await browser.close();
})();
