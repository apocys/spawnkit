/**
 * office-worker/tile-map.js — Tile grid + BFS pathfinding
 * Ported from pixel-agents tileMap.ts. Pure functions, no side effects.
 */
(function () {
  'use strict';
  var T = window.OfficeTypes;
  var TILE_SIZE = T.TILE_SIZE;
  var TileType = T.TileType;

  /** Check if a tile is walkable */
  function isWalkable(col, row, tileMap, blockedTiles) {
    var rows = tileMap.length;
    var cols = rows > 0 ? tileMap[0].length : 0;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    if (tileMap[row][col] !== TileType.FLOOR) return false;
    if (blockedTiles.has(col + ',' + row)) return false;
    return true;
  }

  /** Get all walkable tile positions */
  function getWalkableTiles(tileMap, blockedTiles) {
    var tiles = [];
    var rows = tileMap.length;
    for (var r = 0; r < rows; r++) {
      var cols = tileMap[r].length;
      for (var c = 0; c < cols; c++) {
        if (isWalkable(c, r, tileMap, blockedTiles)) {
          tiles.push({ col: c, row: r });
        }
      }
    }
    return tiles;
  }

  /** BFS pathfinding — returns path excluding start, including end */
  function findPath(startCol, startRow, endCol, endRow, tileMap, blockedTiles) {
    if (startCol === endCol && startRow === endRow) return [];
    if (!isWalkable(endCol, endRow, tileMap, blockedTiles)) return [];

    var key = function (c, r) { return c + ',' + r; };
    var visited = new Set();
    visited.add(key(startCol, startRow));

    var parent = new Map();
    var queue = [{ col: startCol, row: startRow }];
    var dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];

    while (queue.length > 0) {
      var curr = queue.shift();
      var currKey = key(curr.col, curr.row);

      if (curr.col === endCol && curr.row === endRow) {
        // Reconstruct path
        var path = [];
        var k = key(endCol, endRow);
        while (k !== key(startCol, startRow)) {
          var parts = k.split(',');
          path.unshift({ col: parseInt(parts[0]), row: parseInt(parts[1]) });
          k = parent.get(k);
        }
        return path;
      }

      for (var i = 0; i < dirs.length; i++) {
        var nc = curr.col + dirs[i].dc;
        var nr = curr.row + dirs[i].dr;
        var nk = key(nc, nr);
        if (!visited.has(nk) && isWalkable(nc, nr, tileMap, blockedTiles)) {
          visited.add(nk);
          parent.set(nk, currKey);
          queue.push({ col: nc, row: nr });
        }
      }
    }
    return []; // no path found
  }

  /** Create a default office layout */
  function createDefaultLayout(cols, rows) {
    cols = cols || T.DEFAULT_COLS;
    rows = rows || T.DEFAULT_ROWS;
    var tiles = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        // Walls on the edges
        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          row.push(TileType.WALL);
        } else {
          row.push(TileType.FLOOR);
        }
      }
      tiles.push(row);
    }
    return { version: 1, cols: cols, rows: rows, tiles: tiles, furniture: [], seats: [] };
  }

  /** Convert layout to blocked tiles set (from furniture footprints) */
  function getBlockedTiles(furniture) {
    var blocked = new Set();
    for (var i = 0; i < furniture.length; i++) {
      var f = furniture[i];
      var w = f.width || 1;
      var h = f.height || 1;
      for (var r = 0; r < h; r++) {
        for (var c = 0; c < w; c++) {
          blocked.add((f.col + c) + ',' + (f.row + r));
        }
      }
    }
    return blocked;
  }

  /** Convert layout seats to a Map<seatId, Seat> */
  function layoutToSeats(seats) {
    var map = new Map();
    for (var i = 0; i < seats.length; i++) {
      var s = seats[i];
      map.set(s.id, {
        id: s.id,
        col: s.col,
        row: s.row,
        facingDir: s.facingDir || T.Direction.DOWN,
        assigned: false
      });
    }
    return map;
  }

  /** Pixel center of a tile */
  function tileCenter(col, row) {
    return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
  }

  window.TileMap = {
    isWalkable: isWalkable,
    getWalkableTiles: getWalkableTiles,
    findPath: findPath,
    createDefaultLayout: createDefaultLayout,
    getBlockedTiles: getBlockedTiles,
    layoutToSeats: layoutToSeats,
    tileCenter: tileCenter
  };
})();
