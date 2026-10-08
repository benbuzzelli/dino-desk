// Hand-authored arena-style room templates for the dungeon redesign.
//
// The grid is the static layout (walls/floor/pillars/grass). Everything
// dynamic (guards, plates, keys, blocks, start, exit) lives in `spawns`
// so features don't have to be encoded in the grid chars.
//
// Grid legend:
//   '.'  floor
//   '#'  wall
//   'P'  pillar (acts as a wall, rendered as a single obstacle)
//   'g'  tall grass (floor + hide spot — guards can't see the player while they stand on it)
//   'O'  pit (blocks the player; push a block into it to fill and make floor)

import type { DinoSpecies } from '../shared/draw';

export const TEMPLATE_COLS = 15;
export const TEMPLATE_ROWS = 11;

export type KeyColor = 'red' | 'blue' | 'yellow';

export type Spawn =
  | { kind: 'start'; r: number; c: number }
  | { kind: 'exit'; r: number; c: number }
  | {
      kind: 'patrol-guard';
      r: number;
      c: number;
      patrol: { r: number; c: number }[];
      species?: DinoSpecies;
      color?: string;
    }
  | {
      kind: 'watcher';
      r: number;
      c: number;
      facing: 'up' | 'down' | 'left' | 'right';
      species?: DinoSpecies;
      color?: string;
    }
  | { kind: 'plate'; r: number; c: number }
  | { kind: 'plate-gate'; r: number; c: number }
  | { kind: 'key'; r: number; c: number; color: KeyColor }
  | { kind: 'door'; r: number; c: number; color: KeyColor }
  | { kind: 'block'; r: number; c: number }
  | { kind: 'treasure'; r: number; c: number; type: 'gem' | 'fossil' | 'egg' }
  // Fossil assembly: scatter fossils, point an altar at a target cell.
  // When the player stands on the altar with ≥ `requires` fossils, the fossils
  // are consumed and the target cell turns into floor (wall/pit → floor).
  | { kind: 'fossil'; r: number; c: number }
  | {
      kind: 'altar';
      r: number;
      c: number;
      requires: number;
      target: { r: number; c: number };
    }
  // Egg-as-puzzle-piece: pick up on walk-over, carry to a plate to hatch.
  // Hatched eggs permanently weigh their plate (same mechanic as a block), and
  // a baby dino sprite stays on the plate.
  | { kind: 'egg'; r: number; c: number };

export interface RoomTemplate {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  grid: string[]; // TEMPLATE_ROWS strings, each TEMPLATE_COLS chars
  spawns: Spawn[];
  tags?: string[];
}

// ------- Template 1: Simple Crossing (difficulty 1) -------
// Teaches: watch the guard's cone, walk past when they're facing away.
// Layout: open arena, one patrol guard walking a horizontal line through the
// middle. Player spawns top-left, exit bottom-right.

export const T_SIMPLE_CROSSING: RoomTemplate = {
  id: 'simple-crossing',
  name: 'Simple Crossing',
  difficulty: 1,
  tags: ['intro', 'stealth'],
  grid: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawns: [
    { kind: 'start', r: 1, c: 1 },
    { kind: 'exit', r: 9, c: 13 },
    {
      kind: 'patrol-guard',
      r: 5,
      c: 7,
      patrol: [
        { r: 5, c: 3 },
        { r: 5, c: 4 },
        { r: 5, c: 5 },
        { r: 5, c: 6 },
        { r: 5, c: 7 },
        { r: 5, c: 8 },
        { r: 5, c: 9 },
        { r: 5, c: 10 },
        { r: 5, c: 11 },
      ],
      species: 'raptor',
      color: '#2196F3',
    },
  ],
};

// ------- Template 2: Pillar Dance (difficulty 1) -------
// Teaches: pillars block guard vision. Move when the cone looks away.
// Layout: open arena with 4 pillars as cover, a single stationary watcher
// in the center sweeping its cone through 4 directions.

export const T_PILLAR_DANCE: RoomTemplate = {
  id: 'pillar-dance',
  name: 'Pillar Dance',
  difficulty: 1,
  tags: ['intro', 'stealth', 'cover'],
  grid: [
    '###############',
    '#.............#',
    '#.............#',
    '#...P.....P...#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#...P.....P...#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawns: [
    { kind: 'start', r: 1, c: 1 },
    { kind: 'exit', r: 9, c: 13 },
    {
      kind: 'watcher',
      r: 5,
      c: 7,
      facing: 'down',
      species: 'rex',
      color: '#F44336',
    },
  ],
};

