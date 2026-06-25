/**
 * ui.js
 * ─────
 * Manages UI state, screen transitions, HUD updates,
 * and DOM interactions for Road Fighter.
 */

// Use var to avoid hoisting issues
var UI = (function () {
  "use strict";

  console.log("🎨 UI initializing...");

  // ── DOM refs ────────────────────────────
  var screens = {
    home: document.getElementById("screen-home"),
    game: document.getElementById("screen-game"),
    gameover: document.getElementById("screen-gameover"),
  };

  var hud = {
    score: document.getElementById("hud-score"),
    highscore: document.getElementById("hud-highscore"),
    lives: document.getElementById("hud-lives"),
    fuel: document.getElementById("fuel-bar"),
    coins: document.getElementById("hud-coins"),
  };

  var home = {
    highScore: document.getElementById("home-high-score"),
    soundBtn: document.getElementById("btn-sound"),
    soundIcon: document.getElementById("sound-icon"),
  };

  var gameover = {
    score: document.getElementById("go-score"),
    high: document.getElementById("go-high"),
    coins: document.getElementById("go-coins"),
    badge: document.getElementById("new-record-badge"),
  };

  var pauseOverlay = document.getElementById("overlay-pause");
  var modalHow = document.getElementById("modal-how");

  // ── Screen transitions ──────────────────
  function showHome() {
    console.log("🏠 Showing home screen");
    hideAllScreens();
    if (screens.home) {
      screens.home.classList.remove("hidden");
      screens.home.classList.add("active");
    }
    var high = 0;
    if (typeof Game !== "undefined" && Game.loadHighScore) {
      high = Game.loadHighScore();
    }
    updateHomeHighScore(high);
    if (pauseOverlay) {
      pauseOverlay.classList.add("hidden");
    }
  }

  function showGame() {
    console.log("🎮 Showing game screen");
    hideAllScreens();
    if (screens.game) {
      screens.game.classList.remove("hidden");
      screens.game.classList.add("active");
    }
    if (pauseOverlay) {
      pauseOverlay.classList.add("hidden");
    }
  }

  function showGameOver(data) {
    console.log("💀 Game Over:", data);
    hideAllScreens();
    if (screens.gameover) {
      screens.gameover.classList.remove("hidden");
      screens.gameover.classList.add("active");
    }

    if (gameover.score) gameover.score.textContent = data.score || 0;
    if (gameover.high) gameover.high.textContent = data.highScore || 0;
    if (gameover.coins) gameover.coins.textContent = "🪙 " + (data.coins || 0);

    if (data.isRecord && gameover.badge) {
      gameover.badge.classList.remove("hidden");
      spawnConfetti();
    } else if (gameover.badge) {
      gameover.badge.classList.add("hidden");
    }
  }

  function hideAllScreens() {
    Object.values(screens).forEach(function (screen) {
      if (screen) {
        screen.classList.remove("active");
        screen.classList.add("hidden");
      }
    });
  }

  // ── HUD updates ─────────────────────────
  function updateScore(score, highScore) {
    if (hud.score) hud.score.textContent = score || 0;
    if (hud.highscore) hud.highscore.textContent = highScore || 0;
  }

  function updateLives(lives) {
    if (!hud.lives) return;
    var hearts =
      "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives));
    hud.lives.textContent = hearts;
  }

  function updateFuel(fuelPercent) {
    if (!hud.fuel) return;
    var clamped = Math.max(0, Math.min(100, fuelPercent));
    hud.fuel.style.width = clamped + "%";
    if (clamped < 25) {
      hud.fuel.classList.add("critical");
    } else {
      hud.fuel.classList.remove("critical");
    }
  }

  function updateCoins(coinCount) {
    if (hud.coins) hud.coins.textContent = "🪙 " + (coinCount || 0);
  }

  function updateHomeHighScore(highScore) {
    if (home.highScore) home.highScore.textContent = highScore || "0";
  }

  function updateSoundIcon(muted) {
    var icon = home.soundIcon;
    if (icon) icon.textContent = muted ? "🔇" : "🔊";

    var gameSoundBtn = document.getElementById("btn-sound-game");
    if (gameSoundBtn) gameSoundBtn.textContent = muted ? "🔇" : "🔊";
  }

  // ── Modal controls ──────────────────────
  function showHowTo() {
    if (modalHow) {
      modalHow.classList.remove("hidden");
      modalHow.style.opacity = "1";
    }
  }

  function hideHowTo() {
    if (modalHow) {
      modalHow.classList.add("hidden");
      modalHow.style.opacity = "0";
    }
  }

  // ── Confetti effect ──────────────────────
  function spawnConfetti() {
    var container = document.getElementById("go-particles");
    if (!container) return;

    var colors = [
      "#ffd93d",
      "#ff6b1a",
      "#ff3860",
      "#00e6ff",
      "#39d37a",
      "#a855f7",
    ];

    for (var i = 0; i < 80; i++) {
      var el = document.createElement("div");
      var size = 6 + Math.random() * 8;
      var angle = Math.random() * Math.PI * 2;
      var speed = 3 + Math.random() * 6;
      var x = window.innerWidth / 2;
      var y = window.innerHeight / 2;

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

      var startTime = Date.now();
      var duration = 1500 + Math.random() * 1000;
      var dx = Math.cos(angle) * speed;
      var dy = Math.sin(angle) * speed - 1;

      (function (element, dx, dy, x, y, duration, startTime) {
        function animateConfetti() {
          var elapsed = Date.now() - startTime;
          var progress = elapsed / duration;

          if (progress >= 1) {
            element.remove();
            return;
          }

          var currentX = x + dx * progress * 200;
          var currentY = y + dy * progress * 200 + 100 * progress * progress;
          var opacity = 1 - progress;

          element.style.left = currentX + "px";
          element.style.top = currentY + "px";
          element.style.opacity = opacity;
          element.style.transform =
            "rotate(" +
            360 * progress +
            "deg) scale(" +
            (1 - progress * 0.5) +
            ")";

          requestAnimationFrame(animateConfetti);
        }
        setTimeout(animateConfetti, i * 15);
      })(el, dx, dy, x, y, duration, startTime);
    }

    setTimeout(function () {
      container.innerHTML = "";
    }, 4000);
  }

  // ── Init ────────────────────────────────
  function init() {
    console.log("🎨 UI initializing...");
    updateSoundIcon(false);
    showHome();
    console.log("✅ UI initialized");
  }

  // ── Public API ──────────────────────────
  return {
    init: init,
    showHome: showHome,
    showGame: showGame,
    showGameOver: showGameOver,
    updateScore: updateScore,
    updateLives: updateLives,
    updateFuel: updateFuel,
    updateCoins: updateCoins,
    updateHomeHighScore: updateHomeHighScore,
    updateSoundIcon: updateSoundIcon,
    showHowTo: showHowTo,
    hideHowTo: hideHowTo,
  };
})();
