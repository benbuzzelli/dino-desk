import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Spawn, KeyColor } from '../games/dino-dungeon/templates';
import { TEMPLATES } from '../games/dino-dungeon/templates';

const COLS = 15;
const ROWS = 11;
const TILE = 40;

type Tile = '.' | '#' | 'P' | 'g' | 'O';

type Tool =
  | { kind: 'tile'; tile: Tile }
  | { kind: 'spawn'; spawn: Spawn['kind'] }
  | { kind: 'erase' };

const TILE_COLORS: Record<Tile, string> = {
  '.': '#86C558',
  '#': '#3E2723',
  'P': '#5D4037',
  'g': '#2E7D32',
  'O': '#1a0e08',
};

const TILE_LABELS: Record<Tile, string> = {
  '.': 'Floor',
  '#': 'Wall',
  'P': 'Pillar',
  'g': 'Tall grass',
  'O': 'Pit',
};

const SPAWN_LABELS: Record<Spawn['kind'], string> = {
  'start': '🏁 Start',
  'exit': '⭐ Exit',
  'patrol-guard': '🦖 Patrol',
  'watcher': '👁 Watcher',
  'plate': '⬤ Plate',
  'plate-gate': '▒ Plate gate',
  'key': '🔑 Key',
  'door': '▥ Door',
  'block': '📦 Block',
  'treasure': '💎 Treasure',
  'fossil': '🦴 Fossil',
  'altar': '🏛 Altar',
  'egg': '🥚 Egg',
};

const TILE_DESCRIPTIONS: Record<Tile, string> = {
  '.': 'Walkable space. The player and guards can stand here.',
  '#': 'Solid wall. Blocks movement and guard vision.',
  'P': 'Pillar. Acts like a wall — blocks movement and vision — but reads as a single obstacle inside a room.',
  'g': 'Tall grass. Walkable. While the player stands on grass, no guard can see them — great for timing windows between patrols.',
  'O': 'Pit. Blocks the player like a wall. Push a block into a pit to fill it and create a floor tile.',
};

const SPAWN_DESCRIPTIONS: Record<Spawn['kind'], string> = {
  'start': 'Where the player enters the room. Exactly one per room; placing a new one moves it.',
  'exit': 'Reaching this cell clears the room. Exactly one per room.',
  'patrol-guard': 'Dino guard that walks a set route. If the player is in its vision cone, the room resets. Defaults to stationary — hand-edit the exported `patrol` array to add a walking route.',
  'watcher': 'Stationary guard with a rotating vision cone (sweeps up→right→down→left every few seconds). Longer sight range than a patrol.',
  'plate': 'Pressure plate. Stepping on it (or pushing a block onto it) permanently opens the plate-gate. One per room.',
  'plate-gate': 'Barrier that stays closed until the plate is pressed. Once open, it stays open for the rest of the room. One per room.',
  'key': 'Collectible. When the player walks over it, its color is added to their inventory and opens any matching-color doors.',
  'door': 'Closed until the player has a key of the same color. Opening consumes nothing — the key keeps working for any more doors of that color.',
  'block': 'Push block. Walking into it shoves it one tile in the direction of movement. Cannot push into walls, doors, gates, or other blocks. A block on a plate also activates it.',
  'treasure': 'Bonus collectible. Purely for score/flair — does not affect room completion.',
  'fossil': 'Scattered bone fragment. Walking over it adds one fossil to inventory. Spend at the altar to trigger its effect.',
  'altar': 'Consumes fossils when the player stands on it, and turns its target cell into floor (for example, opening a blocked path). After placing the altar, click a target cell to set what opens.',
  'egg': 'Pick up by walking over it. Movement slows while carrying. Drop on a plate to hatch — the baby dino permanently weighs the plate (same as a block, but you can carry it over pits). Only one egg can be carried at a time.',
};

