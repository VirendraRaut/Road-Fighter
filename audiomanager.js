/**
 * audioManager.js
 * ───────────────
 * Road Fighter Audio Manager - Completely self-contained
 */

// Use var instead of const to avoid hoisting issues
var AudioManager = (function () {
  "use strict";

  console.log("📢 AudioManager initializing...");

  // ── State ───────────────────────────────
  var _muted = false;
  var _unlocked = false;
  var _bgTrack = null;
  var _bgTrackName = null;
  var _initialized = false;
  var _sfxPool = {};

  // ── Asset paths ─────────────────────────
  var TRACKS = {
    start: "audio/game_start.mp3",
    race: "audio/race_running.mp3",
    crash: "audio/crash.mp3",
    gameover: "audio/game_over.mp3",
    coin: "audio/coin.mp3",
  };

  var VOLUMES = {
    start: 0.7,
    race: 0.35,
    crash: 0.6,
    gameover: 0.7,
    coin: 0.5,
  };

  // ── Web Audio context for fallback sounds ──
  var _audioCtx = null;

  function getAudioContext() {
    if (!_audioCtx) {
      try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log("✅ Web Audio context created");
      } catch (e) {
        console.warn("Web Audio not supported:", e.message);
        return null;
      }
    }
    return _audioCtx;
  }

  // ── Synthesised fallback sounds ──────────
  function playSynthesisedSound(type) {
    console.log("🔊 Playing synthesised sound:", type);

    var ctx = getAudioContext();
    if (!ctx) {
      console.warn("No audio context available");
      return;
    }

    try {
      // Resume context if suspended
      if (ctx.state === "suspended") {
        ctx.resume().catch(function (e) {});
      }

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      var now = ctx.currentTime;
      var freq = 440;
      var duration = 0.3;
      var volume = 0.3;

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
      console.warn("Failed to play synthesised sound:", e.message);
    }
  }

  // ── Pre-load all SFX ────────────────────
  function preload() {
    console.log("Preloading audio files...");
    ["crash", "coin", "gameover", "start"].forEach(function (key) {
      if (!TRACKS[key]) return;
      try {
        var audio = new Audio(TRACKS[key]);
        audio.preload = "auto";
        audio.volume = VOLUMES[key] || 0.7;
        _sfxPool[key] = audio;
        console.log("  ✅ Preloaded:", key);
      } catch (e) {
        console.warn("  ⚠️ Could not preload:", key, e.message);
        _sfxPool[key] = null;
      }
    });
    _initialized = true;
  }

  // ── Unlock audio context ────────────────
  function unlockOnInteraction() {
    if (_unlocked) return;

    var unlock = function () {
      _unlocked = true;
      console.log("🔓 Audio unlocked by user interaction");

      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);

      // Resume Web Audio context if suspended
      var ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(function (e) {});
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
    console.log("🎵 Playing background:", name);

    if (!TRACKS[name]) {
      console.warn("Track not found:", name);
      return;
    }

    stopBg();

    try {
      var audio = new Audio(TRACKS[name]);
      audio.loop = name === "race";
      audio.volume = _muted ? 0 : VOLUMES[name] || 0.5;
      audio.preload = "auto";

      _bgTrack = audio;
      _bgTrackName = name;

      var playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(function () {
          console.warn("Failed to play audio file, using fallback");
          _bgTrack = null;
          playFallbackBg(name);
        });
      }
    } catch (e) {
      console.warn("Error playing background:", e.message);
      playFallbackBg(name);
    }
  }

  // ── Fallback background music ────────────
  function playFallbackBg(name) {
    if (name === "race" && !_muted) {
      console.log("🎵 Using fallback background tone");
      var ctx = getAudioContext();
      if (!ctx) return;

      try {
        if (ctx.state === "suspended") {
          ctx.resume().catch(function (e) {});
        }

        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.5);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 1);
        osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 1.5);
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 2);

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1);

        osc.start(ctx.currentTime);

        _bgTrack = {
          stop: function () {
            try {
              osc.stop();
            } catch (e) {}
          },
          pause: function () {},
          currentTime: 0,
        };
        _bgTrackName = "race";

        // Restart after 2 seconds
        setTimeout(function () {
          if (_bgTrack && _bgTrackName === "race" && !_muted) {
            playFallbackBg("race");
          }
        }, 2000);
      } catch (e) {
        console.warn("Fallback background failed:", e.message);
      }
    }
  }

  // ── Stop background music ────────────────
  function stopBg() {
    if (_bgTrack) {
      if (typeof _bgTrack.stop === "function") {
        _bgTrack.stop();
      } else if (typeof _bgTrack.pause === "function") {
        _bgTrack.pause();
        _bgTrack.currentTime = 0;
      }
      _bgTrack = null;
      _bgTrackName = null;
    }
  }

  // ── Play one-shot SFX ───────────────────
  function playSfx(name) {
    if (_muted) {
      console.log("🔇 Sound muted, skipping:", name);
      return;
    }

    if (!TRACKS[name]) {
      console.warn("SFX not found:", name);
      return;
    }

    console.log("🔊 Playing SFX:", name);

    // Try to use pooled audio first
    var pooled = _sfxPool[name];
    if (pooled) {
      try {
        pooled.currentTime = 0;
        pooled.volume = _muted ? 0 : VOLUMES[name] || 0.7;
        var promise = pooled.play();
        if (promise) {
          promise.catch(function () {
            playSynthesisedSound(name);
          });
        }
        return;
      } catch (e) {
        // Error playing — use fallback
      }
    }

    // Try creating fresh audio
    try {
      var audio = new Audio(TRACKS[name]);
      audio.volume = VOLUMES[name] || 0.7;
      var promise = audio.play();
      if (promise) {
        promise.catch(function () {
          playSynthesisedSound(name);
        });
      }
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
    console.log("🔇 Mute toggled:", _muted);

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
    _muted = !!val;
    console.log("🔇 Mute set to:", _muted);

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
    if (_initialized) {
      console.log("AudioManager already initialized");
      return;
    }

    console.log("🎵 AudioManager initializing...");
    preload();
    unlockOnInteraction();

    // Resume Web Audio context on any interaction
    var resumeCtx = function () {
      var ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(function (e) {});
      }
    };

    document.addEventListener("click", resumeCtx, { once: true });
    document.addEventListener("touchstart", resumeCtx, { once: true });
    document.addEventListener("keydown", resumeCtx, { once: true });

    console.log("✅ AudioManager initialized");
  }

  // ── Test sound (for debugging) ──────────
  function testSound() {
    console.log("🔊 Testing sound...");
    if (_muted) {
      console.log("🔇 Sound is muted, toggling...");
      toggleMute();
    }
    // Try to play a test sound
    try {
      playSfx("coin");
    } catch (e) {
      console.error("Test sound failed:", e);
    }
  }

  // ── Public API ──────────────────────────
  var publicAPI = {
    init: init,
    playBg: playBg,
    stopBg: stopBg,
    playSfx: playSfx,
    toggleMute: toggleMute,
    setMuted: setMuted,
    isMuted: isMuted,
    testSound: testSound,
  };

  console.log("✅ AudioManager ready");
  return publicAPI;
})();

// Double-check it's defined
if (typeof AudioManager !== "undefined") {
  console.log("✅ AudioManager successfully defined globally");
} else {
  console.error("❌ AudioManager not defined!");
}
