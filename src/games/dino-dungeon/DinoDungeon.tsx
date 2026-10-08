import { useRef, useCallback } from 'react';
import { drawDino, drawWalkDino, drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawEasyModeButton } from '../shared/draw';
import type { DinoSpecies, WalkDirection } from '../shared/draw';
import { getWallTileImage, getBaseGrassTileImage, getFinishImage, getArrowImage, getFossilBoneImage, getAltarImage, getPressurePlateImage, getDungeonKeyImage, getDungeonEggImage } from '../shared/dino-svgs';
import { spawnCelebration, updateParticles, drawParticles } from '../shared/particles';
import { playStep, playCelebration, playSticker, playPop, playSuccess, playMismatch } from '../shared/audio';
import { earnSticker, trackProgress } from '../shared/stickers';
import { isEasyMode, toggleEasyMode } from '../shared/easyMode';
import { normalizeMoveKey } from '../shared/input';
import { getDifficulty } from '../shared/difficulty';
import type { Difficulty } from '../shared/difficulty';
import { trackDinoEncounter } from '../shared/collection';
import { useGameCanvas } from '../shared/useGameCanvas';
import type { Particle, Point } from '../shared/types';
import { buildBspRoom } from './bsp';
import { buildTemplateLevel } from './from-template';
import { templateForLevel } from './templates';

type DungeonGenerator = 'tree' | 'bsp' | 'template';
const DUNGEON_GEN_KEY = 'dinoLearn_dungeonGen';
function getDungeonGenerator(): DungeonGenerator {
  try {
    const v = localStorage.getItem(DUNGEON_GEN_KEY);
    if (v === 'bsp' || v === 'template') return v;
  } catch {}
  return 'tree';
}

// Exit opens when: difficulty is hard (doors gate the path), OR the room has no
// treasures to pick up (e.g. BSP skeleton rooms in Phase 1 of the generator refactor).
function computeInitialExitOpen(room: { treasures: unknown[] }, difficulty: Difficulty): boolean {
  return difficulty === 'hard' || room.treasures.length === 0;
}

const W = 800;
const H = 600;
const COLS = 15;
const ROWS = 11;
const TILE = 50;

type DungeonCell = 'empty' | 'wall' | 'grass' | 'pit';

type GuardKind = 'patrol' | 'watcher';

