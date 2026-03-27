#!/usr/bin/env node
/**
 * Bundles all game source into a single self-contained HTML file
 * for embedding in a React Native WebView.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../../src/game');

// Read all source files and strip TypeScript features for inline JS
function stripTS(code) {
  // Remove type-only exports/imports
  let out = code;
  // Remove import/export type statements
  out = out.replace(/^import\s+type\s+.*?;\s*$/gm, '');
  out = out.replace(/^export\s+type\s+.*?;\s*$/gm, '');
  // Remove type annotations on parameters: : Type
  out = out.replace(/:\s*(?:string|number|boolean|void|never|null|undefined|any|unknown)(?=\s*[),;={])/g, '');
  out = out.replace(/:\s*\w+(?:\[\])?(?=\s*[),;={])/g, '');
  // Remove interface/type declarations
  out = out.replace(/^(?:export\s+)?(?:interface|type)\s+\w+[^{]*\{[\s\S]*?\}/gm, '');
  // Remove enum (replace with const object)
  out = out.replace(/^export\s+enum\s+(\w+)\s*\{([^}]*)\}/gm, (_, name, body) => {
    const entries = body.split(',').map(e => e.trim()).filter(Boolean).map(e => {
      const [key, val] = e.split('=').map(s => s.trim());
      return val ? `  ${key}: ${val}` : `  ${key}: '${key}'`;
    });
    return `const ${name} = {\n${entries.join(',\n')}\n};\nObject.freeze(${name});`;
  });
  return out;
}

const files = [
  'world/rng.ts',
  'world/terrain.ts',
  'world/biomes.ts',
  'world/chunk.ts',
  'world/chunk-manager.ts',
  'difficulty.ts',
  'entities/Enemy.ts',
  'entities/Slime.ts',
  'entities/Bat.ts',
  'entities/Skeleton.ts',
  'entities/Jumper.ts',
  'entities/Boss.ts',
  'entities/particles.ts',
  'entities/Collectibles.ts',
  'input/input.ts',
  'rendering/renderer.ts',
  'engine/camera.ts',
  'hazards/index.ts',
  'entities/player.ts',
  'engine/game-engine.ts',
];

let js = '';
for (const f of files) {
  const fp = path.join(srcDir, f);
  const code = fs.readFileSync(fp, 'utf-8');
  js += `\n// === ${f} ===\n`;
  js += stripTS(code);
  js += '\n';
}

// Wrap in an IIFE to avoid polluting global scope
const wrapped = `(function() {
'use strict';
${js}
})();`;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
canvas { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<canvas id="gameCanvas"></canvas>
<script>
// Mobile bridge — receives touch input from React Native via postMessage
(function() {
  'use strict';
  
  // Override window event listeners for mobile
  // The InputManager listens for 'game-input' CustomEvents
  window.__mobileInput = { left: false, right: false, jump: false, jumpPressed: false, attack: false, attackPressed: false };
  
  // Listen for messages from React Native
  window.addEventListener('message', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'game-input') {
        // Dispatch as CustomEvent for InputManager
        window.dispatchEvent(new CustomEvent('game-input', { detail: data }));
      }
    } catch(err) {}
  });
  
  // Also support ReactWebView injectedMessage  
  document.addEventListener('message', function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'game-input') {
        window.dispatchEvent(new CustomEvent('game-input', { detail: data }));
      }
    } catch(err) {}
  });
  
${wrapped}
  
  // Create engine and expose control
  const canvas = document.getElementById('gameCanvas');
  const engine = new GameEngine(canvas, 42);
  
  // Set reduced particles for mobile performance (access private field via convention)
  // The constructor runs particles = new ParticleSystem() so we patch the prototype
  
  engine.start();
  
  // Stats callback → post back to React Native
  engine.onStatsUpdate = function(stats) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'stats',
      score: stats.score,
      coins: stats.coins,
      distance: stats.distance,
      health: stats.health,
      maxHealth: stats.maxHealth,
      biome: stats.biome,
      fps: stats.fps,
      powerUps: stats.powerUps
    }));
  };
  
  engine.onGameOver = function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'gameover'
    }));
  };
  
  // Expose engine for control
  window.__gameEngine = engine;
  
  // Handle resize
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    engine.renderer.resize(w, h);
    engine.camera.setScreenSize(w, h);
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  // Expose controls
  window.__gameControls = {
    setSeed: function(seed) { engine.setSeed(seed); },
    pause: function() { engine.pause(); },
    resume: function() { engine.resume(); },
    getState: function() { return engine.state; },
  };
  
})();
</script>
</body>
</html>`;

const outPath = path.resolve(__dirname, '../assets/game.html');
fs.writeFileSync(outPath, html, 'utf-8');
console.log('Bundled game.html → ' + outPath + ' (' + html.length + ' bytes)');
