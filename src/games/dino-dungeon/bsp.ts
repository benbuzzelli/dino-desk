// BSP-based dungeon room generator (Phase 1: skeleton only — no content).
// Returns the same DungeonRoom shape the game expects; content placement
// (keys, doors, guards, plates, treasures, blocks) gets layered on in Phase 2.

import type { Difficulty } from '../shared/difficulty';

const COLS = 15;
const ROWS = 11;

type DungeonCell = 'empty' | 'wall';

type KeyColor = 'red' | 'blue' | 'yellow';

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
  species: 'rex' | 'stego' | 'bronto' | 'raptor' | 'ankylo' | 'para' | 'spino' | 'ptera' | 'tric';
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

interface PressurePlate {
  r: number;
  c: number;
  pressed: boolean;
}

interface PlateGate {
  r: number;
  c: number;
  open: boolean;
}

interface PushBlock {
  r: number;
  c: number;
}

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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Leaf {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: Leaf;
  right?: Leaf;
  room?: Rect;
}

const MIN_LEAF = 5; // smallest piece a BSP node can become
const MIN_ROOM = 3; // smallest carved room dimension

function splitLeaf(leaf: Leaf): void {
  // already split
  if (leaf.left || leaf.right) return;

  // too small to split further
  const canSplitH = leaf.h >= MIN_LEAF * 2;
  const canSplitV = leaf.w >= MIN_LEAF * 2;
  if (!canSplitH && !canSplitV) return;

  const splitHorizontally =
    canSplitH && canSplitV
      ? leaf.h > leaf.w * 1.25
        ? true
        : leaf.w > leaf.h * 1.25
          ? false
          : Math.random() < 0.5
      : canSplitH;

  if (splitHorizontally) {
    const range = leaf.h - MIN_LEAF * 2;
    const splitOffset = MIN_LEAF + Math.floor(Math.random() * (range + 1));
    leaf.left = { x: leaf.x, y: leaf.y, w: leaf.w, h: splitOffset };
    leaf.right = { x: leaf.x, y: leaf.y + splitOffset, w: leaf.w, h: leaf.h - splitOffset };
  } else {
    const range = leaf.w - MIN_LEAF * 2;
    const splitOffset = MIN_LEAF + Math.floor(Math.random() * (range + 1));
    leaf.left = { x: leaf.x, y: leaf.y, w: splitOffset, h: leaf.h };
    leaf.right = { x: leaf.x + splitOffset, y: leaf.y, w: leaf.w - splitOffset, h: leaf.h };
  }

  // keep splitting probabilistically — smaller leaves split less often to give variety
  if (Math.random() < 0.8) splitLeaf(leaf.left);
  if (Math.random() < 0.8) splitLeaf(leaf.right);
}

function carveRoom(leaf: Leaf, grid: DungeonCell[][]): void {
  if (leaf.left || leaf.right) {
    if (leaf.left) carveRoom(leaf.left, grid);
    if (leaf.right) carveRoom(leaf.right, grid);
    return;
  }
  // interior of leaf leaves a 1-tile margin on each side so corridors can run along the edges
  const maxW = leaf.w - 2;
  const maxH = leaf.h - 2;
  if (maxW < MIN_ROOM || maxH < MIN_ROOM) return;

  const roomW = MIN_ROOM + Math.floor(Math.random() * (maxW - MIN_ROOM + 1));
  const roomH = MIN_ROOM + Math.floor(Math.random() * (maxH - MIN_ROOM + 1));
  const roomX = leaf.x + 1 + Math.floor(Math.random() * (leaf.w - roomW - 1));
  const roomY = leaf.y + 1 + Math.floor(Math.random() * (leaf.h - roomH - 1));
  leaf.room = { x: roomX, y: roomY, w: roomW, h: roomH };

  for (let r = roomY; r < roomY + roomH; r++) {
    for (let c = roomX; c < roomX + roomW; c++) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = 'empty';
      }
    }
  }
}

function rectCenter(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + Math.floor(rect.w / 2),
    y: rect.y + Math.floor(rect.h / 2),
  };
}

