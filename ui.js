// ui.js - User Interface and Menus

let currentScreen = 'menu';
let currentShopTab = 'skins';
let animFrame = 0;
let menuBirdCanvas, menuBirdCtx;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id + '-screen').classList.add('active');
  currentScreen = id;
}

function goToMenu() {
  showScreen('menu');
  updateMenuStats();
  if(!menuBirdCanvas) {
    menuBirdCanvas = document.getElementById('menu-bird-canvas');
    menuBirdCtx = menuBirdCanvas.getContext('2d');
  }
}

function updateMenuStats() {
  document.getElementById('menu-coins').textContent = state.coins;
  document.getElementById('menu-highscore').textContent = state.highScore;
  
  // Difficulty highlight
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === state.difficulty);
  });
}

// Diff picker
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.difficulty = btn.dataset.diff;
    saveState();
    updateMenuStats();
  });
});

// Shop
function openShop() { showScreen('shop'); shopTab('skins'); }
function closeShop() { goToMenu(); }
function shopTab(tab) {
  currentShopTab = tab;
  document.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(tab)));
  renderShop();
}

function renderShop() {
  document.getElementById('shop-coins').textContent = state.coins;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  
  const items = currentShopTab === 'skins' ? SKINS : BGS;
  const ownedList = currentShopTab === 'skins' ? state.ownedSkins : state.ownedBgs;
  const equippedId = currentShopTab === 'skins' ? state.equippedSkin : state.equippedBg;

  items.forEach((item, idx) => {
    const owned = ownedList.includes(item.id);
    const equipped = equippedId === item.id;
    const canAfford = state.coins >= item.price;
    
    const card = document.createElement('div');
    card.className = currentShopTab === 'skins' ? 'skin-card' : 'bg-card';
    if(equipped) card.classList.add('equipped');
    
    let btnClass = 'cant-afford', btnText = 'Not enough';
    if(equipped) { btnClass = 'equipped'; btnText = '✓ Equipped'; }
    else if(owned) { btnClass = 'equip'; btnText = 'Equip'; }
    else if(canAfford) { btnClass = 'buy'; btnText = 'Buy'; }

    let previewHtml = '';
    if (currentShopTab === 'skins') {
      previewHtml = `<canvas class="skin-preview" data-idx="${idx}" width="64" height="64"></canvas>`;
    } else {
      previewHtml = `<div class="bg-preview" style="background:linear-gradient(${item.color1}, ${item.color2})"></div>`;
    }

    card.innerHTML = `
      ${equipped ? '<div class="equipped-badge">Equipped</div>' : ''}
      ${previewHtml}
      <div class="skin-name">${item.name}</div>
      <div class="skin-price ${item.price===0?'free':''}">${item.price===0?'Free':'🪙 '+item.price}</div>
      <button class="skin-btn ${btnClass}" data-id="${item.id}">${btnText}</button>
    `;
    grid.appendChild(card);

    card.querySelector('button').addEventListener('click', () => {
      if(equipped) return;
      if(owned) {
        if(currentShopTab==='skins') state.equippedSkin = item.id;
        else state.equippedBg = item.id;
        saveState(); renderShop();
      } else if(canAfford) {
        state.coins -= item.price;
        if(currentShopTab==='skins') { state.ownedSkins.push(item.id); state.equippedSkin = item.id; }
        else { state.ownedBgs.push(item.id); state.equippedBg = item.id; }
        saveState(); renderShop();
      }
    });
  });
}

// Missions
function openMissions() { showScreen('missions'); renderMissions(); }
function closeMissions() { goToMenu(); }
function checkMissions() {
  MISSIONS.forEach(m => {
    if(state.missionProgress[m.id] === undefined) state.missionProgress[m.id] = 0;
    // Update based on stats
    if(m.type === 'gamesPlayed') state.missionProgress[m.id] = state.stats.gamesPlayed;
    if(m.type === 'coinsCollected') state.missionProgress[m.id] = state.stats.coinsCollected;
    if(m.type === 'highScore') state.missionProgress[m.id] = Math.max(state.missionProgress[m.id], state.highScore);
    if(m.type === 'totalDeaths') state.missionProgress[m.id] = state.stats.totalDeaths;
  });
}
function renderMissions() {
  checkMissions();
  const list = document.getElementById('missions-list');
  list.innerHTML = '';
  MISSIONS.forEach(m => {
    const prog = Math.min(state.missionProgress[m.id] || 0, m.target);
    const done = prog >= m.target;
    const claimed = state.claimedMissions.includes(m.id);
    if(claimed) return; // Hide claimed

    const pct = (prog / m.target) * 100;
    list.innerHTML += `
      <div class="mission-card ${done ? 'completed' : ''}">
        <div class="mission-top">
          <span class="mission-desc">${m.desc}</span>
          <span class="mission-reward">🪙 ${m.reward}</span>
        </div>
        <div class="mission-bar"><div class="mission-fill" style="width:${pct}%"></div></div>
        <div class="mission-top">
          <span class="mission-progress">${prog} / ${m.target}</span>
          ${done ? `<button class="mission-claim" onclick="claimMission('${m.id}', ${m.reward})">Claim</button>` : ''}
        </div>
      </div>
    `;
  });
  if(list.innerHTML === '') list.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">All missions complete!</div>';
}
function claimMission(id, reward) {
  state.coins += reward;
  state.claimedMissions.push(id);
  saveState();
  renderMissions();
}

