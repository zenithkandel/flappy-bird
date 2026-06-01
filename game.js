// ============================================
// FLAPPY QUEST — Game Engine
// ============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ---- Skins Data ----
const SKINS = [
  { id:'classic', name:'Classic', price:0, body:'#FFD700', wing:'#FFA500', eye:'#fff', pupil:'#222', beak:'#FF6347' },
  { id:'blaze', name:'Blaze', price:75, body:'#FF4500', wing:'#FF0000', eye:'#fff', pupil:'#111', beak:'#FFD700', glow:'rgba(255,69,0,0.4)' },
  { id:'arctic', name:'Arctic', price:120, body:'#87CEEB', wing:'#5AC8FA', eye:'#fff', pupil:'#1a3a5c', beak:'#B0E0E6', glow:'rgba(90,200,250,0.3)' },
  { id:'phantom', name:'Phantom', price:200, body:'#8B5CF6', wing:'#6D28D9', eye:'#E0E0FF', pupil:'#1a0a2e', beak:'#A78BFA', glow:'rgba(139,92,246,0.4)' },
  { id:'sakura', name:'Sakura', price:250, body:'#F9A8D4', wing:'#EC4899', eye:'#fff', pupil:'#831843', beak:'#FB7185', glow:'rgba(236,72,153,0.3)' },
  { id:'royal', name:'Royal', price:350, body:'#FBBF24', wing:'#D97706', eye:'#fff', pupil:'#78350F', beak:'#F59E0B', glow:'rgba(251,191,36,0.4)', crown:true },
  { id:'neon', name:'Neon', price:500, body:'#00FF88', wing:'#00CC66', eye:'#fff', pupil:'#003322', beak:'#66FFAA', glow:'rgba(0,255,136,0.5)' },
  { id:'cosmic', name:'Cosmic', price:800, body:'#1E1B4B', wing:'#312E81', eye:'#C4B5FD', pupil:'#000', beak:'#818CF8', glow:'rgba(129,140,248,0.5)', stars:true },
];

// ---- State ----
let state = loadState();
let game = null;
let currentScreen = 'menu';
let animFrame = 0;

function defaultState() {
  return { coins:0, highScore:0, owned:['classic'], equipped:'classic' };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('flappyquest'));
    return s && s.owned ? s : defaultState();
  } catch { return defaultState(); }
}

function saveState() { localStorage.setItem('flappyquest', JSON.stringify(state)); }

// ---- Screen Management ----
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id + '-screen').classList.add('active');
  currentScreen = id;
}

function goToMenu() {
  showScreen('menu');
  updateMenuStats();
  animateMenuBird();
}

function updateMenuStats() {
  document.getElementById('menu-coins').textContent = state.coins;
  document.getElementById('menu-highscore').textContent = state.highScore;
}

// ---- Menu Bird Preview ----
function animateMenuBird() {
  const c = document.getElementById('menu-bird-canvas');
  const cx = c.getContext('2d');
  let t = 0;
  function draw() {
    if (currentScreen !== 'menu') return;
    cx.clearRect(0,0,120,120);
    const skin = SKINS.find(s => s.id === state.equipped) || SKINS[0];
    drawBird(cx, 60, 60, 2.2, Math.sin(t*0.08)*15, skin, t);
    t++;
    requestAnimationFrame(draw);
  }
  draw();
}

