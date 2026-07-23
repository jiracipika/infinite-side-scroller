#!/usr/bin/env node
/**
 * Bundles the game engine into a single self-contained HTML file
 * for embedding in the React Native WebView.
 *
 * Uses esbuild for proper TypeScript transpilation — the old regex-based
 * approach broke on complex types, generics, and decorators.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '../../..');
const srcDir = path.resolve(rootDir, 'src/game');
const outFile = path.resolve(__dirname, '../assets/game.html');

// Entry point — imports the engine and exposes it on window
const entryCode = `
  import { GameEngine } from './engine/game-engine';
  window.GameEngine = GameEngine;
`;

// Write temporary entry file
const entryPath = path.resolve(srcDir, '_mobile-entry.ts');
fs.writeFileSync(entryPath, entryCode, 'utf-8');

async function build() {
  try {
    // Bundle with esbuild — resolves all imports, strips types, minifies
    const result = await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      minify: true,
      write: false,
      format: 'iife',
      target: ['es2020'],
      platform: 'browser',
      define: {
        'global': 'window',
      },
      loader: {
        '.ts': 'ts',
      },
      tsconfig: path.resolve(rootDir, 'tsconfig.json'),
    });

    // Clean up temp entry
    fs.unlinkSync(entryPath);

    const gameJS = result.outputFiles[0].text;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
canvas { display: block; width: 100%; height: 100%; touch-action: none; }
</style>
</head>
<body>
<canvas id="gameCanvas"></canvas>
<script>
(function() {
  'use strict';

  // Mobile bridge — receives touch input from React Native
  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type) {
        window.dispatchEvent(new CustomEvent('game-input', { detail: data }));
      }
    } catch(err) {}
  });

  document.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type) {
        window.dispatchEvent(new CustomEvent('game-input', { detail: data }));
      }
    } catch(err) {}
  });

  // === Game engine bundle ===
  ${gameJS}

  // Create engine
  var canvas = document.getElementById('gameCanvas');
  var engine = new window.GameEngine(canvas, 42, 'knight');

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
      lives: stats.lives,
      biome: stats.biome,
      fps: stats.fps,
      powerUps: stats.powerUps,
      maxCombo: stats.maxCombo || 0,
      enemiesDefeated: stats.enemiesDefeated || 0
    }));
  };

  engine.onGameOver = function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'gameover'
    }));
  };

  window.__gameEngine = engine;

  // Handle resize
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    engine['renderer'].resize(w, h);
    engine['camera'].setScreenSize(w, h);
  }

  window.addEventListener('resize', resize);
  resize();

  // Expose controls for React Native
  window.__gameControls = {
    setSeed: function(seed) { engine.setSeed(seed); },
    setLevel: function(config) { engine.setLevel(config); },
    pause: function() { engine.pause(); },
    resume: function() { engine.resume(); },
    getState: function() { return engine.state; },
    setCharacter: function(id) { engine.setSeed(engine.worldSeed, id); },
  };

})();
</script>
</body>
</html>`;

    fs.writeFileSync(outFile, html, 'utf-8');
    console.log('✓ Bundled game.html → ' + outFile);
    console.log('  Size: ' + (html.length / 1024).toFixed(1) + ' KB');
  } catch (err) {
    // Clean up temp entry on error
    try { fs.unlinkSync(entryPath); } catch {}
    console.error('✗ Bundle failed:', err.message);
    if (err.errors) {
      for (const e of err.errors) {
        console.error('  ' + e.location?.file + ':' + e.location?.line + ' — ' + e.text);
      }
    }
    process.exit(1);
  }
}

build();
