
(() => {
"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const $ = id => document.getElementById(id);
const scoreUI = $("score");
const waveUI = $("wave");
const comboUI = $("combo");
const healthBar = $("healthBar");
const overlay = $("overlay");
const message = $("message");
const startButton = $("start");
const pauseButton = $("pause");

let W = 0, H = 0, dpr = 1;
let running = false, paused = false, gameOver = false;
let lastTime = 0, elapsed = 0, spawnTimer = 0;
let score = 0, wave = 1, combo = 1, comboTimer = 0;
let shake = 0, flash = 0;

const keys = {};
const pointers = new Map();

const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  angle: -Math.PI / 2,
  speed: 310,
  health: 100,
  invulnerable: 0,
  fireTimer: 0
};

let bullets = [];
let enemies = [];
let particles = [];
let stars = [];

const rand = (a,b) => a + Math.random() * (b-a);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const dist2 = (a,b) => (a.x-b.x)**2 + (a.y-b.y)**2;

function resize() {
  const rect = canvas.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W*dpr);
  canvas.height = Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if (!running && !gameOver) {
    player.x = W/2;
    player.y = H/2;
  }
  makeStars();
}

function makeStars() {
  stars = Array.from({length: Math.max(70, Math.floor(W*H/6500))}, () => ({
    x: Math.random()*W,
    y: Math.random()*H,
    size: rand(.4,1.7),
    alpha: rand(.2,.85),
    speed: rand(5,24),
    phase: rand(0,Math.PI*2)
  }));
}

window.addEventListener("resize", resize);
resize();

function resetGame() {
  score = 0;
  wave = 1;
  combo = 1;
  comboTimer = 0;
  elapsed = 0;
  spawnTimer = 0.6;
  bullets = [];
  enemies = [];
  particles = [];
  shake = 0;
  flash = 0;

  player.x = W/2;
  player.y = H/2;
  player.vx = 0;
  player.vy = 0;
  player.angle = -Math.PI/2;
  player.health = 100;
  player.invulnerable = 1.5;
  player.fireTimer = 0;

  updateHUD();
}

function updateHUD() {
  scoreUI.textContent = String(score).padStart(6,"0");
  waveUI.textContent = String(wave).padStart(2,"0");
  comboUI.textContent = "×" + combo;
  healthBar.style.width = player.health + "%";
}

function startGame() {
  resetGame();
  running = true;
  paused = false;
  gameOver = false;
  overlay.classList.add("hidden");
  pauseButton.textContent = "Ⅱ 暂停";
}

function endGame() {
  running = false;
  paused = false;
  gameOver = true;
  message.innerHTML = "任务结束<br>最终得分：" + score + "<br>抵达波次：" + wave;
  startButton.textContent = "再次挑战";
  overlay.classList.remove("hidden");
  pauseButton.textContent = "Ⅱ 暂停";
}

function togglePause() {
  if (gameOver || !running) return;
  paused = !paused;
  if (paused) {
    message.innerHTML = "系统已暂停<br>准备好后继续任务。";
    startButton.textContent = "继续任务";
    overlay.classList.remove("hidden");
    pauseButton.textContent = "▶ 继续";
  } else {
    overlay.classList.add("hidden");
    pauseButton.textContent = "Ⅱ 暂停";
    lastTime = performance.now();
  }
}

startButton.addEventListener("click", () => {
  if (paused && !gameOver) {
    paused = false;
    overlay.classList.add("hidden");
    pauseButton.textContent = "Ⅱ 暂停";
    lastTime = performance.now();
  } else {
    startGame();
  }
});

pauseButton.addEventListener("click", togglePause);

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if ([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key === "Escape") togglePause();
});
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

let mouse = {x:0,y:0,down:false};

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return {x:e.clientX-r.left, y:e.clientY-r.top};
}

canvas.addEventListener("pointerdown", e => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = pointerPos(e);

  if (e.pointerType === "touch") {
    if (p.x < W*0.48) {
      pointers.set(e.pointerId, {
        type:"move", startX:p.x, startY:p.y, x:p.x, y:p.y
      });
    } else {
      pointers.set(e.pointerId, {type:"aim", x:p.x, y:p.y});
    }
  } else {
    mouse = {...p, down:true};
  }
});

