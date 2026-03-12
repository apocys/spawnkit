/**
 * medieval-renderer.js — Medieval-themed canvas renderer
 * Extends the base Renderer with castle walls, stone floors, torchlight, day/night.
 */
(function () {
  'use strict';
  var T = window.OfficeTypes;
  var MT = window.MedTypes;
  var TILE = T.TILE_SIZE;

  // ── Tile colors ──
  var TILE_COLORS = {};
  TILE_COLORS[MT.MedTileType.FLOOR_STONE] = ['#4a4a55', '#52525e'];
  TILE_COLORS[MT.MedTileType.WALL_CASTLE] = ['#2a2a35', '#252530'];
  TILE_COLORS[MT.MedTileType.FLOOR_WOOD]  = ['#6d5a3a', '#7a6544'];
  TILE_COLORS[MT.MedTileType.FLOOR_DIRT]  = ['#6b5e3a', '#7a6d44'];
  TILE_COLORS[MT.MedTileType.FLOOR_GRASS] = ['#3a5a2a', '#446630'];
  TILE_COLORS[MT.MedTileType.FLOOR_WATER] = ['#2a4a6a', '#2e5070'];
  TILE_COLORS[MT.MedTileType.WALL_TOWER]  = ['#1e1e28', '#222230'];

  /** Render medieval tile grid */
  function renderTiles(ctx, tileMap, ox, oy, zoom) {
    var s = TILE * zoom;
    for (var r = 0; r < tileMap.length; r++) {
      for (var c = 0; c < tileMap[r].length; c++) {
        var tile = tileMap[r][c];
        if (tile === MT.MedTileType.VOID) continue;

        var x = ox + c * s;
        var y = oy + r * s;
        var colors = TILE_COLORS[tile] || TILE_COLORS[MT.MedTileType.FLOOR_STONE];
        ctx.fillStyle = (r + c) % 2 === 0 ? colors[0] : colors[1];
        ctx.fillRect(x, y, s, s);

        // Stone texture (subtle noise for stone floors)
        if (tile === MT.MedTileType.FLOOR_STONE || tile === MT.MedTileType.WALL_CASTLE) {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          // Pseudo-random pattern based on position
          if ((r * 7 + c * 13) % 5 === 0) {
            ctx.fillRect(x + s * 0.1, y + s * 0.1, s * 0.2, s * 0.15);
          }
          if ((r * 11 + c * 3) % 7 === 0) {
            ctx.fillRect(x + s * 0.6, y + s * 0.5, s * 0.25, s * 0.2);
          }
        }

        // Wall crenellation
        if (tile === MT.MedTileType.WALL_CASTLE || tile === MT.MedTileType.WALL_TOWER) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x, y, s, s * 0.25);
          // Battlements
          if (r === 0 || (r > 0 && tileMap[r - 1] && tileMap[r - 1][c] === MT.MedTileType.VOID)) {
            ctx.fillStyle = '#1a1a24';
            for (var b = 0; b < 3; b++) {
              ctx.fillRect(x + b * s * 0.35 + s * 0.05, y, s * 0.2, s * 0.15);
            }
          }
        }

        // Water shimmer
        if (tile === MT.MedTileType.FLOOR_WATER) {
          ctx.fillStyle = 'rgba(100,180,255,0.08)';
          var shimmer = Math.sin((Date.now() / 1000 + r * 0.5 + c * 0.3) * 2) * 0.5 + 0.5;
          ctx.globalAlpha = shimmer * 0.15;
          ctx.fillRect(x, y, s, s);
          ctx.globalAlpha = 1;
        }

        // Grass detail
        if (tile === MT.MedTileType.FLOOR_GRASS) {
          ctx.fillStyle = 'rgba(100,200,80,0.1)';
          if ((r * 5 + c * 9) % 3 === 0) {
            ctx.fillRect(x + s * 0.3, y + s * 0.2, 2 * zoom, 4 * zoom);
            ctx.fillRect(x + s * 0.7, y + s * 0.6, 2 * zoom, 3 * zoom);
          }
        }
      }
    }
  }

  /** Render medieval furniture */
  function renderFurniture(ctx, furniture, ox, oy, zoom) {
    var s = TILE * zoom;
    for (var i = 0; i < furniture.length; i++) {
      var f = furniture[i];
      var x = ox + f.col * s;
      var y = oy + f.row * s;
      var w = (f.width || 1) * s;
      var h = (f.height || 1) * s;
      var info = MT.MED_FURNITURE[f.type];

      if (f.type === 'throne') {
        // Ornate throne
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.85);
        ctx.fillStyle = '#c9a959';
        ctx.fillRect(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.5);
        ctx.fillStyle = '#b22222';
        ctx.fillRect(x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.35);
        // Crown detail
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(x + w * 0.35, y + h * 0.05, w * 0.3, h * 0.08);
      }
      else if (f.type === 'anvil') {
        ctx.fillStyle = '#555';
        ctx.fillRect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.5);
        ctx.fillStyle = '#777';
        ctx.fillRect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.2);
      }
      else if (f.type === 'bookcase') {
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        var colors = ['#b22222', '#2a5a8b', '#2d5a27', '#8b6914', '#663399'];
        for (var b = 0; b < 5; b++) {
          ctx.fillStyle = colors[b % colors.length];
          ctx.fillRect(x + 3 + b * (w * 0.18), y + 3, w * 0.14, h * 0.7);
        }
      }
      else if (f.type === 'barrel') {
        ctx.fillStyle = '#6d4c2a';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a3520';
        ctx.lineWidth = 1.5 * zoom;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      else if (f.type === 'torch') {
        // Torch post
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(x + w * 0.4, y + h * 0.3, w * 0.2, h * 0.65);
        // Flame — per-torch flicker with phase offset for organic feel
        var now = Date.now();
        var flickerPhase = now / 150 + i * 1.3;
        var flicker = (Math.sin(flickerPhase) * 0.5 + 0.5) * 0.2 + 0.8; // 0.8–1.0 intensity
        var flickerX = Math.sin(flickerPhase * 0.7) * w * 0.04; // subtle horizontal sway
        var glowRadius = s * (1.2 + flicker * 0.4);
        // Outer glow
        var grd = ctx.createRadialGradient(
          x + w / 2 + flickerX, y + h * 0.18, 0,
          x + w / 2 + flickerX, y + h * 0.18, glowRadius
        );
        grd.addColorStop(0, 'rgba(255, 160, 40, ' + (0.12 * flicker) + ')');
        grd.addColorStop(0.4, 'rgba(255, 120, 20, ' + (0.07 * flicker) + ')');
        grd.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(x - glowRadius, y - glowRadius, w + glowRadius * 2, h + glowRadius * 2);
        // Outer flame
        ctx.fillStyle = 'rgba(255, ' + Math.floor(100 + flicker * 50) + ', 20, 0.85)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2 + flickerX, y + h * 0.2, w * (0.18 + flicker * 0.04), h * (0.18 + flicker * 0.04), 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner flame (hotter core)
        ctx.fillStyle = 'rgba(255, 220, 80, ' + (0.7 + flicker * 0.3) + ')';
        ctx.beginPath();
        ctx.ellipse(x + w / 2 + flickerX * 0.5, y + h * 0.21, w * 0.09, h * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      else if (f.type === 'table') {
        ctx.fillStyle = '#5c4a3a';
        ctx.fillRect(x + 2, y + h * 0.15, w - 4, h * 0.7);
        ctx.fillStyle = '#6d5a48';
        ctx.fillRect(x + 3, y + h * 0.18, w - 6, h * 0.5);
      }
      else if (f.type === 'grave') {
        ctx.fillStyle = '#4a4a5e';
        ctx.fillRect(x + w * 0.3, y + h * 0.1, w * 0.4, h * 0.7);
        ctx.fillRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.15);
      }
      else if (f.type === 'bed') {
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#b22222';
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        ctx.fillStyle = '#e8d5b7';
        ctx.fillRect(x + 4, y + 4, w * 0.3, h - 8);
      }
      else if (f.type === 'dummy') {
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(x + w * 0.4, y + h * 0.2, w * 0.2, h * 0.7);
        ctx.fillStyle = '#c9a959';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h * 0.15, w * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + w * 0.15, y + h * 0.35, w * 0.7, w * 0.1);
      }
      else if (f.type === 'banner') {
        ctx.fillStyle = '#5c3a1e';
        ctx.fillRect(x + w * 0.45, y, w * 0.1, h);
        ctx.fillStyle = '#b22222';
        ctx.fillRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.5);
        ctx.fillStyle = '#c9a959';
        ctx.font = Math.max(10, 12 * zoom) + 'px serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚔', x + w / 2, y + h * 0.4);
      }
      else if (f.type === 'well') {
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a4a6a';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      else if (f.type === 'cauldron') {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.5, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2d8f4e';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h * 0.45, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bubbles
        var bubble = Math.sin(Date.now() / 300 + i * 2);
        ctx.fillStyle = 'rgba(100,255,100,0.3)';
        ctx.beginPath();
        ctx.arc(x + w * 0.4, y + h * (0.3 + bubble * 0.05), 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      else {
        // Fallback
        ctx.fillStyle = '#555';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        if (info && info.emoji) {
          ctx.font = Math.max(12, 16 * zoom) + 'px serif';
          ctx.textAlign = 'center';
          ctx.fillText(info.emoji, x + w / 2, y + h / 2 + 4 * zoom);
        }
      }
    }
  }

  /** Render medieval character */
  function renderCharacter(ctx, ch, ox, oy, zoom, palettes) {
    var s = TILE * zoom;
    var p = (palettes || MT.MED_PALETTES)[ch.palette % (palettes || MT.MED_PALETTES).length];
    var x = ox + ch.x * zoom;
    var y = oy + ch.y * zoom;
    var sz = s * 0.75;
    var half = sz / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + half * 0.8, half * 0.5, half * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    var bodyY = y;
    if (ch.state === window.OfficeTypes.CharacterState.WORK) bodyY = y - sz * 0.1;
    if (ch.state === window.OfficeTypes.CharacterState.WALK) {
      bodyY -= Math.abs(Math.sin(ch.frame * Math.PI / 2)) * 2 * zoom;
    }

    // Cloak
    ctx.fillStyle = p.cloak;
    ctx.fillRect(x - half * 0.5, bodyY - half * 0.2, half * 1.0, half * 0.8);

    // Armor body
    ctx.fillStyle = p.armor;
    ctx.fillRect(x - half * 0.35, bodyY - half * 0.35, half * 0.7, half * 0.6);

    // Head
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - half * 0.25, bodyY - half * 0.85, half * 0.5, half * 0.45);

    // Hair/helm
    ctx.fillStyle = p.hair;
    ctx.fillRect(x - half * 0.3, bodyY - half * 0.9, half * 0.6, half * 0.15);

    // Eyes
    var eyeOff = 0;
    if (ch.dir === window.OfficeTypes.Direction.LEFT) eyeOff = -2 * zoom;
    if (ch.dir === window.OfficeTypes.Direction.RIGHT) eyeOff = 2 * zoom;
    if (ch.dir !== window.OfficeTypes.Direction.UP) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x - half * 0.12 + eyeOff, bodyY - half * 0.65, 2 * zoom, 2 * zoom);
      ctx.fillRect(x + half * 0.08 + eyeOff, bodyY - half * 0.65, 2 * zoom, 2 * zoom);
    }

    // Work animation — hands
    if (ch.state === window.OfficeTypes.CharacterState.WORK) {
      ctx.fillStyle = p.skin;
      var ho = ch.frame === 0 ? -1 : 1;
      ctx.fillRect(x - half * 0.5 + ho * zoom, bodyY + half * 0.15, half * 0.18, half * 0.12);
      ctx.fillRect(x + half * 0.32 - ho * zoom, bodyY + half * 0.15, half * 0.18, half * 0.12);
    }

    // Name + title
    ctx.fillStyle = '#c9a959';
    ctx.font = 'bold ' + Math.max(9, 10 * zoom) + 'px serif';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, x, bodyY - half * 1.1);

    // Mood emoji
    if (ch.emoji) {
      ctx.font = Math.max(12, 14 * zoom) + 'px serif';
      ctx.fillText(ch.emoji, x + half * 0.7, bodyY - half * 0.5);
    }

    // Tool status (parchment style)
    if (ch.toolStatus && ch.isActive) {
      var text = ch.toolStatus;
      ctx.font = Math.max(8, 9 * zoom) + 'px serif';
      var tw = ctx.measureText(text).width + 12 * zoom;
      var bx = x - tw / 2;
      var by = bodyY - half * 1.6;
      ctx.fillStyle = 'rgba(40, 30, 20, 0.8)';
      ctx.fillRect(bx, by, tw, 14 * zoom);
      ctx.strokeStyle = '#c9a959';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, tw, 14 * zoom);
      ctx.fillStyle = '#e8d5b7';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, by + 10 * zoom);
    }
  }

  /** Lerp between two rgba color strings — expects [r,g,b,a] arrays */
  function lerpColor(c1, c2, t) {
    var r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    var g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    var b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    var a = +(c1[3] + (c2[3] - c1[3]) * t).toFixed(3);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /** Day/night overlay with smooth gradient transitions and crescent moon */
  function renderDayNight(ctx, canvasW, canvasH, cycleProgress) {
    // Color keyframes: [r, g, b, alpha]
    // progress: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk, 1=midnight
    var KEYS = [
      { p: 0.00, c: [10,  10,  50,  0.55] },  // midnight — deep blue-purple
      { p: 0.20, c: [10,  10,  50,  0.55] },  // still night
      { p: 0.28, c: [200, 100, 60,  0.30] },  // dawn — pink-orange
      { p: 0.40, c: [180, 140, 80,  0.10] },  // morning — warm
      { p: 0.55, c: [100, 160, 255, 0.04] },  // midday — light blue tint
      { p: 0.68, c: [220, 90,  30,  0.28] },  // dusk — deep orange-red
      { p: 0.78, c: [80,  30,  80,  0.40] },  // twilight — purple
      { p: 1.00, c: [10,  10,  50,  0.55] }   // midnight
    ];

    // Find surrounding keyframes
    var k1 = KEYS[0], k2 = KEYS[KEYS.length - 1];
    for (var i = 0; i < KEYS.length - 1; i++) {
      if (cycleProgress >= KEYS[i].p && cycleProgress <= KEYS[i + 1].p) {
        k1 = KEYS[i];
        k2 = KEYS[i + 1];
        break;
      }
    }
    var span = k2.p - k1.p;
    var t = span > 0 ? (cycleProgress - k1.p) / span : 0;
    // Smooth step
    t = t * t * (3 - 2 * t);
    var overlayColor = lerpColor(k1.c, k2.c, t);

    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Crescent moon during night (progress > 0.72 or < 0.24)
    var isNight = cycleProgress > 0.72 || cycleProgress < 0.24;
    if (isNight) {
      var moonAlpha = cycleProgress > 0.72
        ? Math.min(1, (cycleProgress - 0.72) / 0.08)
        : Math.min(1, (0.24 - cycleProgress) / 0.08);
      moonAlpha = Math.min(moonAlpha, 0.9);

      var mx = canvasW * 0.82;
      var my = canvasH * 0.12;
      var mr = Math.min(canvasW, canvasH) * 0.035;

      ctx.save();
      ctx.globalAlpha = moonAlpha;
      // Moon body
      ctx.fillStyle = '#e8dfc0';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      // Crescent cutout (offset circle to create crescent shape)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.95)';
      ctx.beginPath();
      ctx.arc(mx + mr * 0.45, my - mr * 0.1, mr * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // Subtle glow around moon
      ctx.globalAlpha = moonAlpha * 0.15;
      var moonGlow = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 2.5);
      moonGlow.addColorStop(0, 'rgba(232, 223, 192, 0.6)');
      moonGlow.addColorStop(1, 'rgba(232, 223, 192, 0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(mx, my, mr * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Draw role-based weapon/shield on top of an agent sprite.
   * Called after renderCharacter so equipment appears on top.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x  — pixel center of character
   * @param {number} y  — pixel center of character
   * @param {string} role — agent role string (lowercase)
   * @param {number} size — half-size of character sprite (sz/2)
   */
  function drawAgentEquipment(ctx, x, y, role, size) {
    var s = size;
    var r = (role || '').toLowerCase();

    if (r === 'orchestrator' || r === 'captain' || r === 'commander') {
      // Sword — right side
      ctx.strokeStyle = '#c0c0c0';
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.55, y + s * 0.6);
      ctx.lineTo(x + s * 0.55, y - s * 0.5);
      ctx.stroke();
      // Crossguard
      ctx.beginPath();
      ctx.moveTo(x + s * 0.35, y + s * 0.05);
      ctx.lineTo(x + s * 0.75, y + s * 0.05);
      ctx.stroke();
      // Pommel
      ctx.fillStyle = '#c9a959';
      ctx.beginPath();
      ctx.arc(x + s * 0.55, y + s * 0.65, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // Kite shield — left side
      ctx.fillStyle = '#8b1a1a';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y - s * 0.35);
      ctx.lineTo(x - s * 0.85, y - s * 0.35);
      ctx.lineTo(x - s * 0.85, y + s * 0.2);
      ctx.lineTo(x - s * 0.70, y + s * 0.45);
      ctx.lineTo(x - s * 0.55, y + s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c9a959';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.stroke();
      // Shield emblem
      ctx.fillStyle = '#c9a959';
      ctx.font = Math.max(6, s * 0.35) + 'px serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚔', x - s * 0.70, y + s * 0.1);

    } else if (r === 'researcher' || r === 'scout' || r === 'analyst' && false) {
      // Quill — right side
      ctx.strokeStyle = '#e8d5b7';
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.45, y + s * 0.4);
      ctx.lineTo(x + s * 0.65, y - s * 0.4);
      ctx.stroke();
      // Feather vane
      ctx.fillStyle = 'rgba(240,220,150,0.8)';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.65, y - s * 0.4);
      ctx.quadraticCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.55, y + s * 0.05);
      ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.1, x + s * 0.65, y - s * 0.4);
      ctx.fill();
      // Scroll — left side
      ctx.fillStyle = '#d4b483';
      ctx.fillRect(x - s * 0.75, y - s * 0.15, s * 0.25, s * 0.45);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(x - s * 0.75, y - s * 0.2, s * 0.25, s * 0.07);
      ctx.fillRect(x - s * 0.75, y + s * 0.28, s * 0.25, s * 0.07);

    } else if (r === 'coder' || r === 'builder' || r === 'engineer') {
      // Hammer — right side
      ctx.fillStyle = '#777';
      // Handle
      ctx.fillRect(x + s * 0.45, y - s * 0.3, s * 0.1, s * 0.7);
      // Head
      ctx.fillStyle = '#888';
      ctx.fillRect(x + s * 0.35, y - s * 0.38, s * 0.3, s * 0.18);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(x + s * 0.37, y - s * 0.36, s * 0.1, s * 0.14);

    } else if (r === 'analyst' || r === 'advisor' || r === 'strategist') {
      // Scales of balance — right side
      ctx.strokeStyle = '#c9a959';
      ctx.lineWidth = Math.max(1, s * 0.05);
      // Pole
      ctx.beginPath();
      ctx.moveTo(x + s * 0.55, y + s * 0.4);
      ctx.lineTo(x + s * 0.55, y - s * 0.25);
      ctx.stroke();
      // Beam
      ctx.beginPath();
      ctx.moveTo(x + s * 0.30, y - s * 0.2);
      ctx.lineTo(x + s * 0.80, y - s * 0.2);
      ctx.stroke();
      // Left pan
      ctx.beginPath();
      ctx.moveTo(x + s * 0.30, y - s * 0.2);
      ctx.lineTo(x + s * 0.22, y + s * 0.1);
      ctx.lineTo(x + s * 0.38, y + s * 0.1);
      ctx.lineTo(x + s * 0.30, y - s * 0.2);
      ctx.stroke();
      // Right pan
      ctx.beginPath();
      ctx.moveTo(x + s * 0.80, y - s * 0.2);
      ctx.lineTo(x + s * 0.72, y + s * 0.05);
      ctx.lineTo(x + s * 0.88, y + s * 0.05);
      ctx.lineTo(x + s * 0.80, y - s * 0.2);
      ctx.stroke();

    } else {
      // Default — dagger
      ctx.strokeStyle = '#b0b0c0';
      ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.50, y + s * 0.35);
      ctx.lineTo(x + s * 0.62, y - s * 0.2);
      ctx.stroke();
      // Crossguard
      ctx.beginPath();
      ctx.moveTo(x + s * 0.42, y + s * 0.1);
      ctx.lineTo(x + s * 0.70, y + s * 0.1);
      ctx.stroke();
    }
  }

  /** Render characters with z-sorting */
  function renderCharacters(ctx, characters, ox, oy, zoom) {
    var sorted = Array.from(characters.values()).slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < sorted.length; i++) {
      renderCharacter(ctx, sorted[i], ox, oy, zoom);
      // Draw role-based equipment on top of base sprite
      var ch = sorted[i];
      var s = TILE * zoom;
      var px = ox + ch.x * zoom;
      var py = oy + ch.y * zoom;
      drawAgentEquipment(ctx, px, py, ch.role || '', s * 0.375);
    }
  }

  window.MedRenderer = {
    renderTiles: renderTiles,
    renderFurniture: renderFurniture,
    renderCharacter: renderCharacter,
    renderCharacters: renderCharacters,
    renderDayNight: renderDayNight,
    drawAgentEquipment: drawAgentEquipment,
    lerpColor: lerpColor
  };
})();
