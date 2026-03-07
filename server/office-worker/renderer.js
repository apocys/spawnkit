/**
 * office-worker/renderer.js — Canvas 2D renderer
 * Renders tiles, furniture, characters with proper z-sorting.
 * Pixel-art style with emoji characters (no spritesheet dependency).
 */
(function () {
  'use strict';
  var T = window.OfficeTypes;
  var TILE = T.TILE_SIZE;

  // ── Character palettes (skin tone + outfit) ──
  var PALETTES = [
    { skin: '#f4c794', shirt: '#4a90d9', hair: '#3d2b1f' },
    { skin: '#d4a574', shirt: '#e74c3c', hair: '#1a1a2e' },
    { skin: '#f0d5a8', shirt: '#27ae60', hair: '#8b6914' },
    { skin: '#c68642', shirt: '#9b59b6', hair: '#0d0d0d' },
    { skin: '#ffe0bd', shirt: '#e67e22', hair: '#b5651d' },
    { skin: '#a0785a', shirt: '#2ecc71', hair: '#2c2c2c' }
  ];

  /** Render the tile grid (floor + walls) */
  function renderTiles(ctx, tileMap, ox, oy, zoom) {
    var s = TILE * zoom;
    for (var r = 0; r < tileMap.length; r++) {
      for (var c = 0; c < tileMap[r].length; c++) {
        var tile = tileMap[r][c];
        if (tile === T.TileType.VOID) continue;

        var x = ox + c * s;
        var y = oy + r * s;

        if (tile === T.TileType.WALL) {
          ctx.fillStyle = T.WALL_COLOR;
          ctx.fillRect(x, y, s, s);
          // Wall top highlight
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(x, y, s, s * 0.3);
        } else {
          // Floor tile — alternating pattern
          ctx.fillStyle = (r + c) % 2 === 0 ? T.FLOOR_COLOR : '#3e434b';
          ctx.fillRect(x, y, s, s);
        }
      }
    }
    // Grid lines
    ctx.strokeStyle = T.GRID_COLOR;
    ctx.lineWidth = 1;
    for (var r = 0; r <= tileMap.length; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * s);
      ctx.lineTo(ox + (tileMap[0] ? tileMap[0].length : 0) * s, oy + r * s);
      ctx.stroke();
    }
    var cols = tileMap[0] ? tileMap[0].length : 0;
    for (var c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * s, oy);
      ctx.lineTo(ox + c * s, oy + tileMap.length * s);
      ctx.stroke();
    }
  }

  /** Render furniture items */
  function renderFurniture(ctx, furniture, ox, oy, zoom) {
    var s = TILE * zoom;
    for (var i = 0; i < furniture.length; i++) {
      var f = furniture[i];
      var x = ox + f.col * s;
      var y = oy + f.row * s;
      var w = (f.width || 1) * s;
      var h = (f.height || 1) * s;

      // Desk
      if (f.type === 'desk') {
        ctx.fillStyle = '#5c4a3a';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#6d5a48';
        ctx.fillRect(x + 3, y + 3, w - 6, h * 0.6);
        // Monitor
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(x + w * 0.25, y + 4, w * 0.5, h * 0.4);
        ctx.fillStyle = '#4a90d9';
        ctx.fillRect(x + w * 0.28, y + 5, w * 0.44, h * 0.35);
      }
      // Plant
      else if (f.type === 'plant') {
        ctx.fillStyle = '#6d4c2a';
        ctx.fillRect(x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.45);
        ctx.fillStyle = '#2d8f4e';
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.35, w * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      // Bookshelf
      else if (f.type === 'bookshelf') {
        ctx.fillStyle = '#5c4a3a';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        // Shelves
        for (var sh = 0; sh < 3; sh++) {
          ctx.fillStyle = '#4a3a2a';
          ctx.fillRect(x + 2, y + h * (0.25 + sh * 0.25), w - 4, 2);
          // Books
          var colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
          for (var b = 0; b < 4; b++) {
            ctx.fillStyle = colors[(sh * 4 + b) % colors.length];
            ctx.fillRect(x + 4 + b * (w * 0.2), y + h * (0.05 + sh * 0.25), w * 0.15, h * 0.18);
          }
        }
      }
      // Cooler
      else if (f.type === 'cooler') {
        ctx.fillStyle = '#a0b4c8';
        ctx.fillRect(x + w * 0.2, y + h * 0.1, w * 0.6, h * 0.8);
        ctx.fillStyle = '#7090b0';
        ctx.fillRect(x + w * 0.25, y + h * 0.15, w * 0.5, h * 0.3);
      }
      // Generic
      else {
        ctx.fillStyle = '#555';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      }
    }
  }

  /** Render a single character (pixel-art style) */
  function renderCharacter(ctx, ch, ox, oy, zoom) {
    var s = TILE * zoom;
    var p = PALETTES[ch.palette % PALETTES.length];
    var x = ox + ch.x * zoom;
    var y = oy + ch.y * zoom;
    var sz = s * 0.7;
    var half = sz / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + half * 0.8, half * 0.6, half * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body offset for sitting
    var bodyY = y;
    if (ch.state === T.CharacterState.WORK) {
      bodyY = y - sz * 0.1;
    }

    // Walk bounce
    if (ch.state === T.CharacterState.WALK) {
      bodyY -= Math.abs(Math.sin(ch.frame * Math.PI / 2)) * 2 * zoom;
    }

    // Body
    ctx.fillStyle = p.shirt;
    ctx.fillRect(x - half * 0.4, bodyY - half * 0.3, half * 0.8, half * 0.7);

    // Head
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - half * 0.3, bodyY - half * 0.9, half * 0.6, half * 0.55);

    // Hair
    ctx.fillStyle = p.hair;
    ctx.fillRect(x - half * 0.35, bodyY - half * 0.95, half * 0.7, half * 0.2);

    // Eyes (direction-aware)
    ctx.fillStyle = '#1a1a2e';
    var eyeOff = 0;
    if (ch.dir === T.Direction.LEFT) eyeOff = -2 * zoom;
    if (ch.dir === T.Direction.RIGHT) eyeOff = 2 * zoom;
    if (ch.dir !== T.Direction.UP) {
      ctx.fillRect(x - half * 0.15 + eyeOff, bodyY - half * 0.65, 2 * zoom, 2 * zoom);
      ctx.fillRect(x + half * 0.1 + eyeOff, bodyY - half * 0.65, 2 * zoom, 2 * zoom);
    }

    // Work animation — typing hands
    if (ch.state === T.CharacterState.WORK) {
      ctx.fillStyle = p.skin;
      var handOff = ch.frame === 0 ? -1 : 1;
      ctx.fillRect(x - half * 0.5 + handOff * zoom, bodyY + half * 0.2, half * 0.2, half * 0.15);
      ctx.fillRect(x + half * 0.3 - handOff * zoom, bodyY + half * 0.2, half * 0.2, half * 0.15);
    }

    // Name label
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = Math.max(9, 10 * zoom) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, x, bodyY - half * 1.1);

    // Tool status bubble
    if (ch.toolStatus && ch.isActive) {
      var text = ch.toolStatus;
      ctx.font = Math.max(8, 9 * zoom) + 'px system-ui';
      var tw = ctx.measureText(text).width + 10 * zoom;
      var bx = x - tw / 2;
      var by = bodyY - half * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      _roundRect(ctx, bx, by, tw, 14 * zoom, 4 * zoom);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'center';
      ctx.fillText(text, x, by + 10 * zoom);
    }

    // Emoji badge
    if (ch.emoji) {
      ctx.font = Math.max(12, 14 * zoom) + 'px serif';
      ctx.textAlign = 'center';
      ctx.fillText(ch.emoji, x + half * 0.6, bodyY - half * 0.5);
    }
  }

  /** Render all characters with z-sorting (bottom-to-top) */
  function renderCharacters(ctx, characters, ox, oy, zoom) {
    // Sort by Y position for depth
    var sorted = Array.from(characters.values()).slice().sort(function (a, b) {
      return a.y - b.y;
    });
    for (var i = 0; i < sorted.length; i++) {
      renderCharacter(ctx, sorted[i], ox, oy, zoom);
    }
  }

  /** Render seat indicators */
  function renderSeats(ctx, seats, ox, oy, zoom) {
    var s = TILE * zoom;
    seats.forEach(function (seat) {
      var x = ox + seat.col * s;
      var y = oy + seat.row * s;
      ctx.fillStyle = seat.assigned ? T.SEAT_BUSY : T.SEAT_AVAILABLE;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    });
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  window.Renderer = {
    renderTiles: renderTiles,
    renderFurniture: renderFurniture,
    renderCharacter: renderCharacter,
    renderCharacters: renderCharacters,
    renderSeats: renderSeats
  };
})();
