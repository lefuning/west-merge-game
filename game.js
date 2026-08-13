/* ============================================================
 * 西游·字战 — 文字合成 + 放置割草 小游戏
 * 原生 Canvas 2D + JavaScript，零依赖
 * 内部分辨率 720x1280，等比缩放适配任意屏幕
 * ============================================================ */
(() => {
'use strict';

/* ================= 配置常量 ================= */
const W = 720, H = 1280;
const STATUS_H = 64;
const BATTLE_TOP = 64, BATTLE_H = 680;        // 战斗区 64~744
const ACTION_TOP = 744, ACTION_H = 88;        // 操作栏 744~832
const GRID_TOP = 832;                          // 合成区 832~1180
const DEX_TOP = 1180;                          // 图鉴栏 1180~1280

const COLS = 4, ROWS = 4;
const CELL_W = 80, CELL_H = 80, CELL_GAP = 6;
const GRID_W = COLS * CELL_W + (COLS - 1) * CELL_GAP;      // 338
const GRID_X = (W - GRID_W) / 2;                            // 191
const GRID_PAD = 5;                                          // 合成区面板内边距
const GRID_Y = GRID_TOP + (348 - (ROWS * CELL_H + (ROWS - 1) * CELL_GAP)) / 2;

const HERO_SLOTS = [130, 270, 410, 550, 690]; // 5个英雄槽位 y
const PLAYER_POS = { x: 85, y: 430 };          // 唐僧位置
const JUMP_COST = 3;                            // 每次跳跃消耗古币
const START_COINS = 15;                         // 初始古币（5次免费跳跃）

/* ================= 合成链配置 ================= */
const CHAINS = [
  {
    id: 0, name: '齐天大圣', unlocked: true, unlockCost: 0,
    chars: [{ c: '孙', color: '#8bc34a' }, { c: '悟', color: '#4fc3f7' }, { c: '空', color: '#ba68c8' }],
    heroes: [
      { level: 4, name: '孙悟空', atk: 18, interval: 1.0, proj: 'stick', color: '#ff9800', sub: '齐天大圣' },
      { level: 5, name: '斗战胜佛', atk: 45, interval: 0.7, proj: 'pen', color: '#ffd54f', sub: '斗战胜佛', form: '成佛形态' }
    ]
  },
  {
    id: 1, name: '火云洞主', unlocked: false, unlockCost: 100,
    chars: [{ c: '红', color: '#ef5350' }, { c: '孩', color: '#ff7043' }, { c: '儿', color: '#f06292' }],
    heroes: [
      { level: 4, name: '红孩儿', atk: 14, interval: 0.8, proj: 'fire', color: '#ff5722', sub: '圣婴大王' },
      { level: 5, name: '圣婴大王', atk: 35, interval: 0.6, proj: 'fan', color: '#ff8a65', sub: '三昧真火', form: '受封称号' }
    ]
  },
  {
    id: 2, name: '平天大圣', unlocked: false, unlockCost: 200,
    chars: [{ c: '牛', color: '#a1887f' }, { c: '魔', color: '#8d6e63' }, { c: '王', color: '#6d4c41' }],
    heroes: [
      { level: 4, name: '牛魔王', atk: 26, interval: 1.5, proj: 'ram', color: '#5d4037', sub: '平天大圣' },
      { level: 5, name: '混天大圣', atk: 55, interval: 1.0, proj: 'ram', color: '#3e2723', sub: '盖世魔王', form: '七大圣号' }
    ]
  },
  {
    id: 3, name: '南海观音', unlocked: false, unlockCost: 300,
    chars: [{ c: '观', color: '#26a69a' }, { c: '音', color: '#4db6ac' }, { c: '士', color: '#80cbc4' }],
    heroes: [
      { level: 4, name: '观音士', atk: 20, interval: 0.9, proj: 'lotus', color: '#00bfa5', sub: '南海观音' },
      { level: 5, name: '大慈大悲', atk: 40, interval: 0.8, proj: 'lotus', color: '#00e5c0', sub: '普渡众生', form: '菩萨德号' }
    ]
  },
  {
    id: 4, name: '金蝉子', unlocked: false, unlockCost: 400,
    chars: [{ c: '唐', color: '#b39ddb' }, { c: '三', color: '#9575cd' }, { c: '藏', color: '#7e57c2' }],
    heroes: [
      { level: 4, name: '唐三藏', atk: 10, interval: 1.1, proj: 'staff', color: '#7e57c2', sub: '金蝉子', heal: 3 },
      { level: 5, name: '旃檀功德佛', atk: 26, interval: 0.8, proj: 'staff', color: '#b388ff', sub: '旃檀功德佛', form: '成佛形态', heal: 6 }
    ]
  }
];

/* ================= 游戏状态 ================= */
let state = {
  coins: 0, wave: 1, playerHp: 100, over: false, overTimer: 0,
  win: false, winTimer: 0,
  refreshUsed: 0, selected: null, jumping: false, jumpT: 0,
  jumpFrom: { x: 0, y: 0 }, jumpTarget: null,
  kills: 0, maxWave: 0, started: false, waitingWave: false, waitT: 0
};

let screen = 'menu';   // 'menu' | 'game' 主菜单 / 游戏进行
let menuT = 0;          // 主菜单动画计时

let grid = [];
let heroes = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floats = [];
let waveState = { spawning: false, toSpawn: 0, timer: 0, interval: 1.0, done: false };
let shake = 0, combo = 0, comboTimer = 0;

/* ================= Canvas ================= */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const loadBar = document.getElementById('load-bar');
const loadingBox = document.getElementById('loading');

/* ================= 工具函数 ================= */
function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return Math.floor(rand(a, b + 1)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeOutBounce(t) { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; }
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ================= 音效 (WebAudio 合成) ================= */
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 忽略 */ } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f0, f1, dur, vol, type) {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.connect(g); g.connect(a.destination);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}
function sfx(kind) {
  if (kind === 'jump') { tone(320, 880, 0.22, 0.16, 'sine'); }
  else if (kind === 'land') { tone(200, 140, 0.1, 0.14, 'triangle'); }
  else if (kind === 'merge') { tone(520, 980, 0.14, 0.22, 'triangle'); setTimeout(() => tone(980, 1500, 0.16, 0.16, 'sine'), 90); }
  else if (kind === 'hero') { tone(300, 1200, 0.35, 0.2, 'sawtooth'); setTimeout(() => tone(1200, 1600, 0.25, 0.12, 'sine'), 120); }
  else if (kind === 'hit') { tone(700, 300, 0.06, 0.08, 'square'); }
  else if (kind === 'kill') { tone(900, 200, 0.12, 0.12, 'square'); }
  else if (kind === 'hurt') { tone(180, 60, 0.25, 0.22, 'sawtooth'); }
  else if (kind === 'coin') { tone(1200, 1600, 0.06, 0.07, 'sine'); }
  else if (kind === 'unlock') { tone(400, 1200, 0.4, 0.18, 'triangle'); setTimeout(() => tone(800, 1600, 0.4, 0.14, 'sine'), 150); }
  else if (kind === 'deny') { tone(220, 120, 0.18, 0.16, 'square'); }
  else if (kind === 'over') { tone(300, 80, 0.8, 0.2, 'sawtooth'); }
  else if (kind === 'win') {
    tone(523, 1046, 0.3, 0.18, 'triangle');
    setTimeout(() => tone(659, 1318, 0.3, 0.18, 'triangle'), 180);
    setTimeout(() => tone(784, 1568, 0.55, 0.22, 'sine'), 360);
  }
}

/* ================= 粒子 / 飘字 ================= */
function burst(x, y, color, n, speed, size) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(0.2, 1) * (speed || 200);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.4, 0.9), maxLife: 0.9, size: rand((size || 3) * 0.5, size || 5), color, grav: 260 });
  }
}
function floatText(x, y, text, color, size) {
  floats.push({ x, y, text, color: color || '#fff', life: 1, maxLife: 1, size: size || 24 });
}

