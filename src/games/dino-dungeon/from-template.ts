// Converts a RoomTemplate into the DungeonRoom shape the game expects.
//
// The template's grid drives wall/floor layout. Spawns populate all dynamic
// features (guards, keys, plates, etc.). The output matches the existing
// `DungeonRoom` interface so the game's rendering and movement code can
// work unchanged.

import type { RoomTemplate } from './templates';
import { templateForLevel } from './templates';
import type { Difficulty } from '../shared/difficulty';

const ROWS = 11;
const COLS = 15;

type DungeonCell = 'empty' | 'wall' | 'grass' | 'pit';
type KeyColor = 'red' | 'blue' | 'yellow';
type DinoSpecies = 'rex' | 'stego' | 'bronto' | 'raptor' | 'ankylo' | 'para' | 'spino' | 'ptera' | 'tric';

interface Guard {
  kind: 'patrol' | 'watcher';
  r: number;
  c: number;
  patrolPath: { r: number; c: number }[];
  patrolIndex: number;
  patrolDir: 1 | -1;
  facing: 'up' | 'down' | 'left' | 'right';
  moveTimer: number;
  alertTimer: number;
  rotationTimer: number;
  species: DinoSpecies;
  color: string;
}

interface Treasure {
  r: number;
  c: number;
  collected: boolean;
  type: 'gem' | 'fossil' | 'egg';
  bobOffset: number;
}

interface DungeonKey {
  r: number;
  c: number;
  color: KeyColor;
  collected: boolean;
}

interface DungeonDoor {
  r: number;
  c: number;
  color: KeyColor;
  open: boolean;
}

interface PressurePlate { r: number; c: number; pressed: boolean }
interface PlateGate { r: number; c: number; open: boolean }
interface PushBlock { r: number; c: number }

interface Fossil { r: number; c: number; collected: boolean }
interface Altar { r: number; c: number; requires: number; targetR: number; targetC: number; used: boolean }
interface DungeonEgg {
  r: number;
  c: number;
  collected: boolean;
  hatched: boolean;
  hatchR?: number;
  hatchC?: number;
}

export interface DungeonRoom {
  grid: DungeonCell[][];
  guards: Guard[];
  treasures: Treasure[];
  startR: number;
  startC: number;
  exitR: number;
  exitC: number;
  keys: DungeonKey[];
  doors: DungeonDoor[];
  plate: PressurePlate | null;
  plateGate: PlateGate | null;
  blocks: PushBlock[];
  fossils: Fossil[];
  altar: Altar | null;
  eggs: DungeonEgg[];
}

function parseGrid(gridStrings: string[]): DungeonCell[][] {
  // Normalize to ROWS×COLS.
  //   '#' / 'P'  wall  (pillars act as walls for now)
  //   'g'        tall grass — walkable, hides player from guard vision
  //   'O'        pit — blocks player; push a block to fill it
  //   everything else → floor
  const grid: DungeonCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'wall' as DungeonCell),
  );
  for (let r = 0; r < ROWS; r++) {
    const row = gridStrings[r] ?? '';
    for (let c = 0; c < COLS; c++) {
      const ch = row[c] ?? '#';
      if (ch === '#' || ch === 'P') grid[r][c] = 'wall';
      else if (ch === 'g') grid[r][c] = 'grass';
      else if (ch === 'O') grid[r][c] = 'pit';
      else grid[r][c] = 'empty';
    }
  }
  return grid;
}

export function buildTemplateRoom(template: RoomTemplate): DungeonRoom {
  const grid = parseGrid(template.grid);

  const guards: Guard[] = [];
  const treasures: Treasure[] = [];
  const keys: DungeonKey[] = [];
  const doors: DungeonDoor[] = [];
  const blocks: PushBlock[] = [];
  const fossils: Fossil[] = [];
  const eggs: DungeonEgg[] = [];
  let altar: Altar | null = null;
  let plate: PressurePlate | null = null;
  let plateGate: PlateGate | null = null;
  let startR = 1;
  let startC = 1;
  let exitR = ROWS - 2;
  let exitC = COLS - 2;

  for (const s of template.spawns) {
    switch (s.kind) {
      case 'start':
        startR = s.r;
        startC = s.c;
        // ensure the tile is walkable
        grid[s.r][s.c] = 'empty';
        break;
      case 'exit':
        exitR = s.r;
        exitC = s.c;
        grid[s.r][s.c] = 'empty';
        break;
      case 'patrol-guard': {
        const facings: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
        guards.push({
          kind: 'patrol',
          r: s.r,
          c: s.c,
          patrolPath: s.patrol.length > 0 ? s.patrol : [{ r: s.r, c: s.c }],
          patrolIndex: 0,
          patrolDir: 1,
          facing: 'down',
          moveTimer: 0,
          alertTimer: 0,
          rotationTimer: 0,
          species: s.species ?? 'raptor',
          color: s.color ?? '#2196F3',
        });
        void facings;
        break;
      }
      case 'watcher':
        guards.push({
          kind: 'watcher',
          r: s.r,
          c: s.c,
          patrolPath: [{ r: s.r, c: s.c }],
          patrolIndex: 0,
          patrolDir: 1,
          facing: s.facing,
          moveTimer: 0,
          alertTimer: 0,
          rotationTimer: 2 + Math.random(),
          species: s.species ?? 'rex',
          color: s.color ?? '#F44336',
        });
        break;
      case 'plate':
        plate = { r: s.r, c: s.c, pressed: false };
        grid[s.r][s.c] = 'empty';
        break;
      case 'plate-gate':
        plateGate = { r: s.r, c: s.c, open: false };
        // gate sits on a floor tile — the game treats it as wall while closed
        grid[s.r][s.c] = 'empty';
        break;
      case 'key':
        keys.push({ r: s.r, c: s.c, color: s.color, collected: false });
        grid[s.r][s.c] = 'empty';
        break;
      case 'door':
        doors.push({ r: s.r, c: s.c, color: s.color, open: false });
        grid[s.r][s.c] = 'empty';
        break;
      case 'block':
        blocks.push({ r: s.r, c: s.c });
        grid[s.r][s.c] = 'empty';
        break;
      case 'treasure':
        treasures.push({
          r: s.r,
          c: s.c,
          collected: false,
          type: s.type,
          bobOffset: Math.random() * Math.PI * 2,
        });
        grid[s.r][s.c] = 'empty';
        break;
      case 'fossil':
        fossils.push({ r: s.r, c: s.c, collected: false });
        grid[s.r][s.c] = 'empty';
        break;
      case 'altar':
        altar = {
          r: s.r,
          c: s.c,
          requires: Math.max(1, s.requires),
          targetR: s.target.r,
          targetC: s.target.c,
          used: false,
        };
        grid[s.r][s.c] = 'empty';
        break;
      case 'egg':
        eggs.push({ r: s.r, c: s.c, collected: false, hatched: false });
        grid[s.r][s.c] = 'empty';
        break;
    }
  }

  return {
    grid,
    guards,
    treasures,
    startR,
    startC,
    exitR,
    exitC,
    keys,
    doors,
    plate,
    plateGate,
    blocks,
    fossils,
    altar,
    eggs,
  };
}

export function buildTemplateLevel(level: number, _difficulty: Difficulty): DungeonRoom {
  const template = templateForLevel(level);
  return buildTemplateRoom(template);
}