export const T_NEW_ROOM: RoomTemplate = {
  id: "new-room",
  name: "New Room",
  difficulty: 1,
  grid: [
    "###############",
    "#...#..#......#",
    "#...#..#......#",
    "#.............#",
    "#...#..######.#",
    "########....#.#",
    "#...........#.#",
    "#...........#.#",
    "#...........#.#",
    "#...........#.#",
    "###############",
  ],
  spawns: [
    {"kind":"start","r":1,"c":1},
    {"kind":"exit","r":9,"c":13},
    {"kind":"plate","r":3,"c":3},
    {"kind":"plate-gate","r":3,"c":4},
    {"kind":"watcher","r":2,"c":6,"facing":"down"},
    {"kind":"key","r":4,"c":5,"color":"red"},
    {"kind":"door","r":6,"c":13,"color":"red"},
  ],
};


// ------- Template 3: First Plate (difficulty 2) -------
// Teaches: pressure plates open matching gates. Step on plate to pass.
// Layout: arena split by a wall with a single gate. Plate on the start side
// unlocks the gate; once open, player crosses to the exit side.

export const T_FIRST_PLATE: RoomTemplate = {
  id: 'first-plate',
  name: 'First Plate',
  difficulty: 2,
  tags: ['intro', 'plate'],
  grid: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#######.#######', // middle wall with a single floor tile that'll hold the gate
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawns: [
    { kind: 'start', r: 1, c: 1 },
    { kind: 'exit', r: 9, c: 13 },
    { kind: 'plate', r: 3, c: 7 },
    { kind: 'plate-gate', r: 5, c: 7 },
  ],
};

// ------- Template: Bone Chapel (difficulty 2) -------
// Showcases: fossil assembly + altar + egg hatching.
// Teaches: gather 3 scattered fossils → activate the altar → wall opens →
// travel to the plate up north → stand on it (ideally drop the egg for a
// hatch-on-plate bonus) → exit alcove unlocks.
// Puzzle flow:
//   1. Player starts in the south chamber (rows 5–9).
//   2. Collects 3 🦴 fossils scattered around the south floor.
//   3. Optionally picks up the 🥚 egg — it slows you but unlocks a cute
//      baby-on-plate moment when you drop it on the north plate.
//   4. Stands on the altar at (7, 7). Fossils are consumed; the single
//      wall tile at (4, 7) becomes floor, opening the way north.
//   5. Walks up into the north chamber (rows 1–3). The exit alcove
//      (cols 11–13) is sealed behind a plate-gate at (3, 10).
//   6. Presses the plate at (1, 2) (dropping the egg here hatches the
//      baby on the plate permanently). The gate opens.
//   7. Walks east through the gate, up to the exit at (1, 13).

export const T_BONE_CHAPEL: RoomTemplate = {
  id: 'bone-chapel',
  name: 'Bone Chapel',
  difficulty: 2,
  tags: ['intro', 'fossil', 'altar', 'egg'],
  grid: [
    '###############',
    '#.........#...#', // north exit alcove walled off at col 10
    '#.........#...#',
    '#.............#', // row 3 is the only passage — plate-gate lives at (3,10)
    '###############', // the dividing wall — altar opens the cell at col 7
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '###############',
  ],
  spawns: [
    { kind: 'start', r: 9, c: 1 },
    { kind: 'exit', r: 1, c: 13 },

    // The fossil puzzle: 3 bones to find in the south chamber, offered at the altar
    { kind: 'fossil', r: 5, c: 3 },
    { kind: 'fossil', r: 8, c: 5 },
    { kind: 'fossil', r: 6, c: 11 },
    { kind: 'altar', r: 7, c: 7, requires: 3, target: { r: 4, c: 7 } },

    // Egg + plate: optional-but-charming hatching moment
    { kind: 'egg', r: 9, c: 13 },
    { kind: 'plate', r: 1, c: 2 },
    { kind: 'plate-gate', r: 3, c: 10 },
  ],
};

// ------- Ordered library -------

export const TEMPLATES: RoomTemplate[] = [
  T_BONE_CHAPEL,
  T_NEW_ROOM,
  T_SIMPLE_CROSSING,
  T_PILLAR_DANCE,
  T_FIRST_PLATE,
  T_NEW_ROOM,
];

// Pick a template for a given level index. For now we cycle through the
// launch library so every run exercises all three; later this'll be driven
// by expedition length + difficulty ramp.
export function templateForLevel(level: number): RoomTemplate {
  return TEMPLATES[level % TEMPLATES.length];
}
