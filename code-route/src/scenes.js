// Illustrations SVG originales, schématiques (vue de dessus ou panneaux).
// Chaque scène est une chaîne SVG autonome, couleurs fixes (lisibles sur fond clair ou sombre).
(function () {
  const W = 400, H = 240;
  const wrap = (inner, bg = "#2c3a33") =>
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">` +
    `<rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;

  // Voiture vue de dessus, orientée vers le haut (rot en degrés).
  const car = (x, y, rot = 0, color = "#3b82f6", label = "") =>
    `<g transform="translate(${x} ${y}) rotate(${rot})">` +
    `<rect x="-13" y="-24" width="26" height="48" rx="7" fill="${color}" stroke="#0b1210" stroke-width="1.5"/>` +
    `<rect x="-10" y="-14" width="20" height="10" rx="2" fill="#cfe3f3" opacity=".9"/>` +
    `<rect x="-10" y="10" width="20" height="7" rx="2" fill="#cfe3f3" opacity=".7"/>` +
    `<rect x="-11" y="-24" width="6" height="3" fill="#fff6c4"/><rect x="5" y="-24" width="6" height="3" fill="#fff6c4"/>` +
    `</g>` +
    (label ? `<text x="${x}" y="${y + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text>` : "");

  const bike = (x, y, rot = 0) =>
    `<g transform="translate(${x} ${y}) rotate(${rot})">` +
    `<rect x="-2" y="-16" width="4" height="32" rx="2" fill="#111"/>` +
    `<rect x="-8" y="-5" width="16" height="4" rx="2" fill="#111"/>` +
    `<circle cx="0" cy="2" r="7" fill="#f59e0b" stroke="#111" stroke-width="1.5"/></g>`;

  const person = (x, y, color = "#f59e0b") =>
    `<g transform="translate(${x} ${y})"><circle r="7" fill="${color}" stroke="#111" stroke-width="1.5"/><circle r="3" fill="#3b2a1a"/></g>`;

  const label = (x, y, t, size = 12, color = "#ffffff", anchor = "middle") =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" text-anchor="${anchor}" fill="${color}" font-family="sans-serif">${t}</text>`;

  const dashV = (x, y1, y2, color = "#f4f4f4", w = 3, dash = "14 10") =>
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-dasharray="${dash}"/>`;
  const lineV = (x, y1, y2, color = "#f4f4f4", w = 3) =>
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="${w}"/>`;
  const dashH = (y, x1, x2, color = "#f4f4f4", w = 3, dash = "14 10") =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${w}" stroke-dasharray="${dash}"/>`;

  const ROAD = "#4a4f55";

  // Route verticale à double sens (deux voies), avec ou sans trottoirs/bâtiments.
  const twoLaneRoad = (urban) => {
    let s = "";
    if (urban) {
      s += `<rect x="0" y="0" width="110" height="${H}" fill="#7d7a73"/><rect x="290" y="0" width="110" height="${H}" fill="#7d7a73"/>`;
      for (let i = 0; i < 4; i++) {
        s += `<rect x="8" y="${8 + i * 60}" width="70" height="48" rx="3" fill="#9a6b4f"/>`;
        s += `<rect x="322" y="${8 + i * 60}" width="70" height="48" rx="3" fill="#8a7b6b"/>`;
      }
      s += `<rect x="110" y="0" width="12" height="${H}" fill="#a9a59c"/><rect x="278" y="0" width="12" height="${H}" fill="#a9a59c"/>`;
    } else {
      for (let i = 0; i < 7; i++) s += `<circle cx="${40 + (i % 2) * 30}" cy="${20 + i * 35}" r="13" fill="#3f7a4a"/><circle cx="${340 + (i % 2) * 25}" cy="${30 + i * 33}" r="12" fill="#3f7a4a"/>`;
    }
    s += `<rect x="122" y="0" width="156" height="${H}" fill="${ROAD}"/>`;
    s += dashV(200, 0, H);
    return s;
  };

  const overtake = (urban) => {
    let s = twoLaneRoad(urban);
    s += bike(255, 120);
    s += car(205, 132, 0, "#3b82f6");
    // flèche de distance
    s += `<line x1="219" y1="100" x2="248" y2="100" stroke="#fde047" stroke-width="2"/>`;
    s += `<path d="M219 100 l6 -4 v8z M248 100 l-6 -4 v8z" fill="#fde047"/>`;
    s += label(233, 92, "?", 14, "#fde047");
    s += `<rect x="6" y="${H - 30}" width="${urban ? 150 : 170}" height="22" rx="4" fill="#0b1210" opacity=".75"/>`;
    s += label(12, H - 14, urban ? "En agglomération" : "Hors agglomération", 12, "#fff", "start");
    return wrap(s, urban ? "#5e5b55" : "#2f5a37");
  };

  const highway3 = () => {
    let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="#2f5a37"/>`;
    s += `<rect x="70" y="0" width="260" height="${H}" fill="${ROAD}"/>`;
    s += `<rect x="40" y="0" width="30" height="${H}" fill="#6b6f74"/>`; // terre-plein / glissière côté gauche
    s += lineV(70, 0, H, "#d9d9d9", 3) + lineV(330, 0, H, "#f4f4f4", 3);
    s += dashV(157, 0, H, "#f4f4f4", 3, "30 18") + dashV(243, 0, H, "#f4f4f4", 3, "30 18");
    s += car(113, 40, 0, "#9ca3af");
    s += car(200, 140, 0, "#3b82f6");
    s += label(200, 200, "MOI", 11, "#fde047");
    s += label(287, 120, "voie libre", 12, "#c8f7c5");
    s += label(113, 228, "gauche", 10, "#ddd") + label(200, 228, "centre", 10, "#ddd") + label(287, 228, "droite", 10, "#ddd");
    return wrap(s);
  };

  const crossroad = (dirt) => {
    let s = "";
    s += `<rect x="160" y="0" width="80" height="${H}" fill="${ROAD}"/>`;
    if (dirt) {
      s += `<rect x="0" y="85" width="160" height="70" fill="${ROAD}"/>`;
      s += `<rect x="240" y="92" width="160" height="56" fill="#8b6a43"/>`;
      s += `<circle cx="300" cy="110" r="3" fill="#6d5233"/><circle cx="340" cy="132" r="4" fill="#6d5233"/><circle cx="370" cy="105" r="3" fill="#6d5233"/>`;
      s += label(330, 170, "chemin de terre", 11, "#f3e2c7");
    } else {
      s += `<rect x="0" y="85" width="${W}" height="70" fill="${ROAD}"/>`;
    }
    s += dashV(200, 0, 85) + dashV(200, 155, H);
    s += dashH(120, 0, 160);
    if (!dirt) s += dashH(120, 240, W);
    s += car(220, 205, 0, "#3b82f6");
    s += label(220, 238, "MOI", 11, "#fde047");
    s += car(290, 103, -90, "#ef4444");
    return wrap(s, "#2f5a37");
  };

  const roundaboutYield = () => {
    let s = `<rect x="160" y="0" width="80" height="${H}" fill="${ROAD}"/><rect x="0" y="85" width="${W}" height="70" fill="${ROAD}"/>`;
    s += `<circle cx="200" cy="120" r="95" fill="${ROAD}"/><circle cx="200" cy="120" r="40" fill="#3f7a4a" stroke="#ddd" stroke-width="3"/>`;
    s += car(220, 225, 0, "#3b82f6");
    s += car(148, 150, 135, "#ef4444");
    // ligne cédez le passage (discontinue) à l'entrée
    s += dashH(205, 200, 240, "#f4f4f4", 4, "6 5");
    s += `<g transform="translate(270 200)"><path d="M-16 -12 L16 -12 L0 16 Z" fill="#fff" stroke="#d81e1e" stroke-width="5" stroke-linejoin="round"/></g>`;
    return wrap(s, "#2f5a37");
  };

  const arrowLeft = () => {
    let s = `<rect x="80" y="0" width="240" height="${H}" fill="${ROAD}"/>`;
    s += lineV(200, 40, H, "#f4f4f4", 3) + dashV(200, 0, 40);
    s += lineV(80, 0, H) + lineV(320, 0, H);
    s += lineV(260, 0, 180) + dashV(260, 180, H, "#f4f4f4", 3, "30 18") + dashV(140, 0, H, "#f4f4f4", 3, "30 18");
    // flèche tourne-à-gauche dans la voie 200-260
    s += `<path d="M236 150 v-48 h-14 l0 -10 l-16 18 l16 18 v-10 h4 v32z" fill="#f4f4f4"/>`;
    s += `<path d="M296 150 v-60 h8 l-14 -18 l-14 18 h8 v60z" fill="#f4f4f4"/>`;
    s += car(230, 205, 0, "#3b82f6");
    s += label(230, 236, "MOI", 11, "#fde047");
    return wrap(s, "#5e5b55");
  };

  const crosswalk = () => {
    let s = `<rect x="0" y="70" width="${W}" height="100" fill="${ROAD}"/><rect x="0" y="50" width="${W}" height="20" fill="#a9a59c"/><rect x="0" y="170" width="${W}" height="20" fill="#a9a59c"/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="240" y="${74 + i * 16}" width="50" height="9" fill="#f4f4f4"/>`;
    s += dashH(120, 0, 230);
    s += car(120, 145, 90, "#3b82f6");
    s += person(265, 182);
    s += `<path d="M265 170 l0 -10" stroke="#fde047" stroke-width="3"/><path d="M259 162 l6 -8 l6 8" fill="none" stroke="#fde047" stroke-width="3"/>`;
    return wrap(s, "#5e5b55");
  };

  const sasVelo = () => {
    let s = `<rect x="100" y="0" width="200" height="${H}" fill="${ROAD}"/>`;
    s += lineV(200, 0, H);
    s += `<line x1="200" y1="120" x2="300" y2="120" stroke="#f4f4f4" stroke-width="5"/>`;
    s += `<line x1="200" y1="70" x2="300" y2="70" stroke="#f4f4f4" stroke-width="5"/>`;
    s += `<g transform="translate(250 96)" fill="none" stroke="#f4f4f4" stroke-width="3"><circle cx="-14" cy="6" r="9"/><circle cx="14" cy="6" r="9"/><path d="M-14 6 L-4 -8 L8 -8 L14 6 M-4 -8 L2 6 L8 -8"/></g>`;
    s += car(250, 170, 0, "#3b82f6");
    s += `<g transform="translate(330 40)"><rect x="-12" y="-30" width="24" height="60" rx="5" fill="#111"/><circle cy="-17" r="7" fill="#ef4444"/><circle cy="0" r="7" fill="#3a3a3a"/><circle cy="17" r="7" fill="#3a3a3a"/></g>`;
    return wrap(s, "#5e5b55");
  };

  const dash = (light) => {
    let s = `<rect x="20" y="20" width="360" height="200" rx="30" fill="#111518"/>`;
    s += `<circle cx="110" cy="120" r="70" fill="none" stroke="#2a3138" stroke-width="10"/><circle cx="290" cy="120" r="70" fill="none" stroke="#2a3138" stroke-width="10"/>`;
    for (let i = 0; i <= 8; i++) {
      const a = (-220 + i * 32.5) * Math.PI / 180;
      s += `<line x1="${110 + Math.cos(a) * 52}" y1="${120 + Math.sin(a) * 52}" x2="${110 + Math.cos(a) * 62}" y2="${120 + Math.sin(a) * 62}" stroke="#8b949e" stroke-width="2"/>`;
    }
    s += `<line x1="110" y1="120" x2="70" y2="90" stroke="#f97316" stroke-width="3"/>`;
    if (light === "red") {
      // burette d'huile
      s += `<g transform="translate(196 120)" fill="#ef4444"><path d="M-30 -2 h8 l4 -6 h10 l4 6 h6 l22 -10 l3 4 l-21 18 v8 h-36 z"/><rect x="-36" y="-6" width="8" height="10" rx="2"/><path d="M31 6 q4 6 0 9 q-4 -3 0 -9z"/></g>`;
    } else {
      // feux de route : demi-disque + traits horizontaux
      s += `<g transform="translate(200 120)" fill="none" stroke="#3b82f6" stroke-width="4"><path d="M4 -16 C 22 -16 22 16 4 16 Z" fill="#3b82f6"/><path d="M-4 -12 h-18 M-4 -4 h-18 M-4 4 h-18 M-4 12 h-18"/></g>`;
    }
    return wrap(s, "#20262b");
  };

  const curb = (yellow) => {
    let s = `<rect x="0" y="0" width="${W}" height="80" fill="#a9a59c"/><rect x="0" y="80" width="${W}" height="160" fill="${ROAD}"/>`;
    s += `<rect x="0" y="76" width="${W}" height="6" fill="#d3cfc6"/>`;
    if (yellow === "cont") s += `<line x1="0" y1="86" x2="${W}" y2="86" stroke="#facc15" stroke-width="6"/>`;
    if (yellow === "dash") s += `<line x1="0" y1="86" x2="${W}" y2="86" stroke="#facc15" stroke-width="6" stroke-dasharray="22 16"/>`;
    s += dashH(160, 0, W);
    s += car(200, 122, -90, "#3b82f6");
    return wrap(s, "#5e5b55");
  };

  const busZigzag = () => {
    let s = `<rect x="0" y="0" width="${W}" height="70" fill="#a9a59c"/><rect x="0" y="70" width="${W}" height="170" fill="${ROAD}"/>`;
    s += `<rect x="0" y="66" width="${W}" height="6" fill="#d3cfc6"/>`;
    let p = "M40 78";
    for (let i = 0; i < 10; i++) p += ` L${60 + i * 32} ${i % 2 ? 78 : 112}`;
    s += `<path d="${p}" fill="none" stroke="#facc15" stroke-width="5" stroke-linejoin="miter"/>`;
    s += `<line x1="40" y1="112" x2="360" y2="112" stroke="#facc15" stroke-width="3" stroke-dasharray="8 8" opacity=".0"/>`;
    s += label(250, 140, "BUS", 18, "#facc15");
    s += `<g transform="translate(330 40)"><rect x="-2" y="-30" width="4" height="40" fill="#333"/><rect x="-18" y="-46" width="36" height="22" rx="3" fill="#1d4ed8"/>${label(0, -30, "BUS", 11)}</g>`;
    s += dashH(176, 0, W);
    s += car(110, 140, -90, "#3b82f6");
    return wrap(s, "#5e5b55");
  };

  const busLane = (turn) => {
    let s = `<rect x="80" y="0" width="240" height="${H}" fill="${ROAD}"/><rect x="320" y="0" width="80" height="${H}" fill="#a9a59c"/>`;
    if (turn) s += `<rect x="320" y="40" width="80" height="60" fill="${ROAD}"/>`;
    s += lineV(80, 0, H);
    s += dashV(160, 0, H, "#f4f4f4", 3, "30 18");
    if (turn) s += dashV(240, 0, H, "#f4f4f4", 6, "10 10");
    else s += lineV(240, 0, H, "#f4f4f4", 6);
    s += `<text x="280" y="160" font-size="22" font-weight="800" text-anchor="middle" fill="#f4f4f4" font-family="sans-serif" transform="rotate(0)">BUS</text>`;
    s += car(200, 185, 0, "#3b82f6");
    s += label(200, 224, "MOI", 11, "#fde047");
    if (turn) s += `<path d="M206 140 q0 -60 90 -70" fill="none" stroke="#fde047" stroke-width="3" stroke-dasharray="6 5"/><path d="M296 70 l-10 -6 l2 12z" fill="#fde047"/>`;
    return wrap(s, "#5e5b55");
  };

  const mixedLine = () => {
    let s = `<rect x="120" y="0" width="160" height="${H}" fill="${ROAD}"/>`;
    s += lineV(196, 0, H, "#f4f4f4", 3) + dashV(204, 0, H, "#f4f4f4", 3, "18 12");
    s += lineV(120, 0, H) + lineV(280, 0, H);
    s += car(240, 175, 0, "#3b82f6") + label(240, 215, "MOI", 11, "#fde047");
    s += car(240, 70, 0, "#9ca3af");
    s += label(330, 124, "ligne", 10, "#ddd") + label(330, 138, "discontinue", 10, "#ddd") + label(330, 152, "de mon côté", 10, "#ddd");
    return wrap(s, "#2f5a37");
  };

  const rabattement = () => {
    let s = `<rect x="120" y="0" width="160" height="${H}" fill="${ROAD}"/>`;
    s += lineV(120, 0, H) + lineV(280, 0, H);
    s += lineV(200, 0, 70, "#f4f4f4", 3) + dashV(200, 70, H, "#f4f4f4", 3, "30 18");
    for (const y of [200, 135]) s += `<line x1="190" y1="${y}" x2="218" y2="${y - 40}" stroke="#f4f4f4" stroke-width="7"/><path d="M226 ${y - 52} l-20 6 l14 14z" fill="#f4f4f4"/>`;
    s += car(170, 210, 0, "#3b82f6");
    return wrap(s, "#2f5a37");
  };

  const pnLights = () => {
    let s = `<rect x="150" y="0" width="100" height="${H}" fill="${ROAD}"/>`;
    for (let i = 0; i < 2; i++) s += `<rect x="0" y="${84 + i * 50}" width="${W}" height="6" fill="#8c8c8c"/>`;
    for (let x = 6; x < W; x += 22) s += `<rect x="${x}" y="78" width="10" height="62" fill="#6b4f2f" opacity=".7"/>`;
    s += `<g transform="translate(320 60)"><rect x="-3" y="0" width="6" height="90" fill="#ddd"/>`;
    s += `<g transform="translate(0 -10)"><rect x="-26" y="-6" width="52" height="12" fill="#fff" stroke="#d81e1e" stroke-width="2" transform="rotate(30)"/><rect x="-26" y="-6" width="52" height="12" fill="#fff" stroke="#d81e1e" stroke-width="2" transform="rotate(-30)"/></g>`;
    s += `<rect x="-34" y="24" width="68" height="26" rx="13" fill="#111"/><circle cx="-18" cy="37" r="9" fill="#ef4444"/><circle cx="18" cy="37" r="9" fill="#5b1b1b"/></g>`;
    s += `<rect x="252" y="60" width="70" height="8" fill="#fff" stroke="#d81e1e" stroke-width="2" transform="rotate(-80 252 64)"/>`;
    s += car(200, 205, 0, "#3b82f6");
    return wrap(s, "#2f5a37");
  };

  // ── Panneaux (fond neutre) ──
  const SIGN_BG = "#e9ede8";
  const signWrap = (inner) => wrap(`<g transform="translate(200 120)">${inner}</g>`, SIGN_BG);
  const triangle = (inner) =>
    signWrap(`<path d="M0 -92 L92 72 L-92 72 Z" fill="#fff" stroke="#d81e1e" stroke-width="16" stroke-linejoin="round"/>${inner}`);

  const signs = {
    signAB1: () => triangle(`<g stroke="#111" stroke-width="13" stroke-linecap="butt"><line x1="-28" y1="-10" x2="28" y2="50"/><line x1="28" y1="-10" x2="-28" y2="50"/></g>`),
    signAB2: () => triangle(`<rect x="-8" y="-38" width="16" height="96" fill="#111"/><rect x="-36" y="14" width="72" height="6" fill="#111"/>`),
    signYield: () => signWrap(`<path d="M-92 -72 L92 -72 L0 92 Z" fill="#fff" stroke="#d81e1e" stroke-width="16" stroke-linejoin="round"/>`),
    signStop: () => {
      const pts = [];
      for (let i = 0; i < 8; i++) { const a = (22.5 + i * 45) * Math.PI / 180; pts.push(`${(Math.cos(a) * 92).toFixed(1)},${(Math.sin(a) * 92).toFixed(1)}`); }
      return signWrap(`<polygon points="${pts.join(" ")}" fill="#d81e1e" stroke="#fff" stroke-width="5"/><text y="16" font-size="46" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">STOP</text>`);
    },
    signAB6: () => signWrap(`<rect x="-66" y="-66" width="132" height="132" fill="#fff" stroke="#222" stroke-width="2" transform="rotate(45)"/><rect x="-44" y="-44" width="88" height="88" fill="#f5c400" transform="rotate(45)"/>`),
    signB6d: () => signWrap(`<circle r="88" fill="#1d4ed8" stroke="#d81e1e" stroke-width="16"/><g stroke="#d81e1e" stroke-width="16"><line x1="-58" y1="-58" x2="58" y2="58"/><line x1="58" y1="-58" x2="-58" y2="58"/></g>`),
    signB6a1: () => signWrap(`<circle r="88" fill="#1d4ed8" stroke="#d81e1e" stroke-width="16"/><line x1="-58" y1="-58" x2="58" y2="58" stroke="#d81e1e" stroke-width="16"/>`),
  };

  window.SCENES = {
    cyclistOut: () => overtake(false),
    cyclistIn: () => overtake(true),
    highway3,
    crossRight: () => crossroad(false),
    dirtRoad: () => crossroad(true),
    roundaboutYield,
    arrowLeft,
    crosswalk,
    sasVelo,
    dashRed: () => dash("red"),
    dashBlue: () => dash("blue"),
    yellowCont: () => curb("cont"),
    yellowDash: () => curb("dash"),
    busZigzag,
    busLane: () => busLane(false),
    busLaneTurn: () => busLane(true),
    mixedLine,
    rabattement,
    pnLights,
    ...signs,
  };
})();