function toolDescription(
  tool: Tool,
  keyColor: KeyColor,
  treasureType: 'gem' | 'fossil' | 'egg',
  watcherFacing: 'up' | 'down' | 'left' | 'right',
): { title: string; body: string; extra?: string } {
  if (tool.kind === 'tile') {
    return { title: TILE_LABELS[tool.tile], body: TILE_DESCRIPTIONS[tool.tile] };
  }
  if (tool.kind === 'erase') {
    return {
      title: 'Eraser',
      body: 'Removes the spawn on a clicked cell. Leaves the underlying tile alone. Right-clicking a cell does the same thing without switching tools.',
    };
  }
  const kind = tool.spawn;
  const base = { title: SPAWN_LABELS[kind], body: SPAWN_DESCRIPTIONS[kind] };
  if (kind === 'key' || kind === 'door') return { ...base, extra: `Color: ${keyColor}` };
  if (kind === 'treasure') return { ...base, extra: `Type: ${treasureType}` };
  if (kind === 'watcher') return { ...base, extra: `Initial facing: ${watcherFacing}` };
  return base;
}

const KEY_COLORS: KeyColor[] = ['red', 'blue', 'yellow'];
const TREASURE_TYPES: ('gem' | 'fossil' | 'egg')[] = ['gem', 'fossil', 'egg'];

const FACINGS: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

interface EditorState {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  grid: Tile[][];
  spawns: Spawn[];
}

function makeEmptyGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < COLS; c++) {
      // default to a walled border and open interior
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) row.push('#');
      else row.push('.');
    }
    grid.push(row);
  }
  return grid;
}

