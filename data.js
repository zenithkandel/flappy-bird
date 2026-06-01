// data.js - Configuration, State, and Items

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

const BGS = [
  { id:'day', name:'Sunny Day', price:0, color1:'#87CEEB', color2:'#4a6fa1', weather:'none' },
  { id:'night', name:'Starry Night', price:150, color1:'#1a1a3e', color2:'#0d1321', weather:'none', stars:true },
  { id:'sunset', name:'Sunset Horizon', price:250, color1:'#FF7E5F', color2:'#FEB47B', weather:'none' },
  { id:'rain', name:'Monsoon', price:400, color1:'#4B5563', color2:'#1F2937', weather:'rain' },
  { id:'snow', name:'Winter Wonderland', price:400, color1:'#E0E7FF', color2:'#93C5FD', weather:'snow' }
];

const MISSIONS = [
  { id:'play_10', desc:'Play 10 Games', target:10, reward:50, type:'gamesPlayed' },
  { id:'collect_100', desc:'Collect 100 Coins', target:100, reward:100, type:'coinsCollected' },
  { id:'score_50', desc:'Reach Score 50 in one game', target:50, reward:150, type:'highScore' },
  { id:'die_50', desc:'Crash 50 times', target:50, reward:50, type:'totalDeaths' }
];

const ACHIEVEMENTS = [
  { id:'first_flight', name:'First Flight', desc:'Play your first game.' },
  { id:'coin_1', name:'Penny Pincher', desc:'Collect your first coin.' },
  { id:'fever_1', name:'Catch the Fever', desc:'Activate Fever Mode.' },
  { id:'revive_1', name:'Second Chance', desc:'Use a revive.' },
  { id:'rich', name:'Wealthy Bird', desc:'Accumulate 1000 coins.' }
];

// ---- State Management ----
let state = loadState();

function defaultState() {
  return {
    coins: 0,
    highScore: 0,
    ownedSkins: ['classic'],
    equippedSkin: 'classic',
    ownedBgs: ['day'],
    equippedBg: 'day',
    difficulty: 'normal',
    stats: {
      gamesPlayed: 0,
      totalDeaths: 0,
      coinsCollected: 0,
      totalJumps: 0,
      nearMisses: 0
    },
    missionProgress: {
      play_10: 0,
      collect_100: 0,
      score_50: 0,
      die_50: 0
    },
    claimedMissions: [],
    unlockedAchievements: [],
    lastDaily: 0
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('flappyquest_v2'));
    return s && s.stats ? s : defaultState();
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem('flappyquest_v2', JSON.stringify(state));
}

// Global drawing helper for birds
function drawBird(c, x, y, scale, angle, skin, tick) {
  c.save();
  c.translate(x, y);
  c.rotate((angle||0) * Math.PI/180);
  const s = scale || 1;

  if (skin.glow) { c.shadowColor = skin.glow; c.shadowBlur = 18 * s; }

  // Body
  c.fillStyle = skin.body; c.beginPath(); c.ellipse(0, 0, 13*s, 10*s, 0, 0, Math.PI*2); c.fill(); c.shadowBlur = 0;
  
  // Wing
  const wingY = Math.sin((tick||0)*0.25) * 3 * s;
  c.fillStyle = skin.wing; c.beginPath(); c.ellipse(-2*s, wingY, 8*s, 5*s, -0.3, 0, Math.PI*2); c.fill();

  // Eye & Pupil
  c.fillStyle = skin.eye; c.beginPath(); c.arc(6*s, -3*s, 4*s, 0, Math.PI*2); c.fill();
  c.fillStyle = skin.pupil; c.beginPath(); c.arc(7.5*s, -3*s, 2*s, 0, Math.PI*2); c.fill();

  // Beak
  c.fillStyle = skin.beak; c.beginPath();
  c.moveTo(12*s, -1*s); c.lineTo(18*s, 1*s); c.lineTo(12*s, 3*s); c.fill();

  if (skin.crown) {
    c.fillStyle = '#FFD700'; c.beginPath();
    c.moveTo(-5*s, -10*s); c.lineTo(-3*s, -16*s); c.lineTo(0, -11*s);
    c.lineTo(3*s, -17*s); c.lineTo(5*s, -10*s); c.fill();
  }
  if (skin.stars) {
    c.fillStyle = '#E0E7FF';
    for (let i=0; i<5; i++) {
      const sx = Math.sin(i*1.8 + (tick||0)*0.05) * 10*s, sy = Math.cos(i*2.3 + (tick||0)*0.07) * 7*s;
      c.beginPath(); c.arc(sx, sy, 1*s, 0, Math.PI*2); c.fill();
    }
  }
  c.restore();
}
