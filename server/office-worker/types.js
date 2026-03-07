/**
 * office-worker/types.js — Shared constants, enums, and type definitions (JSDoc)
 * Ported from pixel-agents architecture, adapted for SpawnKit.
 */
'use strict';

// ── Tile System ──
var TILE_SIZE = 32;
var DEFAULT_COLS = 20;
var DEFAULT_ROWS = 14;

var TileType = { FLOOR: 0, WALL: 1, VOID: 2 };
var CharacterState = { IDLE: 'idle', WALK: 'walk', WORK: 'work' };
var Direction = { DOWN: 0, LEFT: 1, RIGHT: 2, UP: 3 };

// ── Animation Timing ──
var WALK_SPEED = 64;           // pixels per second
var WALK_FRAME_DURATION = 0.15; // seconds per walk frame
var WORK_FRAME_DURATION = 0.4;  // seconds per work frame (typing)
var IDLE_FRAME_DURATION = 0.8;  // seconds per idle frame

// ── Behavior ──
var WANDER_PAUSE_MIN = 2.0;    // seconds before next wander
var WANDER_PAUSE_MAX = 6.0;
var WANDER_MOVES_MIN = 2;
var WANDER_MOVES_MAX = 5;
var SEAT_REST_MIN = 4.0;       // seconds resting at seat when idle
var SEAT_REST_MAX = 10.0;

// ── Rendering ──
var BUBBLE_OFFSET_Y = -8;      // speech bubble Y offset from character
var BUBBLE_FADE_DURATION = 0.5; // seconds
var MAX_DELTA_TIME = 0.1;       // cap delta time to prevent teleporting

// ── Colors ──
var FLOOR_COLOR = '#3a3f47';
var WALL_COLOR = '#2a2d35';
var GRID_COLOR = 'rgba(255,255,255,0.03)';
var SEAT_AVAILABLE = 'rgba(74,222,128,0.3)';
var SEAT_BUSY = 'rgba(239,68,68,0.3)';

// Export for IIFE modules
if (typeof window !== 'undefined') {
  window.OfficeTypes = {
    TILE_SIZE: TILE_SIZE,
    DEFAULT_COLS: DEFAULT_COLS,
    DEFAULT_ROWS: DEFAULT_ROWS,
    TileType: TileType,
    CharacterState: CharacterState,
    Direction: Direction,
    WALK_SPEED: WALK_SPEED,
    WALK_FRAME_DURATION: WALK_FRAME_DURATION,
    WORK_FRAME_DURATION: WORK_FRAME_DURATION,
    IDLE_FRAME_DURATION: IDLE_FRAME_DURATION,
    WANDER_PAUSE_MIN: WANDER_PAUSE_MIN,
    WANDER_PAUSE_MAX: WANDER_PAUSE_MAX,
    WANDER_MOVES_MIN: WANDER_MOVES_MIN,
    WANDER_MOVES_MAX: WANDER_MOVES_MAX,
    SEAT_REST_MIN: SEAT_REST_MIN,
    SEAT_REST_MAX: SEAT_REST_MAX,
    BUBBLE_OFFSET_Y: BUBBLE_OFFSET_Y,
    BUBBLE_FADE_DURATION: BUBBLE_FADE_DURATION,
    MAX_DELTA_TIME: MAX_DELTA_TIME,
    FLOOR_COLOR: FLOOR_COLOR,
    WALL_COLOR: WALL_COLOR,
    GRID_COLOR: GRID_COLOR,
    SEAT_AVAILABLE: SEAT_AVAILABLE,
    SEAT_BUSY: SEAT_BUSY
  };
}