/* ================= 初始化 ================= */
function initGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid.push({
        x: GRID_X + c * (CELL_W + CELL_GAP) + CELL_W / 2,
        y: GRID_Y + r * (CELL_H + CELL_GAP) + CELL_H / 2,
        c: null, chainId: -1, level: 0, scale: 0, pop: 0
      });
    }
  }
}
function emptyCells() { return grid.filter(g => !g.c); }
function resetGame() {
  state = {
    coins: START_COINS, wave: 1, playerHp: 100, over: false, overTimer: 0,
    win: false, winTimer: 0,
    refreshUsed: 0, selected: null, jumping: false, jumpT: 0,
    jumpFrom: { x: 0, y: 0 }, jumpTarget: null,
    kills: 0, maxWave: 0, started: true, waitingWave: false, waitT: 0
  };
  CHAINS.forEach((c, i) => { c.unlocked = (i === 0); });
  enemies = []; projectiles = []; particles = []; floats = []; heroes = [];
  combo = 0; comboTimer = 0; shake = 0;
  initGrid();
  waveState = { spawning: true, toSpawn: 6, timer: 1.0, interval: 1.1, done: false };
  // 开局送两个起始字，让玩家立刻体验合成
  setTimeout(() => { spawnChar(randEmpty()); spawnChar(randEmpty()); }, 300);
}
function randEmpty() {
  const ec = emptyCells();
  return ec.length ? ec[irand(0, ec.length - 1)] : null;
}
// 该链是否已毕业：已有 L5 终极形态英雄出战
function chainDone(chainId) {
  return heroes.some(h => h.chainId === chainId && h.level >= 5);
}
// 当前可产出字块的链池：所有已解锁链（毕业链也刷字，但合成到L4自动折算古币）
function spawnPool() {
  return CHAINS.filter(c => c.unlocked);
}
function spawnChar(cell) {
  if (!cell) return null;
  const pool = spawnPool();
  if (pool.length === 0) return null;
  // 毕业链降权：未毕业链权重3，毕业链权重1，避免毕业链字块刷太多占格子
  const weighted = [];
  for (const c of pool) {
    const w = chainDone(c.id) ? 1 : 3;
    for (let i = 0; i < w; i++) weighted.push(c);
  }
  const chain = weighted[irand(0, weighted.length - 1)];
  const ch = chain.chars[0];
  // 只刷 L1（第一个字），L2/L3 仅通过合成获得
  cell.c = ch.c; cell.chainId = chain.id; cell.level = 1; cell.scale = 0; cell.pop = 1;
  return cell;
}

/* ================= 跳跃 ================= */
function startJump() {
  if (state.jumping || state.over) return;
  const target = randEmpty();
  if (!target) { floatText(W / 2, GRID_TOP - 20, '格子满了！先合成吧', '#ffcc80', 22); sfx('deny'); return; }
  if (state.coins < JUMP_COST) { floatText(W / 2, GRID_TOP - 20, '古币不足！击杀妖怪赚古币', '#ff8a80', 20); sfx('deny'); return; }
  state.coins -= JUMP_COST;
  state.jumping = true; state.jumpT = 0;
  state.jumpFrom = { x: PLAYER_POS.x + 40, y: PLAYER_POS.y };
  state.jumpTarget = target;
  sfx('jump');
}

/* ================= 合成 ================= */
function mergeCells(a, b) {
  const chain = CHAINS[b.chainId];
  const maxLv = chain.heroes[chain.heroes.length - 1].level;
  if (b.level >= maxLv) return; // L5为顶，禁止再合成（防御，正常入口已拦截）
  b.level += 1;
  // 毕业链合成到L4+：自动折算古币，不生成英雄（解决"毕业后无事可做"死锁）
  if (b.level >= 4 && chainDone(b.chainId)) {
    const price = b.level >= 5 ? 120 : 60;
    state.coins += price;
    floatText(b.x, b.y - 20, '毕业回收 +' + price + ' 古币', '#ffd54f', 24);
    burst(b.x, b.y, '#ffd54f', 20, 280, 5);
    burst(W / 2, BATTLE_TOP + BATTLE_H / 2, '#ffd54f', 20, 300, 5);
    sfx('coin');
    a.c = null; a.chainId = -1; a.level = 0; a.scale = 0;
    b.c = null; b.chainId = -1; b.level = 0; b.scale = 0;
    combo++; comboTimer = 2.5;
    refreshHeroes();
    return;
  }
  const ch = chain.chars.find(c => c.c === b.c);
  b.c = ch ? chain.chars[Math.min(b.level - 1, chain.chars.length - 1)].c : b.c;
  if (b.level >= 4 && chain.chars.length < b.level) {
    // 高级角色字
  }
  if (b.level > 4) {
    const hero = chain.heroes.find(h => h.level === b.level);
    b.c = hero ? hero.name[0] + '' : b.c;
    // 用角色名首字表示？不，L5用特殊字符
  }
  a.c = null; a.chainId = -1; a.level = 0; a.scale = 0;
  b.pop = 1; b.scale = 0;
  combo++; comboTimer = 2.5;
  burst(b.x, b.y, '#ffd54f', 18, 260, 5);
  const ch2 = chain.chars[b.level - 1] || {};
  floatText(b.x, b.y - 20, b.level >= 4 ? chain.heroes.find(h => h.level === b.level)?.name || b.c : ch2.c + '·' + (b.level + 1) + '级', b.level >= 4 ? '#ffd54f' : '#fff', b.level >= 4 ? 26 : 20);
  sfx(b.level >= 4 ? 'hero' : 'merge');
  if (b.level >= 4) {
    // 全屏金光
    burst(W / 2, BATTLE_TOP + BATTLE_H / 2, '#ffd54f', 40, 400, 6);
    shake = 0.25;
    const hero = chain.heroes.find(h => h.level === b.level);
    floatText(W / 2, BATTLE_TOP + 120, '★ ' + (hero ? hero.name : b.c) + ' 出战！★', '#ffd54f', 34);
    if (hero && hero.form) {
      // 终极形态标注：本名 · 形态（如 孙悟空·成佛形态）
      const baseName = chain.heroes[0] ? chain.heroes[0].name : '';
      floatText(W / 2, BATTLE_TOP + 158, baseName + ' · ' + hero.form, '#ffe082', 16);
    }
  }
  refreshHeroes();
}

function refreshHeroes() {
  const best = {};
  grid.forEach(cell => {
    if (cell.c && cell.level >= 4) {
      if (!best[cell.chainId] || cell.level > best[cell.chainId].level) best[cell.chainId] = cell;
    }
  });
  heroes = [];
  CHAINS.forEach((chain, ci) => {
    if (best[ci]) {
      const cell = best[ci];
      const heroDef = chain.heroes.find(h => h.level === cell.level);
      if (heroDef) {
        heroes.push({
          chainId: ci, name: heroDef.name, atk: heroDef.atk, interval: heroDef.interval,
          timer: 0, color: heroDef.color, proj: heroDef.proj, level: cell.level,
          x: 155, y: HERO_SLOTS[ci], sub: heroDef.sub, form: heroDef.form, heal: heroDef.heal
        });
      }
    }
  });
}

