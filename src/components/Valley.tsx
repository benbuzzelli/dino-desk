import { useRef, useCallback } from 'react';
import { drawCustomCursor } from '../games/shared/draw';
import { useGameCanvas } from '../games/shared/useGameCanvas';
import { playStep, playPop } from '../games/shared/audio';
import {
  getAvatar,
  drawAvatarSprite,
  getEarnedStickerCount,
  getGrowthStage,
} from '../games/shared/avatar';
import { getActiveProfile, profileKey } from '../games/shared/profile';
import { getCollectionCount, getAllSlots } from '../games/shared/collection';
import {
  getActiveQuest,
  getQuestById,
  completedToday,
  QUEST_GAME_TO_APP,
} from '../games/shared/quests';
import { getQuillSpriteImage } from '../games/shared/quill';
import { normalizeMoveKey } from '../games/shared/input';
import type { GameId } from '../games/shared/types';

// Map background
import dinoMapUrl from '../games/shared/sprites/backgrounds/dino-map.png';

// Numbered game icons — filename format is <name>-<x>-<y>.png where x,y is the
// top-left position of the icon in map pixel space.
import volcanoIcon from '../games/shared/sprites/backgrounds/games/volcano-game-178-17.png';
import dungeonIcon from '../games/shared/sprites/backgrounds/games/dungeon-game-1380-166.png';
import spellIcon from '../games/shared/sprites/backgrounds/games/spell-game-882-756.png';
import eggIcon from '../games/shared/sprites/backgrounds/games/egg-hatch-game-370-1256.png';
import museumIcon from '../games/shared/sprites/backgrounds/games/museum-1724-997.png';
import boneCaveIcon from '../games/shared/sprites/backgrounds/games/bone-cave-2615-466.png';
import jungleIcon from '../games/shared/sprites/backgrounds/games/jungle-find-2970-1107.png';

// Directional rex sprites for the player avatar on the Valley map.
import rexU from '../games/shared/sprites/dinos/rex/u.png';
import rexUR from '../games/shared/sprites/dinos/rex/ur.png';
import rexR from '../games/shared/sprites/dinos/rex/r.png';
import rexDR from '../games/shared/sprites/dinos/rex/dr.png';
import rexD from '../games/shared/sprites/dinos/rex/d.png';
import rexDL from '../games/shared/sprites/dinos/rex/dl.png';
import rexL from '../games/shared/sprites/dinos/rex/l.png';
import rexUL from '../games/shared/sprites/dinos/rex/ul.png';

type Dir8 = 'u' | 'ur' | 'r' | 'dr' | 'd' | 'dl' | 'l' | 'ul';

const REX_SPRITE_URLS: Record<Dir8, string> = {
  u: rexU, ur: rexUR, r: rexR, dr: rexDR,
  d: rexD, dl: rexDL, l: rexL, ul: rexUL,
};

// Quantize a movement vector into one of 8 compass directions so we can
// pick the matching rex sprite.
function dir8FromDelta(dx: number, dy: number): Dir8 {
  const angle = Math.atan2(dy, dx); // canvas Y grows downward
  const eighth = Math.PI / 8;
  if (angle >= -eighth && angle < eighth) return 'r';
  if (angle >= eighth && angle < 3 * eighth) return 'dr';
  if (angle >= 3 * eighth && angle < 5 * eighth) return 'd';
  if (angle >= 5 * eighth && angle < 7 * eighth) return 'dl';
  if (angle >= 7 * eighth || angle < -7 * eighth) return 'l';
  if (angle >= -7 * eighth && angle < -5 * eighth) return 'ul';
  if (angle >= -5 * eighth && angle < -3 * eighth) return 'u';
  return 'ur';
}

const W = 800;
const H = 600;
const MAP_W = 3618;
const MAP_H = 1727;

// World zoom: how much the map + its painted icons shrink in the viewport.
// Player and Quill keep their canvas-native size so the characters don't
// become hard to see. 0.42 shows roughly 1900×1430 of map at a time.
const ZOOM = 0.34;
const VIEW_MAP_W = W / ZOOM;
const VIEW_MAP_H = H / ZOOM;