export function LevelEditor() {
  const [state, setState] = useState<EditorState>(() => ({
    id: 'new-room',
    name: 'New Room',
    difficulty: 1,
    grid: makeEmptyGrid(),
    spawns: [
      { kind: 'start', r: 1, c: 1 },
      { kind: 'exit', r: 9, c: 13 },
    ],
  }));
  const [past, setPast] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  // Flag set at the start of a mouse gesture. When true, the next edit snapshots
  // the current state into the undo stack, then flips the flag off so subsequent
  // drag-edits within the same gesture don't each create their own undo entries.
  const pendingSnapshotRef = useRef(false);

  const [tool, setTool] = useState<Tool>({ kind: 'tile', tile: '.' });
  const [keyColor, setKeyColor] = useState<KeyColor>('red');
  const [treasureType, setTreasureType] = useState<'gem' | 'fossil' | 'egg'>('gem');
  const [watcherFacing, setWatcherFacing] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'warn' | 'err' | 'info' } | null>(null);
  // After placing an altar, the next grid click sets its target cell.
  const [pendingAltarTarget, setPendingAltarTarget] = useState<{ r: number; c: number } | null>(null);
  const [altarRequires, setAltarRequires] = useState(3);

  const UNDO_CAP = 80;

  const applyEdit = useCallback((updater: (prev: EditorState) => EditorState) => {
    setState((prev) => {
      if (pendingSnapshotRef.current) {
        setPast((p) => [...p.slice(-(UNDO_CAP - 1)), prev]);
        setFuture([]);
        pendingSnapshotRef.current = false;
      }
      return updater(prev);
    });
  }, []);

  // Explicit snapshot for non-gesture edits (button clicks like Clear / Load).
  const snapshotAndSet = useCallback((next: EditorState) => {
    setState((prev) => {
      setPast((p) => [...p.slice(-(UNDO_CAP - 1)), prev]);
      setFuture([]);
      return next;
    });
  }, []);

  const beginGesture = useCallback(() => {
    pendingSnapshotRef.current = true;
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prevState = p[p.length - 1];
      setState((cur) => {
        setFuture((f) => [...f.slice(-(UNDO_CAP - 1)), cur]);
        return prevState;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nextState = f[f.length - 1];
      setState((cur) => {
        setPast((p) => [...p.slice(-(UNDO_CAP - 1)), cur]);
        return nextState;
      });
      return f.slice(0, -1);
    });
  }, []);

  const grid = state.grid;
  const spawns = state.spawns;

  const spawnAt = useMemo(() => {
    const map = new Map<string, Spawn>();
    for (const s of spawns) map.set(`${s.r},${s.c}`, s);
    return map;
  }, [spawns]);

  const updateGrid = useCallback((r: number, c: number, tile: Tile) => {
    applyEdit((prev) => {
      if (prev.grid[r][c] === tile) return prev; // no-op — don't burn an undo slot
      const next = prev.grid.map((row) => row.slice());
      next[r][c] = tile;
      return { ...prev, grid: next };
    });
  }, [applyEdit]);

  const replaceSpawn = useCallback((newSpawn: Spawn) => {
    applyEdit((prev) => {
      // Unique-per-kind spawns (start, exit, plate, plate-gate): remove the existing one first.
      const uniqueKinds = new Set(['start', 'exit', 'plate', 'plate-gate']);
      const filtered = prev.spawns.filter((s) => {
        if (uniqueKinds.has(newSpawn.kind) && s.kind === newSpawn.kind) return false;
        // Also remove any spawn already at this cell
        if (s.r === newSpawn.r && s.c === newSpawn.c) return false;
        return true;
      });
      return { ...prev, spawns: [...filtered, newSpawn] };
    });
  }, [applyEdit]);

  const removeSpawnAt = useCallback((r: number, c: number) => {
    applyEdit((prev) => {
      const filtered = prev.spawns.filter((s) => !(s.r === r && s.c === c));
      if (filtered.length === prev.spawns.length) return prev; // nothing to remove
      return { ...prev, spawns: filtered };
    });
  }, [applyEdit]);

  const applyTool = useCallback(
    (r: number, c: number) => {
      // If an altar was just placed, the next click sets its target cell.
      if (pendingAltarTarget) {
        applyEdit((prev) => {
          const spawns = prev.spawns.map((s) =>
            s.kind === 'altar' && s.r === pendingAltarTarget.r && s.c === pendingAltarTarget.c
              ? { ...s, target: { r, c } }
              : s,
          );
          return { ...prev, spawns };
        });
        setPendingAltarTarget(null);
        setMessage({ text: 'Altar target set. Place more fossils, or pick another tool.', tone: 'ok' });
        return;
      }
      if (tool.kind === 'tile') {
        updateGrid(r, c, tool.tile);
        return;
      }
      if (tool.kind === 'erase') {
        removeSpawnAt(r, c);
        return;
      }
      // spawn tool — build the spawn payload based on kind
      const kind = tool.spawn;
      let spawn: Spawn;
      switch (kind) {
        case 'start':
          spawn = { kind: 'start', r, c };
          break;
        case 'exit':
          spawn = { kind: 'exit', r, c };
          break;
        case 'patrol-guard':
          // default: stationary patrol (single cell). Authors extend patrols
          // by editing the exported TS, or later via a patrol-edit tool.
          spawn = { kind: 'patrol-guard', r, c, patrol: [{ r, c }] };
          break;
        case 'watcher':
          spawn = { kind: 'watcher', r, c, facing: watcherFacing };
          break;
        case 'plate':
          spawn = { kind: 'plate', r, c };
          break;
        case 'plate-gate':
          spawn = { kind: 'plate-gate', r, c };
          break;
        case 'key':
          spawn = { kind: 'key', r, c, color: keyColor };
          break;
        case 'door':
          spawn = { kind: 'door', r, c, color: keyColor };
          break;
        case 'block':
          spawn = { kind: 'block', r, c };
          break;
        case 'treasure':
          spawn = { kind: 'treasure', r, c, type: treasureType };
          break;
        case 'fossil':
          spawn = { kind: 'fossil', r, c };
          break;
        case 'altar':
          // Default target = altar's own cell; the next click sets the real target.
          spawn = { kind: 'altar', r, c, requires: altarRequires, target: { r, c } };
          break;
        case 'egg':
          spawn = { kind: 'egg', r, c };
          break;
      }
      // Placing a spawn on a wall/pillar cell: auto-convert to floor so the feature is reachable.
      if (grid[r][c] === '#' || grid[r][c] === 'P') {
        updateGrid(r, c, '.');
      }
      replaceSpawn(spawn);
      // After placing an altar, prompt for its target cell.
      if (spawn.kind === 'altar') {
        setPendingAltarTarget({ r, c });
        setMessage({ text: 'Altar placed. Click the target cell it should open (wall or pit).', tone: 'info' });
      }
    },
    [tool, keyColor, treasureType, watcherFacing, altarRequires, pendingAltarTarget, grid, updateGrid, removeSpawnAt, replaceSpawn, applyEdit],
  );

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, r: number, c: number) => {
      e.preventDefault();
      beginGesture(); // one undo entry per mousedown — drag-paints bundle together
      if (e.button === 2) {
        removeSpawnAt(r, c);
        return;
      }
      applyTool(r, c);
    },
    [applyTool, removeSpawnAt, beginGesture],
  );

  const exportTs = useCallback(() => {
    const gridStrings = state.grid.map((row) => row.join(''));
    const spawnLines = state.spawns.map((s) => `    ${JSON.stringify(s)},`).join('\n');
    const literal =
      `export const T_${state.id.toUpperCase().replace(/-/g, '_')}: RoomTemplate = {\n` +
      `  id: ${JSON.stringify(state.id)},\n` +
      `  name: ${JSON.stringify(state.name)},\n` +
      `  difficulty: ${state.difficulty},\n` +
      `  grid: [\n${gridStrings.map((g) => `    ${JSON.stringify(g)},`).join('\n')}\n  ],\n` +
      `  spawns: [\n${spawnLines}\n  ],\n` +
      `};\n`;
    navigator.clipboard.writeText(literal).then(
      () => setMessage({ text: 'Copied template to clipboard.', tone: 'ok' }),
      () => setMessage({ text: literal, tone: 'info' }),
    );
  }, [state]);

  const loadFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Very permissive: evaluate the JS object literal by extracting the braces block.
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('no template literal found');
      // eslint-disable-next-line no-new-func
      const obj = new Function(`return (${match[0]});`)();
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.grid) || !Array.isArray(obj.spawns)) {
        throw new Error('missing fields');
      }
      const newGrid: Tile[][] = [];
      for (let r = 0; r < ROWS; r++) {
        const row: Tile[] = [];
        const src = obj.grid[r] ?? '';
        for (let c = 0; c < COLS; c++) {
          const ch = (src[c] as Tile) ?? '#';
          row.push(ch === '.' || ch === '#' || ch === 'P' || ch === 'g' || ch === 'O' ? ch : '#');
        }
        newGrid.push(row);
      }
      snapshotAndSet({
        id: obj.id ?? 'imported',
        name: obj.name ?? 'Imported Room',
        difficulty: (obj.difficulty ?? 1) as EditorState['difficulty'],
        grid: newGrid,
        spawns: obj.spawns as Spawn[],
      });
      setMessage({ text: 'Loaded template from clipboard.', tone: 'ok' });
    } catch (err) {
      setMessage({ text: `Load failed: ${(err as Error).message}`, tone: 'err' });
    }
  }, []);

  const loadExample = useCallback((id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const newGrid: Tile[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: Tile[] = [];
      const src = tpl.grid[r] ?? '';
      for (let c = 0; c < COLS; c++) {
        const ch = (src[c] as Tile) ?? '#';
        row.push(ch === '.' || ch === '#' || ch === 'P' || ch === 'g' || ch === 'O' ? ch : '#');
      }
      newGrid.push(row);
    }
    snapshotAndSet({
      id: tpl.id,
      name: tpl.name,
      difficulty: tpl.difficulty,
      grid: newGrid,
      spawns: tpl.spawns,
    });
    setMessage({ text: `Loaded "${tpl.name}".`, tone: 'info' });
  }, []);

  const verify = useCallback(() => {
    // Convert grid+spawns into the same structure the game uses, then BFS.
    type Cell = 'empty' | 'wall';
    // Verifier is conservative: treats pit tiles as walls (doesn't simulate
    // block-fills-pit). If a room's intended solution routes through a pit,
    // the verifier will report unsolvable — that's OK, the author can confirm
    // by playing.
    const gg: Cell[][] = state.grid.map((row) =>
      row.map((ch) => (ch === '#' || ch === 'P' || ch === 'O' ? 'wall' : 'empty')),
    );
    // Apply spawns that need floor
    for (const s of state.spawns) {
      if (
        s.kind === 'start' || s.kind === 'exit' || s.kind === 'plate' ||
        s.kind === 'plate-gate' || s.kind === 'key' || s.kind === 'door' ||
        s.kind === 'block' || s.kind === 'treasure' ||
        s.kind === 'fossil' || s.kind === 'altar' || s.kind === 'egg'
      ) {
        gg[s.r][s.c] = 'empty';
      }
    }
    const start = state.spawns.find((s) => s.kind === 'start');
    const exit = state.spawns.find((s) => s.kind === 'exit');
    if (!start || !exit) {
      setMessage({ text: 'Verifier needs both a Start and an Exit.', tone: 'warn' });
      return;
    }
    const doors = state.spawns.filter((s): s is Extract<Spawn, { kind: 'door' }> => s.kind === 'door');
    const keys = state.spawns.filter((s): s is Extract<Spawn, { kind: 'key' }> => s.kind === 'key');
    const plate = state.spawns.find((s) => s.kind === 'plate') ?? null;
    const gate = state.spawns.find((s) => s.kind === 'plate-gate') ?? null;
    const blocks = state.spawns.filter((s) => s.kind === 'block');
    const blockSet = new Set(blocks.map((b) => `${b.r},${b.c}`));
    const fossils = state.spawns.filter((s): s is Extract<Spawn, { kind: 'fossil' }> => s.kind === 'fossil');
    const altar = state.spawns.find((s): s is Extract<Spawn, { kind: 'altar' }> => s.kind === 'altar') ?? null;
    const eggs = state.spawns.filter((s): s is Extract<Spawn, { kind: 'egg' }> => s.kind === 'egg');
    const fossilIdx = new Map<string, number>();
    fossils.forEach((f, i) => fossilIdx.set(`${f.r},${f.c}`, i));
    const eggIdx = new Map<string, number>();
    eggs.forEach((e, i) => eggIdx.set(`${e.r},${e.c}`, i));

    const keyColors = [...new Set(keys.map((k) => k.color))];
    const bit: Partial<Record<KeyColor, number>> = {};
    keyColors.forEach((k, i) => { bit[k] = 1 << i; });

    // Plates are non-latching — the gate is only open while weight sits on the
    // plate right now. "Weight" = player standing on it, an egg hatched on it,
    // or a static block placed on it. We derive pressed state from the current
    // state instead of storing a latched flag.
    const staticBlockOnPlate = !!plate && blockSet.has(`${plate.r},${plate.c}`);

    type State = {
      r: number; c: number;
      keys: number;
      fossilMask: number;
      eggCarry: number;   // -1 = no egg carried, else index into eggs
      eggDropped: number; // bitmask of eggs hatched on the plate
      altarUsed: boolean;
    };
    const keyOf = (st: State) =>
      `${st.r},${st.c},${st.keys},${st.fossilMask},${st.eggCarry},${st.eggDropped},${st.altarUsed ? 1 : 0}`;
    const initial: State = {
      r: start.r, c: start.c,
      keys: 0, fossilMask: 0,
      eggCarry: -1, eggDropped: 0, altarUsed: false,
    };
    const platePressed = (st: State) => {
      if (!plate) return false;
      if (staticBlockOnPlate) return true;
      if (st.eggDropped !== 0) return true;
      return st.r === plate.r && st.c === plate.c;
    };
    const seen = new Set([keyOf(initial)]);
    const queue: State[] = [initial];

    const countBits = (x: number) => {
      let n = 0;
      while (x) { n += x & 1; x >>= 1; }
      return n;
    };

    while (queue.length > 0) {
      const st = queue.shift()!;
      if (st.r === exit.r && st.c === exit.c) {
        setMessage({ text: '✅ Room is solvable.', tone: 'ok' });
        return;
      }
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = st.r + dr;
        const nc = st.c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;

        // Altar target becomes floor once used — BFS treats it as floor from that state on.
        const cellIsWall = gg[nr][nc] === 'wall';
        const isAltarTargetOpenedHere =
          altar && st.altarUsed && altar.target.r === nr && altar.target.c === nc;
        if (cellIsWall && !isAltarTargetOpenedHere) continue;
        if (blockSet.has(`${nr},${nc}`)) continue;

        const door = doors.find((d) => d.r === nr && d.c === nc);
        if (door) {
          const kb = bit[door.color];
          if (kb === undefined || (st.keys & kb) === 0) continue;
        }
        if (gate && gate.r === nr && gate.c === nc && !platePressed(st)) continue;

        let newKeys = st.keys;
        const pickedKey = keys.find((k) => k.r === nr && k.c === nc);
        if (pickedKey) {
          const kb = bit[pickedKey.color];
          if (kb !== undefined) newKeys |= kb;
        }
        let newEggCarry = st.eggCarry;
        let newEggDropped = st.eggDropped;
        let newFossils = st.fossilMask;
        let newAltarUsed = st.altarUsed;

        // egg pickup
        const eggHere = eggIdx.get(`${nr},${nc}`);
        if (eggHere !== undefined && st.eggCarry === -1 && (st.eggDropped & (1 << eggHere)) === 0) {
          newEggCarry = eggHere;
        }
        // carried-egg deposit on plate (permanent weight)
        if (plate && plate.r === nr && plate.c === nc && newEggCarry >= 0) {
          newEggDropped |= 1 << newEggCarry;
          newEggCarry = -1;
        }
        // fossil pickup
        const fidx = fossilIdx.get(`${nr},${nc}`);
        if (fidx !== undefined && (st.fossilMask & (1 << fidx)) === 0) {
          newFossils |= 1 << fidx;
        }
        // altar activation
        if (altar && !st.altarUsed && altar.r === nr && altar.c === nc) {
          if (countBits(newFossils) >= altar.requires) {
            newAltarUsed = true;
            // we simulate fossils being consumed by not adding the `used` bit to mask;
            // state already records "altar used" so no need to decrement fossils.
          }
        }

        const next: State = {
          r: nr, c: nc,
          keys: newKeys,
          fossilMask: newFossils,
          eggCarry: newEggCarry,
          eggDropped: newEggDropped,
          altarUsed: newAltarUsed,
        };
        const k = keyOf(next);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push(next);
        }
      }
    }
    setMessage({ text: '❌ No path from Start to Exit found.', tone: 'err' });
  }, [state]);

  const resetGrid = useCallback(() => {
    snapshotAndSet({
      id: 'new-room',
      name: 'New Room',
      difficulty: 1,
      grid: makeEmptyGrid(),
      spawns: [
        { kind: 'start', r: 1, c: 1 },
        { kind: 'exit', r: 9, c: 13 },
      ],
    });
    setMessage({ text: 'Cleared.', tone: 'info' });
  }, [snapshotAndSet]);

  // Keyboard shortcuts: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y redo.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const isZ = e.key === 'z' || e.key === 'Z';
      const isY = e.key === 'y' || e.key === 'Y';
      if (isZ && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((isZ && e.shiftKey) || isY) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1b1b24',
        color: '#eee',
        fontFamily: 'Fredoka, sans-serif',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#FFD54F' }}>Dungeon Room Editor</h1>

        <input
          value={state.id}
          onChange={(e) => setState((s) => ({ ...s, id: e.target.value }))}
          placeholder="id"
          style={inputStyle}
        />
        <input
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="Name"
          style={{ ...inputStyle, width: 180 }}
        />
        <select
          value={state.difficulty}
          onChange={(e) => setState((s) => ({ ...s, difficulty: Number(e.target.value) as EditorState['difficulty'] }))}
          style={inputStyle}
        >
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>Difficulty {d}</option>
          ))}
        </select>

        <button
          style={past.length === 0 ? btnDisabled : btn}
          onClick={undo}
          disabled={past.length === 0}
          title="Undo (⌘Z / Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          style={future.length === 0 ? btnDisabled : btn}
          onClick={redo}
          disabled={future.length === 0}
          title="Redo (⇧⌘Z / Ctrl+Y)"
        >
          ↷ Redo
        </button>
        <button style={btn} onClick={verify}>Verify</button>
        <button style={btn} onClick={exportTs}>Export to clipboard</button>
        <button style={btn} onClick={loadFromClipboard}>Load from clipboard</button>
        <button style={btn} onClick={resetGrid}>Clear</button>
      </div>

      {/* Quick-load existing templates */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#999', fontSize: 12 }}>Load existing:</span>
        {TEMPLATES.map((t) => (
          <button key={t.id} style={{ ...btnSmall }} onClick={() => loadExample(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      {/* Main area: grid on the left, palette on the right */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Grid */}
        <div
          style={{
            display: 'inline-block',
            background: '#000',
            padding: 6,
            borderRadius: 6,
            position: 'relative',
            outline: pendingAltarTarget ? '2px dashed #FFD54F' : 'none',
            cursor: pendingAltarTarget ? 'crosshair' : 'default',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* overlay: small red ring on every altar target cell, so authors can see the link */}
          {spawns
            .filter((s): s is Extract<Spawn, { kind: 'altar' }> => s.kind === 'altar')
            .map((a, i) => (
              <div
                key={`altar-target-${i}`}
                style={{
                  position: 'absolute',
                  left: 6 + a.target.c * TILE + TILE / 2 - 8,
                  top: 6 + a.target.r * TILE + TILE / 2 - 8,
                  width: 16,
                  height: 16,
                  border: '2px solid #FF7043',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: '0 0 6px rgba(255,112,67,0.8)',
                }}
              />
            ))}
          {grid.map((row, r) => (
            <div key={r} style={{ display: 'flex' }}>
              {row.map((cell, c) => {
                const spawn = spawnAt.get(`${r},${c}`);
                return (
                  <div
                    key={c}
                    onMouseDown={(e) => handleCellMouseDown(e, r, c)}
                    onMouseEnter={(e) => {
                      if (e.buttons === 1 && tool.kind === 'tile') applyTool(r, c);
                    }}
                    style={{
                      width: TILE,
                      height: TILE,
                      background: TILE_COLORS[cell],
                      outline: '1px solid rgba(0,0,0,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      cursor: 'crosshair',
                      fontSize: 14,
                      userSelect: 'none',
                    }}
                  >
                    {spawn && renderSpawnIcon(spawn)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Palette */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 280, maxWidth: 320 }}>
          {(() => {
            const d = toolDescription(tool, keyColor, treasureType, watcherFacing);
            return (
              <div
                style={{
                  background: 'rgba(255,213,79,0.08)',
                  border: '1px solid rgba(255,213,79,0.25)',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  Selected
                </div>
                <div style={{ fontSize: 14, color: '#FFD54F', fontWeight: 'bold', marginBottom: 4 }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.45 }}>
                  {d.body}
                </div>
                {d.extra && (
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 6, fontStyle: 'italic' }}>
                    {d.extra}
                  </div>
                )}
              </div>
            );
          })()}

          <Section title="Tiles">
            <div style={paletteGrid}>
              {(Object.keys(TILE_COLORS) as Tile[]).map((t) => (
                <PaletteButton
                  key={t}
                  active={tool.kind === 'tile' && tool.tile === t}
                  onClick={() => setTool({ kind: 'tile', tile: t })}
                  label={TILE_LABELS[t]}
                  swatch={TILE_COLORS[t]}
                />
              ))}
            </div>
          </Section>

          <Section title="Spawns">
            <div style={paletteGrid}>
              {(Object.keys(SPAWN_LABELS) as Spawn['kind'][]).map((k) => (
                <PaletteButton
                  key={k}
                  active={tool.kind === 'spawn' && tool.spawn === k}
                  onClick={() => setTool({ kind: 'spawn', spawn: k })}
                  label={SPAWN_LABELS[k]}
                />
              ))}
            </div>
          </Section>

          <Section title="Spawn options">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Key/door color:
                <select
                  value={keyColor}
                  onChange={(e) => setKeyColor(e.target.value as KeyColor)}
                  style={inputStyle}
                >
                  {KEY_COLORS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Treasure type:
                <select
                  value={treasureType}
                  onChange={(e) => setTreasureType(e.target.value as 'gem' | 'fossil' | 'egg')}
                  style={inputStyle}
                >
                  {TREASURE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Watcher facing:
                <select
                  value={watcherFacing}
                  onChange={(e) => setWatcherFacing(e.target.value as typeof watcherFacing)}
                  style={inputStyle}
                >
                  {FACINGS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Altar requires:
                <select
                  value={altarRequires}
                  onChange={(e) => setAltarRequires(parseInt(e.target.value, 10))}
                  style={inputStyle}
                >
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} fossils</option>)}
                </select>
              </label>
              {pendingAltarTarget && (
                <div style={{
                  color: '#FFD54F',
                  fontSize: 12,
                  padding: '6px 8px',
                  background: 'rgba(255,213,79,0.1)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,213,79,0.3)',
                }}>
                  Click a cell to set the altar's target (wall or pit to open).
                  <button
                    onClick={() => setPendingAltarTarget(null)}
                    style={{ ...btnSmall, marginLeft: 8 }}
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          </Section>

          <Section title="Eraser">
            <PaletteButton
              active={tool.kind === 'erase'}
              onClick={() => setTool({ kind: 'erase' })}
              label="🗑 Remove spawn"
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
              Right-click a cell also removes its spawn.
            </div>
          </Section>

          <Section title="Help">
            <div style={{ fontSize: 12, color: '#bbb', lineHeight: 1.5 }}>
              • Click a palette tile/spawn, then click grid cells to paint.<br/>
              • Drag with a tile tool to paint multiple cells.<br/>
              • Patrol guards default to stationary; hand-edit the exported JSON to add a patrol path.<br/>
              • Only one Plate, Plate-Gate, Start, and Exit per room — placing a new one replaces the old.
            </div>
          </Section>
        </div>
      </div>

      {/* Status */}
      {message && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background:
              message.tone === 'ok' ? 'rgba(76,175,80,0.18)' :
              message.tone === 'warn' ? 'rgba(255,193,7,0.18)' :
              message.tone === 'err' ? 'rgba(244,67,54,0.2)' :
              'rgba(100,180,255,0.15)',
            borderLeft: `4px solid ${
              message.tone === 'ok' ? '#4CAF50' :
              message.tone === 'warn' ? '#FFC107' :
              message.tone === 'err' ? '#F44336' :
              '#4FC3F7'
            }`,
            fontFamily: message.tone === 'info' && message.text.includes('\n') ? 'monospace' : 'Fredoka, sans-serif',
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

function renderSpawnIcon(s: Spawn): React.ReactNode {
  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    textShadow: '0 0 3px rgba(0,0,0,0.8)',
    pointerEvents: 'none',
  };
  switch (s.kind) {
    case 'start': return <div style={style}>🏁</div>;
    case 'exit': return <div style={style}>⭐</div>;
    case 'patrol-guard': return <div style={style}>🦖</div>;
    case 'watcher': return <div style={{ ...style, fontSize: 20 }}>👁</div>;
    case 'plate': return <div style={{ ...style, fontSize: 22, color: '#66BB6A' }}>⬤</div>;
    case 'plate-gate':
      return (
        <div style={{
          position: 'absolute', inset: 3, background: '#2E7D32',
          border: '2px solid #66BB6A', pointerEvents: 'none',
        }}/>
      );
    case 'key':
      return (
        <div style={{ ...style, color: colorOf(s.color), fontSize: 22 }}>🔑</div>
      );
    case 'door':
      return (
        <div style={{
          position: 'absolute', inset: 3, background: colorOf(s.color),
          border: '2px solid rgba(0,0,0,0.4)', pointerEvents: 'none',
        }}/>
      );
    case 'block':
      return (
        <div style={{
          position: 'absolute', inset: 5, background: '#A1887F',
          border: '2px solid #6D4C41', pointerEvents: 'none',
        }}/>
      );
    case 'treasure':
      return <div style={style}>{s.type === 'gem' ? '💎' : s.type === 'fossil' ? '🦴' : '🥚'}</div>;
    case 'fossil':
      return <div style={{ ...style, fontSize: 20 }}>🦴</div>;
    case 'altar':
      return <div style={{ ...style, fontSize: 18 }}>🏛</div>;
    case 'egg':
      return <div style={{ ...style, fontSize: 20 }}>🥚</div>;
  }
}

function colorOf(c: KeyColor): string {
  if (c === 'red') return '#EF5350';
  if (c === 'blue') return '#42A5F5';
  return '#FFC107';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#999',
        marginBottom: 6,
      }}>{title}</div>
      {children}
    </div>
  );
}

function PaletteButton({
  active,
  label,
  swatch,
  onClick,
}: {
  active: boolean;
  label: string;
  swatch?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)',
        border: active ? '2px solid #4CAF50' : '1px solid rgba(255,255,255,0.12)',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 8,
        fontFamily: 'Fredoka, sans-serif',
        fontSize: 13,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        textAlign: 'left',
      }}
    >
      {swatch && (
        <div style={{
          width: 14, height: 14, background: swatch,
          border: '1px solid rgba(0,0,0,0.4)', borderRadius: 3,
        }}/>
      )}
      <span>{label}</span>
    </button>
  );
}

const btn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: 8,
  fontFamily: 'Fredoka, sans-serif',
  fontSize: 13,
  cursor: 'pointer',
};

const btnDisabled: React.CSSProperties = {
  ...btn,
  opacity: 0.35,
  cursor: 'not-allowed',
};

const btnSmall: React.CSSProperties = {
  ...btn,
  padding: '4px 8px',
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff',
  padding: '6px 10px',
  borderRadius: 6,
  fontFamily: 'Fredoka, sans-serif',
  fontSize: 13,
  outline: 'none',
};

const paletteGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
};
