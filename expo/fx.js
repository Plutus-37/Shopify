(() => {
  const SL = [...document.querySelectorAll('.slide')];
  const byId = id => document.getElementById(id);
  const fine = matchMedia('(pointer:fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raf = f => requestAnimationFrame(f);

  /* ---------- 1. titles split word by word ---------- */
  function split(el) {
    let i = 0;
    const walk = n => {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/([ \t\n]+)/).forEach(p => {
            if (!p) return;
            if (/^[ \t\n]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--wi', i++);
            const s = document.createElement('span'); s.textContent = p; w.appendChild(s); frag.appendChild(w);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName.toLowerCase() !== 'svg') walk(c);
      });
    };
    walk(el);
  }
  document.querySelectorAll('.slide h1, .slide h2').forEach(h => { h.classList.remove('r'); split(h); });

  /* ---------- 2. count-up numbers ---------- */
  const counters = [...document.querySelectorAll('.stat .n')].map(n => ({ n, t: n.firstChild, v: parseInt(n.firstChild.textContent, 10) }));
  function runCounters(s) {
    counters.filter(c => s.contains(c.n)).forEach(c => {
      const t0 = performance.now() + 450, d = 1300; c.t.textContent = '0';
      const step = now => { const p = Math.min(1, Math.max(0, (now - t0) / d)); c.t.textContent = Math.round(c.v * (1 - Math.pow(1 - p, 3))); if (p < 1) raf(step); };
      raf(step);
    });
  }

  /* ---------- 3. wipe transition ---------- */
  const wipe = document.createElement('div'); wipe.className = 'wipe'; wipe.innerHTML = '<i></i><i></i><b></b>'; document.body.appendChild(wipe);
  window.go = function (n) {
    if (n < 0 || n >= SL.length || n === cur || busy) return;
    busy = true;
    const fwd = n > cur, old = SL[cur];
    if (!reduce) {
      wipe.classList.remove('go', 'back'); void wipe.offsetWidth;
      wipe.querySelector('b').textContent = SL[n].dataset.year || '';
      wipe.classList.add('go'); if (!fwd) wipe.classList.add('back');
    }
    old.classList.add('leaving');
    setTimeout(() => { old.classList.remove('active', 'leaving'); show(n); }, reduce ? 300 : 440);
    setTimeout(() => { busy = false; }, reduce ? 320 : 900);
  };

  /* ---------- 4. cursor + parallax + tilt ---------- */
  if (fine) {
    const ring = document.createElement('div'); ring.className = 'cur';
    const dot = document.createElement('div'); dot.className = 'cur-dot';
    document.body.append(ring, dot);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px)`;
      ring.classList.toggle('big', !!e.target.closest('.card,.draw,button,.toc div,.stop'));
      const px = mx / innerWidth - .5, py = my / innerHeight - .5;
      document.documentElement.style.setProperty('--px', (-px * 22) + 'px');
      document.documentElement.style.setProperty('--py', (-py * 14) + 'px');
    });
    (function loop() { rx += (mx - rx) * .18; ry += (my - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px)`; raf(loop); })();
    document.querySelectorAll('.card').forEach(c => {
      c.addEventListener('mousemove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.classList.add('tilt');
        c.style.transform = `perspective(700px) rotateY(${(x - .5) * 12}deg) rotateX(${(.5 - y) * 12}deg) scale(1.04)`;
        c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
      });
      c.addEventListener('mouseleave', () => { c.classList.remove('tilt'); c.style.transform = ''; });
    });
  }

  /* ---------- 5. lightbox ---------- */
  const lb = document.createElement('div'); lb.id = 'lb'; lb.innerHTML = '<img alt=""><p></p>'; document.body.appendChild(lb);
  const openLB = (src, t) => { lb.querySelector('img').src = src; lb.querySelector('p').textContent = t || ''; lb.classList.add('on'); };
  lb.addEventListener('click', () => lb.classList.remove('on'));
  addEventListener('keydown', e => { if (lb.classList.contains('on') && e.key === 'Escape') { lb.classList.remove('on'); e.stopImmediatePropagation(); } }, true);

  /* ---------- 6. drawing boards ---------- */
  const cache = {};
  const loadImg = src => cache[src] || (cache[src] = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }));
  const draws = [...document.querySelectorAll('.draw')];
  draws.forEach(d => d.addEventListener('click', () => openLB(d.dataset.photo, d.dataset.title)));
  function resetDraw(d) {
    d._run = (d._run || 0) + 1; d.classList.remove('done', 'drawing');
    const c = d.querySelector('canvas'); c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }
  async function runDraw(d, delay) {
    resetDraw(d); const run = d._run;
    const sk = await loadImg(d.dataset.sketch);
    await new Promise(r => setTimeout(r, delay));
    if (run !== d._run || !sk) return;
    const board = d.querySelector('.board'), c = board.querySelector('canvas'), tip = board.querySelector('.tip');
    const W = board.clientWidth, H = board.clientHeight;
    if (!W || !H) { d.classList.add('done'); return; }
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.max(W / sk.width, H / sk.height), iw = sk.width * s, ih = sk.height * s, ix = (W - iw) / 2, iy = (H - ih) / 2;
    const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
    const m = mask.getContext('2d'); m.lineCap = 'round'; m.lineJoin = 'round';
    const rows = Math.max(6, Math.round(H / 24)), rh = H / rows, pts = [];
    for (let r = 0; r < rows; r++) {
      const y = (r + .5) * rh, steps = 26;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        pts.push([(r % 2 ? 1 - t : t) * W + (Math.random() - .5) * 10, y + Math.sin(t * Math.PI * 7 + r * 1.7) * rh * .5]);
      }
    }
    m.lineWidth = rh * 2; m.strokeStyle = '#000';
    d.classList.add('drawing');
    const dur = +d.dataset.dur || 2800, t0 = performance.now(); let last = 1;
    const frame = now => {
      if (run !== d._run) return;
      const p = Math.min(1, (now - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const upto = Math.max(1, Math.floor(e * (pts.length - 1)));
      if (upto > last) { m.beginPath(); m.moveTo(pts[last - 1][0], pts[last - 1][1]); for (let i = last; i <= upto; i++) m.lineTo(pts[i][0], pts[i][1]); m.stroke(); last = upto; }
      ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-in'; ctx.drawImage(sk, ix, iy, iw, ih); ctx.globalCompositeOperation = 'source-over';
      const q = pts[upto]; tip.style.transform = `translate(${q[0]}px,${q[1]}px)`;
      if (p < 1) raf(frame);
      else {
        ctx.clearRect(0, 0, W, H); ctx.drawImage(sk, ix, iy, iw, ih);
        d.classList.remove('drawing');
        setTimeout(() => { if (run === d._run) d.classList.add('done'); }, 500);
      }
    };
    raf(frame);
  }

  /* ---------- 7. flying car + trail ---------- */
  const trail = document.createElement('canvas'); trail.id = 'trail'; document.body.appendChild(trail);
  const car = document.createElement('div'); car.id = 'skycar'; car.innerHTML = '<img src="img/car.webp" alt="">'; document.body.appendChild(car);
  const tc = trail.getContext('2d'); let TW = 0, TH = 0;
  const resize = () => { const dpr = Math.min(2, devicePixelRatio || 1); TW = innerWidth; TH = innerHeight; trail.width = TW * dpr; trail.height = TH * dpr; tc.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener('resize', resize);
  let parts = [], flight = null, loopOn = false, lastT = 0;
  const INK = '#231f1a', YEL = '#efb02a', PAPER = '#fbf7ec';
  const emit = (x, y, vx, vy, kind) => { const o = { x, y, vx, vy, kind, life: 0, max: kind === 'puff' ? 900 + Math.random() * 700 : kind === 'star' ? 800 : 380, r: 5 + Math.random() * 11, rot: Math.random() * 6 }; parts.push(o); return o; };
  function drawParts(dt) {
    tc.clearRect(0, 0, TW, TH);
    parts = parts.filter(p => (p.life += dt) < p.max);
    for (const p of parts) {
      const k = p.life / p.max; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vx *= .965; p.vy *= .965;
      if (p.kind === 'puff') {
        tc.globalAlpha = 1 - k; tc.fillStyle = PAPER; tc.strokeStyle = INK; tc.lineWidth = 2;
        tc.beginPath(); tc.arc(p.x, p.y, p.r * (1 + k * 1.8), 0, 7); tc.fill(); tc.stroke();
      } else if (p.kind === 'line') {
        tc.globalAlpha = (1 - k) * .85; tc.strokeStyle = INK; tc.lineWidth = 3; tc.lineCap = 'round';
        tc.beginPath(); tc.moveTo(p.x, p.y); tc.lineTo(p.x + p.vx * 7, p.y + p.vy * 7); tc.stroke();
      } else {
        const s = 9 * (1 - k) + 2; tc.globalAlpha = 1 - k * k; tc.fillStyle = YEL; tc.strokeStyle = INK; tc.lineWidth = 1.5;
        tc.save(); tc.translate(p.x, p.y); tc.rotate(p.rot + k * 4); tc.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? s * .35 : s; tc.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        tc.closePath(); tc.fill(); tc.stroke(); tc.restore();
      }
    }
    tc.globalAlpha = 1;
  }
  const bez = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function target() {
    const st = document.querySelector('.slide.active .stage.car');
    if (!st) return [TW * .7, TH * .5];
    const r = st.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * .55];
  }
  function startCar(mode) {
    const cw = car.offsetWidth || 400, ch = cw * .62;
    let segs;
    if (mode === 'flyby') {
      segs = [{ p: [[TW + cw, TH * .2], [TW * .62, TH * .55], [TW * .3, -TH * .12], [-cw, TH * .16]], d: 2800 }];
    } else {
      segs = [
        { p: [[TW + cw, TH * .05], [TW * .75, -TH * .15], [TW * .35, TH * .95], [TW * .16, TH * .55]], d: 1500 },
        { p: [[TW * .16, TH * .55], [TW * .02, TH * .15], [null, -TH * .2], [null, null]], d: 1700, toTarget: true }
      ];
    }
    flight = { mode, segs, i: 0, t0: performance.now(), x: segs[0].p[0][0], y: segs[0].p[0][1], face: -1, hover: false, cw, ch };
    car.classList.add('on'); car.classList.remove('flip');
    if (!loopOn) { loopOn = true; lastT = performance.now(); raf(tick); }
  }
  function stopCar() { flight = null; car.classList.remove('on'); }
  function carLeave() {
    if (!flight) return; const f = flight, now = performance.now();
    f.hover = false; f.mode = 'flyby'; f.i = 0; f.t0 = now;
    f.segs = [{ p: [[f.x, f.y], [f.x + TW * .12, f.y - TH * .45], [TW * .85, -TH * .05], [TW + f.cw, -TH * .35]], d: 1800 }];
  }
  /* plane */
  const plane = document.createElement('div'); plane.id = 'plane'; plane.innerHTML = '<img src="img/c_plane.webp" alt="">'; document.body.appendChild(plane);
  let pl = null, planeDone = false;
  const ship = document.createElement('div'); ship.id = 'ship'; ship.innerHTML = '<img src="img/b_ship.webp" alt="">'; document.body.appendChild(ship);
  let sh = null;
  function startShip() { sh = { t0: performance.now(), d: 13000, w: ship.offsetWidth || 400 }; ship.classList.add('on'); if (!loopOn) { loopOn = true; lastT = performance.now(); raf(tick); } }
  function stopShip() { sh = null; ship.classList.remove('on'); }
  function startPlane() { planeDone = true; pl = { t0: performance.now(), d: 9000, w: plane.offsetWidth || 300 }; plane.classList.add('on'); if (!loopOn) { loopOn = true; lastT = performance.now(); raf(tick); } }
  function stopPlane() { pl = null; plane.classList.remove('on'); }
  /* runners (final scene) */
  const runners = document.createElement('div'); runners.id = 'runners';
  runners.innerHTML = '<div class="rb"></div><img src="img/r_papy.webp" alt=""><img class="kid" src="img/r_kid.webp" alt="">';
  document.body.appendChild(runners);
  let scene = 0;
  function stopScene() { scene++; runners.className = ''; runners.style.transition = 'none'; runners.querySelector('.rb').classList.remove('on'); }
  function finale() {
    const id = ++scene, at = (ms, f) => setTimeout(() => { if (id === scene) f(); }, ms);
    const rb = runners.querySelector('.rb');
    at(4400, () => {
      const st = document.querySelector('.slide.active .stage.car'); if (!st) return;
      const r = st.getBoundingClientRect(), h = runners.offsetHeight || TH * .18;
      const y = Math.min(TH * .9, r.bottom) - h, x1 = Math.max(10, r.left + r.width * .12);
      runners.style.transition = 'none'; runners.style.transform = `translate(${-runners.offsetWidth - 40}px,${y}px)`;
      void runners.offsetWidth; runners.classList.add('on', 'run');
      runners.style.transition = 'transform 2.4s cubic-bezier(.3,.1,.4,1)'; runners.style.transform = `translate(${x1}px,${y}px)`;
    });
    at(6300, carLeave);
    at(6900, () => { runners.classList.remove('run'); runners.classList.add('jump'); });
    at(8200, () => { runners.classList.remove('jump'); rb.textContent = 'Bon… rendez-vous en 1936 !'; rb.classList.add('on'); });
  }
  function tick(now) {
    const dt = Math.min(50, now - lastT); lastT = now;
    if (flight) {
      const f = flight; let nx, ny;
      if (!f.hover) {
        const sg = f.segs[f.i]; let p = sg.p;
        if (sg.toTarget) { const [tx, ty] = target(); p = [p[0], p[1], [tx - TW * .12, p[2][1]], [tx, ty]]; }
        const t = Math.min(1, (now - f.t0) / sg.d), e = ease(t);
        nx = bez(p[0][0], p[1][0], p[2][0], p[3][0], e); ny = bez(p[0][1], p[1][1], p[2][1], p[3][1], e);
        if (t >= 1) {
          if (f.i < f.segs.length - 1) { f.i++; f.t0 = now; }
          else if (f.mode === 'flyby') { stopCar(); }
          else { f.hover = true; f.h0 = now; }
        }
      } else {
        const [tx, ty] = target(), k = (now - f.h0) / 1000;
        nx = tx + Math.sin(k * 1.2) * 16; ny = ty + Math.sin(k * 2.3) * 11;
      }
      if (flight) {
        const vx = nx - f.x, vy = ny - f.y;
        if (!f.hover && Math.abs(vx) > .8) f.face = vx > 0 ? 1 : -1;
        if (f.hover && f.face !== -1 && now - f.h0 > 250) f.face = -1;
        car.classList.toggle('flip', f.face === 1);
        let rot = f.hover ? Math.sin((now - f.h0) / 1000 * 1.7) * 3 : Math.max(-28, Math.min(28, Math.atan2(-vy, Math.abs(vx) + .01) * 57.3 * .6)) * (f.face === -1 ? 1 : -1);
        f.x = nx; f.y = ny;
        car.style.transform = `translate(${nx - f.cw / 2}px,${ny - f.ch / 2}px) rotate(${rot}deg)`;
        const rearX = nx - f.face * f.cw * .42, rearY = ny + f.ch * .12;
        const speed = Math.hypot(vx, vy);
        const n = f.hover ? (Math.random() < .25 ? 1 : 0) : 2;
        for (let i = 0; i < n; i++) emit(rearX + (Math.random() - .5) * 10, rearY + (Math.random() - .5) * 14, -f.face * (1 + Math.random() * 1.5), -.3 - Math.random() * .6, 'puff');
        if (!f.hover && speed > 2) emit(rearX, rearY - f.ch * .15 + (Math.random() - .5) * f.ch * .5, -f.face * (6 + Math.random() * 4), 0, 'line');
        if (Math.random() < (f.hover ? .06 : .35)) emit(rearX + (Math.random() - .5) * 30, rearY + (Math.random() - .5) * 30, (Math.random() - .5) * 3, (Math.random() - .5) * 3, 'star');
      }
    }
    if (pl) {
      const k = (now - pl.t0) / pl.d;
      if (k >= 1) stopPlane();
      else {
        const x = TW + pl.w - k * (TW + pl.w * 2), y = TH * .08 + Math.sin(k * 9) * 10, rot = Math.cos(k * 9) * 4;
        plane.style.transform = `translate(${x - pl.w / 2}px,${y - pl.w * .33}px) rotate(${rot}deg)`;
        if (Math.random() < .55) { const o = emit(x + pl.w * .42, y + (Math.random() - .5) * 8, 1.2 + Math.random(), -.2, 'puff'); o.r = 3 + Math.random() * 5; o.max = 1400; }
      }
    }
    if (sh) {
      const k = (now - sh.t0) / sh.d;
      if (k >= 1) stopShip();
      else {
        const x = TW + sh.w * .6 - k * (TW + sh.w * 1.2), y = TH * .13 + Math.sin(k * 6) * 14, rot = Math.sin(k * 6 + 1) * 3;
        ship.style.transform = `translate(${x - sh.w / 2}px,${y - sh.w * .33}px) rotate(${rot}deg)`;
        if (Math.random() < .4) { const o = emit(x + sh.w * .45, y + (Math.random() - .5) * 30, 1 + Math.random(), -.3, 'puff'); o.r = 4 + Math.random() * 7; o.max = 1600; }
        if (Math.random() < .08) emit(x + (Math.random() - .5) * sh.w * .6, y - sh.w * .25, (Math.random() - .5) * 2, -1, 'star');
      }
    }
    drawParts(dt);
    if (flight || pl || sh || parts.length) raf(tick); else { loopOn = false; tc.clearRect(0, 0, TW, TH); }
  }

  /* ---------- 7b. cameo companions ---------- */
  const cam = document.createElement('div'); cam.className = 'cameo';
  cam.innerHTML = '<img alt=""><div class="cb"><b>Le saviez-vous ?</b><span class="t"></span><span class="c"></span></div>';
  document.body.appendChild(cam);
  const NAMES = { papy: 'M. Auguste', kid: 'Lucien' };
  let camRun = 0;
  function cameo(s) {
    const run = ++camRun; cam.classList.remove('on');
    const who = s.dataset.cameo; if (!who) return;
    setTimeout(() => {
      if (run !== camRun) return;
      cam.querySelector('img').src = 'img/c_' + who + '.webp';
      cam.querySelector('b').textContent = NAMES[who] + ' : le saviez-vous ?';
      const full = s.dataset.cameoText, tt = cam.querySelector('.t'); tt.textContent = '';
      cam.classList.add('on');
      let i = 0; setTimeout(function type() { if (run !== camRun) return; tt.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(type, 22); }, 1100);
    }, 1900);
  }

  /* ---------- 8. slide hook ---------- */
  let started = false;
  function onSlide(n) {
    const s = SL[n];
    runCounters(s);
    draws.forEach(d => { if (s.contains(d)) runDraw(d, 1150); else resetDraw(d); });
    if (s.querySelector('.stage.car')) { startCar('land'); finale(); }
    else { stopScene(); if (flight && flight.mode === 'land') stopCar(); }
    if (s.dataset.plane && !planeDone) setTimeout(() => { if (SL[cur] === s && !pl) startPlane(); }, 1500); else if (!s.dataset.plane) stopPlane();
    if (s.dataset.ship) setTimeout(() => { if (SL[cur] === s && !sh) startShip(); }, 900); else stopShip();
  }
  document.addEventListener('slide', e => { if (started) onSlide(e.detail); });

  /* ---------- 9. intro ---------- */
  const intro = document.createElement('div'); intro.id = 'intro';
  intro.innerHTML = '<div class="half t"></div><div class="half b"></div><div class="mini"><img src="img/m0.webp" alt=""></div><div class="yr">2026</div><div class="lbl">On remonte le temps…</div><div class="bar"><i></i></div><button class="go">Commencer le voyage ▸</button>';
  document.body.appendChild(intro);
  const srcs = [...new Set([...document.querySelectorAll('img')].map(i => i.getAttribute('src')).concat(draws.map(d => d.dataset.sketch), ['img/car.webp','img/c_plane.webp','img/r_papy.webp','img/r_kid.webp','img/b_ship.webp','img/b_workers.webp','img/b_rank.webp','img/b_train.webp']))].filter(Boolean);
  let loaded = 0, counted = false;
  const bar = intro.querySelector('.bar i');
  const check = () => { if (counted && loaded >= srcs.length) { intro.classList.add('ready'); intro.querySelector('.lbl').textContent = 'Destination : 1880'; } };
  srcs.forEach(s => loadImg(s).then(() => { loaded++; bar.style.width = (loaded / srcs.length * 100) + '%'; check(); }));
  const yr = intro.querySelector('.yr'), y0 = performance.now();
  (function cnt(now) { const p = Math.min(1, (now - y0) / 2400), e = 1 - Math.pow(1 - p, 4); yr.textContent = Math.round(2026 - 146 * e); if (p < 1) raf(cnt); else { counted = true; check(); } })(y0);
  setTimeout(() => { counted = true; loaded = srcs.length; check(); }, 9000);
  function start() {
    if (started) return; started = true;
    try { if (fine && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    intro.classList.add('out');
    setTimeout(() => {
      intro.classList.add('gone');
      const s = SL[cur]; s.classList.remove('active'); void s.offsetWidth; s.classList.add('active');
      onSlide(cur);
      if (cur === 0) setTimeout(() => startCar('flyby'), 1600);
    }, 480);
    setTimeout(() => intro.remove(), 1200);
  }
  intro.addEventListener('click', start);
  addEventListener('keydown', e => {
    if (started) return;
    if ([' ', 'Enter', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); start(); }
    else e.stopImmediatePropagation();
  }, true);
})();