type LocationId = GameId;

interface ValleyLocation {
  id: LocationId;
  name: string;
  description: string;
  url: string;
  x: number; // map-space top-left x
  y: number; // map-space top-left y
  w: number;
  h: number;
}

const LOCATIONS: ValleyLocation[] = [
  { id: 'volcano-escape',  name: 'Volcano',     description: 'Volcano Run',  url: volcanoIcon,  x: 178,  y: 17,   w: 484, h: 475 },
  { id: 'dino-dungeon',    name: 'Deep Cave',   description: 'Dino Dungeon', url: dungeonIcon,  x: 1380, y: 166,  w: 402, h: 300 },
  { id: 'spell-dino',      name: 'Chalkboard',  description: 'Spell Dino',   url: spellIcon,    x: 882,  y: 756,  w: 328, h: 272 },
  { id: 'egg-hunt',        name: 'Nest',        description: 'Egg Hunt',     url: eggIcon,      x: 370,  y: 1256, w: 318, h: 266 },
  { id: 'collection',      name: 'Museum',      description: 'Dino Museum',  url: museumIcon,   x: 1724, y: 997,  w: 310, h: 350 },
  { id: 'dino-match',      name: 'Fossil Cave', description: 'Dino Match',   url: boneCaveIcon, x: 2615, y: 466,  w: 318, h: 320 },
  { id: 'jungle-explorer', name: 'Jungle',      description: 'Jungle Find',  url: jungleIcon,   x: 2970, y: 1107, w: 383, h: 328 },
];

// map-space spawn point — open area near the map center-bottom
const SPAWN = { x: 1800, y: 1480 };
const POS_KEY = 'valleyMapPos';

// Quill NPC in map-space
const QUEST_GIVER = {
  x: 2250,
  y: 1400,
  name: 'Quill',
};

const WALK_SPEED = 560; // map pixels per second (~235 screen px/s at ZOOM=0.42)
const ARRIVE_DIST = 14;
const ENTER_DIST = 260; // close enough (in map pixels) to trigger a game on tap
const LOCATION_HIT_PAD = 24; // extra pixels around the location bbox for tap generosity

const imageCache = new Map<string, HTMLImageElement>();
function loadUrl(url: string): HTMLImageElement {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const img = new Image();
  img.src = url;
  imageCache.set(url, img);
  return img;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Player hitbox half-width (map-space). The player's LEFT and RIGHT edges
// are used for horizontal collision — so the rex sprite's visual sides
// are what bump into the sides of map icons, not the single feet point.
const PLAYER_HALF_W = 55;

// Flip to true to overlay collision rectangles for tuning. Red = obstacle
// (lower-half of a map icon). Blue = player's hitbox. Yellow = full sprite
// bbox on every icon, Quill, and the player.
const DEBUG_COLLISION = false;

// Collision: the player's feet (vertical point) cannot enter the LOWER HALF
// of any map-icon sprite, and the player's horizontal EXTENT cannot
// overlap the icon's horizontal extent in that same lower half. The upper
// half is pass-through so walking "behind" a landmark works naturally —
// once the feet are above the icon's vertical midpoint, the player can
// slide left/right/up freely. Add foliage/props here as they're introduced.
function getObstacleRects(): Array<{ x: number; y: number; w: number; h: number }> {
  return LOCATIONS.map((loc) => {
    const midY = loc.y + loc.h / 2;
    return {
      x: loc.x,
      y: midY,
      w: loc.w,
      h: loc.h - loc.h / 2,
    };
  });
}

// `widthMode` picks the player's horizontal hitbox for the collision test:
//   - 'edges'  → full width (center ± PLAYER_HALF_W). Used for horizontal
//                moves so the sprite's visible sides bump the icon edges.
//   - 'center' → zero width (just the center X). Used for vertical moves
//                so the player can slide up/down past an icon as long as
//                their vertical center line is outside the icon's bbox.
type WidthMode = 'edges' | 'center';

function collidesWithObstaclesAt(px: number, py: number, widthMode: WidthMode): boolean {
  const halfW = widthMode === 'edges' ? PLAYER_HALF_W : 0;
  const rects = getObstacleRects();
  for (const r of rects) {
    if (
      px + halfW > r.x &&
      px - halfW < r.x + r.w &&
      py >= r.y &&
      py <= r.y + r.h
    ) {
      return true;
    }
  }
  return false;
}

// Apply a movement delta with axis-separated collision resolution so the
// player slides along an obstacle's edge instead of stopping dead.
function stepWithCollision(
  player: { x: number; y: number },
  dx: number,
  dy: number,
) {
  // Safety hatch: if the player somehow started inside an obstacle (e.g. a
  // new obstacle was added around their saved position), don't trap them —
  // let the move complete so they can walk out. Uses the CENTER test: the
  // player's center is inside an obstacle iff they are genuinely stuck.
  // Grazing-only overlap (edges clipping while center is outside) is a
  // legal state from sliding past an icon's side and must not trigger the
  // hatch, otherwise it would let the player wall through sideways.
  if (collidesWithObstaclesAt(player.x, player.y, 'center')) {
    player.x += dx;
    player.y += dy;
    return;
  }
  // Horizontal: full-width check so edges of the sprite bump icon sides.
  const nx = player.x + dx;
  if (!collidesWithObstaclesAt(nx, player.y, 'edges')) player.x = nx;
  // Vertical: center-only check so brushing past an icon's side doesn't
  // block up/down travel — only a genuine overlap (center inside the
  // icon's x range) stops the movement.
  const ny = player.y + dy;
  if (!collidesWithObstaclesAt(player.x, ny, 'center')) player.y = ny;
}

function loadPlayerPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(profileKey(POS_KEY));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return {
          x: clamp(parsed.x, 20, MAP_W - 20),
          y: clamp(parsed.y, 20, MAP_H - 20),
        };
      }
    }
  } catch {}
  return { ...SPAWN };
}

