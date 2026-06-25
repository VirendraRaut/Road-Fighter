/**
 * script.js
 * ─────────
 * Main entry point — initialises assets, audio, UI, and starts the game.
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Road Fighter starting...");

  // ── Check if all modules are loaded ──
  if (typeof AudioManager === "undefined") {
    console.error("❌ AudioManager not loaded!");
    alert("Error: AudioManager failed to load. Please refresh the page.");
    return;
  }
  if (typeof Assets === "undefined") {
    console.error("❌ Assets not loaded!");
    alert("Error: Assets failed to load. Please refresh the page.");
    return;
  }
  if (typeof UI === "undefined") {
    console.error("❌ UI not loaded!");
    alert("Error: UI failed to load. Please refresh the page.");
    return;
  }
  if (typeof Game === "undefined") {
    console.error("❌ Game not loaded!");
    alert("Error: Game failed to load. Please refresh the page.");
    return;
  }

  console.log("✅ All modules loaded");

  // ── Initialise modules ──────────────────
  try {
    AudioManager.init();
    console.log("✅ AudioManager initialised");
  } catch (e) {
    console.error("❌ AudioManager init failed:", e);
  }

  try {
    UI.init();
    console.log("✅ UI initialised");
  } catch (e) {
    console.error("❌ UI init failed:", e);
  }

  // ── Load assets ─────────────────────────
  console.log("📦 Loading assets...");
  Assets.load((images) => {
    console.log("✅ Assets loaded:", Object.keys(images).length, "items");

    try {
      // Initialise the game
      Game.init({
        onScore: UI.updateScore,
        onLives: UI.updateLives,
        onFuel: UI.updateFuel,
        onCoins: UI.updateCoins,
        onGameOver: UI.showGameOver,
      });
      console.log("✅ Game initialised");

      // Set high score in UI
      const high = Game.loadHighScore();
      UI.updateHomeHighScore(high);

      // ── Bind UI events ─────────────────────
      bindUIEvents();
      console.log("✅ UI events bound");

      // Show home screen
      UI.showHome();
      console.log("🏁 Road Fighter ready!");

      // Test sound
      setTimeout(() => {
        try {
          AudioManager.testSound();
        } catch (e) {
          // Silently fail
        }
      }, 500);
    } catch (e) {
      console.error("❌ Game init failed:", e);
      alert("Error starting game. Check console for details.");
    }
  });
});

function bindUIEvents() {
  // Start button
  const startBtn = document.getElementById("btn-start");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      try {
        AudioManager.playSfx("start");
        Game.start();
        UI.showGame();
      } catch (e) {
        console.error("Start error:", e);
      }
    });
  }

  // How to play button
  const howBtn = document.getElementById("btn-how");
  if (howBtn) {
    howBtn.addEventListener("click", () => {
      UI.showHowTo();
    });
  }

  // Close how-to modal
  const closeHowBtn = document.getElementById("btn-close-how");
  if (closeHowBtn) {
    closeHowBtn.addEventListener("click", () => {
      UI.hideHowTo();
    });
  }

  const modalHow = document.getElementById("modal-how");
  if (modalHow) {
    modalHow.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) UI.hideHowTo();
    });
  }

  // Sound toggle (home)
  const soundBtn = document.getElementById("btn-sound");
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      const muted = AudioManager.toggleMute();
      UI.updateSoundIcon(muted);
    });
  }

  // Sound toggle (game)
  const soundGameBtn = document.getElementById("btn-sound-game");
  if (soundGameBtn) {
    soundGameBtn.addEventListener("click", () => {
      const muted = AudioManager.toggleMute();
      UI.updateSoundIcon(muted);
    });
  }

  // Pause button
  const pauseBtn = document.getElementById("btn-pause");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      const paused = Game.pause();
      document
        .getElementById("overlay-pause")
        .classList.toggle("hidden", !paused);
      if (paused) {
        AudioManager.stopBg();
      } else {
        AudioManager.playBg("race");
      }
    });
  }

  // Resume button
  const resumeBtn = document.getElementById("btn-resume");
  if (resumeBtn) {
    resumeBtn.addEventListener("click", () => {
      Game.setPaused(false);
      document.getElementById("overlay-pause").classList.add("hidden");
      AudioManager.playBg("race");
    });
  }

  // Restart from pause
  const restartPauseBtn = document.getElementById("btn-restart-pause");
  if (restartPauseBtn) {
    restartPauseBtn.addEventListener("click", () => {
      document.getElementById("overlay-pause").classList.add("hidden");
      Game.stop();
      AudioManager.playSfx("start");
      Game.start();
    });
  }

  // Home from pause
  const homePauseBtn = document.getElementById("btn-home-pause");
  if (homePauseBtn) {
    homePauseBtn.addEventListener("click", () => {
      document.getElementById("overlay-pause").classList.add("hidden");
      Game.stop();
      AudioManager.stopBg();
      UI.showHome();
      const high = Game.loadHighScore();
      UI.updateHomeHighScore(high);
    });
  }

  // Mobile controls
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");

  const addTouchListeners = (btn, dir) => {
    if (!btn) return;
    const start = (e) => {
      e.preventDefault();
      Game.setKey(dir, true);
    };
    const end = (e) => {
      e.preventDefault();
      Game.setKey(dir, false);
    };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", end, { passive: false });
    btn.addEventListener("touchcancel", end, { passive: false });
    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", end);
    btn.addEventListener("mouseleave", end);
  };

  addTouchListeners(btnLeft, "left");
  addTouchListeners(btnRight, "right");

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") {
      try {
        setTimeout(() => {
          const overlay = document.getElementById("overlay-pause");
          const isPaused = Game.pause();
          if (isPaused !== undefined) {
            overlay.classList.toggle("hidden", !isPaused);
            if (isPaused) {
              AudioManager.stopBg();
            } else {
              AudioManager.playBg("race");
            }
          }
        }, 10);
      } catch (err) {
        // Silently fail
      }
    }
  });

  // Game Over buttons
  const playAgainBtn = document.getElementById("btn-play-again");
  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", () => {
      Game.stop();
      AudioManager.playSfx("start");
      Game.start();
      UI.showGame();
    });
  }

  const goHomeBtn = document.getElementById("btn-go-home");
  if (goHomeBtn) {
    goHomeBtn.addEventListener("click", () => {
      Game.stop();
      AudioManager.stopBg();
      UI.showHome();
      const high = Game.loadHighScore();
      UI.updateHomeHighScore(high);
    });
  }

  // ── Keyboard shortcut: Escape ──
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("modal-how");
      if (modal && !modal.classList.contains("hidden")) {
        UI.hideHowTo();
      }
      const pauseOverlay = document.getElementById("overlay-pause");
      if (pauseOverlay && !pauseOverlay.classList.contains("hidden")) {
        Game.setPaused(false);
        pauseOverlay.classList.add("hidden");
        AudioManager.playBg("race");
      }
    }
  });
}