// ---- Draw Bird ----
function drawBird(c, x, y, scale, angle, skin, tick) {
  c.save();
  c.translate(x, y);
  c.rotate((angle||0) * Math.PI/180);
  const s = scale || 1;

  // Glow
  if (skin.glow) {
    c.shadowColor = skin.glow;
    c.shadowBlur = 18 * s;
  }

  // Body
  c.fillStyle = skin.body;
  c.beginPath();
  c.ellipse(0, 0, 13*s, 10*s, 0, 0, Math.PI*2);
  c.fill();
  c.shadowBlur = 0;

  // Wing
  const wingY = Math.sin((tick||0)*0.25) * 3 * s;
  c.fillStyle = skin.wing;
  c.beginPath();
  c.ellipse(-2*s, wingY, 8*s, 5*s, -0.3, 0, Math.PI*2);
  c.fill();

  // Eye
  c.fillStyle = skin.eye;
  c.beginPath();
  c.arc(6*s, -3*s, 4*s, 0, Math.PI*2);
  c.fill();

  // Pupil
  c.fillStyle = skin.pupil;
  c.beginPath();
  c.arc(7.5*s, -3*s, 2*s, 0, Math.PI*2);
  c.fill();

  // Beak
  c.fillStyle = skin.beak;
  c.beginPath();
  c.moveTo(12*s, -1*s);
  c.lineTo(18*s, 1*s);
  c.lineTo(12*s, 3*s);
  c.closePath();
  c.fill();

  // Crown
  if (skin.crown) {
    c.fillStyle = '#FFD700';
    c.beginPath();
    c.moveTo(-5*s, -10*s); c.lineTo(-3*s, -16*s); c.lineTo(0, -11*s);
    c.lineTo(3*s, -17*s); c.lineTo(5*s, -10*s);
    c.closePath();
    c.fill();
  }

  // Stars (cosmic skin)
  if (skin.stars) {
    c.fillStyle = '#E0E7FF';
    for (let i=0; i<5; i++) {
      const sx = Math.sin(i*1.8 + (tick||0)*0.05) * 10*s;
      const sy = Math.cos(i*2.3 + (tick||0)*0.07) * 7*s;
      c.beginPath();
      c.arc(sx, sy, 1*s, 0, Math.PI*2);
      c.fill();
    }
  }

  c.restore();
}

// ---- Game Logic ----
const GRAVITY = 0.45;
const FLAP_POWER = -7.5;
const PIPE_SPEED = 2.8;
const PIPE_GAP = 145;
const PIPE_WIDTH = 58;
const PIPE_INTERVAL = 1600;
const GROUND_HEIGHT = 70;
const BIRD_X_POS = 0.22; // fraction of canvas width

function createGame() {
  const w = canvas.width, h = canvas.height;
  const groundY = h - GROUND_HEIGHT;
  return {
    bird: { x: w*BIRD_X_POS, y: h*0.4, vy: 0, angle: 0, radius: 14 },
    pipes: [],
    coins: [],
    particles: [],
    groundX: 0,
    score: 0,
    coinsCollected: 0,
    started: false,
    dead: false,
    deadTimer: 0,
    tick: 0,
    pipeTimer: 0,
    flash: 0,
    groundY,
    w, h,
    clouds: Array.from({length:6}, (_,i) => ({
      x: Math.random()*w, y: 30+Math.random()*100,
      w: 50+Math.random()*80, speed: 0.3+Math.random()*0.4
    })),
    bgGrad: null,
    stars: Array.from({length:30}, () => ({
      x: Math.random()*w, y: Math.random()*(h*0.5), s: 0.5+Math.random()*1.5, b: Math.random()
    }))
  };
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (game) { game.w = canvas.width; game.h = canvas.height; game.groundY = canvas.height - GROUND_HEIGHT; }
}

window.addEventListener('resize', resizeCanvas);

function startGame() {
  resizeCanvas();
  game = createGame();
  showScreen('game');
  document.getElementById('tap-to-start').classList.remove('hidden');
  document.getElementById('hud-score').textContent = '0';
  document.getElementById('hud-coin-count').textContent = '0';
  gameLoop();
}

function flap() {
  if (!game || game.dead) return;
  if (!game.started) {
    game.started = true;
    document.getElementById('tap-to-start').classList.add('hidden');
  }
  game.bird.vy = FLAP_POWER;
}

// Input
document.addEventListener('keydown', e => { if (e.code==='Space'||e.code==='ArrowUp') { e.preventDefault(); flap(); }});
canvas.addEventListener('mousedown', e => { e.preventDefault(); flap(); });
canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, {passive:false});

