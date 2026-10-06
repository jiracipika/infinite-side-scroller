"use strict";
(() => {
  // src/game/data/characters.ts
  var CHARACTERS = [
    {
      id: "knight",
      name: "Knight",
      description: "Balanced all-rounder",
      ability: "Base kit with standard double-jump pickup and orb shots",
      unlockCost: 0,
      baseUnlocked: true,
      bodyColor: "#4488cc",
      outlineColor: "#2a5a8a",
      eyeColor: "#fff",
      speed: 1,
      jumpVelocity: 1,
      maxHealth: 3,
      width: 24,
      height: 32,
      hasMelee: true,
      meleeCooldown: 0.4,
      meleeDamage: 2,
      meleeRange: 48,
      meleeDuration: 0.2,
      specialName: "Radiant Cleave",
      specialCooldown: 12,
      specialColor: "#f8fafc"
    },
    {
      id: "ninja",
      name: "Ninja",
      description: "Fast but fragile",
      ability: "Starts with a double jump and has quick movement",
      unlockCost: 0,
      baseUnlocked: true,
      bodyColor: "#33aa55",
      outlineColor: "#1a6a3a",
      eyeColor: "#ff0",
      speed: 1.3,
      jumpVelocity: 1.1,
      maxHealth: 2,
      width: 20,
      height: 30,
      hasMelee: true,
      meleeCooldown: 0.28,
      meleeDamage: 1,
      meleeRange: 40,
      meleeDuration: 0.15,
      specialName: "Shadow Tempest",
      specialCooldown: 9,
      specialColor: "#4ade80"
    },
    {
      id: "tank",
      name: "Tank",
      description: "Slow but tough",
      ability: "Heavy armor, extra health, and harder landing control",
      unlockCost: 0,
      baseUnlocked: true,
      bodyColor: "#cc4444",
      outlineColor: "#8a2a2a",
      eyeColor: "#fff",
      speed: 0.7,
      jumpVelocity: 0.85,
      maxHealth: 5,
      width: 28,
      height: 36,
      hasMelee: true,
      meleeCooldown: 0.55,
      meleeDamage: 3,
      meleeRange: 52,
      meleeDuration: 0.26,
      specialName: "Meteor Slam",
      specialCooldown: 14,
      specialColor: "#f97316"
    },
    {
      id: "mage",
      name: "Mage",
      description: "Floaty jumper",
      ability: "Starts with a floaty double jump for aerial routes",
      unlockCost: 180,
      bodyColor: "#8844cc",
      outlineColor: "#5a2a8a",
      eyeColor: "#ddf",
      speed: 0.9,
      jumpVelocity: 1.3,
      maxHealth: 2,
      width: 22,
      height: 34,
      hasMagicBolt: true,
      specialName: "Arcane Nova",
      specialCooldown: 11,
      specialColor: "#c084fc"
    },
    {
      id: "ranger",
      name: "Ranger",
      description: "Quick scout",
      ability: "Starts with bow shots and fast projectile follow-up",
      unlockCost: 220,
      bodyColor: "#16a34a",
      outlineColor: "#14532d",
      eyeColor: "#dcfce7",
      speed: 1.15,
      jumpVelocity: 1.05,
      maxHealth: 3,
      width: 22,
      height: 32,
      specialName: "Arrow Rain",
      specialCooldown: 10,
      specialColor: "#facc15"
    },
    {
      id: "cyborg",
      name: "Cyborg",
      description: "Stable and sturdy",
      ability: "Resists knockback with a reliable health pool",
      unlockCost: 260,
      bodyColor: "#64748b",
      outlineColor: "#1e293b",
      eyeColor: "#67e8f9",
      speed: 0.95,
      jumpVelocity: 0.95,
      maxHealth: 4,
      width: 24,
      height: 33,
      knockbackResistance: 0.5,
      specialName: "Overclock Pulse",
      specialCooldown: 12,
      specialColor: "#22d3ee",
      hasMelee: true,
      meleeCooldown: 0.38,
      meleeDamage: 2,
      meleeRange: 46,
      meleeDuration: 0.2
    },
    {
      id: "spirit",
      name: "Spirit",
      description: "Floaty drifter",
      ability: "Glides longer with an always-ready double jump",
      unlockCost: 320,
      bodyColor: "#8b5cf6",
      outlineColor: "#4c1d95",
      eyeColor: "#f5d0fe",
      speed: 1,
      jumpVelocity: 1.22,
      maxHealth: 2,
      width: 21,
      height: 33,
      specialName: "Astral Wake",
      specialCooldown: 10,
      specialColor: "#e879f9"
    },
    {
      id: "healer",
      name: "Healer",
      description: "Support with passive regen",
      ability: "Slow passive regeneration during long runs",
      unlockCost: 380,
      bodyColor: "#14b8a6",
      outlineColor: "#0f766e",
      eyeColor: "#ecfeff",
      speed: 0.96,
      jumpVelocity: 1.08,
      maxHealth: 4,
      width: 23,
      height: 33,
      specialName: "Verdant Sanctuary",
      specialCooldown: 15,
      specialColor: "#2dd4bf"
    },
    {
      id: "cherry",
      name: "Cherry",
      description: "Gothic charmer with a cherry parasol",
      ability: "Starts with a double jump and quick parasol bonks",
      unlockCost: 450,
      bodyColor: "#2a1f33",
      outlineColor: "#180f20",
      eyeColor: "#ff5d73",
      speed: 1.12,
      jumpVelocity: 1.12,
      maxHealth: 3,
      width: 22,
      height: 32,
      hasMelee: true,
      meleeCooldown: 0.3,
      meleeDamage: 1,
      meleeRange: 42,
      meleeDuration: 0.16,
      specialName: "Cherry Bomb",
      specialCooldown: 9,
      specialColor: "#e5304a"
    }
  ];
  var DEFAULT_CHARACTER = CHARACTERS[0];
  var BASE_CHARACTER_IDS = CHARACTERS.filter((c) => c.baseUnlocked || c.unlockCost <= 0).map((c) => c.id);

  // src/game/rendering/ink-ninja.ts
  function drawInkNinja(ctx2, width, height, pose) {
    const ink = "#0a0a0f";
    const fold = "#373044";
    const edge = "#8e799e";
    const lime = "#c7ff4d";
    const sx = width / 20;
    const sy = height / 30;
    const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
    const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
    const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
    const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * 0.35;
    const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * 0.2;
    const path = (points) => {
      ctx2.beginPath();
      points.forEach(([x, y], i) => i ? ctx2.lineTo(x * sx, y * sy) : ctx2.moveTo(x * sx, y * sy));
    };
    const poly = (color, points) => {
      ctx2.fillStyle = color;
      path(points);
      ctx2.closePath();
      ctx2.fill();
    };
    const mark = (color, points, weight = 0.55) => {
      ctx2.strokeStyle = color;
      ctx2.lineWidth = weight * Math.min(sx, sy);
      path(points);
      ctx2.stroke();
    };
    const shift = (points, x = lean, y = lift) => points.map(([px, py]) => [px + x, py + y]);
    const reach = pose.dashing ? 23 : pose.airborne ? 17 : 11 + Math.abs(stride) * 2;
    const wave = stride * 0.6;
    poly(ink, shift([[8, 9], [1, 7], [-reach, 3 + wave], [-reach + 4, 7], [-reach - 2, 10], [1, 11], [9, 12]]));
    poly(lime, shift([[7, 9], [0, 8], [-reach, 4 + wave], [-reach + 5, 8], [-reach - 1, 9], [1, 10], [7, 11]]));
    poly(lime, shift([[3, 10], [-reach + 6, 12 - wave], [-reach + 10, 13], [-reach + 2, 16 - wave], [2, 12], [6, 11]]));
    mark(ink, shift([[-reach + 7, 7 + wave], [-2, 9], [3, 9]]), 0.7);
    const hip = [10, 18];
    let rearKnee = [5 - stride * 0.8, 23];
    let rearFoot = [4 - stride * 1.5, 29 - Math.max(0, stride)];
    let frontKnee = [14 + stride * 0.8, 23];
    let frontFoot = [15 + stride * 1.5, 29 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearKnee = [3, 21];
      rearFoot = [-1, 25];
      frontKnee = [17, 20];
      frontFoot = [13, 29];
    }
    if (pose.dashing) {
      rearKnee = [1, 23];
      rearFoot = [-3, 27];
      frontKnee = [15, 23];
      frontFoot = [20, 28];
    }
    const leg = (knee, foot, rear) => {
      const [kx, ky] = knee, [fx, fy] = foot;
      poly(ink, [
        [hip[0] - 3, hip[1] - 1],
        [hip[0] + 3, hip[1]],
        [kx + 2.5, ky - 1],
        [fx + 1.5, fy - 2],
        [fx + 4, fy],
        [fx + 3.5, fy + 1],
        [fx - 2, fy + 1],
        [fx - 2, fy - 2],
        [kx - 2.5, ky + 2],
        [hip[0] - 4, hip[1] + 2]
      ]);
      poly(fold, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
      mark(rear ? fold : edge, [[hip[0] + 2, hip[1] + 1], [kx + 2.5, ky], [fx + 1.5, fy - 2]]);
      mark(edge, [[kx - 1.5, ky], [kx + 0.5, ky + 0.7]], 0.45);
    };
    leg(rearKnee, rearFoot, true);
    const rearShoulder = [7 + lean, 11 + lift];
    let rearElbow = [3 - stride, 15];
    let rearHand = [3 - stride * 1.3, 18];
    let frontElbow = [18 + stride * 0.6, 15];
    let frontHand = [17 + stride, 19];
    if (pose.airborne) {
      rearElbow = [2, 13];
      rearHand = [-1, 11];
      frontElbow = [20, 13];
      frontHand = [18, 9];
    }
    if (pose.dashing) {
      rearElbow = [0, 13];
      rearHand = [-4, 12];
      frontElbow = [11, 16];
      frontHand = [6, 17];
    }
    frontElbow = [frontElbow[0] + (21 - frontElbow[0]) * swing, frontElbow[1] + (11 - frontElbow[1]) * swing];
    frontHand = [frontHand[0] + (23 - frontHand[0]) * swing, frontHand[1] + (7 - frontHand[1]) * swing];
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 2 : -2) * tuck, hy = hand[1] - 3 * tuck;
      poly(ink, [
        [ax - 2, ay - 1],
        [ax + 2, ay],
        [ex + 2, ey - 1],
        [hx + 2, hy - 1],
        [hx + 2, hy + 2],
        [hx - 1, hy + 3],
        [hx - 3, hy],
        [ex - 2, ey + 2],
        [ax - 3, ay + 2]
      ]);
      poly(fold, [[ax - 1, ay + 1], [ex + 1, ey], [hx, hy], [ex - 1, ey + 1]]);
      mark(rear ? fold : edge, [[ax + 1, ay], [ex + 2, ey], [hx + 1, hy]]);
      mark(edge, [[hx - 1, hy], [hx + 1, hy + 1]], 0.6);
    };
    arm(rearShoulder, rearElbow, rearHand, true);
    poly(ink, [[5 + lean, 11 + lift], [11 + lean, 9 + lift], [16 + lean, 12 + lift], [14, 17], [13, 20], [7, 20], [5, 16]]);
    poly(fold, [[6 + lean, 12 + lift], [12 + lean, 11 + lift], [13 + lean, 13], [9, 17], [7, 17]]);
    mark(edge, [[6 + lean, 11 + lift], [10 + lean, 10 + lift], [12 + lean, 10.5 + lift]]);
    mark(edge, [[13, 15], [9, 17], [12, 17.5]], 0.45);
    poly(fold, [[6, 18], [14, 17.5], [14, 19], [6, 20]]);
    poly(ink, [[7, 18.5], [10, 18], [10, 19.5], [8, 20.5]]);
    leg(frontKnee, frontFoot, false);
    arm([14 + lean, 12 + lift], frontElbow, frontHand, false);
    poly(fold, [[3, 19], [15 + lean, 7 + lift], [16 + lean, 8 + lift], [5, 21]]);
    mark(edge, [[4, 19], [14 + lean, 9 + lift]], 0.4);
    poly(ink, shift([
      [5, 4],
      [3, 0],
      [6, 1],
      [5, -3],
      [9, 0],
      [10, -4],
      [12, -1],
      [15, -3],
      [15, 0],
      [19, -2],
      [17, 2],
      [20, 1],
      [17, 5],
      [17, 8],
      [13, 11],
      [9, 10],
      [6, 7]
    ]));
    mark(edge, shift([[5, 0], [6, -2], [9, 1], [10, -3], [12, 0], [15, -2]]), 0.55);
    mark(edge, shift([[19, -1], [17, 2], [19, 2]]), 0.5);
    poly(fold, shift([[7, 5], [11, 6.5], [17, 4], [16, 7], [12, 9], [8, 8]]));
    poly(lime, shift([[8, 5.5], [11.5, 6.8], [11, 8], [9, 7.5]]));
    poly(lime, shift([[13, 6.5], [17, 4.8], [16, 7], [13, 8]]));
    poly(lime, shift([[6, 9], [10, 10.5], [16, 8.5], [14, 11], [9, 12], [5, 10.5]]));
    mark(ink, shift([[8, 10.5], [11, 11], [14, 10]]), 0.65);
  }

  // src/game/rendering/ink-cherry.ts
  function drawInkCherry(ctx2, width, height, pose) {
    const ink = "#141019";
    const fold = "#3a2c42";
    const edge = "#a78bb0";
    const cherry = "#e5304a";
    const deep = "#8e1226";
    const stem = "#5a8f5a";
    const skin = "#f2e2da";
    const sx = width / 22;
    const sy = height / 32;
    const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
    const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
    const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
    const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * 0.35;
    const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * 0.2;
    const poly = (color, points) => {
      ctx2.fillStyle = color;
      ctx2.beginPath();
      points.forEach(([x, y], i) => i ? ctx2.lineTo(x * sx, y * sy) : ctx2.moveTo(x * sx, y * sy));
      ctx2.closePath();
      ctx2.fill();
    };
    const mark = (color, points, weight = 0.55) => {
      ctx2.strokeStyle = color;
      ctx2.lineWidth = weight * Math.min(sx, sy);
      ctx2.beginPath();
      points.forEach(([x, y], i) => i ? ctx2.lineTo(x * sx, y * sy) : ctx2.moveTo(x * sx, y * sy));
      ctx2.stroke();
    };
    const shift = (points, x = lean, y = lift) => points.map(([px, py]) => [px + x, py + y]);
    const reach = pose.dashing ? 17 : pose.airborne ? 12 : 8 + Math.abs(stride) * 1.6;
    const wave = stride * 0.5;
    poly(cherry, shift([[14.5, 4.5], [10, 3.5], [5, 4.5 + wave], [-0.5 - reach, 6 + wave], [3, 6.8], [9, 6.2], [14, 5.6]]));
    poly(deep, shift([[14, 4.9], [9, 4], [4.5, 4.9 + wave], [0, 6 + wave], [3.5, 6.3], [9, 5.7]]));
    poly(cherry, shift([[14, 7.5], [9, 6.8], [4, 8 - wave], [-1 - reach, 10.5 - wave], [2.5, 11.2], [8.5, 9.6], [13.6, 8.8]]));
    poly(deep, shift([[13.6, 7.8], [8.5, 7.2], [4, 8.4 - wave], [-0.5 - reach, 10.3 - wave], [3, 10.4], [8.5, 9.2]]));
    mark(stem, shift([[14.2, 3.9], [15.4, 2.6], [16.2, 1.4]], 0), 0.5);
    mark(stem, shift([[13.6, 7.1], [14.8, 5.9], [15.8, 4.9]], 0), 0.5);
    const hip = [11, 20];
    let rearKnee = [7 - stride * 0.8, 24];
    let rearFoot = [6 - stride * 1.5, 31 - Math.max(0, stride)];
    let frontKnee = [15 + stride * 0.8, 24];
    let frontFoot = [16 + stride * 1.5, 31 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearKnee = [4, 22];
      rearFoot = [0, 27];
      frontKnee = [17, 21];
      frontFoot = [14, 31];
    }
    if (pose.dashing) {
      rearKnee = [2, 24];
      rearFoot = [-2, 29];
      frontKnee = [15, 24];
      frontFoot = [21, 30];
    }
    const leg = (knee, foot, rear) => {
      const [kx, ky] = knee, [fx, fy] = foot;
      poly(ink, [
        [hip[0] - 2.5, hip[1] - 1],
        [hip[0] + 2.5, hip[1]],
        [kx + 2, ky - 1],
        [fx + 1.5, fy - 2],
        [fx + 3.5, fy],
        [fx + 3, fy + 1],
        [fx - 2, fy + 1],
        [fx - 2, fy - 2],
        [kx - 2, ky + 2],
        [hip[0] - 3.5, hip[1] + 2]
      ]);
      poly(fold, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
      mark(rear ? fold : edge, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
      mark(edge, [[fx - 2, fy - 1.5], [fx + 3, fy - 1.5]], 0.5);
    };
    leg(rearKnee, rearFoot, true);
    const rearShoulder = [8 + lean, 15 + lift];
    let rearElbow = [4 - stride, 18];
    let rearHand = [4 - stride * 1.3, 21];
    let frontElbow = [17 + stride * 0.6, 18];
    let frontHand = [16 + stride, 22];
    if (pose.airborne) {
      rearElbow = [3, 16];
      rearHand = [0, 14];
      frontElbow = [19, 16];
      frontHand = [18, 12];
    }
    if (pose.dashing) {
      rearElbow = [1, 16];
      rearHand = [-3, 15];
      frontElbow = [12, 19];
      frontHand = [8, 20];
    }
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
      poly(ink, [
        [ax - 1.8, ay - 1],
        [ax + 1.8, ay],
        [ex + 1.8, ey - 1],
        [hx + 1.5, hy - 1],
        [hx + 1.5, hy + 1.5],
        [hx - 1, hy + 2],
        [hx - 2.5, hy],
        [ex - 1.8, ey + 1.5],
        [ax - 2.5, ay + 1.5]
      ]);
      poly(fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
      mark(rear ? fold : edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
    };
    arm(rearShoulder, rearElbow, rearHand, true);
    const sway = -stride * 0.8;
    const flare = pose.airborne ? 2 : 0;
    poly(cherry, shift([
      [3 - sway - flare, 26 + flare * 0.5],
      [7, 28.2 + flare * 0.4],
      [11, 26.6 + flare * 0.5],
      [15, 28.2 + flare * 0.4],
      [19 + sway + flare, 26 + flare * 0.5],
      [19 + sway + flare, 24.5],
      [3 - sway - flare, 24.5]
    ]));
    poly(ink, shift([
      [7, 19],
      [15, 19],
      [18.5 + sway + flare, 25 + flare * 0.5],
      [15, 26.8 + flare * 0.4],
      [11, 25.2 + flare * 0.5],
      [7, 26.8 + flare * 0.4],
      [3.5 - sway - flare, 25 + flare * 0.5]
    ]));
    mark(edge, shift([[3.5 - sway - flare, 25], [7, 26.6], [11, 25], [15, 26.6], [18.5 + sway + flare, 25]]), 0.45);
    poly(ink, shift([[6.5 + lean, 15 + lift], [15.5 + lean, 15 + lift], [16, 20], [13, 21.5], [9, 21.5], [6, 20]]));
    poly(fold, shift([[7.5 + lean, 16 + lift], [14.5 + lean, 16 + lift], [14.5, 19.5], [7.5, 19.5]]));
    mark(edge, shift([[9, 16.5], [9, 19.5]]), 0.4);
    mark(edge, shift([[13, 16.5], [13, 19.5]]), 0.4);
    mark(edge, shift([[9, 17], [13, 18.5]]), 0.35);
    mark(edge, shift([[9, 18.5], [13, 17]]), 0.35);
    poly(cherry, shift([[10.2, 21.5], [11.2, 21.5], [11.2, 22.5], [10.2, 22.5]]));
    poly(cherry, shift([[11.8, 22], [12.8, 22], [12.8, 23], [11.8, 23]]));
    mark(stem, shift([[10.7, 21.3], [12.3, 21.8]], 0), 0.45);
    leg(frontKnee, frontFoot, false);
    arm([15 + lean, 16 + lift], frontElbow, frontHand, false);
    poly(skin, shift([[7, 6], [11, 4.2], [15, 6], [15.4, 11], [13, 13.8], [9, 13.8], [6.6, 11]]));
    poly(cherry, shift([[5.8, 4.5], [11, 2.2], [16.2, 4.5], [16.2, 7], [14.6, 5.4], [12.6, 7], [10.6, 5.4], [8.6, 7], [6.6, 5.4], [5.8, 7]]));
    poly(deep, shift([[5, 5], [6.6, 6], [6.2, 13], [4.6, 11.5]]));
    poly(cherry, shift([[16.2, 5], [17.6, 6], [17.9, 12], [16.3, 12.6]]));
    poly("#ff5d73", shift([[8.4, 8.4], [11.2, 9.6], [10.8, 10.8], [9.2, 10.2]]));
    poly("#ff5d73", shift([[13, 9.4], [16.2, 8.2], [15.6, 10.6], [13.4, 10.6]]));
    mark(ink, shift([[9, 12.2], [11.5, 12.7], [13.5, 12.2]]), 0.5);
    let parasolHand = [16 + stride * 0.6 + lean, 20 + lift];
    let parasolTip = [21.5, 3.5 + lift * 0.5];
    if (pose.dashing) {
      parasolHand = [8 + lean, 20];
      parasolTip = [2, 15];
    }
    if (pose.airborne) parasolTip = [20.5, 2 + lift];
    parasolHand = [parasolHand[0] + (20 - parasolHand[0]) * swing, parasolHand[1] + (12.5 - parasolHand[1]) * swing];
    parasolTip = [parasolTip[0] + (27 - parasolTip[0]) * swing, parasolTip[1] + (6 - parasolTip[1]) * swing];
    mark(ink, [parasolHand, [(parasolHand[0] + parasolTip[0]) / 2, (parasolHand[1] + parasolTip[1]) / 2 - 0.8], parasolTip], 0.9);
    mark(edge, [[parasolHand[0] + 0.3, parasolHand[1] - 0.3], [parasolTip[0] * 0.5 + parasolHand[0] * 0.5, parasolTip[1] * 0.5 + parasolHand[1] * 0.5 - 1]], 0.3);
    mark(edge, [[parasolHand[0] - 1.2, parasolHand[1] + 2], [parasolHand[0], parasolHand[1] + 0.8]], 0.6);
    const spread = 2.2 + swing * 1.8;
    poly(cherry, [
      [parasolTip[0] - spread, parasolTip[1] + 5],
      [parasolTip[0] - spread * 0.55, parasolTip[1] + 1],
      [parasolTip[0], parasolTip[1] - 0.6],
      [parasolTip[0] + spread * 0.55, parasolTip[1] + 1],
      [parasolTip[0] + spread, parasolTip[1] + 5],
      [parasolTip[0] + spread * 0.5, parasolTip[1] + 3.8],
      [parasolTip[0], parasolTip[1] + 5.4],
      [parasolTip[0] - spread * 0.5, parasolTip[1] + 3.8]
    ]);
    mark(deep, [[parasolTip[0] - spread * 0.9, parasolTip[1] + 4.4], [parasolTip[0], parasolTip[1] + 0.4], [parasolTip[0] + spread * 0.9, parasolTip[1] + 4.4]], 0.45);
    mark(edge, [[parasolTip[0], parasolTip[1] - 0.6], [parasolTip[0], parasolTip[1] + 1.2]], 0.4);
  }

  // src/game/rendering/ink-kit.ts
  function inkPoseTerms(pose) {
    const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
    const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
    const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
    const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * 0.35;
    const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * 0.2;
    return { stride, swing, tuck, lean, lift };
  }
  function makeInkHelpers(ctx2, sx, sy, lean, lift) {
    const poly = (color, points) => {
      ctx2.fillStyle = color;
      ctx2.beginPath();
      points.forEach(([x, y], i) => i ? ctx2.lineTo(x * sx, y * sy) : ctx2.moveTo(x * sx, y * sy));
      ctx2.closePath();
      ctx2.fill();
    };
    const mark = (color, points, weight = 0.55) => {
      ctx2.strokeStyle = color;
      ctx2.lineWidth = weight * Math.min(sx, sy);
      ctx2.beginPath();
      points.forEach(([x, y], i) => i ? ctx2.lineTo(x * sx, y * sy) : ctx2.moveTo(x * sx, y * sy));
      ctx2.stroke();
    };
    const shift = (points, x = lean, y = lift) => points.map(([px, py]) => [px + x, py + y]);
    return { poly, mark, shift };
  }
  function inkMaterials(bodyColor, outlineColor) {
    return {
      ink: "#141019",
      fold: "#3a2c42",
      edge: "#a78bb0",
      accent: bodyColor,
      deep: outlineColor,
      skin: "#f1c9a5"
    };
  }

  // src/game/rendering/ink-roster.ts
  var drawInkTank = (ctx2, width, height, pose, mat) => {
    const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
    const sx = width / 28;
    const sy = height / 36;
    const { poly, mark, shift } = makeInkHelpers(ctx2, sx, sy, lean, lift);
    const steel = "#3a4152";
    const plate = "#525d73";
    const rivet = "#9aa7bd";
    const ember = "#f97316";
    const hip = [14, 24];
    let rearKnee = [8 - stride * 0.8, 29];
    let rearFoot = [6 - stride * 1.4, 35 - Math.max(0, stride)];
    let frontKnee = [20 + stride * 0.8, 29];
    let frontFoot = [22 + stride * 1.4, 35 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearKnee = [4, 26];
      rearFoot = [-1, 31];
      frontKnee = [24, 25];
      frontFoot = [20, 35];
    }
    if (pose.dashing) {
      rearKnee = [2, 29];
      rearFoot = [-3, 33];
      frontKnee = [20, 29];
      frontFoot = [27, 34];
    }
    const leg = (knee, foot, rear) => {
      const [kx, ky] = knee, [fx, fy] = foot;
      poly(mat.ink, [
        [hip[0] - 4.5, hip[1] - 1],
        [hip[0] + 4.5, hip[1]],
        [kx + 3.5, ky - 1],
        [fx + 2.5, fy - 2],
        [fx + 5.5, fy],
        [fx + 5, fy + 1],
        [fx - 2, fy + 1],
        [fx - 2.5, fy - 2],
        [kx - 3.5, ky + 2],
        [hip[0] - 5.5, hip[1] + 2]
      ]);
      poly(steel, [[hip[0] - 1.5, hip[1] + 1], [kx + 1.5, ky], [fx, fy - 2], [kx - 1.5, ky + 1]]);
      mark(rear ? steel : plate, [[hip[0] + 2, hip[1] + 1], [kx + 2.5, ky], [fx + 1.5, fy - 2]]);
      mark(rivet, [[fx - 2.5, fy - 2], [fx + 5, fy - 2]], 0.6);
    };
    leg(rearKnee, rearFoot, true);
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
      poly(mat.ink, [
        [ax - 2.5, ay - 1.5],
        [ax + 2.5, ay],
        [ex + 2.5, ey - 1],
        [hx + 2, hy - 1],
        [hx + 2, hy + 2],
        [hx - 1, hy + 2.5],
        [hx - 3, hy],
        [ex - 2.5, ey + 2],
        [ax - 3, ay + 2]
      ]);
      poly(steel, [[ax - 1, ay + 1], [ex + 1, ey], [hx, hy], [ex - 1, ey + 1]]);
      mark(rear ? steel : rivet, [[ax + 1, ay], [ex + 2, ey], [hx + 1, hy]]);
    };
    arm([9 + lean, 15 + lift], [4 - stride, 20], [4 - stride * 1.3, 24], true);
    poly(mat.ink, shift([[6 + lean, 14 + lift], [22 + lean, 14 + lift], [23, 22], [21, 26], [7, 26], [5, 22]]));
    poly(steel, shift([[8 + lean, 15.5 + lift], [20 + lean, 15.5 + lift], [20.5, 21], [7.5, 21]]));
    mark(plate, shift([[9, 17], [19, 17]]), 0.5);
    mark(plate, shift([[9, 19], [19, 19]]), 0.5);
    mark(rivet, shift([[8, 16], [8, 20]], 0), 0.5);
    mark(rivet, shift([[20, 16], [20, 20]], 0), 0.5);
    poly(mat.ink, shift([[2 + lean, 12 + lift], [11 + lean, 10 + lift], [12 + lean, 15 + lift], [10, 17], [3, 16]]));
    poly(plate, shift([[3.5 + lean, 13 + lift], [10 + lean, 11.5 + lift], [10.5 + lean, 14 + lift], [4.5, 15]]));
    poly(mat.ink, shift([[17 + lean, 10 + lift], [26 + lean, 12 + lift], [25, 16], [18, 15], [16.5 + lean, 12 + lift]]));
    poly(plate, shift([[18.5 + lean, 11.5 + lift], [24.5 + lean, 13 + lift], [23.5, 15], [19, 14]]));
    mark(rivet, shift([[4 + lean, 12.5 + lift], [10 + lean, 11 + lift]], 0), 0.6);
    mark(rivet, shift([[18 + lean, 11 + lift], [25 + lean, 12.5 + lift]], 0), 0.6);
    poly(mat.ink, shift([[9 + lean, 4 + lift], [19 + lean, 4 + lift], [20 + lean, 9 + lift], [17, 13], [11, 13], [8 + lean, 9 + lift]]));
    poly(steel, shift([[10.5 + lean, 5.5 + lift], [17.5 + lean, 5.5 + lift], [18 + lean, 8.5 + lift], [10 + lean, 8.5 + lift]]));
    poly(ember, shift([[11.5, 6.5], [16.5, 6.5], [16.5, 7.8], [14.6, 7.8], [14.4, 9.2], [13.6, 9.2], [13.4, 7.8], [11.5, 7.8]]));
    mark(mat.ink, shift([[12.5, 10.5], [15.5, 10.5]]), 0.6);
    mark(rivet, shift([[14 + lean, 2.5 + lift], [14 + lean, 4 + lift]], 0), 0.8);
    let shieldElbow = [22 + stride * 0.6, 18];
    let shieldHand = [23 + stride, 22];
    if (pose.airborne) {
      shieldElbow = [24, 16];
      shieldHand = [22, 12];
    }
    if (pose.dashing) {
      shieldElbow = [16, 20];
      shieldHand = [11, 22];
    }
    shieldElbow = [shieldElbow[0] + (26 - shieldElbow[0]) * swing, shieldElbow[1] + (13 - shieldElbow[1]) * swing];
    shieldHand = [shieldHand[0] + (29 - shieldHand[0]) * swing, shieldHand[1] + (15 - shieldHand[1]) * swing];
    arm([19 + lean, 15 + lift], shieldElbow, shieldHand, false);
    const shieldTop = shieldHand[1] - 9;
    poly(mat.ink, [
      [shieldHand[0] - 4.5, shieldTop + 2],
      [shieldHand[0] + 4.5, shieldTop],
      [shieldHand[0] + 5.5, shieldHand[1] - 2],
      [shieldHand[0] + 3, shieldHand[1] + 5],
      [shieldHand[0] - 3, shieldHand[1] + 5],
      [shieldHand[0] - 5.5, shieldHand[1] - 2]
    ]);
    poly(plate, [
      [shieldHand[0] - 2.8, shieldTop + 3],
      [shieldHand[0] + 2.8, shieldTop + 2],
      [shieldHand[0] + 3.6, shieldHand[1] - 2],
      [shieldHand[0] - 3.4, shieldHand[1] - 2]
    ]);
    mark(ember, [[shieldHand[0] - 3, shieldHand[1] + 1.5], [shieldHand[0] + 3, shieldHand[1] + 1.5]], 0.8);
    mark(rivet, [[shieldHand[0] - 3, shieldHand[1] - 3.5], [shieldHand[0] + 3, shieldHand[1] - 3.5]], 0.5);
    leg(frontKnee, frontFoot, false);
  };
  var drawInkMage = (ctx2, width, height, pose, mat) => {
    const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
    const sx = width / 22;
    const sy = height / 34;
    const { poly, mark, shift } = makeInkHelpers(ctx2, sx, sy, lean, lift);
    const glow = "#c084fc";
    const rune = "#fde68a";
    const hip = [11, 21];
    let rearFoot = [8 - stride * 1.2, 33 - Math.max(0, stride)];
    let frontFoot = [14 + stride * 1.2, 33 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearFoot = [5, 30];
      frontFoot = [14, 33];
    }
    if (pose.dashing) {
      rearFoot = [3, 31];
      frontFoot = [19, 32];
    }
    const foot = (f) => {
      poly(mat.ink, [[f[0] - 2.5, f[1] - 2], [f[0] + 2.5, f[1] - 2], [f[0] + 3, f[1]], [f[0] + 2, f[1] + 1], [f[0] - 2.5, f[1] + 1]]);
    };
    const sway = -stride * 0.8;
    const flare = pose.airborne ? 2.2 : 0;
    poly(mat.deep, shift([
      [4 - sway - flare, 30 + flare * 0.4],
      [11, 31.6 + flare * 0.3],
      [18 + sway + flare, 30 + flare * 0.4],
      [18 + sway + flare, 27],
      [4 - sway - flare, 27]
    ]));
    poly(mat.ink, shift([
      [7, 19],
      [15, 19],
      [18.5 + sway + flare, 28.5 + flare * 0.4],
      [11, 30.2 + flare * 0.3],
      [3.5 - sway - flare, 28.5 + flare * 0.4]
    ]));
    mark(mat.edge, shift([[3.5 - sway - flare, 28.5 + flare * 0.4], [11, 30], [18.5 + sway + flare, 28.5 + flare * 0.4]]), 0.45);
    mark(glow, shift([[6 - sway - flare, 27.5], [16 + sway + flare, 27.5]]), 0.5);
    poly(mat.ink, shift([[6.5 + lean, 14 + lift], [15.5 + lean, 14 + lift], [16, 20], [11, 21.5], [6, 20]]));
    poly(mat.fold, shift([[7.5 + lean, 15 + lift], [14.5 + lean, 15 + lift], [14.5, 18.5], [7.5, 18.5]]));
    mark(glow, shift([[7.5, 19], [14.5, 19]]), 0.6);
    mark(rune, shift([[11, 16], [11, 18.5]], 0), 0.5);
    const rearShoulder = [8 + lean, 15 + lift];
    let rearElbow = [4 - stride, 18];
    let rearHand = [4 - stride * 1.3, 22];
    let frontElbow = [17 + stride * 0.6, 17];
    let frontHand = [16 + stride, 22];
    if (pose.airborne) {
      rearElbow = [3, 15];
      rearHand = [0, 13];
      frontElbow = [19, 15];
      frontHand = [18, 11];
    }
    if (pose.dashing) {
      rearElbow = [1, 15];
      rearHand = [-3, 14];
      frontElbow = [12, 18];
      frontHand = [8, 20];
    }
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
      poly(mat.ink, [
        [ax - 1.8, ay - 1],
        [ax + 1.8, ay],
        [ex + 1.8, ey - 1],
        [hx + 1.5, hy - 1],
        [hx + 1.5, hy + 1.5],
        [hx - 1, hy + 2],
        [hx - 2.5, hy],
        [ex - 1.8, ey + 1.5],
        [ax - 2.5, ay + 1.5]
      ]);
      poly(mat.fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
      mark(rear ? mat.fold : mat.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
      return [hx, hy];
    };
    arm(rearShoulder, rearElbow, rearHand, true);
    const tipSway = -stride * 0.9 - (pose.dashing ? 3 : 0);
    const tipX = 10.5 + lean + tipSway;
    poly(mat.ink, shift([
      [4 + lean, 7.5 + lift],
      [18 + lean, 7.5 + lift],
      [16.5 + lean, 5.2 + lift],
      [7.5 + lean, 5.2 + lift]
    ]));
    poly(mat.deep, shift([
      [7 + lean, 5.8 + lift],
      [15 + lean, 5.8 + lift],
      [13.5 + lean + tipSway * 0.45, 2.2 + lift],
      [tipX + 1.2, 0.2 + lift],
      [tipX - 0.8, 1.6 + lift],
      [8.8 + lean, 4.4 + lift]
    ]));
    mark(glow, shift([[4 + lean, 7.1 + lift], [18 + lean, 7.1 + lift]]), 0.6);
    const sx4 = tipX + 0.2;
    const sy4 = 0.6 + lift;
    mark(rune, [
      [sx4 - 1.6, sy4 + 0.6],
      [sx4, sy4 - 1.4],
      [sx4 + 1.6, sy4 + 0.6],
      [sx4, sy4 - 0.2],
      [sx4 - 1.6, sy4 + 0.6]
    ], 0.9);
    poly(mat.skin, shift([[8, 8.5], [14.5, 8.5], [15, 13], [11.5, 15.5], [8.5, 13]]));
    mark(mat.ink, shift([[9.5, 11.5], [11, 11.9]], 0), 0.5);
    mark(mat.ink, shift([[12.5, 11.9], [14, 11.5]], 0), 0.5);
    mark(mat.edge, shift([[9.5, 15], [10, 17.5]], 0), 0.5);
    mark(mat.edge, shift([[13, 15], [12.6, 17.5]], 0), 0.5);
    foot(rearFoot);
    foot(frontFoot);
    let staffHand = [16 + stride * 0.6 + lean, 21 + lift];
    let orb = [18.5, 3.5 + lift * 0.5];
    if (pose.dashing) {
      orb = [8, 6];
      staffHand = [9 + lean, 20];
    }
    if (pose.airborne) orb = [18, 2.5 + lift];
    staffHand = [staffHand[0] + (19 - staffHand[0]) * swing, staffHand[1] + (13 - staffHand[1]) * swing];
    orb = [orb[0] + (24 - orb[0]) * swing, orb[1] + (8 - orb[1]) * swing];
    frontElbow = [frontElbow[0] + (18 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
    const frontHandPt = arm([15 + lean, 15 + lift], frontElbow, frontHand, false);
    mark(mat.ink, [staffHand, [(staffHand[0] + orb[0]) / 2, (staffHand[1] + orb[1]) / 2], orb], 0.8);
    poly(glow, [[orb[0] - 2.2, orb[1]], [orb[0], orb[1] - 2.2], [orb[0] + 2.2, orb[1]], [orb[0], orb[1] + 2.2]]);
    poly(rune, [[orb[0] - 0.9, orb[1]], [orb[0], orb[1] - 0.9], [orb[0] + 0.9, orb[1]], [orb[0], orb[1] + 0.9]]);
    mark(glow, [[orb[0] - 3.4, orb[1]], [orb[0] + 3.4, orb[1]]], 0.4);
    void frontHandPt;
  };
  var drawInkRanger = (ctx2, width, height, pose, mat) => {
    const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
    const sx = width / 22;
    const sy = height / 32;
    const { poly, mark, shift } = makeInkHelpers(ctx2, sx, sy, lean, lift);
    const leaf = "#4ade80";
    const hide = "#8a6a45";
    const reach = pose.dashing ? 14 : pose.airborne ? 10 : 7 + Math.abs(stride) * 1.6;
    const wave = stride * 0.5;
    poly(mat.ink, shift([[14, 12], [8, 9], [1 - reach, 8 + wave], [-2 - reach, 12 + wave], [1, 16], [7, 18], [13, 17]]));
    poly(mat.deep, shift([[13.5, 11.5], [8.5, 9.5], [2 - reach, 9 + wave], [-1 - reach, 11.5 + wave], [2, 14.5], [8, 15.5]]));
    const hip = [11, 20];
    let rearKnee = [7 - stride * 0.8, 24];
    let rearFoot = [6 - stride * 1.5, 31 - Math.max(0, stride)];
    let frontKnee = [15 + stride * 0.8, 24];
    let frontFoot = [16 + stride * 1.5, 31 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearKnee = [4, 22];
      rearFoot = [0, 27];
      frontKnee = [17, 21];
      frontFoot = [14, 31];
    }
    if (pose.dashing) {
      rearKnee = [2, 24];
      rearFoot = [-2, 29];
      frontKnee = [15, 24];
      frontFoot = [21, 30];
    }
    const leg = (knee, foot, rear) => {
      const [kx, ky] = knee, [fx, fy] = foot;
      poly(mat.ink, [
        [hip[0] - 2.5, hip[1] - 1],
        [hip[0] + 2.5, hip[1]],
        [kx + 2, ky - 1],
        [fx + 1.5, fy - 2],
        [fx + 3.5, fy],
        [fx + 3, fy + 1],
        [fx - 2, fy + 1],
        [fx - 2, fy - 2],
        [kx - 2, ky + 2],
        [hip[0] - 3.5, hip[1] + 2]
      ]);
      poly(hide, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
      mark(rear ? mat.fold : mat.edge, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
      mark(mat.ink, [[fx - 2, fy - 1.5], [fx + 3, fy - 1.5]], 0.6);
    };
    leg(rearKnee, rearFoot, true);
    poly(mat.fold, shift([[5 + lean, 11 + lift], [9 + lean, 10 + lift], [7.5, 19], [3.5, 18]]));
    mark(hide, shift([[4 + lean, 12 + lift], [7 + lean, 11.2 + lift]], 0), 0.6);
    mark(leaf, shift([[3.5, 10.5], [4.5, 8.5], [5.5, 10]], 0), 0.6);
    mark(leaf, shift([[5.5, 10], [6.5, 8], [7.5, 9.6]], 0), 0.6);
    mark(leaf, shift([[7.5, 9.8], [8.5, 7.8], [9.2, 9.4]], 0), 0.6);
    poly(mat.ink, shift([[6.5 + lean, 13 + lift], [15.5 + lean, 13 + lift], [16, 20], [13, 21.5], [9, 21.5], [6, 20]]));
    poly(mat.deep, shift([[7.5 + lean, 14 + lift], [14.5 + lean, 14 + lift], [14.5, 18.5], [7.5, 18.5]]));
    mark(hide, shift([[6.8, 19], [15.2, 19]]), 0.7);
    const rearShoulder = [8 + lean, 14 + lift];
    let rearElbow = [4 - stride, 17];
    let rearHand = [4 - stride * 1.3, 21];
    let frontElbow = [17 + stride * 0.6, 17];
    let frontHand = [16 + stride, 21];
    if (pose.airborne) {
      rearElbow = [3, 13];
      rearHand = [0, 11];
      frontElbow = [19, 13];
      frontHand = [18, 9];
    }
    if (pose.dashing) {
      rearElbow = [1, 13];
      rearHand = [-3, 12];
      frontElbow = [12, 17];
      frontHand = [8, 19];
    }
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
      poly(mat.ink, [
        [ax - 1.8, ay - 1],
        [ax + 1.8, ay],
        [ex + 1.8, ey - 1],
        [hx + 1.5, hy - 1],
        [hx + 1.5, hy + 1.5],
        [hx - 1, hy + 2],
        [hx - 2.5, hy],
        [ex - 1.8, ey + 1.5],
        [ax - 2.5, ay + 1.5]
      ]);
      poly(hide, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
      mark(rear ? mat.fold : mat.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
      return [hx, hy];
    };
    arm(rearShoulder, rearElbow, rearHand, true);
    poly(mat.deep, shift([[4, 12], [3, 6], [9, 1.5], [14.5, 1.5], [17.5, 5], [17, 11], [12, 14], [7, 14]]));
    poly(mat.ink, shift([[6.8, 6.5], [11.5, 4.8], [15.6, 6.5], [15.6, 11.5], [11, 13], [7, 11]]));
    poly(mat.ink, shift([[17, 4.5], [19.5, 6], [18.6, 11], [16.6, 9.5]]));
    mark(mat.ink, shift([[14.5 + lean, 1.5 + lift], [17 + lean + (pose.dashing ? 2 : 0), 0.5 + lift]], 0), 0.8);
    poly(leaf, shift([[8.6, 8.2], [11.2, 9.2], [10.8, 10.4], [9, 9.8]]));
    poly(leaf, shift([[12.6, 9.2], [15.2, 8.2], [14.6, 10.2], [13, 10.2]]));
    let bowHand = [16 + stride * 0.6 + lean, 20 + lift];
    let bowTip = [19.5, 26];
    if (pose.dashing) {
      bowHand = [8 + lean, 19];
      bowTip = [2, 24];
    }
    if (pose.airborne) bowTip = [20, 24];
    bowHand = [bowHand[0] + (20 - bowHand[0]) * swing, bowHand[1] + (14 - bowHand[1]) * swing];
    bowTip = [bowTip[0] + (25 - bowTip[0]) * swing, bowTip[1] + (5 - bowTip[1]) * swing];
    frontElbow = [frontElbow[0] + (19 - frontElbow[0]) * swing, frontElbow[1] + (13 - frontElbow[1]) * swing];
    frontHand = [frontHand[0] + (bowHand[0] - frontHand[0]) * swing, frontHand[1] + (bowHand[1] - frontHand[1]) * swing];
    arm([15 + lean, 14 + lift], frontElbow, frontHand, false);
    mark(hide, [bowHand, [(bowHand[0] + bowTip[0]) / 2 + 2.5, (bowHand[1] + bowTip[1]) / 2], bowTip], 0.9);
    mark(mat.ink, [bowHand, bowTip], 0.35);
    mark(leaf, [[bowTip[0] - 1, bowTip[1] - 1], [bowTip[0] + 1, bowTip[1]]], 0.5);
    leg(frontKnee, frontFoot, false);
  };
  var drawInkCyborg = (ctx2, width, height, pose, mat) => {
    const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
    const sx = width / 24;
    const sy = height / 33;
    const { poly, mark, shift } = makeInkHelpers(ctx2, sx, sy, lean, lift);
    const cyan = "#22d3ee";
    const chrome = "#64748b";
    const panel = "#94a3b8";
    const hip = [12, 21];
    let rearKnee = [8 - stride * 0.8, 25];
    let rearFoot = [7 - stride * 1.5, 32 - Math.max(0, stride)];
    let frontKnee = [16 + stride * 0.8, 25];
    let frontFoot = [17 + stride * 1.5, 32 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearKnee = [5, 23];
      rearFoot = [1, 28];
      frontKnee = [18, 22];
      frontFoot = [15, 32];
    }
    if (pose.dashing) {
      rearKnee = [3, 25];
      rearFoot = [-1, 30];
      frontKnee = [16, 25];
      frontFoot = [22, 31];
    }
    const jet = (foot, lit2) => {
      poly(mat.ink, [[foot[0] - 1, foot[1] - 4], [foot[0] + 3, foot[1] - 4], [foot[0] + 2, foot[1] - 2.5], [foot[0], foot[1] - 2.5]]);
      if (lit2) {
        poly(cyan, [[foot[0] + 0.2, foot[1] - 2.5], [foot[0] + 1.8, foot[1] - 2.5], [foot[0] + 1, foot[1] + 1.5]]);
      }
    };
    const lit = pose.dashing || pose.airborne;
    const leg = (knee, foot, rear) => {
      const [kx, ky] = knee, [fx, fy] = foot;
      poly(mat.ink, [
        [hip[0] - 2.8, hip[1] - 1],
        [hip[0] + 2.8, hip[1]],
        [kx + 2.2, ky - 1],
        [fx + 1.5, fy - 2],
        [fx + 3.5, fy],
        [fx + 3, fy + 1],
        [fx - 2, fy + 1],
        [fx - 2, fy - 2],
        [kx - 2.2, ky + 2],
        [hip[0] - 3.8, hip[1] + 2]
      ]);
      poly(chrome, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
      mark(rear ? mat.fold : panel, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
      mark(cyan, [[kx - 1.5, ky + 0.5], [kx + 1.5, ky + 1.2]], 0.5);
      jet(foot, lit && !rear);
    };
    leg(rearKnee, rearFoot, true);
    const rearShoulder = [8 + lean, 15 + lift];
    let rearElbow = [4 - stride, 18];
    let rearHand = [4 - stride * 1.3, 22];
    let frontElbow = [18 + stride * 0.6, 18];
    let frontHand = [17 + stride, 22];
    if (pose.airborne) {
      rearElbow = [3, 16];
      rearHand = [0, 14];
      frontElbow = [20, 16];
      frontHand = [19, 12];
    }
    if (pose.dashing) {
      rearElbow = [1, 16];
      rearHand = [-3, 15];
      frontElbow = [13, 19];
      frontHand = [9, 20];
    }
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
      if (rear) {
        poly(mat.ink, [
          [ax - 1.8, ay - 1],
          [ax + 1.8, ay],
          [ex + 1.8, ey - 1],
          [hx + 1.5, hy - 1],
          [hx + 1.5, hy + 1.5],
          [hx - 1, hy + 2],
          [hx - 2.5, hy],
          [ex - 1.8, ey + 1.5],
          [ax - 2.5, ay + 1.5]
        ]);
        poly(mat.fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
        mark(mat.fold, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
      } else {
        poly(mat.ink, [
          [ax - 2.2, ay - 1.5],
          [ax + 2.2, ay],
          [ex + 2.2, ey - 1.5],
          [hx + 2, hy - 1],
          [hx + 2, hy + 2],
          [hx - 1, hy + 2.5],
          [hx - 3, hy],
          [ex - 2.2, ey + 2],
          [ax - 3, ay + 2]
        ]);
        poly(chrome, [[ax - 0.8, ay + 0.5], [ax + 1.2, ay + 0.5], [ex + 1, ey], [ex - 1.4, ey + 1]]);
        poly(panel, [[ex - 1, ey + 0.6], [ex + 1.4, ey - 0.2], [hx, hy], [ex - 2, ey + 1.6]]);
        poly(cyan, [[ex - 1.2, ey - 0.4], [ex + 0.8, ey - 0.8], [ex + 0.8, ey + 0.8], [ex - 1.2, ey + 0.8]]);
        mark(mat.ink, [[hx - 1, hy - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1], [hx - 1, hy + 1]], 0.5);
      }
    };
    arm(rearShoulder, rearElbow, rearHand, true);
    poly(mat.ink, shift([[5.5 + lean, 14 + lift], [18.5 + lean, 14 + lift], [19, 22], [16, 24], [8, 24], [5, 22]]));
    poly(chrome, shift([[7 + lean, 15 + lift], [17 + lean, 15 + lift], [17.5, 20.5], [6.5, 20.5]]));
    mark(mat.ink, shift([[7, 18], [17, 18]]), 0.6);
    mark(mat.ink, shift([[7, 20], [17, 20]]), 0.6);
    poly(cyan, shift([[10.4, 16], [13.6, 16], [13.6, 17.4], [10.4, 17.4]]));
    mark(cyan, shift([[12, 17.4], [12, 19.6]], 0), 0.7);
    poly(mat.ink, shift([[15.5 + lean, 12.5 + lift], [21.5 + lean, 14 + lift], [20.5, 17], [15.5, 16]]));
    poly(panel, shift([[16.5 + lean, 13.5 + lift], [20 + lean, 14.5 + lift], [19.2, 15.8], [16.5, 15]]));
    poly(mat.ink, shift([[7 + lean, 4 + lift], [17 + lean, 4 + lift], [18 + lean, 10 + lift], [16, 14], [8, 14], [6 + lean, 10 + lift]]));
    poly(chrome, shift([[8 + lean, 5 + lift], [16 + lean, 5 + lift], [16.8, 9 + lift], [7.2, 9 + lift]]));
    poly(mat.ink, shift([[7.5 + lean, 6.5 + lift], [16.5 + lean, 6.5 + lift], [16.5 + lean, 8.8 + lift], [7.5 + lean, 8.8 + lift]]));
    poly(cyan, shift([[12.4, 7.1], [15.6, 7.1], [15.6, 8.2], [12.4, 8.2]]));
    mark(mat.ink, shift([[14 + lean, 1.8 + lift], [14 + lean, 4 + lift]], 0), 0.8);
    poly(mat.fold, shift([[9.5, 12], [14.5, 12], [14, 14], [10, 14]]));
    frontElbow = [frontElbow[0] + (22 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
    frontHand = [frontHand[0] + (27 - frontHand[0]) * swing, frontHand[1] + (12 - frontHand[1]) * swing];
    arm([16 + lean, 15 + lift], frontElbow, frontHand, false);
    if (swing > 0.3) {
      const hx = frontHand[0] - tuck * 1.5 + 2, hy = frontHand[1] - tuck * 2.5;
      poly(cyan, [[hx + 0.5, hy - 2.2], [hx + 2.6 + swing * 2, hy], [hx + 0.5, hy + 2.2]]);
    }
    leg(frontKnee, frontFoot, false);
  };
  var drawInkSpirit = (ctx2, width, height, pose, mat) => {
    const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
    const sx = width / 21;
    const sy = height / 33;
    const { poly, mark, shift } = makeInkHelpers(ctx2, sx, sy, lean, lift);
    const veil = "#ede9fe";
    const glow = "#a78bfa";
    const float = lift - 1.5;
    const tailSway = -stride * 1.6;
    const tailReach = pose.dashing ? 9 : pose.airborne ? 5 : 2 + Math.abs(stride) * 0.8;
    ctx2.globalAlpha = 0.62;
    poly(glow, shift([
      [6.5, 21 + float],
      [14.5, 21 + float],
      [13.5 + tailSway, 26 + float],
      [16 + tailSway + tailReach, 29.5 + float],
      [11 + tailSway * 0.6, 28 + float],
      [10.5, 32.5 + float],
      [7.5, 28.5 + float],
      [3 - tailReach, 30 + float],
      [7.5, 25 + float]
    ]));
    ctx2.globalAlpha = 0.85;
    poly(veil, shift([
      [8, 21 + float],
      [13, 21 + float],
      [12.2 + tailSway * 0.7, 25.5 + float],
      [14 + tailSway * 0.8 + tailReach * 0.6, 28.5 + float],
      [10.5, 27.5 + float],
      [10, 31 + float],
      [8, 27.5 + float],
      [5.5 - tailReach * 0.6, 28.5 + float],
      [7.8, 24 + float]
    ]));
    ctx2.globalAlpha = 1;
    poly(mat.ink, shift([[6 + lean, 13 + float], [15 + lean, 13 + float], [15.8, 20], [11, 21.8], [6.2, 20]]));
    poly("#ddd6fe", shift([[7.5 + lean, 14 + float], [13.5 + lean, 14 + float], [14, 18.5], [7, 18.5]]));
    mark(glow, shift([[7.2, 18.8], [13.8, 18.8]]), 0.5);
    const sleeve = (shoulder, cuff) => {
      poly(mat.ink, [
        [shoulder[0] - 1.8, shoulder[1] - 1],
        [shoulder[0] + 1.8, shoulder[1]],
        [cuff[0] + 1.6, cuff[1] - 1.5],
        [cuff[0] + 1.6, cuff[1] + 2],
        [cuff[0] - 2, cuff[1] + 2.2],
        [cuff[0] - 2.2, cuff[1] - 0.8]
      ]);
      poly(veil, [[shoulder[0] - 0.8, shoulder[1]], [shoulder[0] + 1, shoulder[1] + 0.4], [cuff[0], cuff[1] + 0.8], [cuff[0] - 1.4, cuff[1]]]);
      mark(glow, [[cuff[0] - 1.8, cuff[1] + 2], [cuff[0] + 1.4, cuff[1] + 2]], 0.5);
    };
    const rearCuff = [3.5 - stride + lean, 18 + float];
    let frontCuff = [17.5 + stride * 0.6 + lean, 18 + float];
    if (pose.airborne) {
      rearCuff[1] -= 3;
      frontCuff[0] += 1.5;
      frontCuff[1] -= 4;
    }
    if (pose.dashing) {
      rearCuff[0] -= 3;
      frontCuff[0] -= 6;
      frontCuff[1] += 1;
    }
    const pushX = swing * 5;
    frontCuff = [frontCuff[0] + pushX, frontCuff[1] - swing * 2.5];
    sleeve([7.5 + lean, 15 + float], rearCuff);
    sleeve([13.5 + lean, 15 + float], frontCuff);
    if (swing > 0.25) {
      ctx2.globalAlpha = 0.5 + swing * 0.4;
      poly(glow, [
        [frontCuff[0] + 2.5, frontCuff[1] - 1],
        [frontCuff[0] + 6 + swing * 3, frontCuff[1] - 2.5],
        [frontCuff[0] + 6 + swing * 3, frontCuff[1] + 1.5],
        [frontCuff[0] + 2.5, frontCuff[1] + 1.5]
      ]);
      ctx2.globalAlpha = 1;
    }
    poly(veil, shift([[5.5, 11], [5, 5], [10.5, 1.5], [16, 5], [15.5, 11], [10.5, 14]]));
    poly(mat.ink, shift([[7.2, 6.5], [10.5, 4.8], [13.8, 6.5], [13.8, 11], [10.5, 12.6]]));
    poly(glow, shift([[9.6, 8.2], [11.8, 7.6], [12.6, 8.6], [11.2, 9.4]]));
    mark(veil, shift([[5.5, 10.8], [10.5, 13.8], [15.5, 10.8]], 0), 0.6);
    const orbit = stride * 1.2 + (pose.dashing ? 2.5 : 0);
    const wisp = (x, y, color, r) => {
      poly(color, [[x - r, y], [x, y - r], [x + r, y], [x, y + r]]);
    };
    ctx2.globalAlpha = 0.85;
    wisp(10.5 + Math.cos(orbit) * 12, 14 + Math.sin(orbit) * 5, glow, 1.4);
    wisp(10.5 + Math.cos(orbit + Math.PI) * 13, 18 + Math.sin(orbit + Math.PI) * 6, veil, 1.1);
    ctx2.globalAlpha = 1;
  };
  var drawInkHealer = (ctx2, width, height, pose, mat) => {
    const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
    const sx = width / 23;
    const sy = height / 33;
    const { poly, mark, shift } = makeInkHelpers(ctx2, sx, sy, lean, lift);
    const mint = "#5eead4";
    const cloth = "#f1f5f9";
    const hide = "#8a6a45";
    const hip = [11.5, 21];
    let rearFoot = [8.5 - stride * 1.3, 32 - Math.max(0, stride)];
    let frontFoot = [14.5 + stride * 1.3, 32 - Math.max(0, -stride)];
    if (pose.airborne) {
      rearFoot = [5, 29];
      frontFoot = [15, 32];
    }
    if (pose.dashing) {
      rearFoot = [3, 30];
      frontFoot = [20, 31];
    }
    const foot = (f) => {
      poly(mat.ink, [[f[0] - 2.5, f[1] - 2], [f[0] + 2.5, f[1] - 2], [f[0] + 3, f[1]], [f[0] + 2, f[1] + 1], [f[0] - 2.5, f[1] + 1]]);
    };
    const sway = -stride * 0.6;
    const flare = pose.airborne ? 1.8 : 0;
    poly(mat.ink, shift([
      [5 - sway - flare, 29 + flare * 0.4],
      [11.5, 30.6 + flare * 0.3],
      [18 + sway + flare, 29 + flare * 0.4],
      [18 + sway + flare, 26],
      [5 - sway - flare, 26]
    ]));
    poly(cloth, shift([
      [6, 20],
      [17, 20],
      [17.8 + sway + flare, 27.8 + flare * 0.4],
      [11.5, 29.4 + flare * 0.3],
      [5.2 - sway - flare, 27.8 + flare * 0.4]
    ]));
    mark(mint, shift([[5.4 - sway - flare, 27.2], [17.6 + sway + flare, 27.2]]), 0.5);
    poly(mat.ink, shift([[6.5 + lean, 14 + lift], [16.5 + lean, 14 + lift], [17, 21], [11.5, 22.5], [6, 21]]));
    poly(cloth, shift([[7.5 + lean, 15 + lift], [15.5 + lean, 15 + lift], [15.5, 19.5], [7.5, 19.5]]));
    mark(mint, shift([[7, 19.8], [16, 19.8]]), 0.7);
    mark(hide, shift([[8 + lean, 15 + lift], [15, 21]], 0), 0.9);
    poly(hide, shift([[13.6, 20.6], [16.2, 20.6], [16, 23], [13.8, 23]]));
    poly(mint, shift([[11, 15.6], [12.2, 15.6], [12.2, 16.6], [13.2, 16.6], [13.2, 17.8], [12.2, 17.8], [12.2, 18.8], [11, 18.8], [11, 17.8], [10, 17.8], [10, 16.6], [11, 16.6]]));
    const rearShoulder = [8 + lean, 15 + lift];
    let rearElbow = [4 - stride, 18];
    let rearHand = [4 - stride * 1.3, 21];
    let frontElbow = [18 + stride * 0.6, 18];
    let frontHand = [17 + stride, 22];
    if (pose.airborne) {
      rearElbow = [3, 15];
      rearHand = [0, 13];
      frontElbow = [20, 15];
      frontHand = [19, 11];
    }
    if (pose.dashing) {
      rearElbow = [1, 15];
      rearHand = [-3, 14];
      frontElbow = [13, 19];
      frontHand = [9, 21];
    }
    const arm = (shoulder, elbow, hand, rear) => {
      const [ax, ay] = shoulder, [ex, ey] = elbow;
      const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
      poly(mat.ink, [
        [ax - 2.2, ay - 1],
        [ax + 2.2, ay],
        [ex + 2.2, ey - 1],
        [hx + 1.8, hy - 1],
        [hx + 1.8, hy + 2],
        [hx - 1, hy + 2.2],
        [hx - 3, hy],
        [ex - 2.2, ey + 1.8],
        [ax - 2.8, ay + 1.8]
      ]);
      poly(cloth, [[ax - 1, ay + 0.8], [ex + 1, ey], [hx, hy], [ex - 1, ey + 1]]);
      mark(rear ? mat.fold : mint, [[ax + 1, ay], [ex + 2, ey], [hx + 1, hy]], 0.5);
      return [hx, hy];
    };
    arm(rearShoulder, rearElbow, rearHand, true);
    poly(mat.skin, shift([[7.5, 6.5], [12, 4.8], [16, 6.5], [16.2, 11], [13.5, 14], [9.5, 14], [7.2, 11]]));
    poly(mat.ink, shift([[6.8, 5.5], [12, 3.2], [16.8, 5.5], [17.2, 8], [15.4, 6.8], [12, 5.6], [8.6, 6.8], [6.6, 8]]));
    poly(mat.deep, shift([[16.2, 4.5], [18.2, 5], [18, 8], [16.4, 7.4]]));
    poly(mat.deep, shift([[8.6, 2.6], [11, 1.4], [13, 2.4], [12, 4], [9.4, 4]]));
    mark(mint, shift([[10.2, 1.8], [12.2, 2.8]], 0), 0.5);
    mark(mat.ink, shift([[9.2, 9.8], [10.8, 10.2]], 0), 0.5);
    mark(mat.ink, shift([[13, 10.2], [14.6, 9.8]], 0), 0.5);
    mark(mat.deep, shift([[10.8, 12.2], [13, 12.2]], 0), 0.5);
    foot(rearFoot);
    foot(frontFoot);
    let staffHand = [18 + stride * 0.6 + lean, 21 + lift];
    let lantern = [20.5, 5.5 + lift * 0.5];
    if (pose.dashing) {
      lantern = [9, 8];
      staffHand = [10 + lean, 20];
    }
    if (pose.airborne) lantern = [20, 4.5 + lift];
    staffHand = [staffHand[0] + (21 - staffHand[0]) * swing, staffHand[1] + (14 - staffHand[1]) * swing];
    lantern = [lantern[0] + (26 - lantern[0]) * swing, lantern[1] + (10 - lantern[1]) * swing];
    frontElbow = [frontElbow[0] + (20 - frontElbow[0]) * swing, frontElbow[1] + (15 - frontElbow[1]) * swing];
    arm([16 + lean, 15 + lift], frontElbow, frontHand, false);
    mark(mat.ink, [staffHand, [(staffHand[0] + lantern[0]) / 2, (staffHand[1] + lantern[1]) / 2], lantern], 0.9);
    mark(mint, [[staffHand[0] + 0.4, staffHand[1] - 0.4], [(staffHand[0] + lantern[0]) / 2 + 0.5, (staffHand[1] + lantern[1]) / 2 - 0.5]], 0.3);
    poly(mat.ink, [
      [lantern[0] - 2.4, lantern[1] - 2],
      [lantern[0] + 2.4, lantern[1] - 2],
      [lantern[0] + 3, lantern[1] + 3.4],
      [lantern[0] - 3, lantern[1] + 3.4]
    ]);
    poly(mint, [
      [lantern[0] - 1.5, lantern[1] - 1],
      [lantern[0] + 1.5, lantern[1] - 1],
      [lantern[0] + 2.1, lantern[1] + 2.8],
      [lantern[0] - 2.1, lantern[1] + 2.8]
    ]);
    mark(mat.ink, [[lantern[0] - 1.2, lantern[1] - 2], [lantern[0] + 1.2, lantern[1] - 2]], 0.8);
    mark(mat.ink, [[lantern[0], lantern[1] - 2], [lantern[0], lantern[1] - 3]], 0.6);
    foot(rearFoot);
    foot(frontFoot);
  };

  // src/game/rendering/character-art.ts
  function resolveTumbleRotation(facingRight, pose) {
    const clamped = Math.max(0, Math.min(1, pose));
    const magnitude = Math.pow(clamped, 1.6) * Math.PI;
    return magnitude === 0 ? 0 : magnitude * (facingRight >= 0 ? 1 : -1);
  }
  function resolveTumbleArms(pose) {
    const clamped = Math.max(0, Math.min(1, pose));
    const lift = Math.round(Math.sin(clamped * Math.PI) * 3);
    const inward = Math.round(Math.sin(clamped * Math.PI) * 2);
    return {
      frontArmDx: 0 - inward,
      frontArmDy: 0 - lift,
      rearArmDx: inward,
      rearArmDy: 0 - Math.round(lift * 0.67)
    };
  }
  function characterLegAnchorY(height) {
    return Math.max(10, height - 25) + 14;
  }
  var ARM_BASE_Y = 17;
  function resolveArmPose(width, height, pose = {}) {
    const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
    const armLen = Math.min(10, Math.max(10, height - 25));
    let rearX = 0;
    let frontX = width - 4;
    let rearY = ARM_BASE_Y;
    let frontY = ARM_BASE_Y;
    let rearH = armLen;
    let frontH = armLen;
    rearY -= stride;
    frontY += stride;
    if (pose.airborne) {
      rearY -= 1;
      frontY -= 3;
      frontH -= 3;
      rearH -= 1;
    } else if (pose.dashing) {
      rearX -= 3;
      frontX -= 5;
      rearH -= 2;
      frontH -= 2;
    }
    if (pose.melee && pose.melee > 0) {
      const swing = Math.sin(Math.min(1, pose.melee) * Math.PI);
      frontY -= Math.round(swing * 4);
      frontH -= Math.round(swing * 2);
    }
    rearY = Math.max(15, rearY);
    frontY = Math.max(15, frontY);
    rearH = Math.max(3, Math.min(armLen, rearH));
    frontH = Math.max(3, Math.min(armLen, frontH));
    return { rearArmX: rearX, rearArmY: rearY, rearArmH: rearH, frontArmX: frontX, frontArmY: frontY, frontArmH: frontH };
  }
  function resolveHeadPose(_width, pose = {}) {
    let offsetX = 0;
    let offsetY = 0;
    if (pose.airborne) {
      offsetX = 1;
      offsetY = -1;
    } else if (pose.dashing) {
      offsetX = 1;
      offsetY = 1;
    } else {
      if (Math.abs(pose.stride ?? 0) > 1.2) offsetY = 1;
      if (pose.melee && pose.melee > 0.1) offsetX = 1;
    }
    return { offsetX, offsetY };
  }
  function resolveLegPose(width, height, pose = {}) {
    const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
    const anchor = characterLegAnchorY(height);
    const baseLen = height - anchor - 2;
    if (pose.airborne) {
      const rearLegY = anchor - 2;
      const rearLegH = baseLen - 6;
      const frontLegY = anchor;
      const frontLegH = baseLen + 5;
      return {
        rearLegX: 5,
        rearLegY,
        rearLegH,
        frontLegX: width - 10,
        frontLegY,
        frontLegH,
        rearBootX: 3,
        rearBootY: rearLegY + rearLegH,
        frontBootX: width - 11,
        frontBootY: frontLegY + frontLegH - 1,
        airborne: true
      };
    }
    return {
      rearLegX: 5,
      rearLegY: anchor,
      rearLegH: baseLen + stride,
      frontLegX: width - 10,
      frontLegY: anchor,
      frontLegH: baseLen - stride,
      rearBootX: 3,
      rearBootY: height - 3 + Math.max(0, stride),
      frontBootX: width - 11,
      frontBootY: height - 3 + Math.max(0, -stride),
      airborne: false
    };
  }
  function rect(ctx2, color, x, y, width, height) {
    ctx2.fillStyle = color;
    ctx2.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }
  function shade(hex, amount) {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return hex;
    const clamp = (value) => Math.max(0, Math.min(255, value));
    const channel = (start) => clamp(parseInt(clean.slice(start, start + 2), 16) + amount).toString(16).padStart(2, "0");
    return `#${channel(0)}${channel(2)}${channel(4)}`;
  }
  function drawSword(ctx2, x, y) {
    rect(ctx2, "#f8fafc", x, y, 2, 11);
    rect(ctx2, "#94a3b8", x + 2, y + 1, 1, 9);
    rect(ctx2, "#fbbf24", x - 2, y + 9, 6, 2);
    rect(ctx2, "#78350f", x, y + 11, 2, 5);
  }
  function drawBow(ctx2, x, y) {
    ctx2.strokeStyle = "#d97706";
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.arc(x, y, 8, -Math.PI / 2, Math.PI / 2);
    ctx2.stroke();
    ctx2.strokeStyle = "#fef3c7";
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(x, y - 8);
    ctx2.lineTo(x, y + 8);
    ctx2.stroke();
  }
  function drawInkKnight(ctx2, w, h, pose) {
    const legs = resolveLegPose(w, h, pose);
    const arms = resolveArmPose(w, h, pose);
    const head = resolveHeadPose(w, pose);
    const hip = characterLegAnchorY(h);
    const poly = (fill, points, rim = "#b885d7") => {
      ctx2.fillStyle = fill;
      ctx2.strokeStyle = rim;
      ctx2.lineWidth = 0.8;
      ctx2.beginPath();
      points.forEach(([x, y], i) => i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y));
      ctx2.closePath();
      ctx2.fill();
      ctx2.stroke();
    };
    const reach = pose.dashing ? 35 : pose.airborne ? 23 : 14;
    const flutter = pose.stride ?? 0;
    poly("#754294", [[6, 12], [-reach, 14 + flutter], [-reach + 8, 20], [-reach - 3, 28 - flutter], [3, h - 1], [9, 20]], "#09080f");
    for (const [x, y, len, bx, by] of [
      [legs.rearLegX, legs.rearLegY, legs.rearLegH, legs.rearBootX, legs.rearBootY],
      [legs.frontLegX, legs.frontLegY, legs.frontLegH, legs.frontBootX, legs.frontBootY]
    ]) poly("#09080f", [[x, y], [x + 5, y], [x + 5, y + len], [bx + 8, by], [bx + 8, by + 3], [bx, by + 3], [x, y + len]]);
    poly("#09080f", [[3, 15], [w / 2, 12], [w - 3, 15], [w - 4, hip], [w / 2, hip + 2], [4, hip]]);
    poly("#44205f", [[5, 16], [w / 2, 15], [w - 5, 17], [w / 2, hip - 2], [5, hip - 3]], "#44205f");
    for (const [x, y, len] of [[arms.rearArmX, arms.rearArmY, arms.rearArmH], [arms.frontArmX, arms.frontArmY, arms.frontArmH]])
      poly("#09080f", [[x - 1, y], [x + 4, y - 1], [x + 6, y + 4], [x + 3, y + len], [x, y + len]]);
    const hx = head.offsetX;
    const hy = head.offsetY;
    poly("#09080f", [[3 + hx, 4 + hy], [w / 2 + hx, 1 + hy], [w - 3 + hx, 5 + hy], [w - 4 + hx, 14 + hy], [w / 2 + hx, 17 + hy], [4 + hx, 13 + hy]], "#c7ff4d");
    poly("#44205f", [[5 + hx, 5 + hy], [w / 2 + hx, 3 + hy], [w / 2 + hx, 7 + hy], [5 + hx, 8 + hy]], "#44205f");
    ctx2.fillStyle = "#c7ff4d";
    ctx2.fillRect(6 + hx, 9 + hy, w - 12, 2);
    ctx2.fillRect(w / 2 - 1, 18, 2, 6);
    ctx2.fillRect(w / 2 - 4, 20, 8, 2);
    const sx = arms.frontArmX + 5, sy = arms.frontArmY;
    poly("#f4f2ed", [[sx, sy - 8], [sx + 2, sy - 12], [sx + 4, sy - 8], [sx + 3, sy + 7], [sx, sy + 7]], "#09080f");
    ctx2.fillStyle = "#c7ff4d";
    ctx2.fillRect(sx - 3, sy + 5, 9, 2);
  }
  function drawCharacterArt(ctx2, char, width, height, pose = {}) {
    const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
    const dark = shade(char.outlineColor, -24);
    const light = shade(char.bodyColor, 28);
    const center = width / 2;
    const headW = Math.max(13, width - 8);
    const head = resolveHeadPose(width, pose);
    const tumblePose = Math.max(0, Math.min(1, pose.tumble ?? 0));
    const tumbleArms = resolveTumbleArms(tumblePose);
    const headX = center - headW / 2 + head.offsetX;
    const headY = 4 + head.offsetY;
    const torsoY = 15;
    const torsoH = Math.max(10, height - 25);
    const legY = torsoY + torsoH - 1;
    const skin = char.id === "ninja" ? "#1f2937" : "#f1c9a5";
    ctx2.save();
    ctx2.imageSmoothingEnabled = false;
    ctx2.lineJoin = "miter";
    if (tumblePose > 0) {
      const rotation = resolveTumbleRotation(1, tumblePose);
      ctx2.translate(width / 2, height / 2);
      ctx2.rotate(rotation);
      ctx2.translate(-width / 2, -height / 2);
    }
    if (char.id === "ninja") {
      drawInkNinja(ctx2, width, height, pose);
      ctx2.restore();
      return;
    }
    if (char.id === "knight") {
      drawInkKnight(ctx2, width, height, pose);
      ctx2.restore();
      return;
    }
    if (char.id === "cherry") {
      drawInkCherry(ctx2, width, height, pose);
      ctx2.restore();
      return;
    }
    const rosterInk = {
      tank: drawInkTank,
      mage: drawInkMage,
      ranger: drawInkRanger,
      cyborg: drawInkCyborg,
      spirit: drawInkSpirit,
      healer: drawInkHealer
    };
    const rosterDraw = rosterInk[char.id];
    if (rosterDraw) {
      rosterDraw(ctx2, width, height, pose, inkMaterials(char.bodyColor, char.outlineColor));
      ctx2.restore();
      return;
    }
    if (pose.dashing) {
      rect(ctx2, "rgba(125,211,252,0.22)", -10, 8, 8, height - 12);
      rect(ctx2, "rgba(125,211,252,0.38)", -5, 12, 5, height - 20);
    }
    if (char.id === "ninja") {
      rect(ctx2, "#dc2626", -7, 10, 10, 3);
      rect(ctx2, "#991b1b", -11, 12, 9, 2);
    } else if (char.id === "knight") {
      ctx2.fillStyle = "#b91c1c";
      ctx2.beginPath();
      ctx2.moveTo(4, 15);
      ctx2.lineTo(-5, 19);
      ctx2.lineTo(3, height - 5);
      ctx2.closePath();
      ctx2.fill();
    } else if (char.id === "ranger") {
      rect(ctx2, "#713f12", 0, 13, 4, height - 16);
    } else if (char.id === "mage") {
      ctx2.fillStyle = "#4c1d95";
      ctx2.beginPath();
      ctx2.moveTo(center, -2);
      ctx2.lineTo(1, 12);
      ctx2.lineTo(width - 1, 12);
      ctx2.closePath();
      ctx2.fill();
      rect(ctx2, "#fde68a", center + 2, 3, 2, 2);
    }
    if (char.id === "spirit") {
      ctx2.fillStyle = "rgba(221,214,254,0.72)";
      ctx2.beginPath();
      ctx2.moveTo(4, legY - 2);
      ctx2.lineTo(width - 4, legY - 2);
      ctx2.lineTo(center + 3, height + 1);
      ctx2.lineTo(center - 2, height - 3);
      ctx2.closePath();
      ctx2.fill();
    } else {
      const legs = resolveLegPose(width, height, { stride, airborne: pose.airborne });
      rect(ctx2, dark, legs.rearLegX, legs.rearLegY, 5, legs.rearLegH);
      rect(ctx2, dark, legs.frontLegX, legs.frontLegY, 5, legs.frontLegH);
      rect(ctx2, "#0f172a", legs.rearBootX, legs.rearBootY, 8, 3);
      rect(ctx2, "#0f172a", legs.frontBootX, legs.frontBootY, 8, 3);
    }
    rect(ctx2, dark, 2, torsoY + 1, width - 4, torsoH);
    rect(ctx2, char.bodyColor, 4, torsoY, width - 8, torsoH - 1);
    rect(ctx2, light, 5, torsoY + 1, Math.max(4, width - 13), 3);
    const arms = resolveArmPose(width, height, pose);
    rect(
      ctx2,
      dark,
      arms.rearArmX + tumbleArms.rearArmDx,
      arms.rearArmY + tumbleArms.rearArmDy,
      4,
      arms.rearArmH
    );
    rect(
      ctx2,
      dark,
      arms.frontArmX + tumbleArms.frontArmDx,
      arms.frontArmY + tumbleArms.frontArmDy,
      4,
      arms.frontArmH
    );
    if (char.id === "tank") {
      rect(ctx2, "#cbd5e1", 2, torsoY, width - 4, 4);
      rect(ctx2, "#475569", -2, torsoY + 2, 6, 9);
      rect(ctx2, "#475569", width - 4, torsoY + 2, 6, 9);
    } else if (char.id === "cyborg") {
      rect(ctx2, "#0f172a", 4, torsoY + 3, width - 8, 3);
      rect(ctx2, "#22d3ee", 6, torsoY + 4, width - 12, 1);
      rect(ctx2, "#22d3ee", center - 2, torsoY + 8, 4, 4);
    } else if (char.id === "healer") {
      rect(ctx2, "#ccfbf1", center - 1, torsoY + 2, 2, torsoH - 5);
      rect(ctx2, "#ccfbf1", center - 5, torsoY + 6, 10, 2);
    } else if (char.id === "ranger") {
      rect(ctx2, "#84cc16", 4, torsoY + 2, width - 8, 2);
      drawBow(
        ctx2,
        arms.frontArmX + 5 + tumbleArms.frontArmDx,
        arms.frontArmY + 3 + tumbleArms.frontArmDy
      );
    } else if (char.id === "knight") {
      rect(ctx2, "#fbbf24", center - 1, torsoY + 3, 2, torsoH - 4);
      drawSword(
        ctx2,
        arms.frontArmX + 5 + tumbleArms.frontArmDx,
        arms.frontArmY - 1 + tumbleArms.frontArmDy
      );
    } else if (char.id === "ninja") {
      rect(ctx2, "#111827", 4, torsoY, width - 8, torsoH - 1);
      rect(ctx2, "#dc2626", 4, torsoY + 5, width - 8, 2);
    } else if (char.id === "mage") {
      rect(ctx2, "#c084fc", center - 2, torsoY + 4, 4, 4);
    } else if (char.id === "spirit") {
      rect(ctx2, "#ddd6fe", 5, torsoY + 2, width - 10, 2);
    }
    rect(ctx2, dark, headX - 1, headY - 1, headW + 2, 12);
    rect(ctx2, skin, headX, headY, headW, 10);
    if (char.id === "knight" || char.id === "tank") {
      rect(ctx2, "#cbd5e1", headX - 1, headY - 2, headW + 2, 8);
      rect(ctx2, "#475569", headX + 1, headY + 5, headW - 2, 4);
      rect(ctx2, char.eyeColor, headX + headW - 5, headY + 6, 3, 2);
      if (char.id === "knight") {
        rect(ctx2, "#fbbf24", center - 1, 0, 2, 4);
      }
    } else if (char.id === "cyborg") {
      rect(ctx2, "#64748b", headX, headY, headW, 10);
      rect(ctx2, "#0f172a", headX + 1, headY + 4, headW - 2, 4);
      rect(ctx2, "#22d3ee", headX + headW - 6, headY + 5, 4, 2);
    } else if (char.id === "ninja") {
      rect(ctx2, "#111827", headX, headY - 1, headW, 11);
      rect(ctx2, "#334155", headX + 2, headY + 4, headW - 4, 4);
      rect(ctx2, "#fde047", headX + headW - 6, headY + 5, 3, 2);
    } else if (char.id === "ranger") {
      rect(ctx2, "#14532d", headX - 1, headY - 2, headW + 2, 5);
      rect(ctx2, "#65a30d", headX - 3, headY + 1, headW + 6, 2);
      rect(ctx2, "#172554", headX + headW - 5, headY + 4, 2, 2);
    } else if (char.id === "mage") {
      rect(ctx2, "#312e81", headX - 1, headY - 1, headW + 2, 5);
      rect(ctx2, "#fef08a", headX + headW - 5, headY + 4, 2, 2);
    } else if (char.id === "spirit") {
      rect(ctx2, "#ede9fe", headX, headY, headW, 10);
      rect(ctx2, "#7c3aed", headX + headW - 6, headY + 4, 3, 3);
      rect(ctx2, "rgba(167,139,250,0.55)", headX - 2, headY + 9, headW + 4, 3);
    } else {
      rect(ctx2, "#ccfbf1", headX - 1, headY - 2, headW + 2, 5);
      rect(ctx2, "#0f766e", center - 1, headY - 3, 2, 5);
      rect(ctx2, "#0f766e", center - 3, headY - 1, 6, 2);
      rect(ctx2, "#134e4a", headX + headW - 5, headY + 4, 2, 2);
    }
    ctx2.strokeStyle = "#0a0a0f";
    ctx2.lineWidth = 1;
    ctx2.globalAlpha = 0.9;
    ctx2.strokeRect(0.5, 1.5, width - 1, height - 3);
    ctx2.strokeStyle = "#f4f2ed";
    ctx2.globalAlpha = 0.75;
    ctx2.beginPath();
    ctx2.moveTo(1, height - 0.5);
    ctx2.lineTo(width - 1, height - 0.5);
    ctx2.stroke();
    ctx2.globalAlpha = 1;
    ctx2.restore();
  }

  // design/roster/preview.ts
  var POSES = [
    { label: "idle", pose: {} },
    { label: "run", pose: { stride: 2.4 } },
    { label: "air", pose: { airborne: true } },
    { label: "dash", pose: { dashing: true } },
    { label: "melee", pose: { melee: 0.5 } },
    { label: "tumble", pose: { airborne: true, tumble: 0.5 } }
  ];
  var SCALE = 5;
  var CHIP = 28;
  var COL_W = 34 * SCALE + 44;
  var ROW_H = 40 * SCALE + 40;
  var canvas = document.getElementById("sheet");
  canvas.width = 150 + POSES.length * COL_W + 20;
  canvas.height = 60 + CHARACTERS.length * ROW_H + 20;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4f2ed";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.fillText("DashVerse roster \u2014 bespoke ink anatomy (real dispatch)", 24, 38);
  CHARACTERS.forEach((char, row) => {
    const rowY = 58 + row * ROW_H;
    ctx.fillStyle = "#181826";
    ctx.fillRect(24, rowY + 14, 72, 72);
    ctx.strokeStyle = "#2a2a3c";
    ctx.strokeRect(24.5, rowY + 14.5, 71, 71);
    ctx.save();
    ctx.translate(24 + (72 - CHIP) / 2, rowY + 14 + 6);
    drawCharacterArt(ctx, char, CHIP, CHIP, {});
    ctx.restore();
    ctx.fillStyle = "#8e799e";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(char.name, 24, rowY + 100);
    POSES.forEach((entry, col) => {
      const cellX = 116 + col * COL_W;
      const boxW = char.width * SCALE;
      const boxH = char.height * SCALE;
      ctx.fillStyle = "#10101c";
      ctx.fillRect(cellX, rowY, COL_W - 14, ROW_H - 26);
      ctx.fillStyle = "#161628";
      ctx.beginPath();
      ctx.moveTo(cellX, rowY + ROW_H - 26);
      ctx.lineTo(cellX + (COL_W - 14) * 0.3, rowY + (ROW_H - 26) * 0.55);
      ctx.lineTo(cellX + (COL_W - 14) * 0.6, rowY + (ROW_H - 26) * 0.75);
      ctx.lineTo(cellX + COL_W - 14, rowY + (ROW_H - 26) * 0.5);
      ctx.lineTo(cellX + COL_W - 14, rowY + ROW_H - 26);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.translate(cellX + (COL_W - 14 - boxW) / 2, rowY + 16);
      ctx.strokeStyle = "rgba(199,255,77,0.22)";
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(0.5, 0.5, boxW - 1, boxH - 1);
      ctx.setLineDash([]);
      ctx.scale(SCALE, SCALE);
      drawCharacterArt(ctx, char, char.width, char.height, entry.pose);
      ctx.restore();
      ctx.fillStyle = "#c7ff4d";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText(entry.label, cellX + 6, rowY + ROW_H - 8);
    });
  });
})();