canvas.addEventListener("pointermove", e => {
  const p = pointerPos(e);
  if (e.pointerType === "touch") {
    const item = pointers.get(e.pointerId);
    if (item) {
      item.x = p.x;
      item.y = p.y;
    }
  } else {
    mouse.x = p.x;
    mouse.y = p.y;
  }
});

function releasePointer(e) {
  pointers.delete(e.pointerId);
  if (e.pointerType !== "touch") mouse.down = false;
}
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);
canvas.addEventListener("contextmenu", e => e.preventDefault());

function getMoveInput() {
  let x = 0, y = 0;
  if (keys.w || keys.arrowup) y -= 1;
  if (keys.s || keys.arrowdown) y += 1;
  if (keys.a || keys.arrowleft) x -= 1;
  if (keys.d || keys.arrowright) x += 1;

  for (const p of pointers.values()) {
    if (p.type === "move") {
      x += clamp((p.x-p.startX)/55,-1,1);
      y += clamp((p.y-p.startY)/55,-1,1);
    }
  }
  const len = Math.hypot(x,y);
  if (len > 1) { x/=len; y/=len; }
  return {x,y};
}

function getAim() {
  let target = null;
  for (const p of pointers.values()) {
    if (p.type === "aim") target = p;
  }
  if (target) return target;
  return mouse;
}

function isFiring() {
  if (mouse.down) return true;
  for (const p of pointers.values()) {
    if (p.type === "aim") return true;
  }
  return false;
}

function spawnEnemy() {
  const side = Math.floor(Math.random()*4);
  let x, y;
  if (side===0) {x=rand(0,W);y=-35;}
  else if (side===1) {x=W+35;y=rand(0,H);}
  else if (side===2) {x=rand(0,W);y=H+35;}
  else {x=-35;y=rand(0,H);}

  const heavy = Math.random() < Math.min(.12 + wave*.018,.35);
  enemies.push({
    x,y,
    r: heavy ? 22 : rand(13,17),
    hp: heavy ? 3 : 1,
    maxHp: heavy ? 3 : 1,
    speed: (heavy ? 48 : rand(68,94)) + wave*4,
    angle: 0,
    phase: rand(0,8),
    heavy
  });
}

function shoot() {
  const a = player.angle;
  const dx = Math.cos(a), dy = Math.sin(a);
  bullets.push({
    x:player.x+dx*22,
    y:player.y+dy*22,
    vx:dx*690,
    vy:dy*690,
    life:1.15,
    r:4
  });
  player.fireTimer = .16;
  burst(player.x+dx*22, player.y+dy*22, "#8cecff", 3, 65);
}

function burst(x,y,color,count,power=130) {
  for (let i=0;i<count;i++) {
    const a = rand(0,Math.PI*2);
    const s = rand(power*.25,power);
    particles.push({
      x,y,
      vx:Math.cos(a)*s,
      vy:Math.sin(a)*s,
      life:rand(.22,.65),
      maxLife:.65,
      size:rand(1.5,4),
      color
    });
  }
}

function damagePlayer() {
  if (player.invulnerable > 0) return;
  player.health = Math.max(0,player.health-14);
  player.invulnerable = .75;
  shake = 10;
  flash = .25;
  burst(player.x,player.y,"#ff7eae",18,180);
  updateHUD();
  if (player.health <= 0) endGame();
}

