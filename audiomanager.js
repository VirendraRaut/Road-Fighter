/**
 * audioManager.js
 * ───────────────
 * Centralized audio management for Road Fighter.
 * Handles: autoplay policy, muting, looping background music,
 * one-shot SFX, volume control, and audio pooling for rapid SFX.
 * Includes fallback synthesised sounds when files are missing.
 */

const AudioManager = (() => {
  // ── State ───────────────────────────────
  let _muted = false;
  let _unlocked = false;
  let _bgTrack = null;
  let _bgTrackName = null;
  let _initialized = false;

  const _sfxPool = {};

  // ── Asset paths ─────────────────────────
  const TRACKS = {
    start: "audio/game_start.mp3",
    race: "audio/race_running.mp3",
    crash: "audio/crash.mp3",
    gameover: "audio/game_over.mp3",
    coin: "audio/coin.mp3",
  };

  const VOLUMES = {
    start: 0.7,
    race: 0.35,
    crash: 0.6,
    gameover: 0.7,
    coin: 0.5,
  };

  // ── Web Audio context for fallback sounds ──
  let _audioCtx = null;

  function getAudioContext() {
    if (!_audioCtx) {
      try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("Web Audio not supported");
        return null;
      }
    }
    return _audioCtx;
  }

  // ── Synthesised fallback sounds ──────────
  function playSynthesisedSound(type) {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      let freq = 440;
      let duration = 0.3;
      let volume = 0.3;

      switch (type) {
        case "coin":
          freq = 880;
          duration = 0.15;
          volume = 0.25;
          osc.type = "sine";
          gain.gain.setValueAtTime(volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(
            1200,
            now + duration * 0.7,
          );
          osc.start(now);
          osc.stop(now + duration);
          break;

        case "crash":
          freq = 200;
          duration = 0.4;
          volume = 0.4;
          osc.type = "sawtooth";
          gain.gain.setValueAtTime(volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + duration);
          osc.start(now);
          osc.stop(now + duration);
          break;

        case "gameover":
          freq = 440;
          duration = 0.8;
          volume = 0.3;
          osc.type = "sawtooth";
          gain.gain.setValueAtTime(volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + duration * 0.6);
          osc.frequency.exponentialRampToValueAtTime(110, now + duration);
          osc.start(now);
          osc.stop(now + duration);
          break;

        case "start":
          freq = 523;
          duration = 0.3;
          volume = 0.3;
          osc.type = "square";
          gain.gain.setValueAtTime(volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(784, now + duration * 0.5);
          osc.start(now);
          osc.stop(now + duration);
          break;

        default:
          osc.type = "sine";
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.frequency.setValueAtTime(440, now);
          osc.start(now);
          osc.stop(now + 0.2);
      }
    } catch (e) {
      // Silently fail
    }
  }

  // ── Pre-load all SFX ────────────────────
  function preload() {
    ["crash", "coin", "gameover", "start"].forEach((key) => {
      if (!TRACKS[key]) return;
      try {
        const audio = new Audio(TRACKS[key]);
        audio.preload = "auto";
        audio.volume = VOLUMES[key] ?? 0.7;
        _sfxPool[key] = audio;
      } catch (e) {
        // File doesn't exist, we'll use fallback
        _sfxPool[key] = null;
      }
    });
    _initialized = true;
  }

  // ── Unlock audio context ────────────────
  function unlockOnInteraction() {
    if (_unlocked) return;

    const unlock = () => {
      _unlocked = true;
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);

      // Resume Web Audio context if suspended
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };

    document.addEventListener("touchstart", unlock, {
      capture: true,
      once: true,
    });
    document.addEventListener("touchend", unlock, {
      capture: true,
      once: true,
    });
    document.addEventListener("click", unlock, { capture: true, once: true });
    document.addEventListener("keydown", unlock, { capture: true, once: true });
  }

  // ── Play background music ───────────────
  function playBg(name) {
    if (!TRACKS[name]) return;

    stopBg();

    // Try to load the audio file
    try {
      const audio = new Audio(TRACKS[name]);
      audio.loop = name === "race";
      audio.volume = _muted ? 0 : (VOLUMES[name] ?? 0.5);
      audio.preload = "auto";

      _bgTrack = audio;
      _bgTrackName = name;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // File not found or autoplay blocked — use fallback
          _bgTrack = null;
          // Play a simple tone instead
          playFallbackBg(name);
        });
      }
    } catch (e) {
      // File doesn't exist — use fallback
      playFallbackBg(name);
    }
  }

  // ── Fallback background music ────────────
  function playFallbackBg(name) {
    if (name === "race" && !_muted) {
      // Create a simple looping tone for race
      const ctx = getAudioContext();
      if (!ctx) return;

      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.5);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 1);
        osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 1.5);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 2);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1);

        osc.start(ctx.currentTime);
        // We'll keep it running and loop it manually
        _bgTrack = {
          stop: () => {
            osc.stop();
          },
          volume: 0.08,
          pause: () => {
            // No-op for fallback
          },
          currentTime: 0,
        };
        _bgTrackName = "race";

        // Restart after 2 seconds
        setTimeout(() => {
          if (_bgTrack && _bgTrackName === "race" && !_muted) {
            playFallbackBg("race");
          }
        }, 2000);
      } catch (e) {
        // Silently fail
      }
    }
  }

  // ── Stop background music ────────────────
  function stopBg() {
    if (_bgTrack) {
      if (_bgTrack.stop) {
        _bgTrack.stop();
      } else {
        _bgTrack.pause();
        _bgTrack.currentTime = 0;
      }
      _bgTrack = null;
      _bgTrackName = null;
    }
  }

  // ── Play one-shot SFX ───────────────────
  function playSfx(name) {
    if (_muted || !TRACKS[name]) return;

    // Try to use pooled audio first
    const pooled = _sfxPool[name];
    if (pooled) {
      try {
        pooled.currentTime = 0;
        pooled.volume = _muted ? 0 : (VOLUMES[name] ?? 0.7);
        const promise = pooled.play();
        if (promise)
          promise.catch(() => {
            // File not found — use fallback
            playSynthesisedSound(name);
          });
        return;
      } catch (e) {
        // Error playing — use fallback
      }
    }

    // Try creating fresh audio
    try {
      const audio = new Audio(TRACKS[name]);
      audio.volume = VOLUMES[name] ?? 0.7;
      const promise = audio.play();
      if (promise)
        promise.catch(() => {
          playSynthesisedSound(name);
        });
      return;
    } catch (e) {
      // File not found — use fallback
    }

    // Final fallback — synthesised sound
    playSynthesisedSound(name);
  }

  // ── Toggle mute ─────────────────────────
  function toggleMute() {
    _muted = !_muted;
    if (_bgTrack) {
      if (_bgTrackName && VOLUMES[_bgTrackName] !== undefined) {
        _bgTrack.volume = _muted ? 0 : VOLUMES[_bgTrackName];
      } else {
        _bgTrack.volume = _muted ? 0 : 0.35;
      }
    }
    return _muted;
  }

  function setMuted(val) {
    _muted = val;
    if (_bgTrack) {
      if (_bgTrackName && VOLUMES[_bgTrackName] !== undefined) {
        _bgTrack.volume = _muted ? 0 : VOLUMES[_bgTrackName];
      } else {
        _bgTrack.volume = _muted ? 0 : 0.35;
      }
    }
  }

  function isMuted() {
    return _muted;
  }

  // ── Init ────────────────────────────────
  function init() {
    if (_initialized) return;
    preload();
    unlockOnInteraction();

    // Resume Web Audio context on any interaction
    const resumeCtx = () => {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("click", resumeCtx, { once: true });
    document.addEventListener("touchstart", resumeCtx, { once: true });
    document.addEventListener("keydown", resumeCtx, { once: true });
  }

  // ── Test sound (for debugging) ──────────
  function testSound() {
    if (_muted) {
      console.log("Sound is muted");
      return;
    }
    console.log("Testing sound...");
    playSfx("coin");
  }

  // Public API
  return {
    init,
    playBg,
    stopBg,
    playSfx,
    toggleMute,
    setMuted,
    isMuted,
    testSound,
  };
})();