// ---- Pipe & Coin Spawning ----
function spawnPipe(g) {
  const minY = 80, maxY = g.groundY - PIPE_GAP - 80;
  const topH = minY + Math.random() * (maxY - minY);
  const pipe = { x: g.w + 20, topH, scored: false };
  g.pipes.push(pipe);
  // Coin between pipes (70% chance)
  if (Math.random() < 0.7) {
    g.coins.push({
      x: pipe.x + PIPE_WIDTH/2,
      y: topH + PIPE_GAP/2 + (Math.random()-0.5)*40,
      r: 10, collected: false, anim: 0
    });
  }
  // Random floating coin (30% chance)
  if (Math.random() < 0.3) {
    g.coins.push({
      x: g.w + 100 + Math.random()*100,
      y: 60 + Math.random()*(g.groundY - 160),
      r: 10, collected: false, anim: Math.random()*100
    });
  }
}

// ---- Collision ----
function checkCollision(g) {
  const b = g.bird;
  const r = b.radius;
  // Ground & ceiling
  if (b.y + r > g.groundY || b.y - r < 0) return true;
  // Pipes
  for (const p of g.pipes) {
    if (b.x + r > p.x && b.x - r < p.x + PIPE_WIDTH) {
      if (b.y - r < p.topH || b.y + r > p.topH + PIPE_GAP) return true;
    }
  }
  return false;
}

// ---- Particles ----
function spawnParticles(g, x, y, color, count) {
  for (let i=0; i<count; i++) {
    g.particles.push({
      x, y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
      life: 30+Math.random()*20, maxLife: 50, r: 2+Math.random()*3, color
    });
  }
}

// ---- Update ----
function update(g) {
  g.tick++;
  if (!g.started) return;
  if (g.dead) { g.deadTimer++; if (g.deadTimer === 40) showGameOver(g); return; }

  // Bird physics
  g.bird.vy += GRAVITY;
  g.bird.y += g.bird.vy;
  g.bird.angle = Math.min(Math.max(g.bird.vy * 3, -30), 70);

  // Pipes
  g.pipeTimer++;
  if (g.pipeTimer > PIPE_INTERVAL / (16.67 * (1 + g.score*0.005))) {
    spawnPipe(g);
    g.pipeTimer = 0;
  }

  for (const p of g.pipes) {
    p.x -= PIPE_SPEED + g.score * 0.03;
    if (!p.scored && p.x + PIPE_WIDTH < g.bird.x) {
      p.scored = true;
      g.score++;
      document.getElementById('hud-score').textContent = g.score;
    }
  }
  g.pipes = g.pipes.filter(p => p.x > -PIPE_WIDTH - 20);

  // Coins
  for (const coin of g.coins) {
    coin.x -= PIPE_SPEED + g.score * 0.03;
    coin.anim++;
    if (!coin.collected) {
      const dx = g.bird.x - coin.x, dy = g.bird.y - coin.y;
      if (Math.sqrt(dx*dx+dy*dy) < g.bird.radius + coin.r) {
        coin.collected = true;
        g.coinsCollected++;
        document.getElementById('hud-coin-count').textContent = g.coinsCollected;
        spawnParticles(g, coin.x, coin.y, '#FFD700', 8);
      }
    }
  }
  g.coins = g.coins.filter(c => c.x > -20 && !c.collected);

  // Particles
  for (const p of g.particles) { p.x+=p.vx; p.y+=p.vy; p.life--; p.vy+=0.1; }
  g.particles = g.particles.filter(p => p.life > 0);

  // Ground scroll
  g.groundX = (g.groundX + PIPE_SPEED + g.score*0.03) % 24;

  // Clouds
  for (const cl of g.clouds) { cl.x -= cl.speed; if (cl.x + cl.w < 0) { cl.x = g.w + 20; cl.y = 30+Math.random()*100; } }

  // Collision
  if (checkCollision(g)) {
    g.dead = true;
    g.flash = 8;
    spawnParticles(g, g.bird.x, g.bird.y, '#FF4444', 15);
  }
}