function update(dt) {
  elapsed += dt;
  player.invulnerable = Math.max(0,player.invulnerable-dt);
  player.fireTimer = Math.max(0,player.fireTimer-dt);
  comboTimer = Math.max(0,comboTimer-dt);
  if (comboTimer === 0) combo = 1;

  const move = getMoveInput();
  player.vx = move.x*player.speed;
  player.vy = move.y*player.speed;
  player.x = clamp(player.x+player.vx*dt,24,W-24);
  player.y = clamp(player.y+player.vy*dt,24,H-24);

  const aim = getAim();
  if (aim.x || aim.y) {
    player.angle = Math.atan2(aim.y-player.y,aim.x-player.x);
  }

  if (isFiring() && player.fireTimer <= 0) shoot();

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(.34,1.1-wave*.055);
  }

  if (score >= wave*180) {
    wave++;
    updateHUD();
    burst(W/2,H/2,"#a997ff",45,230);
  }

  for (let i=bullets.length-1;i>=0;i--) {
    const b = bullets[i];
    b.x += b.vx*dt;
    b.y += b.vy*dt;
    b.life -= dt;
    if (b.life<=0 || b.x<-30 || b.x>W+30 || b.y<-30 || b.y>H+30) bullets.splice(i,1);
  }

  for (let i=enemies.length-1;i>=0;i--) {
    const e = enemies[i];
    e.phase += dt*2.5;
    const a = Math.atan2(player.y-e.y,player.x-e.x);
    e.angle = a;
    e.x += Math.cos(a)*e.speed*dt;
    e.y += Math.sin(a)*e.speed*dt;

    if (dist2(e,player) < (e.r+17)**2) {
      damagePlayer();
      e.x -= Math.cos(a)*32;
      e.y -= Math.sin(a)*32;
    }

    for (let j=bullets.length-1;j>=0;j--) {
      const b = bullets[j];
      if (dist2(e,b) < (e.r+b.r)**2) {
        e.hp--;
        bullets.splice(j,1);
        burst(b.x,b.y,"#82eaff",5,100);
        if (e.hp<=0) {
          burst(e.x,e.y,e.heavy?"#b69aff":"#55eaff",e.heavy?30:17,210);
          enemies.splice(i,1);
          score += e.heavy ? 35 : 15;
          combo = Math.min(combo+1,20);
          comboTimer = 2.1;
          score += combo*2;
          updateHUD();
        }
        break;
      }
    }
  }

  for (let i=particles.length-1;i>=0;i--) {
    const p = particles[i];
    p.x += p.vx*dt;
    p.y += p.vy*dt;
    p.vx *= Math.pow(.08,dt);
    p.vy *= Math.pow(.08,dt);
    p.life -= dt;
    if (p.life<=0) particles.splice(i,1);
  }

  for (const s of stars) {
    s.y += s.speed*dt;
    if (s.y>H+3) {s.y=-3;s.x=Math.random()*W;}
  }

  shake = Math.max(0,shake-dt*28);
  flash = Math.max(0,flash-dt);
}

