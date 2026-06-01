// game.js - Core Game Engine & Features

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let game = null;

const DIFF_SETTINGS = {
  easy: { gap: 170, speed: 2.5, pipeInterval: 1800, movingPipes: false, closingPipes: false },
  normal: { gap: 145, speed: 2.8, pipeInterval: 1600, movingPipes: true, closingPipes: false },
  hard: { gap: 125, speed: 3.2, pipeInterval: 1400, movingPipes: true, closingPipes: true }
};

const GRAVITY = 0.45;
const FLAP_POWER = -7.5;
const PIPE_WIDTH = 60;
const GROUND_HEIGHT = 70;

function createGame() {
  const w = canvas.width, h = canvas.height;
  return {
    w, h, groundY: h - GROUND_HEIGHT,
    bird: { x: w*0.22, y: h*0.4, vy: 0, angle: 0, radius: 14 },
    pipes: [], coins: [], powerups: [], particles: [],
    groundX: 0,
    score: 0, combo: 0, coinsCollected: 0,
    started: false, dead: false, deadTimer: 0, tick: 0, pipeTimer: 0,
    flash: 0, nearMissFlash: 0,
    activePowerups: { shield: 0, magnet: 0, slowmo: 0 },
    fever: { active: false, amount: 0, max: 100 },
    weather: Array.from({length: 40}, () => ({ x: Math.random()*w, y: Math.random()*h, vy: 2+Math.random()*3 })),
    clouds: Array.from({length:6}, () => ({ x: Math.random()*w, y: 30+Math.random()*100, w: 50+Math.random()*80, s: 0.3+Math.random()*0.4 }))
  };
}

function resizeCanvas() {
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  if(game) { game.w = canvas.width; game.h = canvas.height; game.groundY = canvas.height - GROUND_HEIGHT; }
}
window.addEventListener('resize', resizeCanvas);

function startGame(revived = false) {
  if(!revived) {
    resizeCanvas();
    game = createGame();
    state.stats.gamesPlayed++;
    saveState();
    unlockAchievement('first_flight');
  } else {
    game.dead = false; game.deadTimer = 0;
    game.bird.y = game.h * 0.3; game.bird.vy = 0; game.bird.angle = 0;
    game.pipes = game.pipes.filter(p => p.x > game.bird.x + 100);
    game.activePowerups.shield = 120; // 2 seconds invincibility
  }
  
  showScreen('game');
  document.getElementById('tap-to-start').classList.toggle('hidden', revived);
  document.getElementById('hud-score').textContent = game.score;
  document.getElementById('hud-coin-count').textContent = game.coinsCollected;
  document.getElementById('hud-combo').classList.add('hidden');
  document.getElementById('fever-bar').classList.remove('hidden');
  updateFeverBar();
  gameLoop();
}

function revive() {
  if(state.coins >= 50) {
    state.coins -= 50;
    saveState();
    unlockAchievement('revive_1');
    startGame(true);
  }
}

function flap() {
  if(!game || game.dead) return;
  if(!game.started) {
    game.started = true;
    document.getElementById('tap-to-start').classList.add('hidden');
  }
  game.bird.vy = FLAP_POWER;
  state.stats.totalJumps++;
}
document.addEventListener('keydown', e => { if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();flap();} });
canvas.addEventListener('mousedown', e => {e.preventDefault();flap();});
canvas.addEventListener('touchstart', e => {e.preventDefault();flap();}, {passive:false});