/* ================= 战斗系统 ================= */
function startWave(w) {
  const count = 5 + w * 2;
  waveState = {
    spawning: true, toSpawn: count, timer: 0.5,
    interval: Math.max(0.28, 1.1 - w * 0.04), done: false
  };
  state.waitingWave = false;
}
function spawnEnemy() {
  const w = state.wave;
  // 指数缩放：Wave1=17, Wave5=32, Wave10=67, Wave15=140, Wave20=293
  const baseHp = Math.round(15 * Math.pow(1.16, w));
  const baseSpeed = 22 + w * 2.0;

  // 敌人类型：按波次递增混入精怪(快攻)和妖将(坦克)
  let type = 'normal';
  const roll = Math.random();
  if (w >= 5 && roll < 0.18) type = 'tank';
  else if (w >= 3 && roll < 0.38) type = 'fast';

  let hp, speed, dmg, radius;
  if (type === 'fast') {
    // 精怪：低血高速，冲线威胁大
    hp = Math.round(baseHp * 0.55);
    speed = baseSpeed * 1.7;
    dmg = 6; radius = 16;
  } else if (type === 'tank') {
    // 妖将：高血低速，吸收火力
    hp = Math.round(baseHp * 2.5);
    speed = baseSpeed * 0.55;
    dmg = 14; radius = 30;
  } else {
    // 小妖：标准
    hp = baseHp; speed = baseSpeed; dmg = 8; radius = 22;
  }

  enemies.push({
    x: W + 30, y: rand(BATTLE_TOP + 60, BATTLE_TOP + BATTLE_H - 60),
    hp, maxHp: hp, speed, dmg, radius, wob: rand(0, Math.PI * 2),
    type, elite: (Math.random() < 0.08 && w > 1)
  });
}
function heroShoot(h) {
  // 找最近敌人
  let target = null, bd = Infinity;
  for (const e of enemies) {
    const d = (e.x - h.x) * (e.x - h.x) + (e.y - h.y) * (e.y - h.y);
    if (d < bd) { bd = d; target = e; }
  }
  if (!target) return;
  const ang = Math.atan2(target.y - h.y, target.x - h.x);
  const speed = 520;
  const vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed;
  if (h.proj === 'fan') {
    for (let i = -1; i <= 1; i++) {
      const a = ang + i * 0.22;
      projectiles.push({ x: h.x, y: h.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: h.atk, kind: 'fire', color: h.color, ttl: 1.6, pierce: false });
    }
  } else {
    projectiles.push({ x: h.x, y: h.y, vx, vy, dmg: h.atk, kind: h.proj, color: h.color, ttl: h.proj === 'pen' ? 1.4 : 1.2, pierce: h.proj === 'pen' });
  }
  // 辅助定位（唐三藏/旃檀功德佛）：每次攻击为取经人回血
  if (h.heal) {
    const before = state.playerHp;
    state.playerHp = Math.min(100, state.playerHp + h.heal);
    const gained = Math.floor(state.playerHp - before);
    if (gained > 0) {
      floatText(h.x, h.y - 50, '+' + gained, '#69f0ae', 15);
      burst(h.x, h.y - 34, '#69f0ae', 6, 130, 3);
    }
  }
  sfx('hit');
}
function playerShoot() {
  const target = enemies[0];
  if (!target) return;
  const ang = Math.atan2(target.y - PLAYER_POS.y, target.x - PLAYER_POS.x);
  const speed = 420;
  projectiles.push({
    x: PLAYER_POS.x + 30, y: PLAYER_POS.y,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    dmg: 8, kind: 'basic', color: '#ffd54f', ttl: 1.1, pierce: false
  });
}
function damagePlayer(dmg) {
  if (state.win) return; // 五圣归位后取经圆满，不再扣血
  state.playerHp -= dmg;
  shake = 0.35;
  burst(PLAYER_POS.x, PLAYER_POS.y, '#e24b4a', 14, 220, 5);
  floatText(PLAYER_POS.x + 40, PLAYER_POS.y - 30, '-' + dmg, '#ff6b6b', 22);
  sfx('hurt');
  if (state.playerHp <= 0) {
    state.playerHp = 0;
    state.over = true; state.overTimer = 0;
    sfx('over');
  }
}
function killEnemy(e, idx) {
  enemies.splice(idx, 1);
  state.kills++;
  // 不同类型敌人掉落不同古币
  let coin;
  if (e.elite) coin = irand(8, 14);
  else if (e.type === 'tank') coin = irand(5, 10);
  else if (e.type === 'fast') coin = irand(1, 3);
  else coin = irand(2, 5);
  state.coins += coin;
  burst(e.x, e.y, '#ffd54f', 12, 220, 4);
  burst(e.x, e.y, e.elite ? '#ff9800' : (e.type === 'tank' ? '#ef5350' : (e.type === 'fast' ? '#ffca28' : '#b388ff')), 8, 180, 4);
  floatText(e.x, e.y - 16, '+' + coin, '#ffd54f', 18);
  sfx('kill');
}

/* ================= 更新逻辑 ================= */
let playerTimer = 0;
let lastTime = 0;

// 五圣归位判定：5条链全部合出 L5 终极形态即通关
function checkWin() {
  if (state.win || state.over) return;
  const allFive = CHAINS.every(c => heroes.some(h => h.chainId === c.id && h.level >= 5));
  if (allFive) {
    state.win = true; state.winTimer = 0;
    state.maxWave = Math.max(state.maxWave, state.wave);
    sfx('win');
    burst(W / 2, 300, '#ffd54f', 40, 420, 7);
    burst(W / 2, 400, '#b388ff', 30, 380, 6);
    floatText(W / 2, 260, '五圣归位 · 取经圆满！', '#ffd54f', 36);
  }
}

function update(dt) {
  // 连击计时
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  if (shake > 0) shake -= dt;

  // 跳跃动画
  if (state.jumping) {
    state.jumpT += dt / 0.75;
    if (state.jumpT >= 1) {
      state.jumping = false;
      const cell = state.jumpTarget;
      if (cell && !cell.c) {
        const ok = spawnChar(cell);
        sfx('land');
        burst(cell.x, cell.y, '#8bc34a', 10, 180, 4);
        if (!ok) {
          const locked = CHAINS.filter(c => !c.unlocked);
          floatText(cell.x, cell.y - 34, locked.length ? '已解锁角色全部毕业 · 先解锁新角色' : '五圣归位 · 通关！', '#ffd54f', 17);
        }
      }
      state.jumpTarget = null;
    }
  }

  // 字块弹出动画
  grid.forEach(g => {
    if (g.pop > 0) {
      g.pop -= dt * 2.4;
      if (g.pop < 0) g.pop = 0;
    }
  });

  // 波次生成
  if (state.started && !state.over) {
    if (state.waitingWave) {
      state.waitT -= dt;
      if (state.waitT <= 0) startWave(state.wave);
    } else if (waveState.spawning) {
      waveState.timer -= dt;
      if (waveState.timer <= 0 && waveState.toSpawn > 0) {
        spawnEnemy();
        waveState.toSpawn--;
        waveState.timer = waveState.interval;
      }
      if (waveState.toSpawn <= 0 && enemies.length === 0) {
        // 波次完成
        waveState.spawning = false;
        const bonus = state.wave * 5;
        state.coins += bonus;
        floatText(W / 2, BATTLE_TOP + 100, '第 ' + state.wave + ' 波完成 +' + bonus + ' 古币', '#7cf7c8', 28);
        state.maxWave = Math.max(state.maxWave, state.wave);
        state.wave++;
        state.waitingWave = true; state.waitT = 1.6;
        sfx('coin');
      }
    }
  }

  // 敌人移动
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= e.speed * dt;
    e.wob += dt * 6;
    e.y += Math.sin(e.wob) * 0.5;
    if (e.x < 190) {
      enemies.splice(i, 1);
      damagePlayer(e.dmg);
    }
  }

  // 玩家自动攻击
  if (state.started && !state.over && enemies.length > 0) {
    playerTimer -= dt;
    if (playerTimer <= 0) { playerShoot(); playerTimer = 1.2; }
  }

  // 英雄攻击
  heroes.forEach(h => {
    if (enemies.length === 0) return;
    h.timer -= dt;
    if (h.timer <= 0) { heroShoot(h); h.timer = h.interval; }
  });

  // 五圣归位通关判定
  checkWin();

  // 弹幕移动 & 碰撞
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.ttl -= dt;
    let hit = false;
    if (p.ttl <= 0 || p.x > W + 40 || p.x < -40 || p.y < -40 || p.y > H + 40) {
      projectiles.splice(i, 1); continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (dist2(p.x, p.y, e.x, e.y) < (e.radius + 10) * (e.radius + 10)) {
        e.hp -= p.dmg;
        burst(p.x, p.y, '#fff', 4, 120, 3);
        floatText(e.x, e.y - 24, String(p.dmg), '#ffd54f', 15);
        if (e.hp <= 0) { killEnemy(e, j); }
        hit = true;
        break;
      }
    }
    if (hit && !p.pierce) projectiles.splice(i, 1);
    else if (hit && p.pierce) {
      // 穿透弹：继续飞行但降低伤害
      p.dmg = Math.max(1, Math.floor(p.dmg * 0.7));
    }
  }

  // 粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt;
    pt.vy += (pt.grav || 0) * dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  // 飘字
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt * 0.8;
    f.y -= 34 * dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
}

