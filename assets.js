/**
 * assets.js
 * ─────────
 * Preloads all game images.
 * Falls back to canvas-drawn sprites if files are missing,
 * so the game is fully playable even before real assets arrive.
 */

const Assets = (() => {
  const _images = {};
  let _loaded = 0;
  let _total = 0;

  // ── Image manifest ──────────────────────
  const MANIFEST = {
    playerCar: "assets/user_car.png",
    enemyCar: "assets/enemy_car.png",
    road: "assets/road.png",
  };

  // ── Load all images ─────────────────────
  function load(onComplete) {
    const keys = Object.keys(MANIFEST);
    _total = keys.length;

    if (_total === 0) {
      onComplete(_images);
      return;
    }

    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        _images[key] = img;
        _loaded++;
        if (_loaded >= _total) onComplete(_images);
      };
      img.onerror = () => {
        // Generate a fallback canvas-drawn sprite
        _images[key] = makeFallback(key);
        _loaded++;
        if (_loaded >= _total) onComplete(_images);
      };
      img.src = MANIFEST[key];
    });
  }

  // ── Fallback sprite generators ───────────
  function makeFallback(key) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (key === "playerCar") {
      // A sleek blue player car viewed from above
      canvas.width = 40;
      canvas.height = 72;
      // Body
      ctx.fillStyle = "#00aaff";
      ctx.beginPath();
      ctx.roundRect(4, 6, 32, 60, 6);
      ctx.fill();
      // Windshield
      ctx.fillStyle = "rgba(180,230,255,0.7)";
      ctx.beginPath();
      ctx.roundRect(8, 10, 24, 20, 4);
      ctx.fill();
      // Rear window
      ctx.beginPath();
      ctx.roundRect(8, 46, 24, 14, 4);
      ctx.fill();
      // Wheels
      ctx.fillStyle = "#222";
      [
        [0, 10],
        [32, 10],
        [0, 52],
        [32, 52],
      ].forEach(([x, y]) => {
        ctx.fillRect(x, y, 8, 14);
      });
      // Stripe
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(17, 6, 6, 60);
    } else if (key === "enemyCar") {
      // A red enemy car
      canvas.width = 40;
      canvas.height = 72;
      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.roundRect(4, 6, 32, 60, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(255,180,180,0.6)";
      ctx.beginPath();
      ctx.roundRect(8, 10, 24, 20, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(8, 46, 24, 14, 4);
      ctx.fill();
      ctx.fillStyle = "#222";
      [
        [0, 10],
        [32, 10],
        [0, 52],
        [32, 52],
      ].forEach(([x, y]) => ctx.fillRect(x, y, 8, 14));
      // Hazard stripe
      ctx.fillStyle = "rgba(255,200,0,0.4)";
      ctx.fillRect(17, 6, 6, 60);
    } else if (key === "road") {
      // A tiled road segment
      canvas.width = 300;
      canvas.height = 600;
      // Asphalt
      ctx.fillStyle = "#1e2228";
      ctx.fillRect(0, 0, 300, 600);
      // Road boundaries (inside)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 6, 600);
      ctx.fillRect(294, 0, 6, 600);
      // Lane dashes
      ctx.fillStyle = "#ffcc00";
      ctx.setLineDash([30, 30]);
      [75, 150, 225].forEach((x) => {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 600);
        ctx.stroke();
      });
    }

    return canvas;
  }

  function get(key) {
    return _images[key];
  }

  return { load, get };
})();