function glowCircle(x,y,r,color,blur=20) {
  ctx.save();
  ctx.shadowBlur=blur;
  ctx.shadowColor=color;
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawBackground() {
  const bg = ctx.createRadialGradient(W*.5,H*.45,10,W*.5,H*.45,Math.max(W,H)*.75);
  bg.addColorStop(0,"#14213d");
  bg.addColorStop(.48,"#0a1228");
  bg.addColorStop(1,"#030611");
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,W,H);

  // Subtle star field
  for (const s of stars) {
    const twinkle=.55+.45*Math.sin(elapsed*2+s.phase);
    ctx.globalAlpha=s.alpha*twinkle;
    ctx.fillStyle="#bceaff";
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.size,0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;

  // Fine atmospheric rings
  ctx.save();
  ctx.translate(W/2,H/2);
  ctx.strokeStyle="rgba(94,157,220,.075)";
  ctx.lineWidth=1;
  for(let i=1;i<=5;i++){
    ctx.beginPath();
    ctx.arc(0,0,i*Math.min(W,H)*.105,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();

  // Soft ambient lights
  const glow=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,Math.min(W,H)*.55);
  glow.addColorStop(0,"rgba(42,104,180,.09)");
  glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow;
  ctx.fillRect(0,0,W,H);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x,player.y);
  ctx.rotate(player.angle);

  const flicker=player.invulnerable>0 && Math.floor(elapsed*16)%2===0;
  if (flicker) ctx.globalAlpha=.45;

  // Engine trail
  const flame=ctx.createLinearGradient(-36,0,-8,0);
  flame.addColorStop(0,"rgba(50,130,255,0)");
  flame.addColorStop(.55,"rgba(48,190,255,.45)");
  flame.addColorStop(1,"rgba(180,250,255,.9)");
  ctx.fillStyle=flame;
  ctx.beginPath();
  ctx.moveTo(-13,-6);
  ctx.quadraticCurveTo(-37,0,-13,6);
  ctx.closePath();
  ctx.fill();

  // Shield aura
  ctx.shadowBlur=24;
  ctx.shadowColor="#42bfff";
  ctx.strokeStyle="rgba(101,218,255,.55)";
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.arc(0,0,21,0,Math.PI*2);
  ctx.stroke();

  // Ship body
  const body=ctx.createLinearGradient(-15,-15,18,15);
  body.addColorStop(0,"#d8f7ff");
  body.addColorStop(.35,"#73cfff");
  body.addColorStop(1,"#5366b9");
  ctx.fillStyle=body;
  ctx.shadowBlur=20;
  ctx.shadowColor="#39baff";
  ctx.beginPath();
  ctx.moveTo(23,0);
  ctx.quadraticCurveTo(7,-9,-10,-15);
  ctx.lineTo(-7,-5);
  ctx.lineTo(-16,0);
  ctx.lineTo(-7,5);
  ctx.lineTo(-10,15);
  ctx.quadraticCurveTo(7,9,23,0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur=0;
  ctx.fillStyle="#f2ffff";
  ctx.beginPath();
  ctx.ellipse(3,0,8,4,0,0,Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x,e.y);
  ctx.rotate(e.angle+Math.PI/2);
  const pulse=1+Math.sin(e.phase)*.06;
  ctx.scale(pulse,pulse);

  const color=e.heavy?"#b28cff":"#ff76b9";
  ctx.shadowBlur=e.heavy?28:20;
  ctx.shadowColor=color;

  // Outer rotating ring
  ctx.strokeStyle=e.heavy?"rgba(177,139,255,.8)":"rgba(255,118,185,.72)";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.ellipse(0,0,e.r*1.2,e.r*.75,e.phase*.2,0,Math.PI*2);
  ctx.stroke();

  // Main shell
  const g=ctx.createRadialGradient(-5,-6,2,0,0,e.r*1.2);
  g.addColorStop(0,"#f9eaff");
  g.addColorStop(.25,color);
  g.addColorStop(1,"#34264e");
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(0,-e.r);
  ctx.lineTo(e.r*.85,-e.r*.3);
  ctx.lineTo(e.r*.72,e.r*.7);
  ctx.lineTo(0,e.r);
  ctx.lineTo(-e.r*.72,e.r*.7);
  ctx.lineTo(-e.r*.85,-e.r*.3);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur=0;
  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.arc(0,0,e.heavy?5:3.5,0,Math.PI*2);
  ctx.fill();

  if(e.heavy){
    ctx.strokeStyle="rgba(255,255,255,.7)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(0,0,e.r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*(e.hp/e.maxHp));
    ctx.stroke();
  }
  ctx.restore();
}

function drawBullets() {
  for(const b of bullets){
    const a=Math.atan2(b.vy,b.vx);
    ctx.save();
    ctx.translate(b.x,b.y);
    ctx.rotate(a);
    ctx.shadowBlur=20;
    ctx.shadowColor="#5beaff";
    const g=ctx.createLinearGradient(-16,0,8,0);
    g.addColorStop(0,"rgba(40,150,255,0)");
    g.addColorStop(1,"#e8ffff");
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.ellipse(0,0,13,3.2,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for(const p of particles){
    ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);
    ctx.shadowBlur=12;
    ctx.shadowColor=p.color;
    ctx.fillStyle=p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.shadowBlur=0;
}

function drawMobileJoystick() {
  for(const p of pointers.values()){
    if(p.type!=="move") continue;
    const dx=p.x-p.startX,dy=p.y-p.startY;
    const len=Math.hypot(dx,dy);
    const scale=len>42?42/len:1;
    ctx.save();
    ctx.globalAlpha=.35;
    ctx.strokeStyle="#8bdfff";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(p.startX,p.startY,43,0,Math.PI*2);
    ctx.stroke();
    ctx.fillStyle="#8bdfff";
    ctx.beginPath();
    ctx.arc(p.startX+dx*scale,p.startY+dy*scale,17,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function render() {
  ctx.save();
  if(shake>0) ctx.translate(rand(-shake,shake),rand(-shake,shake));

  drawBackground();
  drawBullets();
  for(const e of enemies) drawEnemy(e);
  drawPlayer();
  drawParticles();
  drawMobileJoystick();

  ctx.restore();

  if(flash>0){
    ctx.fillStyle=`rgba(255,100,150,${flash*.45})`;
    ctx.fillRect(0,0,W,H);
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  if(!lastTime) lastTime=now;
  const dt=Math.min((now-lastTime)/1000,.033);
  lastTime=now;

  if(running && !paused && !gameOver) update(dt);
  else {
    // Keep the star field gently moving behind the menu.
    if(!running && !gameOver){
      elapsed+=dt;
      for(const s of stars){
        s.y+=s.speed*dt*.25;
        if(s.y>H+3){s.y=-3;s.x=Math.random()*W;}
      }
    }
  }
  render();
}

requestAnimationFrame(loop);
})();