function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }

/* ================= 渲染 ================= */
function rr(x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}

function drawStatus() {
  // 背景
  ctx.fillStyle = '#10162a';
  ctx.fillRect(0, 0, W, STATUS_H);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(0, STATUS_H - 3, W, 3);

  // HP
  ctx.font = 'bold 18px "Microsoft YaHei"';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('❤', 24, 40);
  const hpw = 150, hpx = 52, hpy = 24, hph = 18;
  rr(hpx, hpy, hpw, hph, 9, '#2a1f2e', null, 0);
  rr(hpx, hpy, hpw * clamp(state.playerHp / 100, 0, 1), hph, 9, state.playerHp > 40 ? '#e24b4a' : '#ff7043', null, 0);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText(Math.ceil(state.playerHp) + '/100', hpx + hpw / 2 - 18, hpy + 14);

  // 金币
  drawCoin(24, 52, 9);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 20px "Microsoft YaHei"';
  ctx.fillText(state.coins, 40, 60);

  // 波次
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8fa3c8';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('第 ' + state.wave + ' 波', W - 80, 34);
  ctx.fillStyle = '#5c6f96';
  ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('击杀 ' + state.kills, W - 80, 54);

  // 连击
  if (combo >= 2 && comboTimer > 0) {
    ctx.fillStyle = hexA('#ffb300', 0.9);
    ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillText('连击 x' + combo, 160, 56);
  }
}

function drawCoin(x, y, r) {
  ctx.fillStyle = '#ffb300';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(x - r * 0.35, y - r * 0.35, r * 0.7, r * 0.7);
}

/* ---------- 角色绘制 ---------- */
function drawHero(h, scale) {
  const s = scale || 1;
  const x = h.x, y = h.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 终极形态（L5）：金身光环 + 头顶佛光
  if (h.level >= 5) {
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 46);
    g.addColorStop(0, 'rgba(255,213,79,0.5)');
    g.addColorStop(1, 'rgba(255,213,79,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,224,130,0.95)';
    ctx.beginPath(); ctx.ellipse(0, -44, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 身体
  ctx.fillStyle = h.color;
  rr(-16, -4, 32, 34, 12, h.color, null, 0);
  // 头
  ctx.fillStyle = '#ffd9a8';
  ctx.beginPath(); ctx.arc(0, -20, 14, 0, Math.PI * 2); ctx.fill();
  // 眼睛
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-5, -20, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -20, 2.6, 0, Math.PI * 2); ctx.fill();
  // 头饰（按链）
  if (h.chainId === 0) {
    // 孙悟空：金箍
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -22, 16, 0.5, Math.PI - 0.5); ctx.stroke();
    // 耳朵
    ctx.fillStyle = '#ffd9a8';
    ctx.beginPath(); ctx.ellipse(-16, -22, 4, 7, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, -22, 4, 7, -0.3, 0, Math.PI * 2); ctx.fill();
  } else if (h.chainId === 1) {
    // 红孩儿：冲天辫
    ctx.strokeStyle = '#e24b4a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(6, -46, 12, -48); ctx.stroke();
  } else if (h.chainId === 2) {
    // 牛魔王：牛角
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath(); ctx.moveTo(-10, -32); ctx.quadraticCurveTo(-22, -46, -16, -50); ctx.quadraticCurveTo(-10, -46, -6, -32); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -32); ctx.quadraticCurveTo(22, -46, 16, -50); ctx.quadraticCurveTo(10, -46, 6, -32); ctx.fill();
    // 鼻子
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath(); ctx.arc(0, -14, 3, 0, Math.PI * 2); ctx.fill();
  } else if (h.chainId === 3) {
    // 观音：莲花冠
    ctx.fillStyle = '#e0f2f1';
    ctx.beginPath(); ctx.arc(0, -32, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00bfa5';
    ctx.beginPath(); ctx.arc(0, -32, 4, 0, Math.PI * 2); ctx.fill();
  } else if (h.chainId === 4) {
    // 唐三藏：光头 + 戒疤
    ctx.fillStyle = '#a1887f';
    ctx.beginPath(); ctx.arc(-4, -27, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -28, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -27, 1.8, 0, Math.PI * 2); ctx.fill();
    // 袈裟披风
    ctx.fillStyle = hexA(h.color, 0.55);
    ctx.beginPath(); ctx.moveTo(-16, 10); ctx.lineTo(-22, 32); ctx.lineTo(22, 32); ctx.lineTo(16, 10); ctx.fill();
  }
  // 名字
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText(h.name, 0, 46);
  // 形态小字
  if (h.form) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = '9px "Microsoft YaHei"';
    ctx.fillText('·' + h.form, 0, 58);
  }
  ctx.restore();
}

