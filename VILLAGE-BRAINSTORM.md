# Village Theme — Joint Brainstorm (ApoMac + Sycopa)

## Problem
Sycopa's `office-green-iso` references assets we DON'T HAVE (Pixel Crawler RPG pack: Body_A, Orcs, Skeletons, Knights, Wizzards, etc.). Result: black screen, 100+ 404 errors. We need to build with what we ACTUALLY have.

## What We ACTUALLY Have (verified on disk)

### Kenney Nature Kit (329 isometric sprites, 512×512px, CC0)
Path: `lib/sprites/kenney-nature-kit/Isometric/{name}_NE.png`

**Ground (seamless iso tiles, already proven working):**
- grass, grass_large, grass_leafs, grass_leafsLarge
- ground_grass, ground_pathBend/Corner/Cross/End/Split/Straight/Tile (14 path pieces)
- ground_riverBend/Corner/Cross/End/Split/Straight/Tile (14 river pieces)

**Trees (61 variants!):**
- tree_default, tree_thin, tree_tall, tree_fat, tree_oak, tree_simple, tree_small, tree_detailed
- tree_blocks, tree_cone, tree_plateau
- tree_pine* (16 variants: DefaultA/B, GroundA/B, RoundA-F, SmallA-D, TallA-D_detailed)
- tree_palm* (6 variants)
- Each has `_dark` and `_fall` (autumn 🍂) versions

**Buildings/Structures:**
- tent_detailedClosed, tent_detailedOpen, tent_smallClosed, tent_smallOpen
- cabin_NE (if it exists, needs verification)
- bridge_stone, bridge_stoneNarrow, bridge_stoneRound, bridge_stoneRoundNarrow
- bridge_wood, bridge_woodNarrow, bridge_woodRound, bridge_woodRoundNarrow
- bridge_center_stone/wood (+ Round variants), bridge_side_stone/wood (+ Round variants)

**Agriculture:**
- crops_cornStageA-D, crops_wheatStageA-B, crops_bambooStageA-B, crops_leafsStageA-B
- crops_dirtRow/Corner/End/Single/DoubleRow/DoubleRowCorner/DoubleRowEnd
- crop_carrot, crop_melon, crop_pumpkin, crop_turnip

**Decorations:**
- flower_purpleA-C, flower_redA-C, flower_yellowA-C
- mushroom_red/redGroup/redTall, mushroom_tan/tanGroup/tanTall
- plant_bush (6 variants), plant_flatShort/Tall
- rock_largeA-F, rock_smallA-I, rock_tallA-J, rock_smallFlatA-C, rock_smallTopA-B
- stone_* (same variants as rock)
- log, log_large, log_stack, log_stackLarge
- stump_old/round/square (+ detailed variants)
- campfire_bricks/logs/planks/stones

**Fences:**
- fence_bend/bendCenter/corner/gate/planks/planksDouble/simple/simpleCenter/simpleDiagonal/simpleDiagonalCenter/simpleHigh/simpleLow

**Other:**
- sign, statue_block/column/columnDamaged/head/obelisk/ring
- canoe, canoe_paddle, bed, bed_floor
- cliff_* (56 variants with caves, waterfalls!)
- hanging_moss, lily_large/small
- platform_beach/grass/stone, pot_large/small

### Kenney Miniature Prototype (characters, 256×512px)
Path: `lib/sprites/kenney-iso-miniature-proto/Characters/Human/`
- Human_0 through Human_7 (8 skins)
- Each: Idle0, Run0-Run9, Pickup0-Pickup9
- ⚠️ Style: blocky/minimalist grey — does NOT match Nature Kit's lush style

### Kenney Castle Kit (76 3D preview PNGs, 64×64px)
Path: `lib/sprites/kenney-castle-kit/Previews/`
- Towers (square/hexagon, bases/mids/tops/roofs), walls (many variants), gates, bridges
- Flags, siege weapons, stairs, trees
- ⚠️ Style: 3D low-poly renders, NOT isometric tiles

### Kenney Graveyard Kit (91 3D preview PNGs, 64×64px)
Path: `lib/sprites/kenney-graveyard-kit/Previews/`
- 5 characters: ghost, keeper, skeleton, vampire, zombie
- Crypts, gravestones, iron fences, pumpkins, candles, lanterns, pine trees
- ⚠️ Same style issue: 3D renders

### Kenney Blocky Characters (18 3D preview PNGs, 64×64px)
Path: `lib/sprites/kenney-blocky-characters/Previews/`
- character-a through character-r (18 different character designs)
- ⚠️ 3D Minecraft-style renders

### Modern Office Revamped (339 objects, 48×48px)
Path: `lib/sprites/modern-office-revamped/`
- Top-down pixel art office furniture — completely different theme

### Pixel Crawler Free Pack (in Downloads, not extracted yet)
- ~/Downloads/Pixel Crawler - Free Pack 2.0.4.zip
- This is likely what Sycopa coded for! Needs extraction.

### Pixel Art Village Props (in Downloads, not extracted yet)
- ~/Downloads/Pixel Art Platformer - Village Props v2.3.0.zip (latest)
- Could have houses, animals, etc.

## Working Tiling Engine (PROVEN)
File: `office-simcity/index.html` (v3, Canvas 2D)
- Uses isocity formula: `(col-row)*tileW/2, (col+row)*tileH/2`
- Kenney Nature Kit diamond = 130×65px within 512×512 source
- Scale 0.25 → 128px tiles on screen, seamless, 60fps
- Pan, zoom, click all working

## What Kira Wants
1. Routes (paths connecting buildings) ✅ we have path tiles
2. A river with bridge ✅ we have river tiles + bridge tiles
3. Houses ❌ only tents/cabins in Nature Kit
4. Animals ❌ nothing in current packs
5. Characters that match the style ❌ Miniature Proto doesn't match
6. A proper cozy village feel — not sparse

## KEY QUESTION FOR SYCOPA
Should we:
A) Extract the Pixel Crawler pack + Village Props and use THOSE (top-down RPG style like your code expected)?
B) Stick with Nature Kit isometric + find a way to make characters work?
C) Hybrid: Nature Kit terrain + generated/custom pixel characters on top?

## Constraints
- Must be a SINGLE HTML file
- Must use ONLY assets that exist locally (no external URLs)
- Must test and verify rendering before claiming done
- Canvas 2D preferred (proven working), Pixi.js acceptable
- 60fps target on M4 Pro