interface Guard {
  kind: GuardKind;
  r: number;
  c: number;
  patrolPath: { r: number; c: number }[];
  patrolIndex: number;
  patrolDir: 1 | -1;
  facing: 'up' | 'down' | 'left' | 'right';
  moveTimer: number;
  alertTimer: number;
  rotationTimer: number;  // watcher: countdown until next rotation
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

type KeyColor = 'red' | 'blue' | 'yellow';

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

interface Fossil {
  r: number;
  c: number;
  collected: boolean;
}

interface Altar {
  r: number;
  c: number;
  requires: number;
  targetR: number;
  targetC: number;
  used: boolean;
}

interface DungeonEgg {
  r: number;
  c: number;
  collected: boolean;  // picked up by the player
  hatched: boolean;    // dropped on a plate and hatched
  hatchR?: number;     // where the baby dino ended up
  hatchC?: number;
}

interface DungeonRoom {
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

const PLATE_COLOR = '#66BB6A';
const PLATE_GATE_COLOR = '#2E7D32';
const BLOCK_COLOR = '#A1887F';
const BLOCK_EDGE = '#6D4C41';

const KEY_COLORS: Record<KeyColor, string> = {
  red: '#EF5350',
  blue: '#42A5F5',
  yellow: '#FFC107',
};

const GUARD_POOL: { species: DinoSpecies; color: string }[] = [
  { species: 'raptor', color: '#2196F3' },
  { species: 'rex', color: '#F44336' },
  { species: 'spino', color: '#3F51B5' },
  { species: 'ankylo', color: '#009688' },
];

const TREASURE_COLORS: Record<string, string> = {
  gem: '#E040FB',
  fossil: '#BCAAA4',
  egg: '#FFD700',
};

const TREASURE_EMOJIS: Record<string, string> = {
  gem: '💎',
  fossil: '🦴',
  egg: '🥚',
};

function generateRoom(level: number, difficulty: Difficulty = 'medium'): DungeonRoom {
  // Dungeon generator flag (localStorage 'dinoLearn_dungeonGen'):
  //   'tree'     — default, procedural maze (current)
  //   'bsp'      — BSP skeleton, empty rooms for testing (Phase 1 of gen refactor)
  //   'template' — hand-authored arena templates (the redesign — see DUNGEON_REDESIGN.md)
  const gen = getDungeonGenerator();
  if (gen === 'template') {
    return buildTemplateLevel(level, difficulty);
  }
  if (gen === 'bsp') {
    return buildBspRoom(level, difficulty);
  }
  // retry generation until we produce a provably solvable room
  for (let attempt = 0; attempt < 10; attempt++) {
    const room = buildRoom(level, difficulty);
    if (isRoomSolvable(room)) return room;
    // as a fallback, try stripping blocks (the only element that can theoretically
    // soft-lock the verifier even with safe placement, thanks to guards etc.)
    if (room.blocks.length > 0) {
      const stripped: DungeonRoom = { ...room, blocks: [] };
      if (isRoomSolvable(stripped)) return stripped;
    }
  }
  // last resort: emit a block-free, plate-free room so the player can always finish
  const fallback = buildRoom(level, difficulty);
  return { ...fallback, blocks: [], plate: null, plateGate: null };
}

function isRoomSolvable(room: DungeonRoom): boolean {
  // BFS over (r, c, keyMask, carryingEgg, eggOnPlate). Plates are non-latching,
  // so the gate only stays open while something sits on the plate. Tracked:
  //   - carryingEgg: the player is walking with an egg; they'll deposit it
  //     when they step on the plate.
  //   - eggOnPlate: an egg has been hatched on the plate (permanent weight).
  // Blocks are treated as immovable walls in this conservative check — if the
  // block placement happens to sit on the plate at spawn, that counts as
  // permanent weight.
  const keyColors = [...new Set(room.keys.map((k) => k.color))];
  const keyBit: Partial<Record<KeyColor, number>> = {};
  keyColors.forEach((col, i) => { keyBit[col] = 1 << i; });
  const blockSet = new Set(room.blocks.map((b) => `${b.r},${b.c}`));
  const staticBlockOnPlate = !!room.plate && blockSet.has(`${room.plate.r},${room.plate.c}`);

  type State = { r: number; c: number; keys: number; carryingEgg: boolean; eggOnPlate: boolean };
  const stateKey = (st: State) => `${st.r},${st.c},${st.keys},${st.carryingEgg ? 1 : 0},${st.eggOnPlate ? 1 : 0}`;

  const initial: State = {
    r: room.startR,
    c: room.startC,
    keys: 0,
    carryingEgg: false,
    eggOnPlate: staticBlockOnPlate,
  };
  const seen = new Set<string>([stateKey(initial)]);
  const queue: State[] = [initial];

  const platePressed = (st: State) => {
    if (!room.plate) return false;
    if (st.eggOnPlate) return true;
    return st.r === room.plate.r && st.c === room.plate.c;
  };

  while (queue.length > 0) {
    const st = queue.shift()!;
    if (st.r === room.exitR && st.c === room.exitC) return true;

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = st.r + dr;
      const nc = st.c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (room.grid[nr][nc] === 'wall' || room.grid[nr][nc] === 'pit') continue;
      if (blockSet.has(`${nr},${nc}`)) continue;

      const door = room.doors.find((d) => d.r === nr && d.c === nc);
      if (door) {
        const bit = keyBit[door.color];
        if (bit === undefined || (st.keys & bit) === 0) continue;
      }
      // Gate is open iff plate is pressed at the time of the move.
      if (
        room.plateGate &&
        room.plateGate.r === nr &&
        room.plateGate.c === nc &&
        !platePressed(st)
      ) continue;

      let newKeys = st.keys;
      const pickedKey = room.keys.find((k) => k.r === nr && k.c === nc);
      if (pickedKey) {
        const bit = keyBit[pickedKey.color];
        if (bit !== undefined) newKeys |= bit;
      }

      // Branching: if an egg sits at (nr, nc) and we're not carrying one, try
      // both picking it up and leaving it. If we're carrying an egg and (nr,nc)
      // is the plate, depositing it is the obvious win — branch into that too.
      const eggAvailable = !st.carryingEgg && !st.eggOnPlate
        && room.eggs.some((e) => e.r === nr && e.c === nc);
      const canDepositHere = st.carryingEgg && room.plate
        && room.plate.r === nr && room.plate.c === nc;

      const nextStates: State[] = [];
      // Base transition — no pickup, no deposit
      nextStates.push({ r: nr, c: nc, keys: newKeys, carryingEgg: st.carryingEgg, eggOnPlate: st.eggOnPlate });
      // Pick up egg
      if (eggAvailable) {
        nextStates.push({ r: nr, c: nc, keys: newKeys, carryingEgg: true, eggOnPlate: st.eggOnPlate });
      }
      // Deposit egg on plate
      if (canDepositHere) {
        nextStates.push({ r: nr, c: nc, keys: newKeys, carryingEgg: false, eggOnPlate: true });
      }

      for (const next of nextStates) {
        const sk = stateKey(next);
        if (!seen.has(sk)) {
          seen.add(sk);
          queue.push(next);
        }
      }
    }
  }
  return false;
}

function buildRoom(level: number, difficulty: Difficulty = 'medium'): DungeonRoom {
  const grid: DungeonCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'wall' as DungeonCell),
  );

  // maze generation — iterative backtracking
  const visited = new Set<string>();
  const stack: { r: number; c: number }[] = [];
  const start = { r: 1, c: 1 };
  visited.add(`${start.r},${start.c}`);
  grid[start.r][start.c] = 'empty';
  stack.push(start);

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const neighbors: { r: number; c: number; wr: number; wc: number }[] = [];

    for (const [dr, dc] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && !visited.has(`${nr},${nc}`)) {
        neighbors.push({ r: nr, c: nc, wr: cur.r + dr / 2, wc: cur.c + dc / 2 });
      }
    }

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      visited.add(`${next.r},${next.c}`);
      grid[next.r][next.c] = 'empty';
      grid[next.wr][next.wc] = 'empty';
      stack.push({ r: next.r, c: next.c });
    }
  }

  // widen passages for toddler friendliness (skip in hard — keeps a strict tree for doors)
  if (difficulty !== 'hard') {
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (grid[r][c] === 'wall' && Math.random() < 0.45) {
          let adj = 0;
          if (r > 0 && grid[r - 1][c] === 'empty') adj++;
          if (r < ROWS - 1 && grid[r + 1][c] === 'empty') adj++;
          if (c > 0 && grid[r][c - 1] === 'empty') adj++;
          if (c < COLS - 1 && grid[r][c + 1] === 'empty') adj++;
          if (adj >= 2) grid[r][c] = 'empty';
        }
      }
    }
  }

  // find reachable cells via flood fill
  const reachable = new Set<string>();
  const floodStack = [{ r: 1, c: 1 }];
  reachable.add('1,1');
  while (floodStack.length > 0) {
    const { r, c } = floodStack.pop()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === 'empty' && !reachable.has(key)) {
        reachable.add(key);
        floodStack.push({ r: nr, c: nc });
      }
    }
  }

  const reachableCells = [...reachable].map((k) => {
    const [r, c] = k.split(',').map(Number);
    return { r, c };
  });

  // find exit — farthest from start
  let maxDist = 0;
  let exitR = ROWS - 2;
  let exitC = COLS - 2;
  for (const cell of reachableCells) {
    const dist = Math.abs(cell.r - 1) + Math.abs(cell.c - 1);
    if (dist > maxDist) {
      maxDist = dist;
      exitR = cell.r;
      exitC = cell.c;
    }
  }

  // place treasures on dead-ends and far cells
  const deadEnds = reachableCells.filter(({ r, c }) => {
    if (r === 1 && c === 1) return false;
    if (r === exitR && c === exitC) return false;
    let adj = 0;
    if (r > 0 && grid[r - 1][c] === 'empty') adj++;
    if (r < ROWS - 1 && grid[r + 1][c] === 'empty') adj++;
    if (c > 0 && grid[r][c - 1] === 'empty') adj++;
    if (c < COLS - 1 && grid[r][c + 1] === 'empty') adj++;
    return adj === 1;
  });

  const treasureTypes: Treasure['type'][] = ['gem', 'fossil', 'egg'];
  const treasureCount = Math.min(2 + Math.floor(level / 2), 5, deadEnds.length);
  const shuffled = deadEnds.sort(() => Math.random() - 0.5);
  const treasures: Treasure[] = shuffled.slice(0, treasureCount).map((pos, i) => ({
    r: pos.r,
    c: pos.c,
    collected: false,
    type: treasureTypes[i % treasureTypes.length],
    bobOffset: Math.random() * Math.PI * 2,
  }));

  // compute the critical cells: every cell on the start→exit route.
  // watchers must not spawn on these; patrols should have patrols that include at least one off-path cell.
  const criticalCells = new Set<string>();
  for (const cell of shortestPath(grid, 1, 1, exitR, exitC)) {
    criticalCells.add(`${cell.r},${cell.c}`);
  }

  // place guards on corridors (not on start, exit, or treasure cells)
  const baseGuards = Math.floor(level / 2);
  const diffBonus = difficulty === 'hard' ? 2 : difficulty === 'easy' ? -1 : 0;
  const guardCount = Math.max(0, Math.min(baseGuards + diffBonus, 6));
  const occupied = new Set<string>();
  occupied.add('1,1');
  occupied.add(`${exitR},${exitC}`);
  for (const t of treasures) occupied.add(`${t.r},${t.c}`);

  const corridorCells = reachableCells.filter(({ r, c }) => {
    if (occupied.has(`${r},${c}`)) return false;
    let adj = 0;
    if (r > 0 && grid[r - 1][c] === 'empty') adj++;
    if (r < ROWS - 1 && grid[r + 1][c] === 'empty') adj++;
    if (c > 0 && grid[r][c - 1] === 'empty') adj++;
    if (c < COLS - 1 && grid[r][c + 1] === 'empty') adj++;
    return adj >= 2;
  });

  const guards: Guard[] = [];
  // prefer placing guards in less-trafficked spots: off the critical path first
  const shuffledCorridors = corridorCells.sort(() => Math.random() - 0.5);
  const offPath = shuffledCorridors.filter(({ r, c }) => !criticalCells.has(`${r},${c}`));
  const onPath = shuffledCorridors.filter(({ r, c }) => criticalCells.has(`${r},${c}`));
  const guardCandidates = [...offPath, ...onPath];

  // watchers only exist in medium (rarely) and hard (more common)
  const watcherProb = difficulty === 'hard' ? 0.5 : difficulty === 'medium' ? 0.2 : 0;
  for (let g = 0; g < guardCount && g < guardCandidates.length; g++) {
    const pos = guardCandidates[g];
    const onCritical = criticalCells.has(`${pos.r},${pos.c}`);
    // a stationary watcher on the critical path permanently blocks it — force patrol instead
    const kind: GuardKind = !onCritical && Math.random() < watcherProb ? 'watcher' : 'patrol';
    const patrol = kind === 'watcher' ? [{ r: pos.r, c: pos.c }] : buildPatrol(grid, pos.r, pos.c, criticalCells);
    const guardType = GUARD_POOL[g % GUARD_POOL.length];
    const facings: Guard['facing'][] = ['up', 'down', 'left', 'right'];
    guards.push({
      kind,
      r: pos.r,
      c: pos.c,
      patrolPath: patrol,
      patrolIndex: 0,
      patrolDir: 1,
      facing: kind === 'watcher' ? facings[Math.floor(Math.random() * 4)] : 'down',
      moveTimer: 0,
      alertTimer: 0,
      rotationTimer: kind === 'watcher' ? 2 + Math.random() * 1 : 0,
      species: guardType.species,
      color: guardType.color,
    });
  }

  // hard-mode: place 1–2 colored doors along the start→exit path with a matching key in the before region
  const keys: DungeonKey[] = [];
  const doors: DungeonDoor[] = [];

  if (difficulty === 'hard') {
    const path = shortestPath(grid, 1, 1, exitR, exitC);
    const doorPalette: KeyColor[] = ['red', 'blue', 'yellow'];
    const doorCount = path.length >= 14 ? 2 : path.length >= 7 ? 1 : 0;
    const doorIndices: number[] = [];
    if (doorCount >= 1) doorIndices.push(Math.floor(path.length * 0.4));
    if (doorCount >= 2) doorIndices.push(Math.floor(path.length * 0.75));

    const doorKeySet = new Set<string>(); // cells where door or key is placed
    doorKeySet.add('1,1');
    doorKeySet.add(`${exitR},${exitC}`);
    for (const t of treasures) doorKeySet.add(`${t.r},${t.c}`);

    for (let i = 0; i < doorIndices.length; i++) {
      const idx = doorIndices[i];
      const doorCell = path[idx];
      const color = doorPalette[i];
      doors.push({ r: doorCell.r, c: doorCell.c, color, open: false });
      doorKeySet.add(`${doorCell.r},${doorCell.c}`);

      // Region reachable if previous doors are open and this door is closed.
      // (Imagine the player has walked past doors 0..i-1 and is now blocked by door i.)
      const blockOnlyCurrent = new Set<string>([`${doorCell.r},${doorCell.c}`]);
      const reachableNow = floodFillAvoiding(grid, 1, 1, blockOnlyCurrent);

      // Exclude cells that were already accessible before the previous door,
      // so the key sits in the newly-opened region instead of back near spawn.
      let candidatesSet: Set<string> = reachableNow;
      if (i >= 1) {
        const prev = doors[i - 1];
        const blockPrev = new Set<string>([`${prev.r},${prev.c}`]);
        const prevRegion = floodFillAvoiding(grid, 1, 1, blockPrev);
        candidatesSet = new Set([...reachableNow].filter((c) => !prevRegion.has(c)));
      }

      const candidates = [...candidatesSet]
        .map((k) => { const [r, c] = k.split(',').map(Number); return { r, c }; })
        .filter(({ r, c }) => !doorKeySet.has(`${r},${c}`));

      if (candidates.length > 0) {
        // prefer cells far from start to make searching interesting
        candidates.sort((a, b) => {
          const da = Math.abs(a.r - 1) + Math.abs(a.c - 1);
          const db = Math.abs(b.r - 1) + Math.abs(b.c - 1);
          return db - da;
        });
        const pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
        keys.push({ r: pick.r, c: pick.c, color, collected: false });
        doorKeySet.add(`${pick.r},${pick.c}`);
      }
    }
  }

  // hard-mode: place a single pressure plate + gate (latching, step to unlock)
  let plate: PressurePlate | null = null;
  let plateGate: PlateGate | null = null;
  const blocks: PushBlock[] = [];
  const claimed = new Set<string>();
  claimed.add('1,1');
  claimed.add(`${exitR},${exitC}`);
  for (const t of treasures) claimed.add(`${t.r},${t.c}`);
  for (const k of keys) claimed.add(`${k.r},${k.c}`);
  for (const d of doors) claimed.add(`${d.r},${d.c}`);
  for (const g of guards) claimed.add(`${g.r},${g.c}`);

  if (difficulty === 'hard') {
    const path = shortestPath(grid, 1, 1, exitR, exitC);
    // find a cell on the path AFTER any existing door, as a candidate for the plate gate
    let lastDoorIdx = -1;
    for (const d of doors) {
      const idx = path.findIndex((p) => p.r === d.r && p.c === d.c);
      if (idx > lastDoorIdx) lastDoorIdx = idx;
    }
    // pick a gate cell ~85% of the way to the exit, but strictly after any door
    const gateCandidateIdx = Math.max(lastDoorIdx + 2, Math.floor(path.length * 0.85));
    if (gateCandidateIdx > 0 && gateCandidateIdx < path.length - 1) {
      const gateCell = path[gateCandidateIdx];
      const gateKey = `${gateCell.r},${gateCell.c}`;
      if (!claimed.has(gateKey)) {
        plateGate = { r: gateCell.r, c: gateCell.c, open: false };
        claimed.add(gateKey);

        // plate goes in the region before the plate gate, not near start, not on any claimed cell
        const plateBlocked = new Set<string>([gateKey, ...doors.map((d) => `${d.r},${d.c}`)]);
        const plateAccessible = floodFillAvoiding(grid, 1, 1, plateBlocked);
        const plateCandidates = [...plateAccessible]
          .map((k) => { const [r, c] = k.split(',').map(Number); return { r, c }; })
          .filter(({ r, c }) => !claimed.has(`${r},${c}`))
          // prefer cells farther from start for a more interesting hunt
          .sort((a, b) => {
            const da = Math.abs(a.r - 1) + Math.abs(a.c - 1);
            const db = Math.abs(b.r - 1) + Math.abs(b.c - 1);
            return db - da;
          });
        if (plateCandidates.length > 0) {
          const pick = plateCandidates[Math.floor(Math.random() * Math.min(3, plateCandidates.length))];
          plate = { r: pick.r, c: pick.c, pressed: false };
          claimed.add(`${pick.r},${pick.c}`);
        } else {
          // no valid plate spot — revert the gate
          plateGate = null;
          claimed.delete(gateKey);
        }
      }
    }

    // place push blocks only in "safe" dead-end branches:
    // block at cell M where M has 2 empty neighbors, one of which is a dead-end D,
    // and neither M nor D holds any item. Pushing the block can only send it into
    // the unused dead-end tip, so the player never gets softlocked.
    const countEmptyNeighbors = (r: number, c: number) => {
      let n = 0;
      if (r > 0 && grid[r - 1][c] === 'empty') n++;
      if (r < ROWS - 1 && grid[r + 1][c] === 'empty') n++;
      if (c > 0 && grid[r][c - 1] === 'empty') n++;
      if (c < COLS - 1 && grid[r][c + 1] === 'empty') n++;
      return n;
    };
    const safeBlockCells: { r: number; c: number }[] = [];
    for (const cell of reachableCells) {
      const { r, c } = cell;
      if (claimed.has(`${r},${c}`)) continue;
      if (countEmptyNeighbors(r, c) !== 2) continue;
      // look for a neighbor that is a dead-end (only M as its empty neighbor)
      let hasSafeDeadEnd = false;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (grid[nr][nc] !== 'empty') continue;
        if (claimed.has(`${nr},${nc}`)) continue;
        if (countEmptyNeighbors(nr, nc) === 1) {
          hasSafeDeadEnd = true;
          break;
        }
      }
      if (hasSafeDeadEnd) safeBlockCells.push({ r, c });
    }
    const blockCount = Math.min(1 + Math.floor(level / 3), 2, safeBlockCells.length);
    const shuffledSafe = safeBlockCells.sort(() => Math.random() - 0.5);
    for (let i = 0; i < blockCount; i++) {
      const b = shuffledSafe[i];
      blocks.push({ r: b.r, c: b.c });
      claimed.add(`${b.r},${b.c}`);
    }
  }

  return { grid, guards, treasures, startR: 1, startC: 1, exitR, exitC, keys, doors, plate, plateGate, blocks, fossils: [], altar: null, eggs: [] };
}