function spawnPipe(g) {
  const diff = DIFF_SETTINGS[state.difficulty];
  const minY = 80, maxY = g.groundY - diff.gap - 80;
  const topH = minY + Math.random() * (maxY - minY);
  const p = { x: g.w + 20, topH, scored: false, gap: diff.gap };
  
  if (diff.movingPipes && Math.random() < 0.3) {
    p.moveDir = Math.random() < 0.5 ? 1 : -1;
    p.minY = Math.max(80, topH - 50); p.maxY = Math.min(maxY, topH + 50);
  }
  if (diff.closingPipes && Math.random() < 0.2) p.closing = true;
  g.pipes.push(p);

  // Spawns
  if(Math.random() < 0.8) {
    const type = Math.random() < 0.1 ? 'diamond' : Math.random() < 0.3 ? 'gold' : 'silver';
    const val = type==='diamond'?10 : type==='gold'?5 : 1;
    const color = type==='diamond'?'#00ffff' : type==='gold'?'#ffd700' : '#c0c0c0';
    g.coins.push({ x: p.x+PIPE_WIDTH/2, y: p.topH+p.gap/2+(Math.random()-0.5)*40, val, color, coll:false, t:0 });
  }

  // Powerup
  if(Math.random() < 0.05) {
    const types = ['shield','magnet','slowmo'];
    g.powerups.push({ x: p.x+PIPE_WIDTH/2, y: p.topH+p.gap/2, type: types[Math.floor(Math.random()*types.length)], coll:false, t:0 });
  }
}

function spawnParticles(g, x, y, color, count) {
  for(let i=0; i<count; i++) g.particles.push({x,y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:30+Math.random()*20, mLife:50, r:2+Math.random()*3, color});
}

function checkCollision(g) {
  const b = g.bird, r = b.radius;
  if(b.y + r > g.groundY || b.y - r < 0) return true;
  for(const p of g.pipes) {
    if(b.x + r > p.x && b.x - r < p.x + PIPE_WIDTH) {
      if(b.y - r < p.topH || b.y + r > p.topH + p.gap) return true;
      // Near miss
      const distToTop = Math.abs((b.y-r) - p.topH);
      const distToBot = Math.abs((b.y+r) - (p.topH+p.gap));
      if(!p.nearMissed && (distToTop < 15 || distToBot < 15)) {
        p.nearMissed = true; state.stats.nearMisses++;
        g.nearMissFlash = 30; document.getElementById('near-miss-flash').classList.remove('hidden');
        g.coinsCollected++;
      }
    }
  }
  return false;
}

function updateFeverBar() {
  const f = document.getElementById('fever-fill');
  f.style.width = (game.fever.amount / game.fever.max * 100) + '%';
  if(game.fever.active) f.style.background = 'linear-gradient(90deg, #fff, #00ffff)';
  else f.style.background = 'linear-gradient(90deg, #ff6b00, #ffd700)';
}