function anyRoom(leaf: Leaf): Rect | undefined {
  if (leaf.room) return leaf.room;
  if (leaf.left) {
    const r = anyRoom(leaf.left);
    if (r) return r;
  }
  if (leaf.right) {
    const r = anyRoom(leaf.right);
    if (r) return r;
  }
  return undefined;
}

function carveCorridor(grid: DungeonCell[][], ax: number, ay: number, bx: number, by: number): void {
  // L-shape: horizontal first then vertical, randomly ordered
  if (Math.random() < 0.5) {
    for (let c = Math.min(ax, bx); c <= Math.max(ax, bx); c++) {
      if (ay >= 0 && ay < ROWS && c >= 0 && c < COLS) grid[ay][c] = 'empty';
    }
    for (let r = Math.min(ay, by); r <= Math.max(ay, by); r++) {
      if (r >= 0 && r < ROWS && bx >= 0 && bx < COLS) grid[r][bx] = 'empty';
    }
  } else {
    for (let r = Math.min(ay, by); r <= Math.max(ay, by); r++) {
      if (r >= 0 && r < ROWS && ax >= 0 && ax < COLS) grid[r][ax] = 'empty';
    }
    for (let c = Math.min(ax, bx); c <= Math.max(ax, bx); c++) {
      if (by >= 0 && by < ROWS && c >= 0 && c < COLS) grid[by][c] = 'empty';
    }
  }
}

function connectLeaves(leaf: Leaf, grid: DungeonCell[][]): void {
  if (!leaf.left || !leaf.right) return;
  connectLeaves(leaf.left, grid);
  connectLeaves(leaf.right, grid);
  const a = anyRoom(leaf.left);
  const b = anyRoom(leaf.right);
  if (!a || !b) return;
  const ca = rectCenter(a);
  const cb = rectCenter(b);
  carveCorridor(grid, ca.x, ca.y, cb.x, cb.y);
}

function collectRooms(leaf: Leaf, out: Rect[]): void {
  if (leaf.room) out.push(leaf.room);
  if (leaf.left) collectRooms(leaf.left, out);
  if (leaf.right) collectRooms(leaf.right, out);
}

export function buildBspRoom(_level: number, _difficulty: Difficulty): DungeonRoom {
  const grid: DungeonCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'wall' as DungeonCell),
  );

  // root covers the whole playable area minus the outer border walls
  const root: Leaf = { x: 1, y: 1, w: COLS - 2, h: ROWS - 2 };
  splitLeaf(root);
  carveRoom(root, grid);
  connectLeaves(root, grid);

  const rooms: Rect[] = [];
  collectRooms(root, rooms);

  // fallback: if the BSP happened to produce no rooms (extreme sizing edge case),
  // carve a single central open space so the game doesn't break.
  if (rooms.length === 0) {
    for (let r = 2; r < ROWS - 2; r++) {
      for (let c = 2; c < COLS - 2; c++) grid[r][c] = 'empty';
    }
    return emptyRoom(grid, 2, 2, ROWS - 3, COLS - 3);
  }

  // start in one corner-ish room, exit in the farthest room (by manhattan center distance)
  const startRoom = rooms[0];
  const start = rectCenter(startRoom);
  let exitRoom = startRoom;
  let maxDist = 0;
  for (const room of rooms) {
    const c = rectCenter(room);
    const d = Math.abs(c.x - start.x) + Math.abs(c.y - start.y);
    if (d > maxDist) {
      maxDist = d;
      exitRoom = room;
    }
  }
  const exit = rectCenter(exitRoom);

  return emptyRoom(grid, start.y, start.x, exit.y, exit.x);
}

function emptyRoom(
  grid: DungeonCell[][],
  startR: number,
  startC: number,
  exitR: number,
  exitC: number,
): DungeonRoom {
  return {
    grid,
    guards: [],
    treasures: [],
    keys: [],
    doors: [],
    plate: null,
    plateGate: null,
    blocks: [],
    fossils: [],
    altar: null,
    eggs: [],
    startR,
    startC,
    exitR,
    exitC,
  };
}
