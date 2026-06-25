/**
 * ui.js
 * ─────
 * Manages UI state, screen transitions, HUD updates,
 * and DOM interactions for Road Fighter.
 */

const UI = (() => {
  // ── DOM refs ────────────────────────────
  const screens = {
    home: document.getElementById("screen-home"),
    game: document.getElementById("screen-game"),
    gameover: document.getElementById("screen-gameover"),
  };

  const hud = {
    score: document.getElementById("hud-score"),
    highscore: document.getElementById("hud-highscore"),
    lives: document.getElementById("hud-lives"),
    fuel: document.getElementById("fuel-bar"),
    coins: document.getElementById("hud-coins"),
  };

  const home = {
    highScore: document.getElementById("home-high-score"),
    soundBtn: document.getElementById("btn-sound"),
    soundIcon: document.getElementById("sound-icon"),
  };

  const gameover = {
    score: document.getElementById("go-score"),
    high: document.getElementById("go-high"),
    coins: document.getElementById("go-coins"),
    badge: document.getElementById("new-record-badge"),
  };

  const pauseOverlay = document.getElementById("overlay-pause");
  const modalHow = document.getElementById("modal-how");

  // ── Screen transitions ──────────────────
  function showHome() {
    hideAllScreens();
    screens.home.classList.remove("hidden");
    screens.home.classList.add("active");
    // Update home high score
    const high = Game.loadHighScore();
    updateHomeHighScore(high);
    // Ensure game screen is reset
    document.getElementById("overlay-pause").classList.add("hidden");
  }

  function showGame() {
    hideAllScreens();
    screens.game.classList.remove("hidden");
    screens.game.classList.add("active");
    // Reset pause overlay
    pauseOverlay.classList.add("hidden");
  }

  function showGameOver(data) {
    hideAllScreens();
    screens.gameover.classList.remove("hidden");
    screens.gameover.classList.add("active");

    // Update stats
    gameover.score.textContent = data.score;
    gameover.high.textContent = data.highScore;
    gameover.coins.textContent = "🪙 " + data.coins;

    // Show/hide new record badge
    if (data.isRecord) {
      gameover.badge.classList.remove("hidden");
      // Trigger celebration effect
      spawnConfetti();
    } else {
      gameover.badge.classList.add("hidden");
    }
  }

  function hideAllScreens() {
    Object.values(screens).forEach((screen) => {
      screen.classList.remove("active");
      screen.classList.add("hidden");
    });
  }

  // ── HUD updates ─────────────────────────
  function updateScore(score, highScore) {
    hud.score.textContent = score;
    hud.highscore.textContent = highScore;
  }

  function updateLives(lives) {
    const hearts =
      "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives));
    hud.lives.textContent = hearts;
  }

  function updateFuel(fuelPercent) {
    const bar = hud.fuel;
    const clamped = Math.max(0, Math.min(100, fuelPercent));
    bar.style.width = clamped + "%";

    // Critical fuel warning
    if (clamped < 25) {
      bar.classList.add("critical");
    } else {
      bar.classList.remove("critical");
    }
  }

  function updateCoins(coinCount) {
    hud.coins.textContent = "🪙 " + coinCount;
  }

  function updateHomeHighScore(highScore) {
    home.highScore.textContent = highScore || "0";
  }

  function updateSoundIcon(muted) {
    const icon = home.soundIcon;
    icon.textContent = muted ? "🔇" : "🔊";
    // Also update the game sound button if it exists
    const gameSoundBtn = document.getElementById("btn-sound-game");
    if (gameSoundBtn) {
      gameSoundBtn.textContent = muted ? "🔇" : "🔊";
    }
  }

  // ── Modal controls ──────────────────────
  function showHowTo() {
    modalHow.classList.remove("hidden");
    modalHow.style.opacity = "1";
  }

  function hideHowTo() {
    modalHow.classList.add("hidden");
    modalHow.style.opacity = "0";
  }

  // ── Confetti effect for new record ──────
  function spawnConfetti() {
    const container = document.getElementById("go-particles");
    const colors = [
      "#ffd93d",
      "#ff6b1a",
      "#ff3860",
      "#00e6ff",
      "#39d37a",
      "#a855f7",
    ];

    for (let i = 0; i < 80; i++) {
      const el = document.createElement("div");
      const size = 6 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      const x = window.innerWidth / 2;
      const y = window.innerHeight / 2;

      el.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size * 0.6}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: 2px;
        transform: rotate(${Math.random() * 360}deg);
        pointer-events: none;
        z-index: 100;
        opacity: 1;
        transition: none;
      `;

      container.appendChild(el);

      // Animate with requestAnimationFrame
      let startTime = Date.now();
      const duration = 1500 + Math.random() * 1000;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed - 1;

      function animateConfetti() {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1) {
          el.remove();
          return;
        }

        const currentX = x + dx * progress * 200;
        const currentY = y + dy * progress * 200 + 100 * progress * progress;
        const opacity = 1 - progress;

        el.style.left = currentX + "px";
        el.style.top = currentY + "px";
        el.style.opacity = opacity;
        el.style.transform = `rotate(${360 * progress}deg) scale(${1 - progress * 0.5})`;

        requestAnimationFrame(animateConfetti);
      }

      setTimeout(animateConfetti, i * 15);
    }

    // Clean up after animation
    setTimeout(() => {
      container.innerHTML = "";
    }, 4000);
  }

  // ── Init ────────────────────────────────
  function init() {
    // Set initial sound icon
    updateSoundIcon(AudioManager.isMuted());
    // Show home screen by default
    showHome();
  }

  // Public API
  return {
    init,
    showHome,
    showGame,
    showGameOver,
    updateScore,
    updateLives,
    updateFuel,
    updateCoins,
    updateHomeHighScore,
    updateSoundIcon,
    showHowTo,
    hideHowTo,
  };
})();