function update(g) {
  g.tick++;
  if(!g.started) return;
  if(g.dead) { 
    g.deadTimer++; 
    if(g.deadTimer===40) { showGameOver(g); return; }
    g.bird.vy += GRAVITY; g.bird.y += g.bird.vy; return; 
  }

  // Physics & Speed
  const diff = DIFF_SETTINGS[state.difficulty];
  let speed = diff.speed + (g.score*0.02);
  if(g.activePowerups.slowmo > 0) { speed *= 0.6; g.activePowerups.slowmo--; }
  if(g.fever.active) speed *= 1.5;

  g.bird.vy += GRAVITY; g.bird.y += g.bird.vy;
  g.bird.angle = Math.min(Math.max(g.bird.vy * 3, -30), 70);

  // Powerups decay
  if(g.activePowerups.shield > 0) g.activePowerups.shield--;
  if(g.activePowerups.magnet > 0) g.activePowerups.magnet--;

  // Fever logic
  if(g.fever.active) {
    g.fever.amount -= 0.2;
    if(g.fever.amount <= 0) g.fever.active = false;
    updateFeverBar();
  }

  // Near miss text
  if(g.nearMissFlash > 0) {
    g.nearMissFlash--;
    if(g.nearMissFlash===0) document.getElementById('near-miss-flash').classList.add('hidden');
  }

  // Pipes
  g.pipeTimer++;
  if(g.pipeTimer > diff.pipeInterval / (16.67 * speed)) { spawnPipe(g); g.pipeTimer = 0; }

  for(const p of g.pipes) {
    p.x -= speed;
    if(p.moveDir) {
      p.topH += p.moveDir;
      if(p.topH < p.minY || p.topH > p.maxY) p.moveDir *= -1;
    }
    if(p.closing && p.gap > 80) p.gap -= 0.1;

    if(!p.scored && p.x + PIPE_WIDTH < g.bird.x) {
      p.scored = true; g.score++;
      
      // Combo checking (center passed)
      const center = p.topH + p.gap/2;
      if(Math.abs(g.bird.y - center) < 25) g.combo++; else g.combo = 0;
      
      const hudCombo = document.getElementById('hud-combo');
      if(g.combo > 1) {
        hudCombo.classList.remove('hidden');
        document.getElementById('combo-val').textContent = g.combo;
        g.score += Math.floor(g.combo/2); // Bonus score
      } else hudCombo.classList.add('hidden');

      document.getElementById('hud-score').textContent = g.score;
    }
  }
  g.pipes = g.pipes.filter(p => p.x > -100);

  // Coins
  for(const c of g.coins) {
    c.x -= speed; c.t++;
    if(!c.coll) {
      let dx = g.bird.x - c.x, dy = g.bird.y - c.y;
      let dist = Math.sqrt(dx*dx+dy*dy);
      // Magnet / Fever pull
      if((g.activePowerups.magnet > 0 || g.fever.active) && dist < 150) {
        c.x += dx * 0.08; c.y += dy * 0.08;
      }
      if(dist < g.bird.radius + 12) {
        c.coll = true;
        g.coinsCollected += c.val;
        document.getElementById('hud-coin-count').textContent = g.coinsCollected;
        spawnParticles(g, c.x, c.y, c.color, 8);
        unlockAchievement('coin_1');
        
        if(!g.fever.active) {
          g.fever.amount += c.val * 2;
          if(g.fever.amount >= g.fever.max) {
            g.fever.active = true; g.fever.amount = g.fever.max;
            unlockAchievement('fever_1');
          }
          updateFeverBar();
        }
      }
    }
  }
  g.coins = g.coins.filter(c => c.x > -20 && !c.coll);

  // Powerups
  for(const pu of g.powerups) {
    pu.x -= speed; pu.t++;
    if(!pu.coll) {
      let dx = g.bird.x - pu.x, dy = g.bird.y - pu.y;
      if(Math.sqrt(dx*dx+dy*dy) < g.bird.radius + 15) {
        pu.coll = true;
        g.activePowerups[pu.type] = 300; // 5 seconds
        spawnParticles(g, pu.x, pu.y, '#fff', 12);
        updatePowerupHUD(g);
      }
    }
  }
  g.powerups = g.powerups.filter(pu => pu.x > -20 && !pu.coll);

  // Particles & Environment
  g.particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; p.vy+=0.1; });
  g.particles = g.particles.filter(p => p.life > 0);
  g.groundX = (g.groundX + speed) % 24;
  g.clouds.forEach(c => { c.x -= c.s; if(c.x+c.w < 0) { c.x = g.w+20; c.y = 30+Math.random()*100; }});
  const bgData = BGS.find(b=>b.id===state.equippedBg);
  if(bgData && bgData.weather !== 'none') {
    g.weather.forEach(w => {
      w.y += w.vy; w.x -= bgData.weather==='snow'?0.5:1.5;
      if(w.y > g.h) { w.y = -10; w.x = Math.random()*g.w; }
    });
  }

  // Collision
  if(checkCollision(g) && g.activePowerups.shield <= 0 && !g.fever.active) {
    g.dead = true; g.flash = 8;
    spawnParticles(g, g.bird.x, g.bird.y, '#FF4444', 20);
    state.stats.totalDeaths++;
  } else if (checkCollision(g) && g.activePowerups.shield > 0) {
    // Shield break
    g.activePowerups.shield = 0;
    spawnParticles(g, g.bird.x, g.bird.y, '#00ffff', 15);
    g.bird.vy = 0; g.bird.y = g.h * 0.3; // bounce up
    g.pipes = g.pipes.filter(p => p.x > g.bird.x + 60); // clear immediate pipes
    updatePowerupHUD(g);
  }
}