// ---- Render ----
function render(g) {
  const c = ctx;
  const {w, h} = g;

  // Sky gradient
  const skyGrad = c.createLinearGradient(0,0,0,h);
  skyGrad.addColorStop(0, '#1a1a3e');
  skyGrad.addColorStop(0.4, '#2d3a6e');
  skyGrad.addColorStop(0.7, '#4a6fa1');
  skyGrad.addColorStop(1, '#7eb8d0');
  c.fillStyle = skyGrad;
  c.fillRect(0,0,w,h);

  // Stars (subtle)
  c.fillStyle = 'rgba(255,255,255,0.5)';
  for (const s of g.stars) {
    const b = 0.3 + 0.7*Math.abs(Math.sin(g.tick*0.02 + s.b*10));
    c.globalAlpha = b * 0.6;
    c.beginPath(); c.arc(s.x, s.y, s.s, 0, Math.PI*2); c.fill();
  }
  c.globalAlpha = 1;

  // Clouds
  c.fillStyle = 'rgba(255,255,255,0.07)';
  for (const cl of g.clouds) {
    c.beginPath();
    c.ellipse(cl.x, cl.y, cl.w/2, 18, 0, 0, Math.PI*2);
    c.fill();
  }

  // Pipes
  for (const p of g.pipes) {
    drawPipe(c, p.x, 0, PIPE_WIDTH, p.topH, true, g);
    drawPipe(c, p.x, p.topH + PIPE_GAP, PIPE_WIDTH, g.groundY - p.topH - PIPE_GAP, false, g);
  }

  // Coins
  for (const coin of g.coins) {
    if (coin.collected) continue;
    const scaleX = Math.abs(Math.cos(coin.anim * 0.06));
    c.save();
    c.translate(coin.x, coin.y);
    c.scale(scaleX, 1);
    // Glow
    c.shadowColor = 'rgba(255,215,0,0.6)';
    c.shadowBlur = 12;
    c.fillStyle = '#FFD700';
    c.beginPath(); c.arc(0,0,coin.r,0,Math.PI*2); c.fill();
    c.shadowBlur = 0;
    // Inner
    c.fillStyle = '#FFF8DC';
    c.beginPath(); c.arc(0,0,coin.r*0.55,0,Math.PI*2); c.fill();
    c.fillStyle = '#DAA520';
    c.font = `bold ${coin.r}px Outfit`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('¢',0,1);
    c.restore();
  }

  // Bird
  const skin = SKINS.find(s => s.id === state.equipped) || SKINS[0];
  if (!g.dead || g.deadTimer < 30) {
    drawBird(c, g.bird.x, g.bird.y, 1.5, g.bird.angle, skin, g.tick);
  }

  // Particles
  for (const p of g.particles) {
    c.globalAlpha = p.life / p.maxLife;
    c.fillStyle = p.color;
    c.beginPath(); c.arc(p.x, p.y, p.r * (p.life/p.maxLife), 0, Math.PI*2); c.fill();
  }
  c.globalAlpha = 1;

  // Ground
  drawGround(c, g);

  // Death flash
  if (g.flash > 0) {
    c.fillStyle = `rgba(255,100,100,${g.flash*0.06})`;
    c.fillRect(0,0,w,h);
    g.flash--;
  }
}

function drawPipe(c, x, y, w, h, isTop, g) {
  if (h <= 0) return;
  const grad = c.createLinearGradient(x,0,x+w,0);
  grad.addColorStop(0, '#2a9d4e');
  grad.addColorStop(0.3, '#3bba60');
  grad.addColorStop(0.7, '#3bba60');
  grad.addColorStop(1, '#1e7a3a');
  c.fillStyle = grad;
  c.fillRect(x, y, w, h);

  // Cap
  const capH = 22, capW = w + 10;
  const capY = isTop ? y + h - capH : y;
  const capGrad = c.createLinearGradient(x-5,0,x+capW-5,0);
  capGrad.addColorStop(0, '#239447');
  capGrad.addColorStop(0.3, '#30b85a');
  capGrad.addColorStop(0.7, '#30b85a');
  capGrad.addColorStop(1, '#1a7035');
  c.fillStyle = capGrad;
  c.fillRect(x - 5, capY, capW, capH);

  // Highlight
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.fillRect(x+5, y, 6, h);
}

