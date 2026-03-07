/**
 * office-worker/characters.js — Character creation + state machine
 * Ported from pixel-agents characters.ts. Pure update function, no rendering.
 */
(function () {
  'use strict';
  var T = window.OfficeTypes;
  var TM = window.TileMap;

  function randomRange(min, max) { return min + Math.random() * (max - min); }
  function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  /** Direction from one tile to an adjacent tile */
  function directionBetween(fromCol, fromRow, toCol, toRow) {
    var dc = toCol - fromCol;
    var dr = toRow - fromRow;
    if (dc > 0) return T.Direction.RIGHT;
    if (dc < 0) return T.Direction.LEFT;
    if (dr > 0) return T.Direction.DOWN;
    return T.Direction.UP;
  }

  /** Create a new character */
  function createCharacter(id, name, seatId, seat, palette) {
    var col = seat ? seat.col : 1;
    var row = seat ? seat.row : 1;
    var center = TM.tileCenter(col, row);
    return {
      id: id,
      name: name || 'Agent ' + id,
      state: T.CharacterState.WORK,
      dir: seat ? seat.facingDir : T.Direction.DOWN,
      x: center.x,
      y: center.y,
      tileCol: col,
      tileRow: row,
      path: [],
      moveProgress: 0,
      currentTool: null,
      toolStatus: '',
      palette: palette || 0,
      frame: 0,
      frameTimer: 0,
      wanderTimer: 0,
      wanderCount: 0,
      wanderLimit: randomInt(T.WANDER_MOVES_MIN, T.WANDER_MOVES_MAX),
      isActive: true,
      seatId: seatId,
      seatTimer: 0,
      bubbleType: null,
      bubbleTimer: 0,
      emoji: '💻'
    };
  }

  /** Update character state machine — called every frame */
  function updateCharacter(ch, dt, walkableTiles, seats, tileMap, blockedTiles) {
    ch.frameTimer += dt;

    switch (ch.state) {
      case T.CharacterState.WORK:
        _updateWork(ch, dt, seats, tileMap, blockedTiles);
        break;
      case T.CharacterState.IDLE:
        _updateIdle(ch, dt, walkableTiles, seats, tileMap, blockedTiles);
        break;
      case T.CharacterState.WALK:
        _updateWalk(ch, dt, seats, tileMap, blockedTiles);
        break;
    }
  }

  function _updateWork(ch, dt, seats, tileMap, blockedTiles) {
    // Typing/working animation
    if (ch.frameTimer >= T.WORK_FRAME_DURATION) {
      ch.frameTimer -= T.WORK_FRAME_DURATION;
      ch.frame = (ch.frame + 1) % 2;
    }
    // If no longer active, transition to idle (with delay)
    if (!ch.isActive) {
      if (ch.seatTimer > 0) {
        ch.seatTimer -= dt;
        return;
      }
      ch.state = T.CharacterState.IDLE;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderTimer = randomRange(T.WANDER_PAUSE_MIN, T.WANDER_PAUSE_MAX);
      ch.wanderCount = 0;
      ch.wanderLimit = randomInt(T.WANDER_MOVES_MIN, T.WANDER_MOVES_MAX);
    }
  }

  function _updateIdle(ch, dt, walkableTiles, seats, tileMap, blockedTiles) {
    ch.frame = 0;
    // If became active, pathfind to seat
    if (ch.isActive) {
      _pathToSeat(ch, seats, tileMap, blockedTiles);
      return;
    }
    // Countdown wander timer
    ch.wanderTimer -= dt;
    if (ch.wanderTimer <= 0) {
      // Wandered enough? Return to seat for rest
      if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
        var seat = seats.get(ch.seatId);
        if (seat) {
          var path = TM.findPath(ch.tileCol, ch.tileRow, seat.col, seat.row, tileMap, blockedTiles);
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = T.CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
            return;
          }
        }
      }
      // Pick a random walkable tile
      if (walkableTiles.length > 0) {
        var target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
        var path = TM.findPath(ch.tileCol, ch.tileRow, target.col, target.row, tileMap, blockedTiles);
        if (path.length > 0) {
          ch.path = path;
          ch.moveProgress = 0;
          ch.state = T.CharacterState.WALK;
          ch.frame = 0;
          ch.frameTimer = 0;
          ch.wanderCount++;
        }
      }
      ch.wanderTimer = randomRange(T.WANDER_PAUSE_MIN, T.WANDER_PAUSE_MAX);
    }
  }

  function _updateWalk(ch, dt, seats, tileMap, blockedTiles) {
    // Walk animation
    if (ch.frameTimer >= T.WALK_FRAME_DURATION) {
      ch.frameTimer -= T.WALK_FRAME_DURATION;
      ch.frame = (ch.frame + 1) % 4;
    }

    if (ch.path.length === 0) {
      // Path complete — arrived
      var center = TM.tileCenter(ch.tileCol, ch.tileRow);
      ch.x = center.x;
      ch.y = center.y;
      _arriveAtTile(ch, seats);
      return;
    }

    // Move toward next tile
    var next = ch.path[0];
    ch.dir = directionBetween(ch.tileCol, ch.tileRow, next.col, next.row);
    ch.moveProgress += (T.WALK_SPEED / T.TILE_SIZE) * dt;

    var from = TM.tileCenter(ch.tileCol, ch.tileRow);
    var to = TM.tileCenter(next.col, next.row);
    var t = Math.min(ch.moveProgress, 1);
    ch.x = from.x + (to.x - from.x) * t;
    ch.y = from.y + (to.y - from.y) * t;

    if (ch.moveProgress >= 1) {
      ch.tileCol = next.col;
      ch.tileRow = next.row;
      ch.x = to.x;
      ch.y = to.y;
      ch.path.shift();
      ch.moveProgress = 0;
    }

    // If became active while walking, repath to seat
    if (ch.isActive && ch.seatId) {
      var seat = seats.get(ch.seatId);
      if (seat) {
        var lastStep = ch.path[ch.path.length - 1];
        if (!lastStep || lastStep.col !== seat.col || lastStep.row !== seat.row) {
          var newPath = TM.findPath(ch.tileCol, ch.tileRow, seat.col, seat.row, tileMap, blockedTiles);
          if (newPath.length > 0) {
            ch.path = newPath;
            ch.moveProgress = 0;
          }
        }
      }
    }
  }

  function _pathToSeat(ch, seats, tileMap, blockedTiles) {
    if (!ch.seatId) {
      ch.state = T.CharacterState.WORK;
      ch.frame = 0;
      ch.frameTimer = 0;
      return;
    }
    var seat = seats.get(ch.seatId);
    if (!seat) return;
    var path = TM.findPath(ch.tileCol, ch.tileRow, seat.col, seat.row, tileMap, blockedTiles);
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = T.CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat
      ch.state = T.CharacterState.WORK;
      ch.dir = seat.facingDir;
      ch.frame = 0;
      ch.frameTimer = 0;
    }
  }

  function _arriveAtTile(ch, seats) {
    if (ch.isActive) {
      if (ch.seatId) {
        var seat = seats.get(ch.seatId);
        if (seat && ch.tileCol === seat.col && ch.tileRow === seat.row) {
          ch.state = T.CharacterState.WORK;
          ch.dir = seat.facingDir;
        } else {
          ch.state = T.CharacterState.IDLE;
        }
      } else {
        ch.state = T.CharacterState.WORK;
      }
    } else {
      // Returning to seat while idle — rest before wandering again
      if (ch.seatId) {
        var seat = seats.get(ch.seatId);
        if (seat && ch.tileCol === seat.col && ch.tileRow === seat.row) {
          ch.state = T.CharacterState.WORK;
          ch.dir = seat.facingDir;
          ch.seatTimer = randomRange(T.SEAT_REST_MIN, T.SEAT_REST_MAX);
          ch.wanderCount = 0;
          ch.wanderLimit = randomInt(T.WANDER_MOVES_MIN, T.WANDER_MOVES_MAX);
          ch.frame = 0;
          ch.frameTimer = 0;
          return;
        }
      }
      ch.state = T.CharacterState.IDLE;
      ch.wanderTimer = randomRange(T.WANDER_PAUSE_MIN, T.WANDER_PAUSE_MAX);
    }
    ch.frame = 0;
    ch.frameTimer = 0;
  }

  window.Characters = {
    create: createCharacter,
    update: updateCharacter
  };
})();