function updatePowerupHUD(g) {
  let html = '';
  if(g.activePowerups.shield>0) html+=`<div class="pu-indicator" style="background:#00ffff;color:#000">🛡️ Shield</div>`;
  if(g.activePowerups.magnet>0) html+=`<div class="pu-indicator" style="background:#ff3b5c">🧲 Magnet</div>`;
  if(g.activePowerups.slowmo>0) html+=`<div class="pu-indicator" style="background:#af52de">⏳ Slow</div>`;
  document.getElementById('hud-powerups').innerHTML = html;
}

function render(g) {
  const c = ctx, {w,h} = g;
  const bgData = BGS.find(b=>b.id===state.equippedBg) || BGS[0];

  // BG
  const grad = c.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, bgData.color1); grad.addColorStop(1, bgData.color2);
  c.fillStyle = grad; c.fillRect(0,0,w,h);

  if(bgData.stars) {
    c.fillStyle = 'rgba(255,255,255,0.6)';
    g.weather.forEach(s => { c.beginPath(); c.arc(s.x, s.y, 1, 0, Math.PI*2); c.fill(); }); // reuse weather array for stars
  }

  c.fillStyle = 'rgba(255,255,255,0.1)';
  g.clouds.forEach(cl => { c.beginPath(); c.ellipse(cl.x, cl.y, cl.w/2, 18, 0, 0, Math.PI*2); c.fill(); });

  // Weather
  if(bgData.weather === 'rain') {
    c.strokeStyle = 'rgba(150,200,255,0.4)'; c.lineWidth = 1.5;
    g.weather.forEach(w => { c.beginPath(); c.moveTo(w.x,w.y); c.lineTo(w.x-2,w.y+10); c.stroke(); });
  } else if(bgData.weather === 'snow') {
    c.fillStyle = 'rgba(255,255,255,0.6)';
    g.weather.forEach(w => { c.beginPath(); c.arc(w.x,w.y, 2, 0, Math.PI*2); c.fill(); });
  }

  // Pipes
  g.pipes.forEach(p => {
    drawPipe(c, p.x, 0, PIPE_WIDTH, p.topH, true);
    drawPipe(c, p.x, p.topH+p.gap, PIPE_WIDTH, g.groundY-p.topH-p.gap, false);
  });

  // Coins
  g.coins.forEach(coin => {
    const s = Math.abs(Math.cos(coin.t*0.06));
    c.save(); c.translate(coin.x, coin.y); c.scale(s,1);
    c.shadowColor = coin.color; c.shadowBlur = 10;
    c.fillStyle = coin.color; c.beginPath(); c.arc(0,0,12,0,Math.PI*2); c.fill();
    c.shadowBlur=0; c.fillStyle = '#fff'; c.beginPath(); c.arc(0,0,7,0,Math.PI*2); c.fill();
    c.restore();
  });

  // Powerups
  g.powerups.forEach(pu => {
    const s = 1 + Math.sin(pu.t*0.1)*0.1;
    c.save(); c.translate(pu.x, pu.y); c.scale(s,s);
    c.fillStyle = pu.type==='shield'?'#00ffff':pu.type==='magnet'?'#ff3b5c':'#af52de';
    c.beginPath(); c.arc(0,0,14,0,Math.PI*2); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 14px Outfit'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(pu.type==='shield'?'🛡':pu.type==='magnet'?'🧲':'⏳', 0,0);
    c.restore();
  });

  // Particles
  g.particles.forEach(p => { c.globalAlpha = p.life/p.mLife; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI*2); c.fill(); });
  c.globalAlpha = 1;

  // Bird
  const skin = SKINS.find(s=>s.id===state.equippedSkin);
  if(!g.dead || g.deadTimer < 30) {
    if(g.activePowerups.shield > 0 || g.fever.active) {
      c.shadowColor = g.fever.active ? '#ff6b00' : '#00ffff'; c.shadowBlur = 20;
      c.strokeStyle = c.shadowColor; c.lineWidth = 3;
      c.beginPath(); c.arc(g.bird.x, g.bird.y, g.bird.radius+6, 0, Math.PI*2); c.stroke(); c.shadowBlur=0;
    }
    drawBird(c, g.bird.x, g.bird.y, 1.5, g.bird.angle, skin, g.tick);
  }

  // Ground
  const gy = g.groundY;
  const grGrad = c.createLinearGradient(0,gy,0,h); grGrad.addColorStop(0,'#5a3a1a'); grGrad.addColorStop(1,'#3b2208');
  c.fillStyle = grGrad; c.fillRect(0,gy,w,GROUND_HEIGHT);
  c.fillStyle = '#4CAF50'; c.fillRect(0,gy,w,8);
  c.fillStyle = '#66BB6A'; c.fillRect(0,gy,w,3);
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
  for(let i=-g.groundX; i<w+24; i+=24) { c.beginPath(); c.moveTo(i,gy+12); c.lineTo(i+12,h); c.stroke(); }

  // Flash
  if(g.flash > 0) { c.fillStyle = `rgba(255,100,100,${g.flash*0.06})`; c.fillRect(0,0,w,h); g.flash--; }
}

