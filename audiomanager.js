/**
 * audioManager.js
 * ───────────────
 * Centralized audio management for Road Fighter.
 * Handles: autoplay policy, muting, looping background music,
 * one-shot SFX, volume control, and audio pooling for rapid SFX.
 */

const AudioManager = (() => {
  // ── State ───────────────────────────────
  let _muted = false;
  let _unlocked = false; // Browser autoplay gate
  let _bgTrack = null; // Currently playing background

  const _sfxPool = {}; // Pre-loaded SFX Audio elements

  // ── Asset paths ─────────────────────────
  const TRACKS = {
    start: "audio/game_start.mp3",
    race: "audio/race_running.mp3",
    crash: "audio/crash.mp3",
    gameover: "audio/game_over.mp3",
    // coin:  'audio/coin.mp3',   // placeholder – uncomment when asset added
  };

  // Volume levels per track
  const VOLUMES = {
    start: 0.7,
    race: 0.4,
    crash: 0.8,
    gameover: 0.7,
    coin: 0.6,
  };

  // ── Pre-load all SFX ────────────────────
  function preload() {
    ["crash", "coin", "gameover", "start"].forEach((key) => {
      if (!TRACKS[key]) return;
      const audio = new Audio(TRACKS[key]);
      audio.preload = "auto";
      audio.volume = VOLUMES[key] ?? 0.7;
      _sfxPool[key] = audio;
    });
  }

  // ── Unlock audio context on first interaction ──
  function unlockOnInteraction() {
    if (_unlocked) return;
    const unlock = () => {
      _unlocked = true;
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      // Resume background if it was pending
      if (_bgTrack && !_bgTrack.paused) return;
    };
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("touchend", unlock, true);
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }

  // ── Play looping background music ───────
  function playBg(name) {
    if (!TRACKS[name]) return;

    // Stop current background
    stopBg();

    const audio = new Audio(TRACKS[name]);
    audio.loop = name === "race"; // race_running loops, others don't
    audio.volume = _muted ? 0 : (VOLUMES[name] ?? 0.5);
    audio.preload = "auto";

    _bgTrack = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked — will play on next user interaction
        const retry = () => {
          audio.play().catch(() => {});
          document.removeEventListener("click", retry, true);
          document.removeEventListener("touchstart", retry, true);
          document.removeEventListener("keydown", retry, true);
        };
        document.addEventListener("click", retry, {
          once: true,
          capture: true,
        });
        document.addEventListener("touchstart", retry, {
          once: true,
          capture: true,
        });
        document.addEventListener("keydown", retry, {
          once: true,
          capture: true,
        });
      });
    }
  }

  // ── Stop background music ────────────────
  function stopBg() {
    if (_bgTrack) {
      _bgTrack.pause();
      _bgTrack.currentTime = 0;
      _bgTrack = null;
    }
  }

  // ── Play one-shot SFX ───────────────────
  function playSfx(name) {
    if (_muted || !TRACKS[name]) return;

    // Reuse pooled audio: rewind if already playing
    const pooled = _sfxPool[name];
    if (pooled) {
      pooled.currentTime = 0;
      pooled.volume = _muted ? 0 : (VOLUMES[name] ?? 0.7);
      pooled.play().catch(() => {});
      return;
    }

    // Fallback: create fresh element
    const audio = new Audio(TRACKS[name]);
    audio.volume = VOLUMES[name] ?? 0.7;
    audio.play().catch(() => {});
  }

  // ── Toggle mute ─────────────────────────
  function toggleMute() {
    _muted = !_muted;
    if (_bgTrack) _bgTrack.volume = _muted ? 0 : (VOLUMES._current ?? 0.4);
    return _muted;
  }

  function setMuted(val) {
    _muted = val;
    if (_bgTrack) _bgTrack.volume = _muted ? 0 : 0.4;
  }

  function isMuted() {
    return _muted;
  }

  // ── Init ────────────────────────────────
  function init() {
    preload();
    unlockOnInteraction();
  }

  // Public API
  return { init, playBg, stopBg, playSfx, toggleMute, setMuted, isMuted };
})();
