/**
 * script.js
 * ─────────
 * Main entry point — initialises assets, audio, UI, and starts the game.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ── Initialise modules ──────────────────
  AudioManager.init();
  UI.init();

  // ── Load assets ─────────────────────────
  Assets.load((images) => {
    // Assets are ready; initialise the game
    Game.init({
      onScore: UI.updateScore,
      onLives: UI.updateLives,
      onFuel: UI.updateFuel,
      onCoins: UI.updateCoins,
      onGameOver: UI.showGameOver,
    });

    // Set high score in UI
    const high = Game.loadHighScore();
    UI.updateHomeHighScore(high);

    // ── Bind UI events ─────────────────────
    bindUIEvents();

    // ── Auto-start (optional) ──────────────
    // Just show the home screen (no auto-start)
    UI.showHome();

    console.log("🏁 Road Fighter ready!");
  });
});

function bindUIEvents() {
  // Start button
  document.getElementById("btn-start").addEventListener("click", () => {
    AudioManager.playSfx("start");
    Game.start();
    UI.showGame();
  });

  // How to play button
  document.getElementById("btn-how").addEventListener("click", () => {
    UI.showHowTo();
  });

  // Close how-to modal
  document.getElementById("btn-close-how").addEventListener("click", () => {
    UI.hideHowTo();
  });
  document.getElementById("modal-how").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) UI.hideHowTo();
  });

  // Sound toggle (home)
  document.getElementById("btn-sound").addEventListener("click", () => {
    const muted = AudioManager.toggleMute();
    UI.updateSoundIcon(muted);
  });

  // Sound toggle (game)
  document.getElementById("btn-sound-game").addEventListener("click", () => {
    const muted = AudioManager.toggleMute();
    UI.updateSoundIcon(muted);
  });

  // Pause button
  document.getElementById("btn-pause").addEventListener("click", () => {
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

  // Resume button
  document.getElementById("btn-resume").addEventListener("click", () => {
    Game.setPaused(false);
    document.getElementById("overlay-pause").classList.add("hidden");
    AudioManager.playBg("race");
  });

  // Restart from pause
  document.getElementById("btn-restart-pause").addEventListener("click", () => {
    document.getElementById("overlay-pause").classList.add("hidden");
    Game.stop();
    AudioManager.playSfx("start");
    Game.start();
  });

  // Home from pause
  document.getElementById("btn-home-pause").addEventListener("click", () => {
    document.getElementById("overlay-pause").classList.add("hidden");
    Game.stop();
    AudioManager.stopBg();
    UI.showHome();
    const high = Game.loadHighScore();
    UI.updateHomeHighScore(high);
  });

  // Mobile controls
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");

  // Touch events with proper press/release
  const addTouchListeners = (btn, dir) => {
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

  // Keyboard shortcuts (for pause, handled in Game)
  document.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") {
      // The Game module handles this, but we need to sync UI
      setTimeout(() => {
        const overlay = document.getElementById("overlay-pause");
        const isPaused = Game.pause();
        // Only show/hide if game is running
        if (isPaused !== undefined) {
          overlay.classList.toggle("hidden", !isPaused);
          if (isPaused) {
            AudioManager.stopBg();
          } else {
            AudioManager.playBg("race");
          }
        }
      }, 10);
    }
  });

  // Game Over buttons
  document.getElementById("btn-play-again").addEventListener("click", () => {
    Game.stop();
    AudioManager.playSfx("start");
    Game.start();
    UI.showGame();
  });

  document.getElementById("btn-go-home").addEventListener("click", () => {
    Game.stop();
    AudioManager.stopBg();
    UI.showHome();
    const high = Game.loadHighScore();
    UI.updateHomeHighScore(high);
  });
}

// ── Keyboard shortcut: Escape to close modals ──
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("modal-how");
    if (!modal.classList.contains("hidden")) {
      UI.hideHowTo();
    }
    const pauseOverlay = document.getElementById("overlay-pause");
    if (!pauseOverlay.classList.contains("hidden")) {
      Game.setPaused(false);
      pauseOverlay.classList.add("hidden");
      AudioManager.playBg("race");
    }
  }
});