function drawPipe(c, x, y, w, h, isTop) {
  if(h<=0) return;
  const grad = c.createLinearGradient(x,0,x+w,0);
  grad.addColorStop(0, '#2a9d4e'); grad.addColorStop(0.5, '#4cd964'); grad.addColorStop(1, '#1e7a3a');
  c.fillStyle = grad; c.fillRect(x,y,w,h);
  const capH = 24, capW = w+10, capY = isTop ? y+h-capH : y;
  c.fillStyle = grad; c.fillRect(x-5, capY, capW, capH);
  c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x+5,y,6,h); c.fillRect(x, capY, capW, 4);
}

function gameLoop() {
  if(currentScreen !== 'game') return;
  update(game);
  render(game);
  if(game.tick % 30 === 0) updatePowerupHUD(game);
  requestAnimationFrame(gameLoop);
}

function showGameOver(g) {
  const isNew = g.score > state.highScore;
  if(isNew) state.highScore = g.score;
  state.coins += g.coinsCollected;
  state.stats.coinsCollected += g.coinsCollected;
  saveState();

  if(state.coins >= 1000) unlockAchievement('rich');

  // Star rating
  const stars = document.getElementById('star-rating').children;
  for(let i=0; i<3; i++) stars[i].className = '';
  let earned = 0;
  if(g.score >= 10) earned = 1;
  if(g.score >= 30) earned = 2;
  if(g.score >= 50) earned = 3;
  setTimeout(() => { if(earned>0) stars[0].className='earned'; }, 300);
  setTimeout(() => { if(earned>1) stars[1].className='earned'; }, 600);
  setTimeout(() => { if(earned>2) stars[2].className='earned'; }, 900);

  document.getElementById('go-score').textContent = g.score;
  document.getElementById('go-best').textContent = state.highScore;
  document.getElementById('go-coins').textContent = '+' + g.coinsCollected;
  document.getElementById('new-best').classList.toggle('hidden', !isNew);
  
  // Revive logic
  const btnRev = document.getElementById('btn-revive');
  btnRev.style.display = state.coins >= 50 ? 'inline-flex' : 'none';

  showScreen('gameover');
}
