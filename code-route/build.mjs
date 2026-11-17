// Assemble les sources en une seule page HTML autonome (dist/index.html).
import { readFileSync, writeFileSync } from "node:fs";
const r = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");
const page = `<title>Sprint Code de la route</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Sora:wght@500;600;700&display=swap">
<style>
${r("./src/style.css")}
</style>
<div id="root"><p style="padding:24px;color:#8fa7a2;font-family:sans-serif">Chargement de l'application…</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/htm@3.1.1/dist/htm.umd.js"></script>
<script>
${safe(r("./src/questions.js"))}
${safe(r("./src/scenes.js"))}
${safe(r("./src/engine.js"))}
${safe(r("./src/app.js"))}
</script>
`;
writeFileSync(new URL("./dist/index.html", import.meta.url), page);
console.log("dist/index.html", (page.length / 1024).toFixed(1) + " KiB");