function drawGround(c, g) {
  const gy = g.groundY;
  const grad = c.createLinearGradient(0, gy, 0, g.h);
  grad.addColorStop(0, '#5a3a1a');
  grad.addColorStop(0.15, '#8B6914');
  grad.addColorStop(1, '#6B4F12');
  c.fillStyle = grad;
  c.fillRect(0, gy, g.w, GROUND_HEIGHT);

  // Grass
  c.fillStyle = '#4CAF50';
  c.fillRect(0, gy, g.w, 8);
  c.fillStyle = '#66BB6A';
  c.fillRect(0, gy, g.w, 3);

  // Ground texture lines
  c.strokeStyle = 'rgba(0,0,0,0.1)';
  c.lineWidth = 1;
  for (let i = -g.groundX; i < g.w + 24; i += 24) {
    c.beginPath(); c.moveTo(i, gy+12); c.lineTo(i+12, gy + GROUND_HEIGHT); c.stroke();
  }
}

// ---- Game Loop ----
function gameLoop() {
  if (currentScreen !== 'game') return;
  update(game);
  render(game);
  requestAnimationFrame(gameLoop);
}

// ---- Game Over ----
function showGameOver(g) {
  const isNew = g.score > state.highScore;
  if (isNew) state.highScore = g.score;
  state.coins += g.coinsCollected;
  saveState();

  document.getElementById('go-score').textContent = g.score;
  document.getElementById('go-best').textContent = state.highScore;
  document.getElementById('go-coins').textContent = '+' + g.coinsCollected;
  document.getElementById('new-best').classList.toggle('hidden', !isNew);
  showScreen('gameover');
}

// ---- Shop ----
function openShop() {
  showScreen('shop');
  renderShop();
}

function closeShop() { goToMenu(); }

function renderShop() {
  document.getElementById('shop-coins').textContent = state.coins;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  SKINS.forEach(skin => {
    const owned = state.owned.includes(skin.id);
    const equipped = state.equipped === skin.id;
    const canAfford = state.coins >= skin.price;

    const card = document.createElement('div');
    card.className = 'skin-card' + (equipped ? ' equipped' : '') + (!owned ? ' locked' : '');

    let btnClass, btnText;
    if (equipped) { btnClass = 'equipped'; btnText = '✓ Equipped'; }
    else if (owned) { btnClass = 'equip'; btnText = 'Equip'; }
    else if (canAfford) { btnClass = 'buy'; btnText = 'Buy'; }
    else { btnClass = 'cant-afford'; btnText = 'Not enough'; }

    card.innerHTML = `
      ${equipped ? '<div class="equipped-badge">Equipped</div>' : ''}
      <canvas class="skin-preview" width="64" height="64"></canvas>
      <div class="skin-name">${skin.name}</div>
      <div class="skin-price ${skin.price===0?'free':''}">${skin.price===0?'Free':'🪙 '+skin.price}</div>
      <button class="skin-btn ${btnClass}" data-skin="${skin.id}">${btnText}</button>
    `;
    grid.appendChild(card);

    // Draw preview
    const pc = card.querySelector('canvas').getContext('2d');
    drawBird(pc, 32, 32, 2, 0, skin, animFrame);

    // Button action
    card.querySelector('button').addEventListener('click', () => {
      if (equipped) return;
      if (owned) { state.equipped = skin.id; saveState(); renderShop(); }
      else if (canAfford) {
        state.coins -= skin.price;
        state.owned.push(skin.id);
        state.equipped = skin.id;
        saveState();
        renderShop();
      }
    });
  });
}

// ---- Animate shop previews ----
setInterval(() => { animFrame++; if (currentScreen === 'shop') {
  document.querySelectorAll('.skin-preview').forEach((cvs, i) => {
    const pc = cvs.getContext('2d');
    pc.clearRect(0,0,64,64);
    drawBird(pc, 32, 32, 2, Math.sin(animFrame*0.08)*10, SKINS[i], animFrame);
  });
}}, 50);

// ---- Init ----
window.addEventListener('DOMContentLoaded', () => {
  updateMenuStats();
  animateMenuBird();
  showScreen('menu');
});