function shortestPath(grid: DungeonCell[][], sr: number, sc: number, er: number, ec: number): { r: number; c: number }[] {
  const parent: Record<string, string | null> = { [`${sr},${sc}`]: null };
  const queue: { r: number; c: number }[] = [{ r: sr, c: sc }];
  while (queue.length > 0) {
    const { r, c } = queue.shift()!;
    if (r === er && c === ec) break;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === 'empty' && !(key in parent)) {
        parent[key] = `${r},${c}`;
        queue.push({ r: nr, c: nc });
      }
    }
  }
  // reconstruct
  const path: { r: number; c: number }[] = [];
  let cur: string | null = `${er},${ec}`;
  while (cur) {
    const [r, c] = cur.split(',').map(Number);
    path.unshift({ r, c });
    cur = parent[cur] ?? null;
  }
  return path;
}

function floodFillAvoiding(grid: DungeonCell[][], sr: number, sc: number, blocked: Set<string>): Set<string> {
  const seen = new Set<string>();
  seen.add(`${sr},${sc}`);
  const stack = [{ r: sr, c: sc }];
  while (stack.length > 0) {
    const { r, c } = stack.pop()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const k = `${nr},${nc}`;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (grid[nr][nc] !== 'empty') continue;
      if (blocked.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push({ r: nr, c: nc });
    }
  }
  return seen;
}

function buildPatrol(
  grid: DungeonCell[][],
  startR: number,
  startC: number,
  criticalCells?: Set<string>,
): { r: number; c: number }[] {
  const path: { r: number; c: number }[] = [{ r: startR, c: startC }];
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  // Find valid first-step directions (empty cell that isn't off-grid)
  const validDirs = dirs.filter(([dr, dc]) => {
    const nr = startR + dr;
    const nc = startC + dc;
    return nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && grid[nr][nc] === 'empty';
  });
  if (validDirs.length === 0) return path;

  // Prefer a direction whose first step leaves the critical path so the guard
  // spends meaningful time off it, giving the player a passage window.
  let chosen: [number, number] | undefined;
  if (criticalCells) {
    const offCritDirs = validDirs.filter(([dr, dc]) => {
      return !criticalCells.has(`${startR + dr},${startC + dc}`);
    });
    if (offCritDirs.length > 0) {
      chosen = offCritDirs[Math.floor(Math.random() * offCritDirs.length)];
    }
  }
  if (!chosen) chosen = validDirs[Math.floor(Math.random() * validDirs.length)];

  const steps = 2 + Math.floor(Math.random() * 3);
  let cr = startR;
  let cc = startC;
  for (let i = 0; i < steps; i++) {
    const nr = cr + chosen[0];
    const nc = cc + chosen[1];
    if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && grid[nr][nc] === 'empty') {
      cr = nr;
      cc = nc;
      path.push({ r: nr, c: nc });
    } else {
      break;
    }
  }

  return path;
}

function getFacing(from: { r: number; c: number }, to: { r: number; c: number }): Guard['facing'] {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 'right' : 'left';
  return dr > 0 ? 'down' : 'up';
}

function visionRange(difficulty: Difficulty, kind: GuardKind = 'patrol'): number {
  const base = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 4 : 3;
  return kind === 'watcher' ? base + 1 : base;
}

function guardMoveInterval(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 1.2;
  if (difficulty === 'hard') return 0.5;
  return 0.8;
}

