/* =========================================================
   Mini Game "Lumba-Lumba Lompat" — ala game dino Chrome saat offline.
   Dipakai di halaman pelanggan (index.php) dan panel admin (admin.php).
   Kontrol: Spasi / ↑ / ketuk layar = lompat · ↓ = turun cepat · Esc = tutup
========================================================= */
(function(){
  'use strict';
  if (window.__bhMiniGame) return;
  // Di panel admin, tombol hanya muncul kalau sudah login
  if (typeof ADMIN_LOGGED_IN !== 'undefined' && !ADMIN_LOGGED_IN) return;
  window.__bhMiniGame = true;

  var W = 640, H = 220, GROUND = 182;
  var KEY = { hi:'bh_game_hi', snd:'bh_game_snd', pos:'bh_game_fab' };
  var store = {
    get: function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set: function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  };
  var mod = function(a,n){ return ((a % n) + n) % n; };
  var rnd = function(a,b){ return a + Math.random()*(b-a); };

  /* ---------- DOM ---------- */
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'mg-fab';
  fab.setAttribute('aria-label', 'Buka mini game');
  fab.innerHTML = '<img src="assets/dolphin.png" alt=""><span class="mg-pad" aria-hidden="true">🎮</span>';

  var tip = document.createElement('div');
  tip.className = 'mg-tip'; tip.textContent = 'Mini Game 🎮 (bisa digeser)';

  var overlay = document.createElement('div');
  overlay.className = 'mg-overlay';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Mini game');
  overlay.innerHTML =
    '<div class="mg-box">' +
      '<div class="mg-head">' +
        '<h2 class="mg-title">🐬 Lumba-Lumba Lompat</h2>' +
        '<button type="button" class="mg-btn mg-snd"></button>' +
        '<button type="button" class="mg-btn mg-close" aria-label="Tutup">×</button>' +
      '</div>' +
      '<div class="mg-stage"><canvas class="mg-canvas" tabindex="0"></canvas></div>' +
      '<p class="mg-hint mg-hint-kb"><kbd>Spasi</kbd> / <kbd>↑</kbd> atau ketuk layar untuk melompat · <kbd>↓</kbd> turun cepat · <kbd>Esc</kbd> tutup</p>' +
      '<p class="mg-hint mg-hint-touch">Ketuk layar untuk melompat · hindari bulu babi, jangan melompat saat ada ubur-ubur 🪼</p>' +
    '</div>';

  document.body.appendChild(fab);
  document.body.appendChild(tip);
  document.body.appendChild(overlay);

  var canvas = overlay.querySelector('.mg-canvas');
  var sndBtn = overlay.querySelector('.mg-snd');
  var closeBtn = overlay.querySelector('.mg-close');
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* ---------- Suara (default mati) ---------- */
  var soundOn = store.get(KEY.snd) === '1';
  var actx = null;
  function paintSnd(){ sndBtn.textContent = soundOn ? '🔊 Suara' : '🔇 Suara'; }
  function beep(f, d, type, vol){
    if (!soundOn) return;
    try{
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.05, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + d);
      o.connect(g); g.connect(actx.destination);
      o.start(n); o.stop(n + d);
    }catch(e){}
  }
  paintSnd();

  /* ---------- Gambar lumba-lumba ---------- */
  var dolphin = new Image(), dolphinOk = false;
  dolphin.onload = function(){ dolphinOk = true; };
  dolphin.src = 'assets/dolphin.png';

  /* ---------- State game ---------- */
  var P = { x: 64, w: 56, h: 49, y: 0, vy: 0, onGround: true };
  var state = 'ready';          // ready | running | over
  var isOpen = false;
  var speed, score, hi, obstacles, spawnIn, bubbles, scroll, fast;
  var raf = 0, last = 0, t = 0, overAt = 0, flashUntil = 0, milestone = 0, newRecord = false;
  hi = parseInt(store.get(KEY.hi), 10) || 0;

  function resetGame(){
    P.y = GROUND - P.h; P.vy = 0; P.onGround = true;
    speed = 5.5; score = 0; obstacles = []; spawnIn = 380;
    scroll = 0; fast = false; milestone = 0; flashUntil = 0; newRecord = false;
    bubbles = [];
    for (var i = 0; i < 16; i++) bubbles.push({ x: rnd(0, W), y: rnd(10, GROUND - 10), r: rnd(2, 6), s: rnd(.3, 1) });
  }

  function jump(){
    if (!P.onGround) return;
    P.vy = -11.8; P.onGround = false;
    beep(520, .12, 'triangle');
  }

  function spawn(){
    var jelly = score > 250 && Math.random() < 0.28;
    if (jelly){
      obstacles.push({ type: 'j', x: W + 20, w: 34, h: 40, baseY: GROUND - 92, ph: rnd(0, 6), y: GROUND - 92 });
      return 34;
    }
    var count = Math.random() < 0.35 ? 2 : 1;
    var s = Math.round(rnd(26, 38));
    var w = count * s + (count - 1) * 4;
    obstacles.push({ type: 'u', x: W + 20, w: w, h: s, s: s, count: count, y: GROUND - s + 4 });
    return w;
  }

  function hits(a, b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function endGame(){
    state = 'over'; overAt = performance.now();
    var s = Math.floor(score);
    if (s > hi){ hi = s; newRecord = s > 0; store.set(KEY.hi, String(hi)); }
    beep(220, .4, 'sawtooth', .06);
  }

  /* ---------- Update ---------- */
  function update(dt){
    // gerakan latar: pelan saat siap, normal saat main, berhenti saat kalah
    var bg = state === 'running' ? speed : (state === 'ready' ? 1.4 : 0);
    scroll += bg * dt;
    for (var i = 0; i < bubbles.length; i++){
      var b = bubbles[i];
      b.x -= (bg * 0.35 + 0.15) * b.s * dt; b.y -= 0.22 * b.s * dt;
      if (b.x < -10) { b.x = W + 10; b.y = rnd(20, GROUND - 6); }
      if (b.y < -10) { b.y = GROUND - 4; }
    }
    if (state === 'ready'){ // melayang-layang santai
      P.y = GROUND - P.h + Math.sin(t * 0.004) * 4; return;
    }
    if (state !== 'running') return;

    score += speed * dt * 0.04;
    speed = Math.min(12.5, 5.5 + score * 0.005);

    // fisika lumba-lumba
    if (!P.onGround){
      P.vy += (0.62 + (fast ? 1.0 : 0)) * dt;
      P.y += P.vy * dt;
      if (P.y >= GROUND - P.h){ P.y = GROUND - P.h; P.vy = 0; P.onGround = true; }
    }

    // rintangan
    for (var k = obstacles.length - 1; k >= 0; k--){
      var o = obstacles[k];
      o.x -= speed * dt;
      if (o.type === 'j') o.y = o.baseY + Math.sin(t * 0.004 + o.ph) * 5;
      if (o.x + o.w < -10) obstacles.splice(k, 1);
    }
    spawnIn -= speed * dt;
    if (spawnIn <= 0){
      var w = spawn();
      var jumpDist = speed * 37; // jarak tempuh selama 1 lompatan
      spawnIn = jumpDist * 1.1 + rnd(40, 220) + w;
    }

    // tabrakan (kotak dikecilkan sedikit supaya adil)
    var pb = { x: P.x + 12, y: P.y + 10, w: P.w - 26, h: P.h - 18 };
    for (var m = 0; m < obstacles.length; m++){
      var q = obstacles[m];
      var ob = q.type === 'u'
        ? { x: q.x + 5, y: q.y + 5, w: q.w - 10, h: q.h - 8 }
        : { x: q.x + 4, y: q.y + 4, w: q.w - 8,  h: q.h - 10 };
      if (hits(pb, ob)){ endGame(); return; }
    }

    // kilatan tiap kelipatan 100
    var ms = Math.floor(score / 100);
    if (ms > milestone){
      milestone = ms; flashUntil = t + 700;
      beep(880, .09, 'square', .035);
      setTimeout(function(){ beep(1175, .12, 'square', .035); }, 110);
    }
  }

  /* ---------- Gambar ---------- */
  function rr(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function drawBackground(){
    var g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#D6EEFF'); g.addColorStop(.55, '#8FCDF5'); g.addColorStop(1, '#4DA3EA');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // berkas cahaya
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    for (var i = 0; i < 4; i++){
      var rx = mod(i * 190 + 40 - scroll * 0.05, W + 200) - 100;
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx + 60, 0); ctx.lineTo(rx + 20, GROUND); ctx.lineTo(rx - 70, GROUND);
      ctx.closePath(); ctx.fill();
    }
    // bukit jauh
    ctx.fillStyle = 'rgba(18,64,122,.16)';
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (var x = 0; x <= W; x += 8){
      var sx = x + scroll * 0.25;
      ctx.lineTo(x, GROUND - 28 - Math.sin(sx * 0.012) * 14 - Math.sin(sx * 0.031) * 8);
    }
    ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();

    // gelembung
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2;
    for (var j = 0; j < bubbles.length; j++){
      var b = bubbles[j];
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill(); ctx.stroke();
    }
  }

  function drawSeabed(){
    var sg = ctx.createLinearGradient(0, GROUND, 0, H);
    sg.addColorStop(0, '#F6E3B0'); sg.addColorStop(1, '#E8C98A');
    ctx.fillStyle = sg; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#D9B877'; ctx.fillRect(0, GROUND, W, 3);
    for (var i = 0; i < 14; i++){ // kerikil
      var x = mod(i * 53 + 17 - scroll, W + 40) - 20, y = GROUND + 10 + (i * 7 % 20);
      ctx.fillStyle = (i % 3) ? '#D2AE6A' : '#F9EBC7';
      ctx.beginPath(); ctx.ellipse(x, y, 3 + (i % 3), 2, 0, 0, 6.2832); ctx.fill();
    }
    ctx.strokeStyle = '#3FAE8A'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (var k = 0; k < 4; k++){ // rumput laut
      var wx = mod(k * 180 + 60 - scroll, W + 60) - 30;
      for (var s = -1; s <= 1; s++){
        var sway = Math.sin(t * 0.003 + k + s) * 3;
        ctx.beginPath(); ctx.moveTo(wx + s * 6, H);
        ctx.quadraticCurveTo(wx + s * 6 + sway, H - 11, wx + s * 6 - sway, H - 22 + Math.abs(s) * 4);
        ctx.stroke();
      }
    }
  }

  function drawUrchin(cx, cy, r){
    ctx.strokeStyle = '#3A2160'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (var a = 0; a < 14; a++){
      var ang = a / 14 * 6.2832;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (r - 1), cy + Math.sin(ang) * (r - 1));
      ctx.lineTo(cx + Math.cos(ang) * (r + 7), cy + Math.sin(ang) * (r + 7));
      ctx.stroke();
    }
    var g = ctx.createRadialGradient(cx - r * .3, cy - r * .35, 2, cx, cy, r);
    g.addColorStop(0, '#9A74D6'); g.addColorStop(1, '#5B3A8C');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx - r * .3, cy - r * .35, r * .22, 0, 6.2832); ctx.fill();
  }

  function drawJelly(o){
    var cx = o.x + o.w / 2, top = o.y;
    ctx.strokeStyle = 'rgba(255,143,184,.9)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (var i = -1; i <= 2; i++){
      var tx = cx - 11 + (i + 1) * 7.3, sw = Math.sin(t * 0.008 + i) * 3;
      ctx.beginPath(); ctx.moveTo(tx, top + 20);
      ctx.quadraticCurveTo(tx + sw, top + 29, tx - sw, top + o.h);
      ctx.stroke();
    }
    var g = ctx.createLinearGradient(0, top, 0, top + 24);
    g.addColorStop(0, '#FFB3CF'); g.addColorStop(1, '#F0538A');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(o.x, top + 22);
    ctx.bezierCurveTo(o.x, top - 8, o.x + o.w, top - 8, o.x + o.w, top + 22);
    ctx.quadraticCurveTo(cx, top + 27, o.x, top + 22); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(cx - 6, top + 7, 5, 3, -.5, 0, 6.2832); ctx.fill();
  }

  function drawDolphin(){
    var cx = P.x + P.w / 2, cy = P.y + P.h / 2;
    // bayangan di dasar laut
    var air = Math.max(0, (GROUND - P.h) - P.y), sc = Math.max(.4, 1 - air / 180);
    ctx.fillStyle = 'rgba(120,85,30,.28)';
    ctx.beginPath(); ctx.ellipse(cx, GROUND + 7, 24 * sc, 4 * sc, 0, 0, 6.2832); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    var ang;
    if (state === 'over') ang = .9;
    else if (P.onGround) ang = Math.sin(t * 0.012) * .05;
    else ang = Math.max(-.45, Math.min(.6, P.vy * .045));
    ctx.rotate(ang);
    ctx.scale(-1, 1); // gambar aslinya menghadap kiri
    if (dolphinOk) ctx.drawImage(dolphin, -P.w / 2, -P.h / 2, P.w, P.h);
    else { ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐬', 0, 0); }
    ctx.restore();

    if (state === 'over'){
      ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💫', cx, P.y - 6);
    }
  }

  function pad5(n){ n = Math.floor(n); return ('00000' + n).slice(-5); }

  function drawHUD(){
    ctx.font = 'bold 15px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'right';
    var blink = t < flashUntil && Math.floor(t / 100) % 2 === 0;
    ctx.fillStyle = 'rgba(18,64,122,.65)';
    ctx.fillText('HI ' + pad5(hi), W - 98, 10);
    ctx.fillStyle = blink ? 'rgba(255,255,255,0)' : '#12407A';
    ctx.fillText(pad5(score), W - 14, 10);
  }

  function pill(text, y, size, bg, fg){
    ctx.font = 'bold ' + size + 'px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 30, h = size + 16;
    ctx.fillStyle = bg; rr(W / 2 - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg; ctx.fillText(text, W / 2, y + 1);
  }

  function draw(){
    drawBackground();
    drawSeabed();
    for (var i = 0; i < obstacles.length; i++){
      var o = obstacles[i];
      if (o.type === 'j') drawJelly(o);
      else for (var c = 0; c < o.count; c++) drawUrchin(o.x + c * (o.s + 4) + o.s / 2, o.y + o.s / 2, o.s / 2 - 4);
    }
    drawDolphin();
    drawHUD();

    if (state === 'ready'){
      pill('Tekan Spasi / ketuk untuk mulai', 70, 15, 'rgba(255,255,255,.92)', '#12407A');
    } else if (state === 'over'){
      pill('GAME OVER', 52, 22, 'rgba(18,64,122,.92)', '#fff');
      pill(newRecord ? '🏆 Rekor baru! ' + Math.floor(score) : 'Skor ' + Math.floor(score) + ' · Ketuk / Spasi untuk main lagi', 94, 13,
           newRecord ? 'rgba(255,214,77,.96)' : 'rgba(255,255,255,.92)', newRecord ? '#7A3A00' : '#12407A');
      if (newRecord) pill('Ketuk / Spasi untuk main lagi', 128, 12, 'rgba(255,255,255,.9)', '#12407A');
    }
  }

  /* ---------- Loop ---------- */
  function frame(now){
    if (!isOpen) return;
    var dt = Math.min(2.5, (now - last) / 16.667);
    last = now; t = now;
    update(dt); draw();
    raf = requestAnimationFrame(frame);
  }

  function startLoop(){
    cancelAnimationFrame(raf);
    last = performance.now(); t = last;
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Buka / tutup ---------- */
  function openGame(){
    if (isOpen) return;
    isOpen = true; tip.classList.remove('show');
    overlay.classList.add('open');
    resetGame(); state = 'ready';
    startLoop();
    canvas.focus({ preventScroll: true });
  }
  function closeGame(){
    if (!isOpen) return;
    if (state === 'running') endGame();
    isOpen = false; cancelAnimationFrame(raf);
    overlay.classList.remove('open');
    fab.focus({ preventScroll: true });
  }

  /* ---------- Input ---------- */
  function press(){
    if (state === 'ready'){ state = 'running'; jump(); }
    else if (state === 'running'){ jump(); }
    else if (state === 'over' && performance.now() - overAt > 450){ resetGame(); state = 'running'; }
  }

  document.addEventListener('keydown', function(e){
    if (!isOpen) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW'){
      e.preventDefault(); if (!e.repeat) press();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS'){
      e.preventDefault(); fast = true;
    } else if (e.code === 'Escape'){
      e.preventDefault(); closeGame();
    }
  });
  document.addEventListener('keyup', function(e){
    if (!isOpen) return;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') fast = false;
    if (e.code === 'Space') e.preventDefault(); // cegah spasi "menekan" tombol yang sedang fokus
  });

  canvas.addEventListener('pointerdown', function(e){ e.preventDefault(); press(); });
  overlay.addEventListener('pointerdown', function(e){ if (e.target === overlay) closeGame(); });
  closeBtn.addEventListener('click', closeGame);
  sndBtn.addEventListener('click', function(){
    soundOn = !soundOn; store.set(KEY.snd, soundOn ? '1' : '0'); paintSnd();
    if (soundOn) beep(660, .1, 'triangle');
    canvas.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', function(){ if (document.hidden && isOpen && state === 'running') last = performance.now(); });

  /* ---------- Tombol melayang: bisa digeser ---------- */
  function clampPos(x, y){
    var r = fab.getBoundingClientRect();
    return {
      x: Math.max(4, Math.min(window.innerWidth  - r.width  - 4, x)),
      y: Math.max(4, Math.min(window.innerHeight - r.height - 4, y))
    };
  }
  function placeFab(x, y){
    var p = clampPos(x, y);
    fab.style.left = p.x + 'px'; fab.style.top = p.y + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
  }
  function restoreFab(){
    var raw = store.get(KEY.pos); if (!raw) return;
    try{
      var s = JSON.parse(raw);
      if (typeof s.x === 'number' && typeof s.y === 'number') placeFab(s.x * window.innerWidth, s.y * window.innerHeight);
    }catch(e){}
  }
  function savePos(){
    var r = fab.getBoundingClientRect();
    store.set(KEY.pos, JSON.stringify({ x: r.left / window.innerWidth, y: r.top / window.innerHeight }));
  }
  restoreFab();
  window.addEventListener('resize', restoreFab);

  var drag = null;
  fab.addEventListener('pointerdown', function(e){
    try{ fab.setPointerCapture(e.pointerId); }catch(err){}
    var r = fab.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    tip.classList.remove('show');
  });
  fab.addEventListener('pointermove', function(e){
    if (!drag) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true; fab.classList.add('mg-drag');
    placeFab(drag.ox + dx, drag.oy + dy);
  });
  fab.addEventListener('pointerup', function(){
    if (!drag) return;
    var moved = drag.moved; drag = null; fab.classList.remove('mg-drag');
    if (moved) savePos(); else openGame();
  });
  fab.addEventListener('pointercancel', function(){ drag = null; fab.classList.remove('mg-drag'); });
  fab.addEventListener('click', function(e){ if (e.detail === 0) openGame(); }); // aktivasi lewat keyboard (Enter/Spasi)

  fab.addEventListener('mouseenter', function(){
    if (drag || isOpen) return;
    var r = fab.getBoundingClientRect();
    tip.classList.add('show');
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = r.left - tw - 10;
    if (left < 8) left = r.right + 10;
    tip.style.left = left + 'px';
    tip.style.top = (r.top + r.height / 2 - th / 2) + 'px';
  });
  fab.addEventListener('mouseleave', function(){ tip.classList.remove('show'); });

  resetGame();
})();