function savePlayerPos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(profileKey(POS_KEY), JSON.stringify(pos));
  } catch {}
}

// Camera: top-left of viewport in map-space. Centers on the player, clamped to
// the map. When the map is larger than the viewport (it is, in both axes here),
// this gives smooth scrolling that kicks in as the player nears any edge.
function computeCamera(player: { x: number; y: number }): { camX: number; camY: number } {
  const camX = clamp(player.x - VIEW_MAP_W / 2, 0, Math.max(0, MAP_W - VIEW_MAP_W));
  const camY = clamp(player.y - VIEW_MAP_H / 2, 0, Math.max(0, MAP_H - VIEW_MAP_H));
  return { camX, camY };
}

export function Valley({
  onSelectGame,
  onOpenMyDino,
  onOpenQuestGiver,
}: {
  onSelectGame: (id: GameId) => void;
  onOpenMyDino?: () => void;
  onOpenQuestGiver?: () => void;
}) {
  const avatar = getAvatar();
  const stateRef = useRef({
    player: loadPlayerPos(),
    target: null as { x: number; y: number; locationId?: LocationId } | null,
    facing: 'd' as Dir8,
    moving: false,
    hoverLocation: null as LocationId | null,
    time: 0,
    myDinoBtn: null as { x: number; y: number; w: number; h: number } | null,
    hoverQuestGiver: false,
    camX: 0,
    camY: 0,
    keysHeld: new Set<string>(),
    nearLocation: null as LocationId | null,
  });

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const key = normalizeMoveKey(e.key);
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      stateRef.current.keysHeld.add(key);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const s = stateRef.current;
      if (s.nearLocation) {
        e.preventDefault();
        playPop();
        onSelectGame(s.nearLocation);
      }
    }
  }, [onSelectGame]);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    const key = normalizeMoveKey(e.key);
    const s = stateRef.current;
    if (s.keysHeld.delete(key) && s.keysHeld.size === 0) {
      // Save final position when the child stops walking via keyboard.
      savePlayerPos(s.player);
    }
  }, []);

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'Dino Valley',
    onKeyDown,
    onKeyUp,
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;
      s.time = mouse.time;

      // Keyboard movement (WASD / arrow keys). Takes precedence over any
      // pending tap-walk target so pressing a key cancels the walk.
      let kdx = 0, kdy = 0;
      if (s.keysHeld.has('ArrowUp')) kdy -= 1;
      if (s.keysHeld.has('ArrowDown')) kdy += 1;
      if (s.keysHeld.has('ArrowLeft')) kdx -= 1;
      if (s.keysHeld.has('ArrowRight')) kdx += 1;
      const keyboardMoving = kdx !== 0 || kdy !== 0;

      if (keyboardMoving) {
        // normalize so diagonals aren't faster than cardinals
        const len = Math.sqrt(kdx * kdx + kdy * kdy);
        kdx /= len;
        kdy /= len;
        s.target = null;
        const step = WALK_SPEED * dt;
        stepWithCollision(s.player, kdx * step, kdy * step);
        s.player.x = clamp(s.player.x, 20, MAP_W - 20);
        s.player.y = clamp(s.player.y, 20, MAP_H - 20);
        s.facing = dir8FromDelta(kdx, kdy);
        s.moving = true;
      } else if (s.target) {
        // walk toward tap target (map-space)
        const dx = s.target.x - s.player.x;
        const dy = s.target.y - s.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > ARRIVE_DIST) {
          const step = Math.min(WALK_SPEED * dt, dist);
          stepWithCollision(s.player, (dx / dist) * step, (dy / dist) * step);
          if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) {
            s.facing = dir8FromDelta(dx, dy);
          }
          s.moving = true;
        } else {
          s.player.x = s.target.x;
          s.player.y = s.target.y;
          s.moving = false;
          const targetLocId = s.target.locationId;
          s.target = null;
          savePlayerPos(s.player);
          if (targetLocId) {
            playPop();
            onSelectGame(targetLocId);
          }
        }
      } else {
        s.moving = false;
      }

      // update camera to follow the player
      const { camX, camY } = computeCamera(s.player);
      s.camX = camX;
      s.camY = camY;

      // mouse position in map-space (viewport is zoomed)
      const mmx = mouse.mouseX / ZOOM + camX;
      const mmy = mouse.mouseY / ZOOM + camY;

      s.hoverLocation = null;
      for (const loc of LOCATIONS) {
        if (
          mmx >= loc.x - LOCATION_HIT_PAD && mmx <= loc.x + loc.w + LOCATION_HIT_PAD &&
          mmy >= loc.y - LOCATION_HIT_PAD && mmy <= loc.y + loc.h + LOCATION_HIT_PAD
        ) {
          s.hoverLocation = loc.id;
          break;
        }
      }
      s.hoverQuestGiver = distance({ x: mmx, y: mmy }, QUEST_GIVER) < 70;

      // Nearest location within walk-in range — used for proximity highlight
      // and for the Enter-to-enter hotkey. Picks the closest so ambiguity
      // resolves naturally (e.g. two icons near each other).
      let nearest: LocationId | null = null;
      let nearestDist = ENTER_DIST;
      for (const loc of LOCATIONS) {
        const d = distance(s.player, { x: loc.x + loc.w / 2, y: loc.y + loc.h / 2 });
        if (d < nearestDist) {
          nearestDist = d;
          nearest = loc.id;
        }
      }
      s.nearLocation = nearest;

      // --- background: dino-map image, drawn at ZOOM scale ---
      const mapImg = loadUrl(dinoMapUrl);
      if (mapImg.complete && mapImg.naturalWidth > 0) {
        ctx.drawImage(mapImg, -camX * ZOOM, -camY * ZOOM, MAP_W * ZOOM, MAP_H * ZOOM);
      } else {
        ctx.fillStyle = '#86C558';
        ctx.fillRect(0, 0, W, H);
      }

      // --- DEBUG: collision + sprite rectangles ---
      if (DEBUG_COLLISION) {
        ctx.save();
        // Full sprite bbox (yellow) around every map icon, the player, and
        // Quill. Collision zone (red fill) covers only the lower half of
        // each map icon. Player hitbox extent (blue) is drawn on top.
        for (const loc of LOCATIONS) {
          const sx = (loc.x - camX) * ZOOM;
          const sy = (loc.y - camY) * ZOOM;
          const sw = loc.w * ZOOM;
          const sh = loc.h * ZOOM;
          ctx.strokeStyle = 'rgba(255,210,40,0.95)';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.strokeRect(sx, sy, sw, sh);

          const midHalf = sh / 2;
          ctx.fillStyle = 'rgba(220,60,60,0.22)';
          ctx.fillRect(sx, sy + midHalf, sw, sh - midHalf);
          ctx.strokeStyle = 'rgba(220,60,60,0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx, sy + midHalf, sw, sh - midHalf);
        }

        // Player sprite bbox (yellow).
        const pImg = loadUrl(REX_SPRITE_URLS[s.facing]);
        if (pImg.complete && pImg.naturalWidth > 0) {
          const targetH = 56;
          const aspect = pImg.naturalWidth / pImg.naturalHeight;
          const renderW = targetH * aspect;
          const bob = s.moving ? Math.sin(mouse.time * 10) * 4 : Math.sin(mouse.time * 2.5) * 2;
          const pSx = (s.player.x - camX) * ZOOM;
          const pSy = (s.player.y - camY) * ZOOM + bob;
          const boxX = pSx - renderW / 2;
          const boxY = pSy - targetH * 0.45;
          ctx.strokeStyle = 'rgba(255,210,40,0.95)';
          ctx.lineWidth = 2;
          ctx.strokeRect(boxX, boxY, renderW, targetH);
        }

        // Quill sprite bbox (yellow).
        const qImg = getQuillSpriteImage();
        if (qImg.complete && qImg.naturalWidth > 0) {
          const qSh = 88;
          const qAspect = qImg.naturalWidth / qImg.naturalHeight;
          const qSw = qSh * qAspect;
          const qBob = Math.sin(mouse.time * 1.2) * 3;
          const qSx = (QUEST_GIVER.x - camX) * ZOOM;
          const qSy = (QUEST_GIVER.y - camY) * ZOOM;
          ctx.strokeStyle = 'rgba(255,210,40,0.95)';
          ctx.lineWidth = 2;
          ctx.strokeRect(qSx - qSw / 2, qSy - qSh / 2 + qBob, qSw, qSh);
        }

        // Player hitbox extent (blue) — drawn last so it sits on top.
        const psx = (s.player.x - camX) * ZOOM;
        const psy = (s.player.y - camY) * ZOOM;
        const phw = PLAYER_HALF_W * ZOOM;
        ctx.strokeStyle = 'rgba(40,130,230,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(psx - phw, psy);
        ctx.lineTo(psx + phw, psy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(psx - phw, psy - 6);
        ctx.lineTo(psx - phw, psy + 6);
        ctx.moveTo(psx + phw, psy - 6);
        ctx.lineTo(psx + phw, psy + 6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(40,130,230,0.95)';
        ctx.beginPath();
        ctx.arc(psx, psy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- title banner (screen-space) ---
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 110, 10, 220, 36, 12);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.font = 'bold 22px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText('Dino Valley', W / 2, 36);
      ctx.fillText('Dino Valley', W / 2, 36);
      ctx.restore();

      // --- y-sorted world entities ---
      const activeQuest = getActiveQuest();
      const questDone = completedToday();
      const hasQuestAvailable = !questDone && !activeQuest;

      // If a quest step targets one of our locations, remember it so we can
      // float a marker above it after the y-sorted pass.
      let questTargetLoc: ValleyLocation | null = null;
      if (activeQuest) {
        const quest = getQuestById(activeQuest.id);
        const step = quest?.steps[activeQuest.stepIndex];
        if (step) {
          const appId = QUEST_GAME_TO_APP[step.gameId] as LocationId;
          questTargetLoc = LOCATIONS.find((l) => l.id === appId) ?? null;
        }
      }

      type Drawable =
        | { kind: 'location'; loc: ValleyLocation; y: number }
        | { kind: 'player'; y: number }
        | { kind: 'questGiver'; y: number };

      const drawables: Drawable[] = [];
      // Depth-sort each icon by the TOP of its collision zone (its vertical
      // midpoint). A player whose feet are below that line renders on top of
      // the icon; above the line, they pass behind it.
      for (const loc of LOCATIONS) drawables.push({ kind: 'location', loc, y: loc.y + loc.h / 2 });
      drawables.push({ kind: 'player', y: s.player.y });
      drawables.push({ kind: 'questGiver', y: QUEST_GIVER.y + 50 });
      drawables.sort((a, b) => a.y - b.y);

      for (const d of drawables) {
        if (d.kind === 'location') {
          drawLocation(
            ctx,
            d.loc,
            s.hoverLocation === d.loc.id || s.nearLocation === d.loc.id,
            mouse.time,
            camX,
            camY,
          );
        } else if (d.kind === 'player') {
          drawAvatar(ctx, s, avatar, mouse.time);
        } else {
          drawQuestGiver(ctx, s.hoverQuestGiver, mouse.time, hasQuestAvailable, !!activeQuest, camX, camY);
        }
      }

      // --- floating quest marker above the active-step location ---
      if (questTargetLoc) {
        const loc = questTargetLoc;
        const cx = (loc.x - camX + loc.w / 2) * ZOOM;
        const topY = (loc.y - camY) * ZOOM;
        const float = Math.sin(mouse.time * 3.2) * 5;
        const markerY = topY - 30 + float;

        // soft glow
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(mouse.time * 4) * 0.15;
        const glow = ctx.createRadialGradient(cx, markerY, 2, cx, markerY, 34);
        glow.addColorStop(0, 'rgba(255,213,79,0.9)');
        glow.addColorStop(1, 'rgba(255,213,79,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, markerY, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // pulsing yellow coin with "!"
        const pulse = 1 + Math.sin(mouse.time * 5) * 0.1;
        ctx.save();
        ctx.translate(cx, markerY);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8D6E63';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#3E2723';
        ctx.font = 'bold 20px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 1);
        ctx.restore();

        // downward pointer anchor so the marker reads as "this spot"
        ctx.save();
        ctx.fillStyle = '#FFD54F';
        ctx.strokeStyle = '#8D6E63';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, markerY + 12);
        ctx.lineTo(cx + 6, markerY + 12);
        ctx.lineTo(cx, markerY + 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // --- active quest banner (screen-space, bottom) ---
      if (activeQuest) {
        const quest = getQuestById(activeQuest.id);
        if (quest) {
          const step = quest.steps[activeQuest.stepIndex];
          const msg = step
            ? `Quest: ${quest.title} · step ${activeQuest.stepIndex + 1}/${quest.steps.length}: ${step.callToAction}`
            : `Quest: ${quest.title}`;
          ctx.save();
          ctx.font = 'bold 14px Fredoka, sans-serif';
          const textW = ctx.measureText(msg).width;
          const bannerW = Math.min(W - 40, textW + 36);
          const bannerX = (W - bannerW) / 2;
          const bannerY = H - 76;
          ctx.fillStyle = 'rgba(62, 39, 35, 0.88)';
          ctx.strokeStyle = 'rgba(255,213,79,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bannerX, bannerY, bannerW, 26, 13);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFE0B2';
          ctx.textAlign = 'center';
          ctx.fillText(msg, W / 2, bannerY + 18);
          ctx.restore();
        }
      }

      // --- footer: collection count (screen-space) ---
      const slots = getAllSlots();
      const collected = getCollectionCount();
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.roundRect(14, H - 42, 220, 28, 10);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 13px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🦖 ${collected}/${slots.length} dinos discovered`, 24, H - 22);
      ctx.restore();

      // --- My Dino button (top-right) ---
      if (avatar) {
        const stickers = getEarnedStickerCount();
        const stage = getGrowthStage(stickers);
        const btnW = 88;
        const btnH = 88;
        const btnX = W - btnW - 14;
        const btnY = 56;
        const btnHover =
          mouse.mouseX >= btnX && mouse.mouseX <= btnX + btnW &&
          mouse.mouseY >= btnY && mouse.mouseY <= btnY + btnH;
        s.myDinoBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

        ctx.save();
        ctx.fillStyle = btnHover ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)';
        ctx.shadowColor = btnHover ? 'rgba(255,255,255,0.6)' : 'transparent';
        ctx.shadowBlur = btnHover ? 14 : 0;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 14);
        ctx.fill();
        ctx.restore();

        drawAvatarSprite(
          ctx,
          btnX + btnW / 2,
          btnY + btnH / 2 - 4,
          40,
          avatar.species,
          stage.index,
        );

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stage.name, btnX + btnW / 2, btnY + btnH - 6);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 13px Fredoka, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Playing as: ${getActiveProfile()}`, W - 16, H - 22);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tap a place to visit it!', W / 2, H - 22);

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
      const sx = (clientX - rect.left) * (W / rect.width);
      const sy = (clientY - rect.top) * (H / rect.height);
      const s = stateRef.current;

      // My Dino button (screen-space)
      const md = s.myDinoBtn;
      if (md && sx >= md.x && sx <= md.x + md.w && sy >= md.y && sy <= md.y + md.h) {
        playPop();
        onOpenMyDino?.();
        return;
      }

      // convert to map-space for everything else (viewport is zoomed)
      const mx = sx / ZOOM + s.camX;
      const my = sy / ZOOM + s.camY;

      // Quest Giver tap (map-space)
      if (distance({ x: mx, y: my }, QUEST_GIVER) < 70) {
        playPop();
        onOpenQuestGiver?.();
        return;
      }

      // location hit (map-space bbox + generous pad)
      for (const loc of LOCATIONS) {
        if (
          mx >= loc.x - LOCATION_HIT_PAD && mx <= loc.x + loc.w + LOCATION_HIT_PAD &&
          my >= loc.y - LOCATION_HIT_PAD && my <= loc.y + loc.h + LOCATION_HIT_PAD
        ) {
          const center = { x: loc.x + loc.w / 2, y: loc.y + loc.h / 2 };
          if (distance(s.player, center) < ENTER_DIST) {
            playPop();
            onSelectGame(loc.id);
          } else {
            playStep();
            // walk to just below the icon's bottom edge so the sprite doesn't overlap the art
            s.target = { x: center.x, y: loc.y + loc.h + 30, locationId: loc.id };
          }
          return;
        }
      }

      // empty tap — move toward that spot (clamped to the map)
      s.target = {
        x: clamp(mx, 20, MAP_W - 20),
        y: clamp(my, 20, MAP_H - 20),
      };
      playStep();
    },
    [onSelectGame, onOpenMyDino, onOpenQuestGiver],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      role="application"
      aria-label="Dino Valley, walk around the valley and tap a place to visit"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}

function drawLocation(
  ctx: CanvasRenderingContext2D,
  loc: ValleyLocation,
  hovered: boolean,
  _time: number,
  camX: number,
  camY: number,
) {
  const img = loadUrl(loc.url);
  if (!img.complete || img.naturalWidth === 0) return;
  // on hover, scale up ~8% around the icon's center and brighten.
  const scale = hovered ? 1.08 : 1;
  const baseW = loc.w * ZOOM;
  const baseH = loc.h * ZOOM;
  const sw = baseW * scale;
  const sh = baseH * scale;
  const cx = (loc.x - camX + loc.w / 2) * ZOOM;
  const cyTop = (loc.y - camY) * ZOOM;
  const sx = cx - sw / 2;
  const sy = cyTop - (sh - baseH) / 2;

  ctx.save();
  if (hovered) {
    ctx.shadowColor = 'rgba(255,235,150,0.95)';
    ctx.shadowBlur = 26;
    ctx.filter = 'brightness(1.12)';
  }
  ctx.drawImage(img, sx, sy, sw, sh);
  ctx.restore();

  if (hovered) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(cx - 64, sy + sh + 4, 128, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(loc.description, cx, sy + sh + 19);
    ctx.restore();
  }
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  s: {
    player: { x: number; y: number };
    facing: Dir8;
    moving: boolean;
    target: { x: number; y: number; locationId?: LocationId } | null;
    camX: number;
    camY: number;
  },
  _avatar: ReturnType<typeof getAvatar>,
  time: number,
) {
  // target ring (at tap destination)
  if (s.target) {
    const tx = (s.target.x - s.camX) * ZOOM;
    const ty = (s.target.y - s.camY) * ZOOM;
    ctx.save();
    const pulse = 0.5 + Math.sin(time * 5) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(tx, ty, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Always use the directional rex sprites on the home map for now.
  // (The growth-stage avatar is still used elsewhere, like the MyDino screen.)
  const img = loadUrl(REX_SPRITE_URLS[s.facing]);
  if (!img.complete || img.naturalWidth === 0) return;

  const targetH = 56; // screen pixels — stays constant regardless of ZOOM
  const aspect = img.naturalWidth / img.naturalHeight;
  const renderW = targetH * aspect;
  const bob = s.moving ? Math.sin(time * 10) * 4 : Math.sin(time * 2.5) * 2;
  const sx = (s.player.x - s.camX) * ZOOM;
  const sy = (s.player.y - s.camY) * ZOOM + bob;

  // Soft ground shadow.
  // - Anchored to the ground (doesn't rise/fall with the bob animation).
  // - Slightly smaller + fainter when the dino is airborne (negative bob),
  //   giving a subtle "grounded vs lifted" feel.
  // - Rendered as a scaled radial gradient for naturally soft edges.
  const groundY = sy - bob + targetH * 0.44;
  const lift = Math.max(0, -bob) / 4; // 0 when planted, ~1 at peak hop
  const radX = renderW * 0.5 * (1 - lift * 0.18);
  const radY = targetH * 0.14 * (1 - lift * 0.18);
  const coreAlpha = 0.52 * (1 - lift * 0.35);

  ctx.save();
  ctx.translate(sx, groundY);
  ctx.scale(1, radY / radX);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radX);
  grad.addColorStop(0, `rgba(0,0,0,${coreAlpha})`);
  grad.addColorStop(0.45, `rgba(0,0,0,${coreAlpha * 0.7})`);
  grad.addColorStop(0.8, `rgba(0,0,0,${coreAlpha * 0.25})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(img, sx - renderW / 2, sy - targetH * 0.45, renderW, targetH);
}

function drawQuestGiver(
  ctx: CanvasRenderingContext2D,
  hovered: boolean,
  time: number,
  hasQuestAvailable: boolean,
  hasActiveQuest: boolean,
  camX: number,
  camY: number,
) {
  const x = (QUEST_GIVER.x - camX) * ZOOM;
  const y = (QUEST_GIVER.y - camY) * ZOOM;
  const bob = Math.sin(time * 1.2) * 3;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 42, 28, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const img = getQuillSpriteImage();
  if (img.complete && img.naturalWidth > 0) {
    const spriteH = 88;
    const aspect = img.naturalWidth / img.naturalHeight;
    const spriteW = spriteH * aspect;
    ctx.save();
    if (hovered || hasQuestAvailable) {
      ctx.shadowColor = hasQuestAvailable ? 'rgba(255,213,79,0.95)' : 'rgba(255,255,255,0.75)';
      ctx.shadowBlur = hasQuestAvailable ? 20 + Math.sin(time * 4) * 4 : 14;
    }
    ctx.drawImage(img, x - spriteW / 2, y - spriteH / 2 + bob, spriteW, spriteH);
    ctx.restore();
  }

  // callout centered above Quill's head
  const indicatorX = x;
  const indicatorY = y - 58 + bob;
  if (hasQuestAvailable) {
    const pulse = 1 + Math.sin(time * 5) * 0.12;
    ctx.save();
    ctx.translate(indicatorX, indicatorY);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#3E2723';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  } else if (hasActiveQuest) {
    // "Continue your quest" — same shape as the new-quest "!" callout so it
    // reads as a deliberate marker, just in a calmer green.
    const pulse = 1 + Math.sin(time * 3.5) * 0.08;
    ctx.save();
    ctx.translate(indicatorX, indicatorY);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2E5D2F';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('→', 0, 1);
    ctx.restore();
  }
}
