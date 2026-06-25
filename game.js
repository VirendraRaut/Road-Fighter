/**
 * game.js
 * ───────
 * Road Fighter — Core Canvas Game Engine
 *
 * Responsibilities:
 *  - Canvas setup & resize handling
 *  - Game loop (requestAnimationFrame)
 *  - Player car entity
 *  - Road scrolling (infinite)
 *  - Enemy cars
 *  - Coins & fuel pickups
 *  - Collision detection (AABB)
 *  - Lives / fuel / score systems
 *  - Speed progression
 *  - Particle system
 *  - Visual effects (shake, flash, score popups)
 *  - Pause / resume
 */

const Game = (() => {
  // ── Canvas refs ─────────────────────────
  let canvas, ctx;
  let W, H; // Viewport dimensions (updated on resize)
  let roadW, roadX; // Road play area

  // ── Game loop state ─────────────────────
  let rafId = null;
  let lastTime = 0;
  let running = false;
  let paused = false;
  let gameOverFlag = false;

  // ── Score / stats ───────────────────────
  let score = 0;
  let highScore = 0;
  let coins = 0;
  let fuel = 100; // 0–100
  let lives = 3;
  let speedMult = 1; // Difficulty multiplier
  let frameCount = 0;

  // ── Road scroll ─────────────────────────
  let roadY = 0;
  let roadSpeed = 4; // base px/frame (pre-delta-scaled)

  // ── Player ──────────────────────────────
  const PLAYER_W = 40;
  const PLAYER_H = 72;
  let playerX, playerY;
  let playerVX = 0; // current horizontal velocity
  let playerLane = 1; // 0 left, 1 mid, 2 right
  const LANE_COUNT = 4;

  // ── Input state ─────────────────────────
  const keys = { left: false, right: false };

  // ── Entity arrays ────────────────────────
  let enemies = [];
  let pickups = []; // { type:'coin'|'fuel', x, y, w, h, collected, anim }
  let particles = [];
  let popups = []; // { text, x, y, life, maxLife, color }

  // ── Timers ──────────────────────────────
  let enemySpawnTimer = 0;
  let fuelSpawnTimer = 0;
  let coinSpawnTimer = 0;
  let difficultyTimer = 0;

  // ── Visual effects ───────────────────────
  let shakeFrames = 0;
  let flashAlpha = 0; // white flash on crash
  let invincFrames = 0; // brief invincibility post-crash

  // ── Constants ───────────────────────────
  const FUEL_DRAIN_RATE = 0.012; // per frame
  const PLAYER_SPEED = 5.5;
  const PLAYER_SMOOTH = 0.22;
  const ENEMY_W = 40;
  const ENEMY_H = 70;
  const COIN_R = 12;
  const FUEL_W = 24;
  const FUEL_H = 36;

  // ── Callbacks to UI ─────────────────────
  let _onScoreUpdate = null;
  let _onLivesUpdate = null;
  let _onFuelUpdate = null;
  let _onCoinsUpdate = null;
  let _onGameOver = null;

  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════
  function init(callbacks) {
    _onScoreUpdate = callbacks.onScore;
    _onLivesUpdate = callbacks.onLives;
    _onFuelUpdate = callbacks.onFuel;
    _onCoinsUpdate = callbacks.onCoins;
    _onGameOver = callbacks.onGameOver;

    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");

    // Load saved high score
    highScore = parseInt(localStorage.getItem("rf_highscore") || "0", 10);

    bindInput();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  // ════════════════════════════════════════
  // CANVAS RESIZE
  // ════════════════════════════════════════
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    W = canvas.width = rect.width || window.innerWidth;
    H = canvas.height = rect.height || window.innerHeight - 56;

    // Road occupies a centred column — narrower on wide screens
    roadW = Math.min(W, Math.round(H * 0.55));
    roadW = Math.max(roadW, 220);
    roadX = Math.round((W - roadW) / 2);

    // Reposition player if game is running
    if (running) snapPlayerToLane(playerLane);
  }

  // ════════════════════════════════════════
  // START / RESET
  // ════════════════════════════════════════
  function start() {
    // Reset all state
    score = 0;
    coins = 0;
    fuel = 100;
    lives = 3;
    speedMult = 1;
    roadY = 0;
    roadSpeed = 4;
    frameCount = 0;
    shakeFrames = 0;
    flashAlpha = 0;
    invincFrames = 0;
    enemies = [];
    pickups = [];
    particles = [];
    popups = [];
    enemySpawnTimer = 0;
    fuelSpawnTimer = 0;
    coinSpawnTimer = 0;
    difficultyTimer = 0;
    paused = false;
    gameOverFlag = false;

    playerLane = Math.floor(LANE_COUNT / 2) - 1;
    snapPlayerToLane(playerLane);
    playerY = H - PLAYER_H - 30;
    playerVX = 0;

    updateHUD();
    running = true;

    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ════════════════════════════════════════
  // PAUSE
  // ════════════════════════════════════════
  function pause() {
    if (!running || gameOverFlag) return;
    paused = !paused;
    if (paused) {
      AudioManager.stopBg();
    } else {
      AudioManager.playBg("race");
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
    return paused;
  }

  function setPaused(val) {
    if (paused === val) return;
    paused = val;
    if (!paused) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  // ════════════════════════════════════════
  // MAIN LOOP
  // ════════════════════════════════════════
  function loop(timestamp) {
    if (!running || paused) return;

    const rawDt = Math.min((timestamp - lastTime) / 16.67, 3); // cap at 3 frames behind
    lastTime = timestamp;
    frameCount++;

    update(rawDt);
    render();

    rafId = requestAnimationFrame(loop);
  }

  // ════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════
  function update(dt) {
    // ── Difficulty ramp ──────────────────
    difficultyTimer += dt;
    if (difficultyTimer > 300) {
      // every ~5 seconds at 60fps
      difficultyTimer = 0;
      const milestone = Math.floor(score / 300);
      speedMult = 1 + milestone * 0.18;
      roadSpeed = 4 + milestone * 1.2;
    }

    const effSpeed = roadSpeed * speedMult * dt;

    // ── Road scroll ──────────────────────
    roadY = (roadY + effSpeed) % H;

    // ── Score ────────────────────────────
    score += dt * speedMult;
    if (score > highScore) highScore = Math.floor(score);

    // ── Fuel drain ───────────────────────
    fuel -= FUEL_DRAIN_RATE * dt * speedMult;
    fuel = Math.max(0, fuel);

    if (fuel <= 0) {
      triggerGameOver("EMPTY TANK");
      return;
    }

    // ── Player movement ───────────────────
    updatePlayer(dt);

    // ── Spawn entities ────────────────────
    spawnEnemies(dt);
    spawnPickups(dt);

    // ── Move enemies ──────────────────────
    enemies.forEach((e) => {
      e.y += e.speed * speedMult * dt;
    });
    enemies = enemies.filter((e) => e.y < H + 100);

    // ── Move pickups ──────────────────────
    pickups.forEach((p) => {
      if (!p.collected) p.y += effSpeed * 0.7;
      // Coin rotation animation
      if (p.type === "coin") p.anim = (p.anim + 3 * dt) % 360;
    });
    pickups = pickups.filter(
      (p) => p.y < H + 50 && !(p.collected && p.animDone),
    );

    // ── Collision detection ───────────────
    if (invincFrames > 0) {
      invincFrames -= dt;
    } else {
      checkCollisions();
    }

    // ── Particles ────────────────────────
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.2 * dt; // gravity
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    });
    particles = particles.filter((p) => p.life > 0);

    // ── Popups ───────────────────────────
    popups.forEach((p) => {
      p.y -= 1.2 * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    });
    popups = popups.filter((p) => p.life > 0);

    // ── Visual effects ────────────────────
    if (shakeFrames > 0) shakeFrames -= dt;
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.04 * dt);

    // ── Update HUD ────────────────────────
    updateHUD();
  }

  // ── Player movement ────────────────────
  function updatePlayer(dt) {
    let targetVX = 0;
    if (keys.left) targetVX = -PLAYER_SPEED;
    if (keys.right) targetVX = PLAYER_SPEED;

    // Smooth acceleration
    playerVX += (targetVX - playerVX) * PLAYER_SMOOTH * dt * 3;

    playerX += playerVX * dt;

    // Road boundary clamp (with margin for the car width)
    const margin = 8;
    const minX = roadX + margin;
    const maxX = roadX + roadW - PLAYER_W - margin;
    playerX = Math.max(minX, Math.min(maxX, playerX));
  }

  function laneX(lane) {
    const laneW = roadW / LANE_COUNT;
    return roadX + laneW * lane + (laneW - PLAYER_W) / 2;
  }

  function snapPlayerToLane(lane) {
    playerX = laneX(lane);
  }

  // ── Spawn enemies ───────────────────────
  function spawnEnemies(dt) {
    const interval = Math.max(40, 90 - speedMult * 12); // faster spawn over time
    enemySpawnTimer += dt;
    if (enemySpawnTimer < interval) return;
    enemySpawnTimer = 0;

    const lane = Math.floor(Math.random() * LANE_COUNT);
    const laneW = roadW / LANE_COUNT;
    const ex = roadX + laneW * lane + (laneW - ENEMY_W) / 2;
    const baseSpeed = 2.5 + Math.random() * 2;

    enemies.push({
      x: ex,
      y: -ENEMY_H - 10,
      w: ENEMY_W,
      h: ENEMY_H,
      speed: baseSpeed,
      lane,
      // Slight color tint variation per enemy
      hue: Math.floor(Math.random() * 40 - 20), // -20 to +20 degrees
    });
  }

  // ── Spawn pickups (coins & fuel) ────────
  function spawnPickups(dt) {
    // Coins
    coinSpawnTimer += dt;
    if (coinSpawnTimer > 120) {
      coinSpawnTimer = 0;
      if (Math.random() < 0.65) {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const laneW = roadW / LANE_COUNT;
        pickups.push({
          type: "coin",
          x: roadX + laneW * lane + laneW / 2 - COIN_R,
          y: -COIN_R * 2,
          w: COIN_R * 2,
          h: COIN_R * 2,
          anim: 0,
          collected: false,
          animDone: false,
        });
      }
    }

    // Fuel canisters
    fuelSpawnTimer += dt;
    const fuelInterval = fuel < 40 ? 80 : 200; // spawn faster when low
    if (fuelSpawnTimer > fuelInterval) {
      fuelSpawnTimer = 0;
      if (Math.random() < (fuel < 35 ? 0.8 : 0.35)) {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const laneW = roadW / LANE_COUNT;
        pickups.push({
          type: "fuel",
          x: roadX + laneW * lane + (laneW - FUEL_W) / 2,
          y: -FUEL_H - 10,
          w: FUEL_W,
          h: FUEL_H,
          anim: 0,
          collected: false,
          animDone: false,
        });
      }
    }
  }

  // ── Collision detection (AABB) ──────────
  function checkCollisions() {
    const px = playerX + 4;
    const py = playerY + 8;
    const pw = PLAYER_W - 8;
    const ph = PLAYER_H - 8;

    // Vs enemies
    for (const e of enemies) {
      if (aabbOverlap(px, py, pw, ph, e.x + 4, e.y + 4, e.w - 8, e.h - 8)) {
        onCrash(e);
        return;
      }
    }

    // Vs pickups
    for (const p of pickups) {
      if (!p.collected && aabbOverlap(px, py, pw, ph, p.x, p.y, p.w, p.h)) {
        collectPickup(p);
      }
    }
  }

  function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ── Crash handler ───────────────────────
  function onCrash(enemy) {
    lives--;
    invincFrames = 120; // ~2 seconds invincibility
    shakeFrames = 25;
    flashAlpha = 0.75;

    // Scatter crash particles at impact point
    spawnCrashParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);

    // Remove the hit enemy
    enemies = enemies.filter((e) => e !== enemy);

    AudioManager.playSfx("crash");

    // Trigger shake via class on the game screen
    const gs = document.getElementById("screen-game");
    gs.classList.remove("screen-shake");
    void gs.offsetWidth; // force reflow
    gs.classList.add("screen-shake");
    setTimeout(() => gs.classList.remove("screen-shake"), 500);

    if (lives <= 0) {
      triggerGameOver("CRASH");
    } else {
      addPopup("CRASH!", playerX + PLAYER_W / 2, playerY, "#ff3860");
    }
  }

  // ── Pickup collector ────────────────────
  function collectPickup(pickup) {
    pickup.collected = true;
    setTimeout(() => {
      pickup.animDone = true;
    }, 400);

    if (pickup.type === "coin") {
      coins++;
      score += 50;
      AudioManager.playSfx("coin");
      addPopup("+50", pickup.x + COIN_R, pickup.y, "#ffd93d");
      spawnCoinParticles(pickup.x + COIN_R, pickup.y + COIN_R);
    } else if (pickup.type === "fuel") {
      fuel = Math.min(100, fuel + 35);
      addPopup("⛽ +FUEL", pickup.x + FUEL_W / 2, pickup.y, "#39d37a");
    }
  }

  // ── Game Over ───────────────────────────
  function triggerGameOver(reason) {
    if (gameOverFlag) return;
    gameOverFlag = true;
    running = false;

    // Save high score
    localStorage.setItem("rf_highscore", Math.floor(highScore));

    AudioManager.stopBg();
    AudioManager.playSfx("gameover");

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Notify UI after brief delay for drama
    setTimeout(() => {
      if (_onGameOver)
        _onGameOver({
          score: Math.floor(score),
          highScore: Math.floor(highScore),
          coins,
          reason,
          isRecord:
            Math.floor(score) >= Math.floor(highScore) && Math.floor(score) > 0,
        });
    }, 700);
  }

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════
  function render() {
    ctx.clearRect(0, 0, W, H);

    // Off-road areas (dark grass / kerb)
    ctx.fillStyle = "#0e1218";
    ctx.fillRect(0, 0, W, H);

    // ── Road ──────────────────────────────
    drawRoad();

    // ── Pickup items ──────────────────────
    pickups.forEach(drawPickup);

    // ── Enemy cars ────────────────────────
    enemies.forEach(drawEnemy);

    // ── Player car ────────────────────────
    drawPlayer();

    // ── Particles ─────────────────────────
    drawParticles();

    // ── Score popups ──────────────────────
    drawPopups();

    // ── Speed lines (sides) ───────────────
    drawSpeedLines();

    // ── Flash effect ──────────────────────
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 80, 80, ${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Road rendering ─────────────────────
  function drawRoad() {
    const img = Assets.get("road");

    if (img) {
      // Tile road.png vertically in a scrolling loop
      const imgH = img.height || H;
      const scale = roadW / (img.width || roadW);
      const tileH = imgH * scale;

      let y = (roadY % tileH) - tileH;
      while (y < H) {
        if (img.tagName === "CANVAS") {
          ctx.drawImage(img, roadX, y, roadW, tileH);
        } else {
          ctx.drawImage(img, roadX, y, roadW, tileH);
        }
        y += tileH;
      }
    } else {
      drawFallbackRoad();
    }

    // Road edge gradient overlays for depth
    const leftGrad = ctx.createLinearGradient(roadX, 0, roadX + 20, 0);
    leftGrad.addColorStop(0, "rgba(0,0,0,0.5)");
    leftGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = leftGrad;
    ctx.fillRect(roadX, 0, 20, H);

    const rightGrad = ctx.createLinearGradient(
      roadX + roadW - 20,
      0,
      roadX + roadW,
      0,
    );
    rightGrad.addColorStop(0, "rgba(0,0,0,0)");
    rightGrad.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = rightGrad;
    ctx.fillRect(roadX + roadW - 20, 0, 20, H);
  }

  function drawFallbackRoad() {
    // Asphalt
    ctx.fillStyle = "#1e2228";
    ctx.fillRect(roadX, 0, roadW, H);

    // White edge lines
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(roadX, 0, 5, H);
    ctx.fillRect(roadX + roadW - 5, 0, 5, H);

    // Lane dividers (dashed)
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 3;
    ctx.setLineDash([28, 28]);
    ctx.lineDashOffset = -roadY;
    for (let i = 1; i < LANE_COUNT; i++) {
      const lx = roadX + (roadW / LANE_COUNT) * i;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // ── Enemy car rendering ─────────────────
  function drawEnemy(e) {
    const img = Assets.get("enemyCar");
    if (img) {
      ctx.save();
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      // Rotate 180° because enemy car image faces "down" (toward player)
      ctx.rotate(Math.PI);
      ctx.drawImage(img, -e.w / 2, -e.h / 2, e.w, e.h);
      ctx.restore();
    } else {
      drawFallbackCar(e.x, e.y, e.w, e.h, "#ff3333");
    }
  }

  // ── Player car rendering ────────────────
  function drawPlayer() {
    const img = Assets.get("playerCar");

    // Blink during invincibility
    if (invincFrames > 0 && Math.floor(invincFrames / 5) % 2 === 0) return;

    ctx.save();
    if (img) {
      ctx.drawImage(img, playerX, playerY, PLAYER_W, PLAYER_H);
    } else {
      drawFallbackCar(playerX, playerY, PLAYER_W, PLAYER_H, "#00aaff");
    }

    // Speed-based tilt on horizontal movement
    if (Math.abs(playerVX) > 1) {
      const tilt = (playerVX / PLAYER_SPEED) * 0.06;
      ctx.globalAlpha = 0.18;
      ctx.translate(playerX + PLAYER_W / 2, playerY + PLAYER_H);
      ctx.rotate(tilt);
      ctx.drawImage(
        img || createPlayerPlaceholder(),
        -PLAYER_W / 2,
        -PLAYER_H,
        PLAYER_W,
        PLAYER_H,
      );
    }
    ctx.restore();

    // Shadow beneath car
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(
      playerX + PLAYER_W / 2,
      playerY + PLAYER_H + 3,
      PLAYER_W * 0.45,
      6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  function drawFallbackCar(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + 2, y + 4, w - 4, h - 8, 5);
    else ctx.rect(x + 2, y + 4, w - 4, h - 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + 5, y + 10, w - 10, 16);

    ctx.fillStyle = "#111";
    [
      [x, y + 8],
      [x + w - 7, y + 8],
      [x, y + h - 20],
      [x + w - 7, y + h - 20],
    ].forEach(([bx, by]) => {
      ctx.fillRect(bx, by, 7, 12);
    });
  }

  // ── Pickup rendering ────────────────────
  function drawPickup(p) {
    if (p.collected) {
      // Collect burst animation — scale up and fade
      ctx.save();
      const t = p.anim / 30; // 0–1
      ctx.globalAlpha = Math.max(0, 1 - t * 2.5);
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.scale(1 + t * 1.5, 1 + t * 1.5);
      ctx.translate(-p.w / 2, -p.h / 2);
      p.anim++;
      drawPickupShape(p, 0, 0);
      ctx.restore();
      return;
    }

    drawPickupShape(p, p.x, p.y);
  }

  function drawPickupShape(p, x, y) {
    if (p.type === "coin") {
      const cx = x + COIN_R;
      const cy = y + COIN_R;
      const squeeze = Math.abs(Math.cos((p.anim * Math.PI) / 180)) * 0.8 + 0.2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(squeeze, 1);

      // Coin body
      ctx.fillStyle = "#ffd93d";
      ctx.beginPath();
      ctx.arc(0, 0, COIN_R, 0, Math.PI * 2);
      ctx.fill();

      // Inner ring
      ctx.strokeStyle = "#ffb800";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, COIN_R - 3, 0, Math.PI * 2);
      ctx.stroke();

      // $ symbol
      ctx.fillStyle = "#b8860b";
      ctx.font = `bold ${COIN_R}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 0);

      // Shine
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(-3, -4, 3, 2, -0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Glow
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#ffd93d";
      ctx.beginPath();
      ctx.arc(cx, cy, COIN_R + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.type === "fuel") {
      const fx = x,
        fy = y;
      // Canister body
      ctx.fillStyle = "#39d37a";
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(fx, fy + 8, FUEL_W, FUEL_H - 8, 4);
        ctx.fill();
      } else {
        ctx.fillRect(fx, fy + 8, FUEL_W, FUEL_H - 8);
      }
      // Cap
      ctx.fillStyle = "#2aaa62";
      ctx.fillRect(fx + 6, fy + 4, FUEL_W - 12, 8);
      // Spout
      ctx.fillStyle = "#1a7a44";
      ctx.fillRect(fx + FUEL_W - 6, fy, 6, 10);
      // Label
      ctx.fillStyle = "#fff";
      ctx.font = `bold 10px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⛽", fx + FUEL_W / 2, fy + FUEL_H / 2 + 6);
      // Glow
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#39d37a";
      ctx.beginPath();
      ctx.arc(fx + FUEL_W / 2, fy + FUEL_H / 2 + 6, FUEL_W, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Particles ───────────────────────────
  function spawnCrashParticles(cx, cy) {
    const colors = ["#ff3860", "#ff6b1a", "#ffd93d", "#ffffff"];
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 25 + Math.random() * 25,
        maxLife: 50,
        alpha: 1,
      });
    }
  }

  function spawnCoinParticles(cx, cy) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2 + Math.random() * 3,
        color: "#ffd93d",
        life: 20 + Math.random() * 15,
        maxLife: 35,
        alpha: 1,
      });
    }
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── Score popups ─────────────────────────
  function addPopup(text, x, y, color = "#ffffff") {
    popups.push({ text, x, y, color, life: 50, maxLife: 50, alpha: 1 });
  }

  function drawPopups() {
    popups.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font = "bold 16px monospace";
      ctx.fillStyle = p.color;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });
  }

  // ── Speed lines (roadside atmosphere) ───
  function drawSpeedLines() {
    if (speedMult < 1.2) return;
    const intensity = Math.min(1, (speedMult - 1.2) / 2);
    const lineCount = Math.floor(6 * intensity);
    const sideW = (W - roadW) / 2;
    if (sideW < 10) return;

    ctx.save();
    ctx.globalAlpha = 0.25 * intensity;
    ctx.strokeStyle = "#00e6ff";
    ctx.lineWidth = 1.5;

    for (let i = 0; i < lineCount; i++) {
      const lx = Math.random() * sideW;
      const ly = Math.random() * H;
      const len = 20 + Math.random() * 50;
      // Left side
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx, ly + len);
      ctx.stroke();
      // Right side
      const rx = roadX + roadW + Math.random() * sideW;
      ctx.beginPath();
      ctx.moveTo(rx, ly);
      ctx.lineTo(rx, ly + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ════════════════════════════════════════
  // HUD UPDATER
  // ════════════════════════════════════════
  function updateHUD() {
    if (_onScoreUpdate)
      _onScoreUpdate(Math.floor(score), Math.floor(highScore));
    if (_onLivesUpdate) _onLivesUpdate(lives);
    if (_onFuelUpdate) _onFuelUpdate(fuel);
    if (_onCoinsUpdate) _onCoinsUpdate(coins);
  }

  // ════════════════════════════════════════
  // INPUT BINDING
  // ════════════════════════════════════════
  function bindInput() {
    document.addEventListener("keydown", (e) => {
      if (!running) return;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          keys.left = true;
          e.preventDefault();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          keys.right = true;
          e.preventDefault();
          break;
        case "p":
        case "P":
          if (running) {
            const nowPaused = pause();
            document
              .getElementById("overlay-pause")
              .classList.toggle("hidden", !nowPaused);
          }
          break;
      }
    });

    document.addEventListener("keyup", (e) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          keys.left = false;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          keys.right = false;
          break;
      }
    });
  }

  // Mobile button press/release
  function setKey(dir, pressed) {
    if (dir === "left") keys.left = pressed;
    if (dir === "right") keys.right = pressed;
  }

  // ── Getters for UI ──────────────────────
  function getScore() {
    return Math.floor(score);
  }
  function getHighScore() {
    return Math.floor(highScore);
  }
  function getCoins() {
    return coins;
  }
  function loadHighScore() {
    highScore = parseInt(localStorage.getItem("rf_highscore") || "0", 10);
    return highScore;
  }

  // Public API
  return {
    init,
    start,
    stop,
    pause,
    setPaused,
    setKey,
    resizeCanvas,
    getScore,
    getHighScore,
    getCoins,
    loadHighScore,
  };
})();
// ── Polyfill roundRect for older browsers ──
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    const r = typeof radii === "number" ? radii : radii || 0;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    return this;
  };
}
