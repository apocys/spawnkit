/**
 * office-worker/office-state.js — Central state manager (single source of truth)
 * Ported from pixel-agents OfficeState class. Owns layout, characters, seats, camera.
 */
(function () {
  'use strict';
  var T = window.OfficeTypes;
  var TM = window.TileMap;
  var CH = window.Characters;

  function OfficeState(layout) {
    this.layout = layout || TM.createDefaultLayout();
    this.tileMap = this.layout.tiles;
    this.seats = TM.layoutToSeats(this.layout.seats || []);
    this.blockedTiles = TM.getBlockedTiles(this.layout.furniture || []);
    this.furniture = this.layout.furniture || [];
    this.walkableTiles = TM.getWalkableTiles(this.tileMap, this.blockedTiles);
    this.characters = new Map();
    this.selectedAgentId = null;
    this.nextPalette = 0;

    // Camera
    this.camera = { x: 0, y: 0, zoom: 2.0 };
  }

  /** Rebuild all derived state from a new layout */
  OfficeState.prototype.rebuildFromLayout = function (layout) {
    this.layout = layout;
    this.tileMap = layout.tiles;
    this.seats = TM.layoutToSeats(layout.seats || []);
    this.blockedTiles = TM.getBlockedTiles(layout.furniture || []);
    this.furniture = layout.furniture || [];
    this.walkableTiles = TM.getWalkableTiles(this.tileMap, this.blockedTiles);
    // Reassign existing characters to new seats
    this._reassignSeats();
  };

  /** Add an agent as a character */
  OfficeState.prototype.addAgent = function (id, name, emoji) {
    if (this.characters.has(id)) return this.characters.get(id);

    // Find an available seat
    var seatId = null;
    var seat = null;
    this.seats.forEach(function (s, sid) {
      if (!s.assigned && !seatId) {
        seatId = sid;
        seat = s;
      }
    });
    if (seat) seat.assigned = true;

    var ch = CH.create(id, name, seatId, seat, this.nextPalette);
    ch.emoji = emoji || '💻';
    this.nextPalette = (this.nextPalette + 1) % 6;
    this.characters.set(id, ch);
    return ch;
  };

  /** Remove an agent */
  OfficeState.prototype.removeAgent = function (id) {
    var ch = this.characters.get(id);
    if (!ch) return;
    // Free the seat
    if (ch.seatId) {
      var seat = this.seats.get(ch.seatId);
      if (seat) seat.assigned = false;
    }
    this.characters.delete(id);
  };

  /** Set agent active/inactive (triggers state transitions) */
  OfficeState.prototype.setAgentActive = function (id, active, toolStatus) {
    var ch = this.characters.get(id);
    if (!ch) return;
    ch.isActive = active;
    ch.toolStatus = toolStatus || '';
    if (active && ch.state === T.CharacterState.IDLE) {
      // Will pathfind to seat on next update
    }
    if (!active) {
      ch.seatTimer = 2.0; // Pause before standing up
      ch.toolStatus = '';
    }
  };

  /** Update tool status label for an agent */
  OfficeState.prototype.setToolStatus = function (id, status) {
    var ch = this.characters.get(id);
    if (ch) ch.toolStatus = status;
  };

  /** Update all characters */
  OfficeState.prototype.update = function (dt) {
    var self = this;
    this.characters.forEach(function (ch) {
      CH.update(ch, dt, self.walkableTiles, self.seats, self.tileMap, self.blockedTiles);
    });
  };

  /** Reassign characters to seats after layout change */
  OfficeState.prototype._reassignSeats = function () {
    // Reset all seat assignments
    this.seats.forEach(function (s) { s.assigned = false; });

    // Try to keep existing assignments
    var self = this;
    this.characters.forEach(function (ch) {
      if (ch.seatId && self.seats.has(ch.seatId)) {
        var seat = self.seats.get(ch.seatId);
        seat.assigned = true;
      } else {
        // Find a new seat
        ch.seatId = null;
        self.seats.forEach(function (s, sid) {
          if (!s.assigned && !ch.seatId) {
            ch.seatId = sid;
            s.assigned = true;
          }
        });
      }
    });
  };

  /** Center camera on the office */
  OfficeState.prototype.centerCamera = function (canvasWidth, canvasHeight) {
    var cols = this.tileMap[0] ? this.tileMap[0].length : T.DEFAULT_COLS;
    var rows = this.tileMap.length;
    var officeW = cols * T.TILE_SIZE * this.camera.zoom;
    var officeH = rows * T.TILE_SIZE * this.camera.zoom;
    this.camera.x = (canvasWidth - officeW) / 2;
    this.camera.y = (canvasHeight - officeH) / 2;
  };

  window.OfficeState = OfficeState;
})();