function drawPlayer() {
  const x = PLAYER_POS.x, y = PLAYER_POS.y;
  ctx.save();
  ctx.translate(x, y);
  // 袈裟
  ctx.fillStyle = '#d84315';
  rr(-18, -2, 36, 38, 12, '#d84315', null, 0);
  ctx.fillStyle = '#ffb300';
  ctx.fillRect(-18, 10, 36, 4);
  // 头（光头+戒疤）
  ctx.fillStyle = '#ffe0b2';
  ctx.beginPath(); ctx.arc(0, -22, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath(); ctx.arc(0, -28, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-6, -26, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, -26, 2, 0, Math.PI * 2); ctx.fill();
  // 眼睛
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-5, -22, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -22, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('唐僧', 0, 50);
  ctx.restore();
}

function drawEnemy(e) {
  const x = e.x, y = e.y;
  const t = e.type || 'normal';
  ctx.save();
  ctx.translate(x, y);

  if (t === 'fast') {
    // 精怪：小体型、黄绿色、瘦长、三角眼
    ctx.fillStyle = e.elite ? '#e65100' : '#33691e';
    ctx.beginPath(); ctx.ellipse(0, 4, 11, 16, 0, 0, Math.PI * 2); ctx.fill();
    // 尖帽
    ctx.fillStyle = e.elite ? '#ff9800' : '#558b2f';
    ctx.beginPath();
    ctx.moveTo(-16, -2); ctx.lineTo(16, -2); ctx.lineTo(0, -24); ctx.closePath(); ctx.fill();
    // 黄眼
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowColor = '#ffeb3b'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(-2, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, 2); ctx.lineTo(2, 5); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // 血条
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#00000066'; ctx.fillRect(-13, -30, 26, 4);
      ctx.fillStyle = '#ff5252'; ctx.fillRect(-13, -30, 26 * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  } else if (t === 'tank') {
    // 妖将：大体型、暗红、宽体、铁甲
    ctx.fillStyle = e.elite ? '#b71c1c' : '#4a0000';
    ctx.beginPath(); ctx.ellipse(0, 8, 24, 28, 0, 0, Math.PI * 2); ctx.fill();
    // 铁盔
    ctx.fillStyle = e.elite ? '#ef5350' : '#8b0000';
    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(22, -20); ctx.lineTo(-22, -20);
    ctx.closePath(); ctx.fill();
    // 肩甲
    ctx.fillStyle = e.elite ? '#ff8a80' : '#b71c1c';
    ctx.beginPath(); ctx.arc(-26, 6, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(26, 6, 8, 0, Math.PI * 2); ctx.fill();
    // 红眼
    ctx.fillStyle = '#ff1744';
    ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(-7, 4, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 4, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 血条
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#00000066'; ctx.fillRect(-24, -34, 48, 6);
      ctx.fillStyle = '#ff5252'; ctx.fillRect(-24, -34, 48 * clamp(e.hp / e.maxHp, 0, 1), 6);
    }
  } else {
    // 小妖：标准紫黑色斗笠怪
    ctx.fillStyle = e.elite ? '#4a148c' : '#311b52';
    ctx.beginPath(); ctx.ellipse(0, 6, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
    // 斗笠
    ctx.fillStyle = e.elite ? '#7e57c2' : '#4a2a6a';
    ctx.beginPath();
    ctx.moveTo(-24, -4); ctx.lineTo(24, -4); ctx.lineTo(16, -22); ctx.lineTo(-16, -22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = e.elite ? '#9575cd' : '#6a3d94';
    ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(18, -10); ctx.lineTo(14, -16); ctx.lineTo(-14, -16); ctx.closePath(); ctx.fill();
    // 红眼
    ctx.fillStyle = '#ff5252';
    ctx.shadowColor = '#ff5252'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(-5, 2, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 2, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 血条
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#00000066'; ctx.fillRect(-18, -34, 36, 5);
      ctx.fillStyle = '#ff5252'; ctx.fillRect(-18, -34, 36 * clamp(e.hp / e.maxHp, 0, 1), 5);
    }
  }
  ctx.restore();
}

/* ---------- 弹幕 ---------- */
function drawProjectile(p) {
  ctx.save();
  if (p.kind === 'basic' || p.kind === 'stick' || p.kind === 'ram') {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    const len = p.kind === 'ram' ? 30 : p.kind === 'stick' ? 26 : 18;
    ctx.fillStyle = p.kind === 'ram' ? '#8d6e63' : '#ffd54f';
    rr(-len / 2, -4, len, 8, 4, ctx.fillStyle, p.kind === 'stick' ? '#fff' : null, 1.5);
  } else if (p.kind === 'fire') {
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'pen') {
    ctx.fillStyle = '#fff8e1';
    ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'lotus') {
    ctx.fillStyle = '#00e5c0';
    ctx.shadowColor = '#00e5c0'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b2dfdb';
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'staff') {
    // 唐三藏：佛珠/锡杖
    ctx.fillStyle = '#b388ff';
    ctx.shadowColor = '#b388ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- 合成格子 ---------- */
function drawGrid() {
  // 区域背景
  ctx.fillStyle = '#0e1426';
  ctx.fillRect(0, GRID_TOP, W, DEX_TOP - GRID_TOP);
  ctx.fillStyle = '#1a2340';
  ctx.fillRect(GRID_X - GRID_PAD, GRID_Y - GRID_PAD, GRID_W + GRID_PAD * 2, ROWS * CELL_H + (ROWS - 1) * CELL_GAP + GRID_PAD * 2);

  ctx.font = '13px "Microsoft YaHei"';
  ctx.fillStyle = 'rgba(143,163,200,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('同字相合升级', W / 2, ACTION_TOP - 10);

  grid.forEach(g => {
    const x = g.x - CELL_W / 2, y = g.y - CELL_H / 2;
    // 空格
    ctx.fillStyle = '#141c36';
    rr(x, y, CELL_W, CELL_H, 10, '#141c36', '#232e54', 1.5);

    if (g.c) {
      // 弹出动画
      let sc = 1;
      if (g.pop > 0) sc = easeOutBack(1 - g.pop);
      const cx = g.x, cy = g.y;
      const chain = CHAINS[g.chainId];
      const chDef = chain ? chain.chars[Math.min(g.level - 1, chain.chars.length - 1)] : null;
      const col = g.level >= 4 ? '#ffd54f' : (chDef ? chDef.color : '#8bc34a');
      // 选中高亮
      if (state.selected === g) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        rr(x - 3, y - 3, CELL_W + 6, CELL_H + 6, 12, null, '#fff', 3);
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      // 字块
      rr(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, 10, col, '#fff', 2);
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      rr(-CELL_W / 2 + 4, -CELL_H / 2 + 4, CELL_W - 8, CELL_H / 2.4, 7, ctx.fillStyle, null, 0);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.c, 0, -2);
      // 等级
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('Lv.' + g.level, 0, CELL_H / 2 - 8);
      ctx.restore();
    }
  });
}

/* ---------- 图鉴栏 ---------- */
function drawDex() {
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, DEX_TOP, W, H - DEX_TOP);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(0, DEX_TOP, W, 2);

  ctx.font = 'bold 14px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8fa3c8';
  ctx.fillText('西游图鉴', W / 2, DEX_TOP + 20);

  const slotW = 132, gap = 12; // 5列布局
  const total = CHAINS.length * slotW + (CHAINS.length - 1) * gap;
  let sx = (W - total) / 2;
  CHAINS.forEach((chain, i) => {
    const inTeam = heroes.find(h => h.chainId === i);
    // 槽
    ctx.fillStyle = chain.unlocked ? '#1a2340' : '#141a2c';
    rr(sx, DEX_TOP + 28, slotW, 66, 10, ctx.fillStyle, chain.unlocked ? '#2c3a66' : '#1f2740', 1.5);
    // 头像
    if (inTeam) {
      drawHeroMini(inTeam, sx + 28, DEX_TOP + 61);
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 11px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText(inTeam.name, sx + slotW / 2, DEX_TOP + 84);
    } else if (chain.unlocked) {
      ctx.fillStyle = '#5c6f96';
      ctx.font = '11px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText('未出战', sx + slotW / 2, DEX_TOP + 61);
    } else {
      ctx.fillStyle = '#8d99b8';
      ctx.font = '15px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 ' + chain.name, sx + slotW / 2, DEX_TOP + 58);
      ctx.font = '11px "Microsoft YaHei"';
      ctx.fillStyle = '#ffb300';
      ctx.fillText(chain.unlockCost + ' 古币解锁', sx + slotW / 2, DEX_TOP + 78);
    }
    sx += slotW + gap;
  });
}

function drawHeroMini(h, x, y) {
  ctx.save();
  ctx.translate(x, y);
  // 终极形态：迷你金身光环
  if (h.level >= 5) {
    ctx.fillStyle = 'rgba(255,213,79,0.35)';
    ctx.beginPath(); ctx.arc(0, -6, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = h.color;
  rr(-12, -2, 24, 22, 8, h.color, null, 0);
  ctx.fillStyle = '#ffd9a8';
  ctx.beginPath(); ctx.arc(0, -12, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-3, -12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -12, 2, 0, Math.PI * 2); ctx.fill();
  if (h.chainId === 0) {
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -13, 12, 0.5, Math.PI - 0.5); ctx.stroke();
  } else if (h.chainId === 1) {
    ctx.strokeStyle = '#e24b4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(4, -28, 8, -30); ctx.stroke();
  } else if (h.chainId === 2) {
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath(); ctx.moveTo(-8, -20); ctx.quadraticCurveTo(-14, -28, -10, -32); ctx.quadraticCurveTo(-6, -28, -4, -20); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -20); ctx.quadraticCurveTo(14, -28, 10, -32); ctx.quadraticCurveTo(6, -28, 4, -20); ctx.fill();
  } else if (h.chainId === 3) {
    ctx.fillStyle = '#e0f2f1';
    ctx.beginPath(); ctx.arc(0, -20, 6, 0, Math.PI * 2); ctx.fill();
  } else if (h.chainId === 4) {
    // 唐三藏：小戒疤
    ctx.fillStyle = '#a1887f';
    ctx.beginPath(); ctx.arc(0, -26, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- 操作栏 ---------- */
function drawActions() {
  ctx.fillStyle = '#10162a';
  ctx.fillRect(0, ACTION_TOP, W, ACTION_H);
  ctx.fillStyle = '#1c2748';
  ctx.fillRect(0, ACTION_TOP, W, 2);

  const by = ACTION_TOP + 16, bh = 56;

  // 刷新按钮
  const refreshEnabled = state.coins >= 30 && state.refreshUsed < 5 && !state.over;
  drawBtn(20, by, 200, bh, '刷新 ' + (5 - state.refreshUsed) + '/5', '30 古币', refreshEnabled, '#854f0b', '#ef9f27');

  // 跳按钮（主按钮）
  const jumpEnabled = !state.jumping && !state.over && emptyCells().length > 0 && state.coins >= JUMP_COST;
  let jumpSub;
  if (state.jumping) jumpSub = '跳跃中...';
  else if (state.coins < JUMP_COST) jumpSub = '古币不足（需' + JUMP_COST + '）';
  else jumpSub = JUMP_COST + ' 古币 · 获得文字';
  drawBtn(250, by, 220, bh + 4, '跳', jumpSub, jumpEnabled, '#ffb300', '#ffd54f', true);

  // 解锁 / 回收按钮（全解锁后变为回收）
  const nextChain = CHAINS.find(c => !c.unlocked);
  let rightLabel, rightSub, rightEnabled, rightColor, rightBorder;
  if (nextChain) {
    rightEnabled = state.coins >= nextChain.unlockCost && !state.over;
    rightLabel = nextChain.name;
    rightSub = nextChain.unlockCost + ' 古币解锁';
    rightColor = '#0f6e56';
    rightBorder = '#1d9e75';
  } else {
    // 全解锁后：回收选中的 L4/L5 字块
    const sellable = state.selected && state.selected.level >= 4;
    const sellPrice = sellable ? (state.selected.level >= 5 ? 120 : 60) : 0;
    rightEnabled = sellable && !state.over;
    rightLabel = '♻ 回收';
    rightSub = sellable ? sellPrice + ' 古币' : '选择 L4/L5 字块';
    rightColor = '#7b1fa2';
    rightBorder = '#ba68c8';
  }
  drawBtn(500, by, 200, bh, rightLabel, rightSub, rightEnabled, rightColor, rightBorder);
}

function drawBtn(x, y, w, h, label, sub, enabled, color, border, big) {
  ctx.save();
  ctx.fillStyle = enabled ? color : '#232a44';
  ctx.strokeStyle = enabled ? border : '#33406b';
  ctx.lineWidth = 2;
  rr(x, y, w, h, big ? 16 : 12, ctx.fillStyle, ctx.strokeStyle, 2);
  if (enabled) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rr(x + 4, y + 4, w - 8, h / 2.6, big ? 8 : 6, ctx.fillStyle, null, 0);
  }
  ctx.fillStyle = enabled ? '#fff' : '#5c6f96';
  ctx.font = (big ? 'bold 26px' : 'bold 17px') + ' "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 - (sub ? 9 : 0));
  if (sub) {
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillStyle = enabled ? 'rgba(255,255,255,0.85)' : '#3d4a72';
    ctx.fillText(sub, x + w / 2, y + h / 2 + 15);
  }
  ctx.restore();
}

/* ---------- 粒子 / 飘字 ---------- */
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}
function drawFloats() {
  floats.forEach(f => {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = 'bold ' + f.size + 'px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;
}

/* ---------- 战斗区背景 ---------- */
function drawBattleBg() {
  ctx.fillStyle = '#12182b';
  ctx.fillRect(0, BATTLE_TOP, W, BATTLE_H);
  // 地面砖纹
  ctx.strokeStyle = 'rgba(255,213,79,0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = BATTLE_TOP + 80 + i * 80;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // 左侧阵营光晕
  ctx.fillStyle = 'rgba(255,179,0,0.05)';
  ctx.beginPath(); ctx.arc(120, 400, 260, 0, Math.PI * 2); ctx.fill();
  // 右侧危险区
  ctx.fillStyle = 'rgba(225,75,74,0.05)';
  ctx.beginPath(); ctx.arc(W - 100, 400, 300, 0, Math.PI * 2); ctx.fill();
  // 底线
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(190, BATTLE_TOP); ctx.lineTo(190, BATTLE_TOP + BATTLE_H); ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------- 结束面板 ---------- */
function drawGameOver(dt) {
  ctx.fillStyle = 'rgba(5,8,16,0.75)';
  ctx.fillRect(0, 0, W, H);
  const t = clamp(state.overTimer, 0, 1);
  const panelW = 480, panelH = 380;
  const px = (W - panelW) / 2, py = 300;
  ctx.fillStyle = '#141c36';
  rr(px, py, panelW, panelH, 20, '#141c36', '#ffd54f', 2);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 40px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('取经失败', W / 2, py + 70);
  ctx.fillStyle = '#b8c6e4';
  ctx.font = '20px "Microsoft YaHei"';
  ctx.fillText('坚守到第 ' + state.maxWave + ' 波', W / 2, py + 115);
  ctx.fillText('击杀 ' + state.kills + ' 个妖怪', W / 2, py + 150);
  ctx.fillText('获得 ' + state.coins + ' 古币', W / 2, py + 185);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = '15px "Microsoft YaHei"';
  ctx.fillText('点击下方按钮 重新踏上西行路', W / 2, py + 225);
  // 重开按钮
  const by2 = py + 250, bw = 240, bh2 = 64;
  ctx.fillStyle = '#ffb300';
  rr(W / 2 - bw / 2, by2, bw, bh2, 14, '#ffb300', '#ffd54f', 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px "Microsoft YaHei"';
  ctx.fillText('重新开始', W / 2, by2 + bh2 / 2 + 4);
}

/* ---------- 胜利面板（五圣归位） ---------- */
function drawWin(dt) {
  ctx.fillStyle = 'rgba(12,8,2,0.72)';
  ctx.fillRect(0, 0, W, H);
  const t = clamp(state.winTimer, 0, 1);
  const panelW = 540, panelH = 420;
  const px = (W - panelW) / 2, py = 250;
  ctx.fillStyle = '#1a1408';
  rr(px, py, panelW, panelH, 20, '#1a1408', '#ffd54f', 3);
  // 金色放射光
  ctx.save();
  ctx.translate(W / 2, py + 60);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = 'rgba(255,213,79,0.25)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -170); ctx.stroke();
  }
  ctx.restore();
  // 标题
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 44px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('五圣归位', W / 2, py + 70);
  ctx.font = '18px "Microsoft YaHei"';
  ctx.fillStyle = '#e8d5a3';
  ctx.fillText('取经圆满 · 佛光普照', W / 2, py + 106);
  // 五圣名单
  const saints = [
    { name: '孙悟空', form: '斗战胜佛' }, { name: '红孩儿', form: '圣婴大王' },
    { name: '牛魔王', form: '混天大圣' }, { name: '观音士', form: '大慈大悲' },
    { name: '唐三藏', form: '旃檀功德佛' }
  ];
  const slotW2 = 92, gap2 = 8;
  const total2 = saints.length * slotW2 + (saints.length - 1) * gap2;
  let sx2 = (W - total2) / 2;
  saints.forEach(s => {
    ctx.fillStyle = 'rgba(255,213,79,0.12)';
    rr(sx2, py + 128, slotW2, 66, 10, ctx.fillStyle, 'rgba(255,213,79,0.4)', 1.5);
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillText(s.name, sx2 + slotW2 / 2, py + 156);
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = '#e8d5a3';
    ctx.fillText(s.form, sx2 + slotW2 / 2, py + 178);
    sx2 += slotW2 + gap2;
  });
  // 战绩
  ctx.fillStyle = '#b8c6e4';
  ctx.font = '17px "Microsoft YaHei"';
  ctx.fillText('坚守 ' + state.maxWave + ' 波 · 击杀 ' + state.kills + ' · 古币 ' + state.coins, W / 2, py + 240);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('西天已到，功德圆满！', W / 2, py + 270);
  // 重开按钮
  const by2 = py + 300, bw = 240, bh2 = 64;
  ctx.fillStyle = '#ffb300';
  rr(W / 2 - bw / 2, by2, bw, bh2, 14, '#ffb300', '#ffd54f', 2);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px "Microsoft YaHei"';
  ctx.fillText('再来一局', W / 2, by2 + bh2 / 2 + 4);
}

/* ================= 主菜单 ================= */
const MENU_BTN = { x: W / 2 - 170, y: 812, w: 340, h: 96 };

function drawMenu(dt) {
  menuT += dt;
  const t = menuT;
  ctx.save();

  // 背景：深蓝夜空渐变
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1b2e');
  bg.addColorStop(0.55, '#16213a');
  bg.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  // 星点
  for (let i = 0; i < 70; i++) {
    const sx = (i * 89 + 17) % W;
    const sy = (i * 61) % (H * 0.75);
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.6 + i * 1.7));
    ctx.fillStyle = 'rgba(255,236,180,' + (0.3 * tw).toFixed(2) + ')';
    ctx.fillRect(sx, sy, 2, 2);
  }

  // 远景山影
  ctx.fillStyle = 'rgba(20,34,58,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.lineTo(140, 300); ctx.lineTo(300, 400); ctx.lineTo(460, 290);
  ctx.lineTo(640, 410); ctx.lineTo(720, 360); ctx.lineTo(720, 470); ctx.lineTo(0, 470);
  ctx.closePath(); ctx.fill();

  // 标题（浮动动画）
  const bob = Math.sin(t * 1.8) * 7;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 78px "Microsoft YaHei"';
  ctx.fillText('西游·字战', W / 2, 232 + bob);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,213,79,0.9)'; ctx.lineWidth = 2.5;
  ctx.strokeText('西游·字战', W / 2, 232 + bob);

  // 副标题
  ctx.fillStyle = '#9db4d8';
  ctx.font = 'bold 22px "Microsoft YaHei"';
  ctx.fillText('—— 文字合成 · 放置割草 · 五圣归位 ——', W / 2, 292 + bob * 0.5);

  // 五圣字块展示条
  const demos = CHAINS.map((chain, i) => {
    const top = chain.heroes[chain.heroes.length - 1];
    return { c: chain.chars[0].c, color: chain.chars[0].color, lv5: top.name };
  });
  const bw = 96, gap = 16;
  const total = demos.length * bw + (demos.length - 1) * gap;
  let dx = (W - total) / 2;
  const cardY = 372;
  demos.forEach((d, i) => {
    const wob = Math.sin(t * 2.2 + i * 1.3) * 4;
    // 字块
    ctx.save();
    ctx.translate(dx + bw / 2, cardY + bw / 2 + wob);
    ctx.rotate(Math.sin(t * 1.4 + i) * 0.04);
    ctx.shadowColor = d.color; ctx.shadowBlur = 16;
    rr(-bw / 2, -bw / 2, bw, bw, 16, d.color, 'rgba(255,255,255,0.5)', 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillText(d.c, 0, 18);
    ctx.restore();
    // 角色名
    ctx.fillStyle = '#e6edf7';
    ctx.font = 'bold 16px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillText('→ ' + d.lv5, dx + bw / 2, cardY + bw + 34);
    dx += bw + gap;
  });

  // 玩法卡片
  rr(56, 560, W - 112, 208, 18, 'rgba(16,22,42,0.85)', '#2c3a66', 1.5);
  const tips = [
    ['🧩 拼字合将', '点击两个相同字块合成升级，拼出西游角色'],
    ['⚔️ 自动御敌', '合出的英雄自动出战，抵御无尽妖潮'],
    ['🏆 五圣归位', '集齐五条链的终极形态，功德圆满']
  ];
  tips.forEach((tp, i) => {
    const ty = 610 + i * 52;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 20px "Microsoft YaHei"';
    ctx.fillText(tp[0], 92, ty);
    ctx.fillStyle = '#aab8d6';
    ctx.font = '16px "Microsoft YaHei"';
    ctx.fillText(tp[1], 230, ty);
  });

  // 开始按钮（脉动）
  const pulse = 1 + Math.sin(t * 2.6) * 0.022;
  ctx.save();
  ctx.translate(MENU_BTN.x + MENU_BTN.w / 2, MENU_BTN.y + MENU_BTN.h / 2);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 28;
  rr(-MENU_BTN.w / 2, -MENU_BTN.h / 2, MENU_BTN.w, MENU_BTN.h, 20, '#ffb300', '#ffe082', 3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('开始取经 ▶', 0, 13);
  ctx.restore();

  // 操作提示
  ctx.fillStyle = '#5c6f96';
  ctx.font = '15px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('点「跳」落字 · 同字相合升级 · 角色自动出战', W / 2, 968);

  // 版本
  ctx.fillStyle = '#3d4a68';
  ctx.font = '13px "Microsoft YaHei"';
  ctx.fillText('v0.3.0 · 五圣归位版', W / 2, 1256);

  ctx.restore();
}

/* ================= 主渲染循环 ================= */
function render(dt) {
  ctx.save();
  if (screen === 'menu') {
    drawMenu(dt);
    ctx.restore();
    return;
  }
  if (shake > 0) {
    const s = shake * 6;
    ctx.translate(rand(-s, s), rand(-s, s));
  }
  // 背景
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(-20, -20, W + 40, H + 40);

  drawStatus();
  drawBattleBg();

  // 玩家与英雄（绘制在战斗区）
  if (state.started && !state.over) drawPlayer();
  heroes.forEach(h => drawHero(h, 1));

  // 跳跃动画角色
  if (state.jumping) {
    const t = state.jumpT;
    const fx = state.jumpFrom.x, fy = state.jumpFrom.y;
    const tx = state.jumpTarget ? state.jumpTarget.x : GRID_X + GRID_W / 2;
    const ty = state.jumpTarget ? state.jumpTarget.y : GRID_Y;
    let x, y, s;
    if (t < 0.72) {
      const p = t / 0.72;
      x = fx + (tx - fx) * easeOutCubic(p);
      y = fy - Math.sin(p * Math.PI) * 300;
      s = 1;
    } else {
      const p = (t - 0.72) / 0.28;
      x = tx; y = ty - 40 + 40 * easeOutBounce(p);
      s = 1 - p * 0.2;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * Math.PI * 2) * 0.15);
    ctx.scale(s, s);
    // 简易唐僧飞行动画
    ctx.fillStyle = '#d84315';
    rr(-16, -10, 32, 30, 10, '#d84315', null, 0);
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath(); ctx.arc(0, -16, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-4, -16, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -16, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 飞行轨迹
    ctx.strokeStyle = 'rgba(255,213,79,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(fx, fy - 40);
    ctx.quadraticCurveTo((fx + tx) / 2, fy - 320, tx, ty - 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 敌人
  enemies.forEach(drawEnemy);
  // 弹幕
  projectiles.forEach(drawProjectile);
  // 粒子 & 飘字
  drawParticles();
  drawFloats();

  // 合成区 & 操作栏 & 图鉴
  drawActions();
  drawGrid();
  drawDex();

  // 结束面板
  if (state.win) drawWin(dt);
  else if (state.over) drawGameOver(dt);
  ctx.restore();
}

/* ================= 输入处理 ================= */
function handleTap(x, y) {
  // 主菜单：点击开始按钮进入游戏
  if (screen === 'menu') {
    if (x > MENU_BTN.x && x < MENU_BTN.x + MENU_BTN.w &&
        y > MENU_BTN.y && y < MENU_BTN.y + MENU_BTN.h) {
      screen = 'game';
      initGrid();
      resetGame();
      sfx('unlock');
      burst(W / 2, MENU_BTN.y + MENU_BTN.h / 2, '#ffd54f', 26, 320, 5);
    }
    return;
  }
  if (state.over || state.win) {
    // 点击重开（失败/通关面板按钮区域一致：550~614）
    const py = 550;
    if (x > W / 2 - 120 && x < W / 2 + 120 && y > py && y < py + 64) {
      resetGame();
      sfx('jump');
    }
    return;
  }
  // 操作栏按钮
  if (y > ACTION_TOP && y < ACTION_TOP + ACTION_H) {
    // 跳按钮
    if (x > 250 && x < 470) { startJump(); return; }
    // 刷新
    if (x > 20 && x < 220) {
      if (state.coins >= 30 && state.refreshUsed < 5) {
        // 只清 L1-L3 碎块，保留 L4/L5 角色字块（英雄不消失）
        let cleared = 0;
        grid.forEach(g => {
          if (g.c && g.level <= 3) {
            burst(g.x, g.y, '#8fa3c8', 8, 160, 4);
            g.c = null; g.chainId = -1; g.level = 0; g.scale = 0;
            cleared++;
          }
        });
        if (cleared === 0) {
          sfx('deny');
          floatText(W / 2, ACTION_TOP + ACTION_H / 2, '没有可刷新的碎块', '#ff8a80', 20);
          return;
        }
        state.coins -= 30; state.refreshUsed++;
        state.selected = null;
        // 补回相同数量的新字
        let refilled = 0;
        for (let i = 0; i < cleared; i++) {
          const c = randEmpty();
          if (c && spawnChar(c)) refilled++;
        }
        refreshHeroes();
        sfx('unlock');
        floatText(W / 2, GRID_TOP - 20, '刷新文字库！', '#7cf7c8', 24);
      } else {
        sfx('deny');
        floatText(W / 2, ACTION_TOP + ACTION_H / 2, state.refreshUsed >= 5 ? '本局刷新次数用尽' : '古币不足', '#ff8a80', 20);
      }
      return;
    }
    // 解锁 / 回收（全解锁后变为回收）
    if (x > 500 && x < 700) {
      const next = CHAINS.find(c => !c.unlocked);
      if (next) {
        if (state.coins >= next.unlockCost) {
          state.coins -= next.unlockCost;
          next.unlocked = true;
          burst(W / 2, GRID_TOP - 40, '#00e5c0', 30, 320, 6);
          floatText(W / 2, GRID_TOP - 60, '解锁「' + next.name + '」合成链！', '#7cf7c8', 30);
          sfx('unlock');
          // 送两个新链的字
          setTimeout(() => {
            const c1 = randEmpty(); if (c1) { c1.c = next.chars[0].c; c1.chainId = next.id; c1.level = 1; c1.scale = 0; c1.pop = 1; }
            const c2 = randEmpty(); if (c2) { c2.c = next.chars[0].c; c2.chainId = next.id; c2.level = 1; c2.scale = 0; c2.pop = 1; }
          }, 350);
        } else {
          sfx('deny');
          floatText(W / 2, ACTION_TOP + ACTION_H / 2, '古币不足（' + next.unlockCost + '）', '#ff8a80', 20);
        }
      } else {
        // 全解锁后：回收选中的 L4/L5 字块
        const cell = state.selected;
        if (cell && cell.level >= 4) {
          const price = cell.level >= 5 ? 120 : 60;
          state.coins += price;
          burst(cell.x, cell.y, cell.level >= 5 ? '#ffd54f' : '#ff9800', 16, 220, 5);
          floatText(cell.x, cell.y - 30, '回收 +' + price + ' 古币', '#ffd54f', 22);
          sfx('coin');
          cell.c = null; cell.chainId = -1; cell.level = 0; cell.scale = 0;
          state.selected = null;
          refreshHeroes();
        } else {
          sfx('deny');
          floatText(W / 2, ACTION_TOP + ACTION_H / 2, '请先选中一个 L4/L5 字块', '#ff8a80', 20);
        }
      }
      return;
    }
    return;
  }

  // 合成格子点击
  if (y > GRID_TOP && y < DEX_TOP) {
    for (const g of grid) {
      if (Math.abs(x - g.x) < CELL_W / 2 + 4 && Math.abs(y - g.y) < CELL_H / 2 + 4) {
        if (!g.c) { state.selected = null; return; }
        if (!state.selected) {
          state.selected = g;
          sfx('land');
        } else if (state.selected === g) {
          state.selected = null;
        } else {
          const a = state.selected;
          if (a.chainId === g.chainId && a.level === g.level && a.c === g.c) {
            const chain = CHAINS[a.chainId];
            const maxLv = chain.heroes[chain.heroes.length - 1].level;
            if (a.level >= maxLv) {
              // L5 为顶，不可再合成
              floatText(g.x, g.y - 26, '已达最高级 · 无法再合成', '#ffd54f', 17);
              sfx('deny');
              state.selected = null;
            } else {
              mergeCells(a, g);
            }
          } else {
            state.selected = g;
            sfx('land');
          }
        }
        return;
      }
    }
    state.selected = null;
    return;
  }

  // 点击战斗区：如果没开始（初始界面），开始游戏
  if (!state.started) {
    resetGame();
    sfx('jump');
  }
}

/* ================= 事件绑定 ================= */
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top) * (H / rect.height);
  audio(); // 首次交互解锁音频
  handleTap(x, y);
});

/* ================= 主循环 ================= */
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;
  if (screen !== 'menu') {
    if (state.over) state.overTimer += dt;
    if (state.win) state.winTimer += dt;
    update(dt);
  }
  render(dt);
  requestAnimationFrame(loop);
}

/* ================= 启动 ================= */
function boot() {
  let p = 0;
  const iv = setInterval(() => {
    p += rand(15, 30);
    loadBar.style.width = Math.min(100, p) + '%';
    if (p >= 100) {
      clearInterval(iv);
      loadingBox.style.transition = 'opacity .5s';
      loadingBox.style.opacity = '0';
      setTimeout(() => loadingBox.style.display = 'none', 520);
      // 停在主菜单，点击「开始取经」才初始化游戏
      requestAnimationFrame(loop);
    }
  }, 90);
}
boot();

})();