function canGuardSee(guard: Guard, pr: number, pc: number, grid: DungeonCell[][], difficulty: Difficulty): boolean {
  if (guard.alertTimer > 0) return false;
  // if the player is standing in tall grass, they're hidden from any guard
  if (grid[pr]?.[pc] === 'grass') return false;

  const range = visionRange(difficulty, guard.kind);
  let dr = 0;
  let dc = 0;
  if (guard.facing === 'up') dr = -1;
  else if (guard.facing === 'down') dr = 1;
  else if (guard.facing === 'left') dc = -1;
  else dc = 1;

  for (let i = 1; i <= range; i++) {
    const cr = guard.r + dr * i;
    const cc = guard.c + dc * i;
    if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) break;
    if (grid[cr][cc] === 'wall') break;
    if (cr === pr && cc === pc) return true;
    // peripheral vision — 1 tile wide
    if (dr !== 0) {
      if ((cc - 1 === pc || cc + 1 === pc) && cr === pr) return true;
    } else {
      if ((cr - 1 === pr || cr + 1 === pr) && cc === pc) return true;
    }
  }
  return false;
}

export function DinoDungeon({ onBack }: { onBack: () => void }) {
  const initialDifficulty = getDifficulty();
  const initialRoom = generateRoom(0, initialDifficulty);
  const stateRef = useRef({
    room: initialRoom,
    playerR: initialRoom.startR,
    playerC: initialRoom.startC,
    particles: [] as Particle[],
    completed: 0,
    level: 0,
    celebrating: 0,
    moveTimer: 0,
    caught: false,
    caughtTimer: 0,
    stickerPopup: '',
    stickerPopupTimer: 0,
    keysHeld: new Set<string>(),
    easyMode: isEasyMode(),
    difficulty: initialDifficulty,
    totalTreasures: 0,
    exitOpen: computeInitialExitOpen(initialRoom, initialDifficulty),
    facing: 'down' as WalkDirection,
    inventory: new Set<KeyColor>(),
    lockedBumpTimer: 0,
    running: false,
    noisePulses: [] as { x: number; y: number; age: number }[],
    fossilsInInventory: 0,
    carriedEggIdx: null as number | null,
  });

  const tryMove = useCallback((dr: number, dc: number) => {
    const s = stateRef.current;
    if (s.celebrating > 0 || s.caught) return;
    const nr = s.playerR + dr;
    const nc = s.playerC + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    if (s.room.grid[nr][nc] === 'wall') return;
    if (s.room.grid[nr][nc] === 'pit') {
      // Pit blocks player; must be filled by pushing a block in first.
      s.lockedBumpTimer = 0.2;
      return;
    }

    // check for a closed door at the target cell
    const door = s.room.doors.find((d) => d.r === nr && d.c === nc && !d.open);
    if (door) {
      if (s.inventory.has(door.color)) {
        door.open = true;
        playSuccess();
        const px = nc * TILE + TILE / 2;
        const py = nr * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(px, py, 12));
      } else {
        s.lockedBumpTimer = 0.35;
        playMismatch();
        return;
      }
    }

    // check for a closed plate gate
    if (s.room.plateGate && s.room.plateGate.r === nr && s.room.plateGate.c === nc && !s.room.plateGate.open) {
      s.lockedBumpTimer = 0.35;
      playMismatch();
      return;
    }

    // check for a push block at the target cell — try to push it
    const blockIdx = s.room.blocks.findIndex((b) => b.r === nr && b.c === nc);
    if (blockIdx !== -1) {
      const block = s.room.blocks[blockIdx];
      const br = block.r + dr;
      const bc = block.c + dc;
      // validate destination
      if (br < 0 || br >= ROWS || bc < 0 || bc >= COLS) {
        s.lockedBumpTimer = 0.2;
        return;
      }
      if (s.room.grid[br][bc] === 'wall') {
        s.lockedBumpTimer = 0.2;
        return;
      }
      const hitDoor = s.room.doors.find((d) => d.r === br && d.c === bc && !d.open);
      const hitPlateGate = s.room.plateGate && s.room.plateGate.r === br && s.room.plateGate.c === bc && !s.room.plateGate.open;
      const hitBlock = s.room.blocks.some((b) => b.r === br && b.c === bc);
      if (hitDoor || hitPlateGate || hitBlock) {
        s.lockedBumpTimer = 0.2;
        return;
      }
      // If the destination is a pit, the block fills it: block is consumed,
      // the pit tile becomes walkable floor.
      if (s.room.grid[br][bc] === 'pit') {
        s.room.grid[br][bc] = 'empty';
        s.room.blocks.splice(blockIdx, 1);
        playSuccess();
        const fx = bc * TILE + TILE / 2;
        const fy = br * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(fx, fy, 14));
        return;
      }
      // push it
      block.r = br;
      block.c = bc;
      playPop();

      // Plate state is recomputed each frame — if the block landed on the plate,
      // the per-frame update in onDraw will press it automatically.
    }

    s.playerR = nr;
    s.playerC = nc;
    // Carrying an egg slows the player — eggs are delicate.
    const carrying = s.carriedEggIdx !== null;
    const baseTimer = s.running ? 0.08 : 0.15;
    s.moveTimer = carrying ? baseTimer * 1.6 : baseTimer;
    if (dr === -1) s.facing = 'up';
    else if (dr === 1) s.facing = 'down';
    else if (dc === -1) s.facing = 'left';
    else if (dc === 1) s.facing = 'right';
    playStep();

    // noise: running alerts nearby guards (they turn to face the sound)
    if (s.running) {
      const NOISE_RADIUS = 4;
      s.noisePulses.push({ x: nc * TILE + TILE / 2, y: nr * TILE + TILE / 2, age: 0 });
      for (const guard of s.room.guards) {
        const d = Math.abs(guard.r - nr) + Math.abs(guard.c - nc);
        if (d <= NOISE_RADIUS) {
          // face toward player
          const gdr = nr - guard.r;
          const gdc = nc - guard.c;
          if (Math.abs(gdc) >= Math.abs(gdr)) {
            guard.facing = gdc > 0 ? 'right' : 'left';
          } else {
            guard.facing = gdr > 0 ? 'down' : 'up';
          }
          // watchers pause rotation briefly after hearing noise
          if (guard.kind === 'watcher') guard.rotationTimer = 1.5;
        }
      }
    }

    // check key pickup (hard mode)
    for (const k of s.room.keys) {
      if (!k.collected && k.r === nr && k.c === nc) {
        k.collected = true;
        s.inventory.add(k.color);
        playPop();
        const px = nc * TILE + TILE / 2;
        const py = nr * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(px, py, 12));
      }
    }

    // Plate/gate state is re-evaluated each frame in the main draw loop
    // (see updatePlateAndGate below) — plates are non-latching, so stepping
    // on and off is a dynamic press/release.

    // (egg pickup + hatch are now manual — press E while standing on an egg to
    //  pick it up, press E again to drop at the current tile. Dropping onto a
    //  plate still triggers the hatch.)

    // fossil pickup
    for (const fossil of s.room.fossils) {
      if (!fossil.collected && fossil.r === nr && fossil.c === nc) {
        fossil.collected = true;
        s.fossilsInInventory++;
        playPop();
        const px = nc * TILE + TILE / 2;
        const py = nr * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(px, py, 10));
        break;
      }
    }

    // altar activation — consume fossils, turn the target tile into floor
    if (
      s.room.altar &&
      !s.room.altar.used &&
      s.room.altar.r === nr &&
      s.room.altar.c === nc &&
      s.fossilsInInventory >= s.room.altar.requires
    ) {
      s.fossilsInInventory -= s.room.altar.requires;
      s.room.altar.used = true;
      const tr = s.room.altar.targetR;
      const tc = s.room.altar.targetC;
      if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
        if (s.room.grid[tr][tc] === 'wall' || s.room.grid[tr][tc] === 'pit') {
          s.room.grid[tr][tc] = 'empty';
        }
      }
      playCelebration();
      const px = nc * TILE + TILE / 2;
      const py = nr * TILE + TILE / 2;
      s.particles.push(...spawnCelebration(px, py, 22));
      if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
        const tx = tc * TILE + TILE / 2;
        const ty = tr * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(tx, ty, 16));
      }
    }

    // check treasure pickup
    for (const t of s.room.treasures) {
      if (!t.collected && t.r === nr && t.c === nc) {
        t.collected = true;
        s.totalTreasures++;
        playPop();
        const px = nc * TILE + TILE / 2;
        const py = nr * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(px, py, 10));

        // treasures still gate the exit in easy/medium; hard uses doors for challenge
        if (s.difficulty !== 'hard') {
          const allCollected = s.room.treasures.every((tr) => tr.collected);
          if (allCollected) {
            s.exitOpen = true;
            playSuccess();
          }
        }
      }
    }

    // check exit
    if (nr === s.room.exitR && nc === s.room.exitC && s.exitOpen) {
      s.completed++;
      s.celebrating = 2.5;
      playCelebration();
      const px = nc * TILE + TILE / 2;
      const py = nr * TILE + TILE / 2;
      s.particles.push(...spawnCelebration(px, py, 25));
      trackDinoEncounter('raptor', 0, 'dino-dungeon');

      const total = trackProgress('dino-dungeon');
      if (total === 1) {
        earnSticker('dino-dungeon-1');
        s.stickerPopup = '🏰 First Expedition!';
        s.stickerPopupTimer = 3;
        playSticker();
      } else if (total === 3) {
        earnSticker('dino-dungeon-3');
        s.stickerPopup = '⚔️ Dungeon Master!';
        s.stickerPopupTimer = 3;
        playSticker();
      }
    }
  }, []);

  // Manual egg pickup/drop — press E to toggle.
  const toggleEggCarry = useCallback(() => {
    const s = stateRef.current;
    if (s.caught || s.celebrating > 0) return;

    if (s.carriedEggIdx !== null) {
      // Dropping at the current tile.
      // Disallow if another uncollected egg is already here (prevents stacking).
      const otherHere = s.room.eggs.some((e, i) =>
        i !== s.carriedEggIdx &&
        !e.hatched &&
        !e.collected &&
        e.r === s.playerR &&
        e.c === s.playerC,
      );
      if (otherHere) {
        s.lockedBumpTimer = 0.2;
        return;
      }

      const egg = s.room.eggs[s.carriedEggIdx];
      egg.r = s.playerR;
      egg.c = s.playerC;
      egg.collected = false;

      const px = s.playerC * TILE + TILE / 2;
      const py = s.playerR * TILE + TILE / 2;

      // If the drop cell is a plate, hatch the egg. The hatched baby sits on
      // the plate permanently, which the per-frame plate/gate update treats as
      // permanent weight — so the gate stays open.
      if (s.room.plate && s.room.plate.r === s.playerR && s.room.plate.c === s.playerC) {
        egg.hatched = true;
        egg.hatchR = s.playerR;
        egg.hatchC = s.playerC;
        playSuccess();
        s.particles.push(...spawnCelebration(px, py, 18));
      } else {
        playPop();
        s.particles.push(...spawnCelebration(px, py, 5));
      }
      s.carriedEggIdx = null;
      return;
    }

    // Pickup — check if standing on an egg.
    for (let i = 0; i < s.room.eggs.length; i++) {
      const egg = s.room.eggs[i];
      if (!egg.collected && !egg.hatched && egg.r === s.playerR && egg.c === s.playerC) {
        egg.collected = true;
        s.carriedEggIdx = i;
        playPop();
        const px = s.playerC * TILE + TILE / 2;
        const py = s.playerR * TILE + TILE / 2;
        s.particles.push(...spawnCelebration(px, py, 6));
        return;
      }
    }
  }, []);

  const { canvasRef, safeTimeout } = useGameCanvas({
    width: W,
    height: H,
    title: 'Dino Dungeon',
    onKeyDown(e) {
      const s = stateRef.current;
      if (e.key === 'Shift') {
        s.running = true;
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        toggleEggCarry();
        return;
      }
      const key = normalizeMoveKey(e.key);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault();
        s.keysHeld.add(key);
        s.running = e.shiftKey;
        if (s.moveTimer <= 0) {
          const dirs: Record<string, [number, number]> = {
            ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
          };
          const [dr, dc] = dirs[key];
          tryMove(dr, dc);
        }
      }
    },
    onKeyUp(e) {
      if (e.key === 'Shift') {
        stateRef.current.running = false;
        return;
      }
      stateRef.current.keysHeld.delete(normalizeMoveKey(e.key));
    },
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;

      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      if (s.moveTimer > 0) s.moveTimer -= dt;
      if (s.lockedBumpTimer > 0) s.lockedBumpTimer -= dt;
      s.particles = updateParticles(s.particles, dt);

      // --- plate / gate update (non-latching) ---
      // Plate is pressed while there's weight on it right now: the player is
      // standing on it, a push-block sits on it, or an egg has hatched on it.
      // The gate mirrors the plate's state — step off, plate un-presses, gate
      // closes. Drop an egg on the plate to keep it pressed while you move.
      if (s.room.plate) {
        const pr = s.room.plate.r;
        const pc = s.room.plate.c;
        const playerOn = s.playerR === pr && s.playerC === pc;
        const blockOn = s.room.blocks.some((b) => b.r === pr && b.c === pc);
        const hatchedOn = s.room.eggs.some(
          (e) => e.hatched && e.hatchR === pr && e.hatchC === pc,
        );
        const pressed = playerOn || blockOn || hatchedOn;
        const was = s.room.plate.pressed;
        s.room.plate.pressed = pressed;
        if (s.room.plateGate) s.room.plateGate.open = pressed;
        if (!was && pressed) {
          playSuccess();
          s.particles.push(...spawnCelebration(pc * TILE + TILE / 2, pr * TILE + TILE / 2, 8));
        } else if (was && !pressed) {
          playMismatch();
        }
      }

      // advance noise pulses
      for (const pulse of s.noisePulses) pulse.age += dt;
      s.noisePulses = s.noisePulses.filter((p) => p.age < 0.5);

      // handle held keys
      if (s.moveTimer <= 0 && !s.caught) {
        const dirs: Record<string, [number, number]> = {
          ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        };
        for (const key of s.keysHeld) {
          if (dirs[key]) {
            tryMove(dirs[key][0], dirs[key][1]);
            break;
          }
        }
      }

      // update guards
      if (!s.caught && s.celebrating <= 0) {
        for (const guard of s.room.guards) {
          if (guard.alertTimer > 0) {
            guard.alertTimer -= dt;
            continue;
          }

          if (guard.kind === 'watcher') {
            // rotate cone every few seconds
            guard.rotationTimer -= dt;
            if (guard.rotationTimer <= 0) {
              const cycle: Guard['facing'][] = ['down', 'right', 'up', 'left'];
              const nextIdx = (cycle.indexOf(guard.facing) + 1) % cycle.length;
              guard.facing = cycle[nextIdx];
              guard.rotationTimer = s.difficulty === 'hard' ? 1.5 : 2.2;
            }
          } else {
            guard.moveTimer -= dt;
            if (guard.moveTimer <= 0) {
              guard.moveTimer = guardMoveInterval(s.difficulty);
              if (guard.patrolPath.length > 1) {
                guard.patrolIndex += guard.patrolDir;
                if (guard.patrolIndex >= guard.patrolPath.length - 1) guard.patrolDir = -1;
                if (guard.patrolIndex <= 0) guard.patrolDir = 1;
                const next = guard.patrolPath[guard.patrolIndex];
                const prev = { r: guard.r, c: guard.c };
                guard.r = next.r;
                guard.c = next.c;
                guard.facing = getFacing(prev, next);
              }
            }
          }

          // check if guard sees player
          if (canGuardSee(guard, s.playerR, s.playerC, s.room.grid, s.difficulty)) {
            s.caught = true;
            s.caughtTimer = 1.5;
            const px = s.playerC * TILE + TILE / 2;
            const py = s.playerR * TILE + TILE / 2;
            s.particles.push(...spawnCelebration(px, py, 8));
          }
        }
      }

      // caught state — return to start after delay
      if (s.caught) {
        s.caughtTimer -= dt;
        if (s.caughtTimer <= 0) {
          s.caught = false;
          s.playerR = s.room.startR;
          s.playerC = s.room.startC;
          s.facing = 'down';
        }
      }

      // celebrating — advance to next room
      if (s.celebrating > 0) {
        s.celebrating -= dt;
        if (s.celebrating <= 0) {
          s.level++;
          s.room = generateRoom(s.level, s.difficulty);
          s.playerR = s.room.startR;
          s.playerC = s.room.startC;
          s.facing = 'down';
          s.exitOpen = computeInitialExitOpen(s.room, s.difficulty);
          s.inventory.clear();
          s.fossilsInInventory = 0;
          s.carriedEggIdx = null;
        }
      }

      // --- RENDER ---
      const gridW = COLS * TILE;
      const offsetX = (W - gridW) / 2;

      // grass-field background (sits behind everything; shows through where
      // tiles happen not to load yet, and matches the overall green feel)
      ctx.fillStyle = '#6FAF46';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(offsetX, 0);

      // draw tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * TILE;
          const y = r * TILE;
          const cell = s.room.grid[r][c];
          if (cell === 'wall') {
            const wallImg = getWallTileImage(r, c);
            if (wallImg.complete && wallImg.naturalWidth > 0) {
              ctx.drawImage(wallImg, x, y, TILE, TILE);
            }
          } else if (cell === 'pit') {
            // paint floor first for surrounding edges, then a dark void on top
            const base = getBaseGrassTileImage();
            if (base.complete && base.naturalWidth > 0) {
              ctx.drawImage(base, x, y, TILE, TILE);
            }
            ctx.save();
            ctx.fillStyle = '#120a05';
            ctx.beginPath();
            ctx.roundRect(x + 5, y + 5, TILE - 10, TILE - 10, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // subtle inner gradient so the pit reads as depth
            const grad = ctx.createRadialGradient(
              x + TILE / 2, y + TILE / 2, 2,
              x + TILE / 2, y + TILE / 2, TILE / 2,
            );
            grad.addColorStop(0, 'rgba(60,30,20,0.7)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            const grassImg = getBaseGrassTileImage();
            if (grassImg.complete && grassImg.naturalWidth > 0) {
              ctx.drawImage(grassImg, x, y, TILE, TILE);
            }
            if (cell === 'grass') {
              // tuft overlay — distinguishes hide-grass from plain floor
              ctx.save();
              ctx.fillStyle = 'rgba(40,120,40,0.55)';
              const tufts = 5;
              for (let t = 0; t < tufts; t++) {
                const tx = x + 6 + ((t * 7) % (TILE - 12));
                const ty = y + 8 + ((t * 11) % (TILE - 16));
                ctx.beginPath();
                ctx.moveTo(tx, ty + 7);
                ctx.lineTo(tx - 2, ty);
                ctx.lineTo(tx + 3, ty + 2);
                ctx.lineTo(tx + 1, ty - 3);
                ctx.lineTo(tx + 5, ty + 1);
                ctx.lineTo(tx + 4, ty + 7);
                ctx.fill();
              }
              // subtle sway shimmer so it feels "alive"
              const shim = 0.15 + Math.sin(mouse.time * 2 + r * 0.9 + c * 0.7) * 0.08;
              ctx.fillStyle = `rgba(120,220,120,${shim})`;
              ctx.fillRect(x, y, TILE, TILE);
              ctx.restore();
            }
          }
        }
      }

      // lava cracks for atmosphere
      for (let i = 0; i < 8; i++) {
        const lx = ((i * 97 + 31) % (COLS * TILE));
        const ly = ((i * 73 + 47) % (ROWS * TILE));
        ctx.strokeStyle = `rgba(255,${80 + Math.sin(mouse.time * 2 + i) * 40},0,${0.15 + Math.sin(mouse.time * 3 + i * 2) * 0.1})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 15, ly + 8);
        ctx.lineTo(lx + 10, ly + 20);
        ctx.stroke();
      }

      // start marker
      {
        const sx = s.room.startC * TILE;
        const sy = s.room.startR * TILE;
        const pulse = 0.3 + Math.sin(mouse.time * 3) * 0.1;
        ctx.fillStyle = `rgba(100,180,255,${pulse})`;
        ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
      }

      // exit marker
      {
        const ex = s.room.exitC * TILE;
        const ey = s.room.exitR * TILE;
        if (s.exitOpen) {
          const pulse = 0.5 + Math.sin(mouse.time * 4) * 0.3;
          ctx.fillStyle = `rgba(76,175,80,${pulse})`;
          ctx.fillRect(ex + 2, ey + 2, TILE - 4, TILE - 4);
          const finishImg = getFinishImage();
          if (finishImg.complete && finishImg.naturalWidth > 0) {
            const bounce = Math.sin(mouse.time * 4) * 3;
            ctx.drawImage(finishImg, ex + 8, ey + 5 + bounce, TILE - 16, TILE - 16);
          }
        } else {
          ctx.fillStyle = 'rgba(255,50,50,0.2)';
          ctx.fillRect(ex + 2, ey + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '20px serif';
          ctx.textAlign = 'center';
          ctx.fillText('🔒', ex + TILE / 2, ey + TILE / 2 + 7);
        }
      }

      // draw pressure plate (stone slab sprite — two states)
      if (s.room.plate) {
        const p = s.room.plate;
        const px = p.c * TILE;
        const py = p.r * TILE;
        const img = getPressurePlateImage(p.pressed);
        if (img.complete && img.naturalWidth > 0) {
          const size = 36;
          const offset = (TILE - size) / 2;
          ctx.save();
          if (!p.pressed) {
            // soft pulse glow to invite the player to step on it
            const pulse = 0.35 + Math.sin(mouse.time * 3) * 0.18;
            ctx.shadowColor = `rgba(120,220,120,${pulse})`;
            ctx.shadowBlur = 14;
          } else {
            // a steady golden glow once activated
            ctx.shadowColor = 'rgba(255,213,79,0.55)';
            ctx.shadowBlur = 10;
          }
          ctx.drawImage(img, px + offset, py + offset, size, size);
          ctx.restore();
        }
      }

      // draw plate gate (closed: solid; open: faded outline)
      if (s.room.plateGate) {
        const g = s.room.plateGate;
        const gx = g.c * TILE;
        const gy = g.r * TILE;
        if (!g.open) {
          ctx.fillStyle = PLATE_GATE_COLOR;
          ctx.fillRect(gx + 4, gy + 4, TILE - 8, TILE - 8);
          // horizontal bars
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          for (let b = 0; b < 3; b++) {
            ctx.fillRect(gx + 8, gy + 12 + b * 10, TILE - 16, 3);
          }
          // center emblem
          ctx.fillStyle = PLATE_COLOR;
          ctx.beginPath();
          ctx.arc(gx + TILE / 2, gy + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // faint residue
          ctx.strokeStyle = 'rgba(100,180,100,0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.strokeRect(gx + 6, gy + 6, TILE - 12, TILE - 12);
          ctx.setLineDash([]);
        }
      }

      // draw push blocks
      for (const b of s.room.blocks) {
        const bx = b.c * TILE;
        const by = b.r * TILE;
        ctx.fillStyle = BLOCK_COLOR;
        ctx.fillRect(bx + 5, by + 5, TILE - 10, TILE - 10);
        ctx.strokeStyle = BLOCK_EDGE;
        ctx.lineWidth = 3;
        ctx.strokeRect(bx + 5, by + 5, TILE - 10, TILE - 10);
        // corner nails + wood grain lines
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(bx + 10, by + 10, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + TILE - 10, by + 10, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + 10, by + TILE - 10, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + TILE - 10, by + TILE - 10, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 8, by + TILE / 2);
        ctx.lineTo(bx + TILE - 8, by + TILE / 2);
        ctx.stroke();
      }

      // draw closed doors (hard mode)
      for (const d of s.room.doors) {
        if (d.open) continue;
        const dx = d.c * TILE;
        const dy = d.r * TILE;
        const color = KEY_COLORS[d.color];

        // frame
        ctx.fillStyle = '#4A2E22';
        ctx.fillRect(dx + 3, dy + 3, TILE - 6, TILE - 6);
        // colored panel
        ctx.fillStyle = color;
        ctx.fillRect(dx + 8, dy + 8, TILE - 16, TILE - 16);
        // keyhole
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(dx + TILE / 2, dy + TILE / 2 - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(dx + TILE / 2 - 2, dy + TILE / 2 - 2, 4, 10);
        // bolts
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(dx + 10, dy + 10, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + TILE - 10, dy + 10, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 10, dy + TILE - 10, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + TILE - 10, dy + TILE - 10, 2, 0, Math.PI * 2); ctx.fill();
      }

      // draw keys (colored ornate sprite per color)
      for (const k of s.room.keys) {
        if (k.collected) continue;
        const kx = k.c * TILE + TILE / 2;
        const ky = k.r * TILE + TILE / 2;
        const bob = Math.sin(mouse.time * 3 + k.r * 1.3 + k.c) * 3;
        const color = KEY_COLORS[k.color];
        const img = getDungeonKeyImage(k.color);

        ctx.save();
        // colored halo glow to make the key visible on grass
        const glowAlpha = 0.28 + Math.sin(mouse.time * 4 + k.r) * 0.1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(255,255,255,${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(kx, ky + bob, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (img.complete && img.naturalWidth > 0) {
          const aspect = img.naturalWidth / img.naturalHeight;
          const h = 30;
          const w = h * aspect;
          ctx.drawImage(img, kx - w / 2, ky + bob - h / 2, w, h);
        }
      }

      // draw fossil fragments (uncollected) — use varied bone sprites so each
      // fossil looks a little different. Seed is the (r, c) pair so a given
      // fossil keeps the same bone across frames.
      for (const fossil of s.room.fossils) {
        if (fossil.collected) continue;
        const fx = fossil.c * TILE + TILE / 2;
        const fy = fossil.r * TILE + TILE / 2;
        const bob = Math.sin(mouse.time * 2.5 + fossil.r * 1.7 + fossil.c * 0.3) * 2;
        const img = getFossilBoneImage(fossil.r * 31 + fossil.c);
        if (img.complete && img.naturalWidth > 0) {
          const aspect = img.naturalWidth / img.naturalHeight;
          const h = 30;
          const w = h * aspect;
          ctx.save();
          ctx.shadowColor = 'rgba(255,248,200,0.55)';
          ctx.shadowBlur = 10;
          ctx.drawImage(img, fx - w / 2, fy + bob - h / 2, w, h);
          ctx.restore();
        }
      }

      // draw the altar (if any)
      if (s.room.altar) {
        const ax = s.room.altar.c * TILE;
        const ay = s.room.altar.r * TILE;
        const needed = Math.max(0, s.room.altar.requires - s.fossilsInInventory);
        const ready = !s.room.altar.used && needed === 0;

        // altar sprite (includes its own pedestal + bone-pile + dino-skull detail)
        const altarImg = getAltarImage();
        if (altarImg.complete && altarImg.naturalWidth > 0) {
          const aspect = altarImg.naturalWidth / altarImg.naturalHeight;
          // slightly larger than the tile so the sprite's base rocks/plants spill
          // over the tile edge — reads better as a real object in the world.
          const altarH = TILE + 12;
          const altarW = altarH * aspect;
          const drawX = ax + TILE / 2 - altarW / 2;
          const drawY = ay + TILE - altarH + 6;

          ctx.save();
          if (ready) {
            // pulsing golden halo behind the altar when it's ready to activate
            const glow = 0.4 + Math.sin(mouse.time * 4) * 0.3;
            ctx.shadowColor = '#FFD54F';
            ctx.shadowBlur = 18;
            ctx.fillStyle = `rgba(255,213,79,${0.18 + glow * 0.18})`;
            ctx.beginPath();
            ctx.arc(ax + TILE / 2, ay + TILE / 2, TILE / 2 + 4, 0, Math.PI * 2);
            ctx.fill();
          }
          // once used, the altar's mostly-decorative — fade slightly
          if (s.room.altar.used) {
            ctx.globalAlpha = 0.78;
          }
          ctx.drawImage(altarImg, drawX, drawY, altarW, altarH);
          ctx.restore();
        }

        if (!s.room.altar.used) {
          // counter badge above the altar
          ctx.save();
          ctx.fillStyle = ready ? '#FFD54F' : 'rgba(255,255,255,0.85)';
          ctx.font = 'bold 12px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          const label = ready ? 'Ready!' : `${s.fossilsInInventory}/${s.room.altar.requires} 🦴`;
          ctx.strokeText(label, ax + TILE / 2, ay - 2);
          ctx.fillText(label, ax + TILE / 2, ay - 2);
          ctx.restore();

          // dashed line to the target so authors & players can read intent
          ctx.save();
          ctx.strokeStyle = ready ? 'rgba(255,213,79,0.6)' : 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 6]);
          ctx.beginPath();
          ctx.moveTo(ax + TILE / 2, ay + TILE / 2);
          ctx.lineTo(s.room.altar.targetC * TILE + TILE / 2, s.room.altar.targetR * TILE + TILE / 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // draw uncollected eggs — whole egg sprite bobbing on the ground
      for (let i = 0; i < s.room.eggs.length; i++) {
        const egg = s.room.eggs[i];
        if (egg.collected || egg.hatched) continue;
        const ex = egg.c * TILE + TILE / 2;
        const ey = egg.r * TILE + TILE / 2;
        const bob = Math.sin(mouse.time * 2 + egg.r * 0.8) * 2;
        const img = getDungeonEggImage(false);
        if (img.complete && img.naturalWidth > 0) {
          const aspect = img.naturalWidth / img.naturalHeight;
          const h = 30;
          const w = h * aspect;
          ctx.save();
          // faint warm halo beneath so the pastel egg reads on grass
          ctx.fillStyle = 'rgba(255,235,180,0.25)';
          ctx.beginPath();
          ctx.ellipse(ex, ey + 10, 16, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(img, ex - w / 2, ey + bob - h / 2, w, h);
          ctx.restore();
        }
      }

      // draw hatched babies on plates — opened-egg sprite sits still on the
      // plate (no bob) since the baby dino is literally weighing the plate down.
      for (const egg of s.room.eggs) {
        if (!egg.hatched || egg.hatchR === undefined || egg.hatchC === undefined) continue;
        const bx = egg.hatchC * TILE + TILE / 2;
        const by = egg.hatchR * TILE + TILE / 2;
        const img = getDungeonEggImage(true);
        if (img.complete && img.naturalWidth > 0) {
          const aspect = img.naturalWidth / img.naturalHeight;
          const h = 32;
          const w = h * aspect;
          ctx.drawImage(img, bx - w / 2, by - h / 2, w, h);
        }
      }

      // draw treasures
      for (const t of s.room.treasures) {
        if (t.collected) continue;
        const tx = t.c * TILE + TILE / 2;
        const ty = t.r * TILE + TILE / 2;
        const bob = Math.sin(mouse.time * 3 + t.bobOffset) * 3;

        // glow
        ctx.save();
        const glowAlpha = 0.2 + Math.sin(mouse.time * 4 + t.bobOffset) * 0.1;
        ctx.shadowColor = TREASURE_COLORS[t.type];
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(255,255,255,${glowAlpha})`;
        ctx.beginPath();
        ctx.arc(tx, ty + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // emoji
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.fillText(TREASURE_EMOJIS[t.type], tx, ty + bob + 7);
      }

      // draw guard vision cones (brighter, pulsing, with an outline so kids can't miss them)
      for (const guard of s.room.guards) {
        if (guard.alertTimer > 0) continue;
        const range = visionRange(s.difficulty, guard.kind);
        let dr = 0;
        let dc = 0;
        if (guard.facing === 'up') dr = -1;
        else if (guard.facing === 'down') dr = 1;
        else if (guard.facing === 'left') dc = -1;
        else dc = 1;

        const pulse = 0.25 + Math.sin(mouse.time * 2.5) * 0.08;
        const peripheralPulse = pulse * 0.55;

        const paintConeTile = (tr: number, tc: number, alpha: number) => {
          const x = tc * TILE + 2;
          const y = tr * TILE + 2;
          const w = TILE - 4;
          const h = TILE - 4;
          // filled danger tint
          ctx.fillStyle = `rgba(255,70,70,${alpha})`;
          ctx.fillRect(x, y, w, h);
          // bright outline
          ctx.strokeStyle = `rgba(255,120,120,${Math.min(1, alpha + 0.35)})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
        };

        for (let i = 1; i <= range; i++) {
          const cr = guard.r + dr * i;
          const cc = guard.c + dc * i;
          if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) break;
          if (s.room.grid[cr][cc] === 'wall') break;

          paintConeTile(cr, cc, pulse);

          if (dr !== 0) {
            if (cc - 1 >= 0 && s.room.grid[cr][cc - 1] === 'empty') {
              paintConeTile(cr, cc - 1, peripheralPulse);
            }
            if (cc + 1 < COLS && s.room.grid[cr][cc + 1] === 'empty') {
              paintConeTile(cr, cc + 1, peripheralPulse);
            }
          } else {
            if (cr - 1 >= 0 && s.room.grid[cr - 1][cc] === 'empty') {
              paintConeTile(cr - 1, cc, peripheralPulse);
            }
            if (cr + 1 < ROWS && s.room.grid[cr + 1][cc] === 'empty') {
              paintConeTile(cr + 1, cc, peripheralPulse);
            }
          }
        }

        // a small "eye" marker above the guard points in the direction they're looking
        const gx = guard.c * TILE + TILE / 2;
        const gy = guard.r * TILE + TILE / 2;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#FF5252';
        ctx.beginPath();
        ctx.arc(gx + dc * 14, gy + dr * 14 - 18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gx + dc * 14, gy + dr * 14 - 18, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // draw guards
      for (const guard of s.room.guards) {
        const gx = guard.c * TILE + TILE / 2;
        const gy = guard.r * TILE + TILE / 2;
        const facingLeft = guard.facing === 'left';
        const guardBob = Math.sin(mouse.time * 2 + guard.r * 3) * 2;

        if (guard.alertTimer > 0) {
          // alert animation — flash
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(mouse.time * 10) * 0.3;
          drawDino(ctx, gx, gy + guardBob, 32, guard.color, facingLeft, guard.species);
          ctx.restore();
          // exclamation
          ctx.fillStyle = '#FF4444';
          ctx.font = 'bold 18px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', gx, gy - 22);
        } else {
          drawDino(ctx, gx, gy + guardBob, 32, guard.color, facingLeft, guard.species);
        }
      }

      // current-tile highlight (draw behind the player so they sit on top)
      {
        const hx = s.playerC * TILE;
        const hy = s.playerR * TILE;
        const pulse = 0.25 + Math.sin(mouse.time * 3) * 0.08;
        ctx.save();
        ctx.fillStyle = `rgba(255,255,200,${pulse})`;
        ctx.fillRect(hx + 2, hy + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 2;
        ctx.strokeRect(hx + 2.5, hy + 2.5, TILE - 5, TILE - 5);
        ctx.restore();
      }

      // draw player
      if (!s.caught || Math.sin(mouse.time * 15) > 0) {
        const px = s.playerC * TILE + TILE / 2;
        const py = s.playerR * TILE + TILE / 2;
        const inGrass = s.room.grid[s.playerR]?.[s.playerC] === 'grass';
        const dinoSize = 40;
        if (inGrass) {
          ctx.save();
          ctx.globalAlpha = 0.55;
          drawWalkDino(ctx, px, py - 3, dinoSize, s.facing, mouse.time);
          ctx.restore();
          // tiny "hidden" eye above the player
          ctx.save();
          ctx.fillStyle = 'rgba(120,220,120,0.9)';
          ctx.font = '14px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🌿', px, py - 22);
          ctx.restore();
        } else {
          drawWalkDino(ctx, px, py - 3, dinoSize, s.facing, mouse.time);
        }

        // egg bobbing above the player's head when carrying — full egg sprite
        if (s.carriedEggIdx !== null) {
          const eggBob = Math.sin(mouse.time * 3) * 3;
          const img = getDungeonEggImage(false);
          if (img.complete && img.naturalWidth > 0) {
            const aspect = img.naturalWidth / img.naturalHeight;
            const h = 28;
            const w = h * aspect;
            ctx.save();
            // soft shadow below the floating egg
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(px, py - 22, 8, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(img, px - w / 2, py - 34 + eggBob - h / 2, w, h);
            ctx.restore();
          }
        }
      }

      // arrow hints for valid moves
      const dirList: [string, number, number][] = [
        ['ArrowUp', -1, 0], ['ArrowDown', 1, 0], ['ArrowLeft', 0, -1], ['ArrowRight', 0, 1],
      ];
      if (!s.caught && s.celebrating <= 0) {
        for (const [key, dr, dc] of dirList) {
          const nr = s.playerR + dr;
          const nc = s.playerC + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && s.room.grid[nr][nc] === 'empty') {
            const ax = nc * TILE + TILE / 2;
            const ay = nr * TILE + TILE / 2;
            const arrowImg = getArrowImage(key);
            if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
              ctx.save();
              ctx.globalAlpha = 0.25;
              const arrowSize = 20;
              ctx.drawImage(arrowImg, ax - arrowSize / 2, ay - arrowSize / 2, arrowSize, arrowSize);
              ctx.restore();
            }
          }
        }
      }

      // noise pulses (expanding rings from where the player ran)
      for (const pulse of s.noisePulses) {
        const p = pulse.age / 0.5;
        const r = 10 + p * (TILE * 4);
        const alpha = (1 - p) * 0.6;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#FFEB3B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawParticles(ctx, s.particles);
      ctx.restore();

      // caught overlay
      if (s.caught) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(200,50,50,0.3)';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        ctx.save();
        ctx.font = 'bold 32px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText('Spotted! 👀', W / 2, H / 2 - 20);
        ctx.fillStyle = '#FF6B6B';
        ctx.fillText('Spotted! 👀', W / 2, H / 2 - 20);

        ctx.font = '18px Fredoka, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Sneaking back to start...', W / 2, H / 2 + 15);
        ctx.restore();
      }

      // celebration
      if (s.celebrating > 0 && !s.caught) {
        ctx.save();
        ctx.font = 'bold 36px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText('Room cleared! 🎉', W / 2, 50);
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFD700';
        ctx.fillText('Room cleared! 🎉', W / 2, 50);
        ctx.restore();
      }

      // bottom HUD: keys inventory (hard) + treasure counter
      {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 110, H - 48, 220, 28, 8);
        ctx.fill();

        if (s.difficulty === 'hard' && s.room.doors.length > 0) {
          // draw a key icon per door color; filled if collected, greyed if not
          const colors: KeyColor[] = [];
          for (const d of s.room.doors) {
            if (!colors.includes(d.color)) colors.push(d.color);
          }
          const iconSpacing = 26;
          const totalW = colors.length * iconSpacing;
          const startX = W / 2 - totalW / 2 + iconSpacing / 2;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 13px Fredoka, sans-serif';
          ctx.fillText('Keys:', W / 2 - totalW / 2 - 50, H - 29);

          for (let i = 0; i < colors.length; i++) {
            const col = colors[i];
            const has = s.inventory.has(col);
            const cx = startX + i * iconSpacing;
            const cy = H - 34;
            ctx.save();
            if (has) {
              ctx.shadowColor = KEY_COLORS[col];
              ctx.shadowBlur = 10;
            }
            ctx.fillStyle = has ? KEY_COLORS[col] : 'rgba(255,255,255,0.22)';
            ctx.beginPath();
            ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx - 1.5, cy, 3, 9);
            ctx.fillRect(cx + 1, cy + 4, 5, 2);
            ctx.fillRect(cx + 1, cy + 7, 4, 2);
            ctx.restore();
          }
        } else {
          const remaining = s.room.treasures.filter((t) => !t.collected).length;
          const total = s.room.treasures.length;
          ctx.fillStyle = remaining === 0 ? '#4CAF50' : '#FFD700';
          ctx.font = 'bold 14px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            remaining === 0 ? 'Exit unlocked! ⭐' : `💎 ${total - remaining}/${total} treasures`,
            W / 2,
            H - 30,
          );
        }
      }

      // room number
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      const generatorMode = getDungeonGenerator();
      if (generatorMode === 'template') {
        const tpl = templateForLevel(s.level);
        ctx.fillStyle = '#FFD54F';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.fillText(`Room ${s.level + 1} · ${tpl.name}`, 16, H - 10);
      } else {
        ctx.fillText(`Room ${s.level + 1}`, 16, H - 10);
      }

      // running-state indicator
      if (s.difficulty === 'hard') {
        ctx.textAlign = 'right';
        ctx.fillStyle = s.running ? '#FFEB3B' : 'rgba(255,255,255,0.35)';
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.fillText(s.running ? '🏃 Running (loud!)' : 'Shift = run', W - 16, H - 10);
      }

      // Egg pickup/drop hint: shown when the player is standing on an egg, or
      // currently carrying one. Helps make the E key discoverable.
      {
        const standingOnEgg = s.room.eggs.some(
          (e) => !e.collected && !e.hatched && e.r === s.playerR && e.c === s.playerC,
        );
        const carrying = s.carriedEggIdx !== null;
        if (standingOnEgg || carrying) {
          const playerCenterX = s.playerC * TILE + TILE / 2;
          // below the dino, below the current tile, so the carried-egg sprite
          // above the head stays unobstructed
          const bubbleY = (s.playerR + 1) * TILE + 4;
          const label = carrying ? 'Press E to drop egg' : 'Press E to pick up';
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.strokeStyle = 'rgba(255,213,79,0.6)';
          ctx.lineWidth = 2;
          ctx.font = 'bold 12px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          const w = ctx.measureText(label).width + 18;
          ctx.beginPath();
          ctx.roundRect(playerCenterX - w / 2, bubbleY, w, 20, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFD54F';
          ctx.fillText(label, playerCenterX, bubbleY + 15);
          ctx.restore();
        }
      }

      drawScore(ctx, '🏰', s.completed);

      // fossil counter HUD (only shown when the room has fossils in play)
      if (s.room.fossils.length > 0 || (s.room.altar && !s.room.altar.used)) {
        const totalFossils = s.room.fossils.length;
        const pickedUp = s.room.fossils.filter((f) => f.collected).length;
        const req = s.room.altar?.requires ?? totalFossils;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(W - 170, 56, 156, 28, 8);
        ctx.fill();
        ctx.fillStyle = '#FFD54F';
        ctx.font = 'bold 13px Fredoka, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          `🦴 ${s.fossilsInInventory}/${req} (found ${pickedUp}/${totalFossils})`,
          W - 162,
          74,
        );
        ctx.restore();
      }

      drawEasyModeButton(ctx, 100, 14, mouse.mouseX, mouse.mouseY, s.easyMode);
      drawStickerPopup(ctx, s.stickerPopup, s.stickerPopupTimer, W, H);
      drawBackButton(ctx, W - 110, 10, mouse.mouseX, mouse.mouseY);
      drawCustomCursor(ctx, mouse.mouseX, mouse.mouseY, !mouse.isTouch, mouse.mouseDown);
    },
  });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      let clientX: number, clientY: number;
      if ('changedTouches' in e) {
        if (e.changedTouches.length === 0) return;
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (clientX - rect.left) * (W / rect.width);
      const my = (clientY - rect.top) * (H / rect.height);

      if (mx > 100 && mx < 180 && my > 14 && my < 48) {
        const s = stateRef.current;
        s.easyMode = toggleEasyMode();
        s.difficulty = getDifficulty();
        // regenerate the current room so door/key layout matches the new difficulty
        s.room = generateRoom(s.level, s.difficulty);
        s.playerR = s.room.startR;
        s.playerC = s.room.startC;
        s.facing = 'down';
        s.inventory.clear();
        s.fossilsInInventory = 0;
        s.carriedEggIdx = null;
        s.exitOpen = computeInitialExitOpen(s.room, s.difficulty);
        return;
      }
      if (mx > W - 110 && mx < W && my > 10 && my < 54) {
        onBack();
        return;
      }

      // touch movement — tap a neighboring tile to move there
      const s = stateRef.current;
      if (s.caught || s.celebrating > 0) return;
      const gridW = COLS * TILE;
      const offsetX = (W - gridW) / 2;
      const tileC = Math.floor((mx - offsetX) / TILE);
      const tileR = Math.floor(my / TILE);
      const dr = tileR - s.playerR;
      const dc = tileC - s.playerC;
      if (Math.abs(dr) + Math.abs(dc) === 1) {
        tryMove(dr, dc);
      }
    },
    [onBack, tryMove],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      role="application"
      aria-label="Dino Dungeon - explore the cave, collect treasure, avoid guards"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