// Stats & Achievements
function openStats() { showScreen('stats'); renderStats(); }
function closeStats() { goToMenu(); }
function renderStats() {
  const g = document.getElementById('stats-grid');
  g.innerHTML = `
    <div class="stats-card"><div class="s-val">${state.stats.gamesPlayed}</div><div class="s-label">Games</div></div>
    <div class="stats-card"><div class="s-val">${state.stats.totalDeaths}</div><div class="s-label">Crashes</div></div>
    <div class="stats-card"><div class="s-val">${state.stats.coinsCollected}</div><div class="s-label">Total Coins</div></div>
    <div class="stats-card"><div class="s-val">${state.stats.nearMisses}</div><div class="s-label">Near Misses</div></div>
  `;
  const ag = document.getElementById('ach-grid');
  ag.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const unl = state.unlockedAchievements.includes(a.id);
    ag.innerHTML += `
      <div class="ach-card ${unl?'unlocked':''}">
        <div class="ach-icon">🏆</div>
        <div class="ach-info">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>
        ${unl ? '<div class="ach-check">✅</div>' : ''}
      </div>
    `;
  });
}

function unlockAchievement(id) {
  if(state.unlockedAchievements.includes(id)) return;
  state.unlockedAchievements.push(id);
  saveState();
  const ach = ACHIEVEMENTS.find(a=>a.id===id);
  if(ach) showToast(ach.name, ach.desc);
}

function showToast(title, desc) {
  const t = document.getElementById('ach-toast');
  document.getElementById('ach-toast-title').textContent = title;
  document.getElementById('ach-toast-desc').textContent = desc;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// Lucky Spin
function openSpin() {
  showScreen('spin');
  document.getElementById('spin-result').classList.add('hidden');
  document.getElementById('btn-do-spin').classList.remove('hidden');
  document.getElementById('btn-spin-close').classList.add('hidden');
  drawWheel(0);
}
function closeSpin() { goToMenu(); }
const spinRewards = [10, 50, 0, 100, 20, 0, 200, 5];
function drawWheel(angle) {
  const c = document.getElementById('spin-canvas').getContext('2d');
  c.clearRect(0,0,320,320);
  c.save(); c.translate(160,160); c.rotate(angle);
  const slices = spinRewards.length;
  for(let i=0; i<slices; i++) {
    c.beginPath(); c.moveTo(0,0); c.arc(0,0,150, i*Math.PI*2/slices, (i+1)*Math.PI*2/slices);
    c.fillStyle = i%2===0 ? '#f5a623' : '#ff6b6b'; c.fill(); c.stroke();
    c.save(); c.rotate((i+0.5)*Math.PI*2/slices); c.translate(90,0);
    c.fillStyle = '#fff'; c.font = 'bold 20px Outfit'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(spinRewards[i]==0 ? 'X' : spinRewards[i], 0,0);
    c.restore();
  }
  c.restore();
  // pointer
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(160,5); c.lineTo(145,25); c.lineTo(175,25); c.fill();
}
let isSpinning = false;
function doSpin() {
  if(isSpinning) return;
  isSpinning = true;
  document.getElementById('btn-do-spin').classList.add('hidden');
  let angle = 0, speed = 0.5, decel = 0.002;
  function anim() {
    angle += speed; speed -= decel;
    drawWheel(angle);
    if(speed > 0) requestAnimationFrame(anim);
    else {
      isSpinning = false;
      const normalized = angle % (Math.PI*2);
      // slice at top is 3/2 PI
      const pointerAngle = (Math.PI*1.5 - normalized + Math.PI*4) % (Math.PI*2);
      const slice = Math.floor(pointerAngle / (Math.PI*2/spinRewards.length));
      const reward = spinRewards[slice];
      const res = document.getElementById('spin-result');
      res.textContent = reward > 0 ? `+${reward}🪙` : 'Better luck next time!';
      res.classList.remove('hidden');
      document.getElementById('btn-spin-close').classList.remove('hidden');
      if(reward > 0) { state.coins+=reward; saveState(); }
    }
  }
  anim();
}

// Daily Bonus
function checkDaily() {
  const now = new Date().getTime();
  if(now - state.lastDaily > 86400000) {
    document.getElementById('daily-popup').classList.remove('hidden');
  }
}
function claimDaily() {
  state.coins += 25;
  state.lastDaily = new Date().getTime();
  saveState();
  document.getElementById('daily-popup').classList.add('hidden');
  updateMenuStats();
}

// Global Animation Loop for Previews
setInterval(() => {
  animFrame++;
  // Menu Bird
  if(currentScreen === 'menu' && menuBirdCtx) {
    menuBirdCtx.clearRect(0,0,120,120);
    const skin = SKINS.find(s=>s.id===state.equippedSkin) || SKINS[0];
    drawBird(menuBirdCtx, 60, 60, 2.2, Math.sin(animFrame*0.08)*15, skin, animFrame);
  }
  // Shop Birds
  if(currentScreen === 'shop' && currentShopTab === 'skins') {
    document.querySelectorAll('.skin-preview').forEach(cvs => {
      const idx = cvs.dataset.idx;
      const c = cvs.getContext('2d');
      c.clearRect(0,0,64,64);
      drawBird(c, 32, 32, 2, Math.sin(animFrame*0.08)*10, SKINS[idx], animFrame);
    });
  }
}, 50);

window.addEventListener('DOMContentLoaded', () => {
  goToMenu();
  checkDaily();
});
