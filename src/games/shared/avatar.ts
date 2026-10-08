import { profileKey } from './profile';
import { loadStickers } from './stickers';

// Egg + growth sprites per species
import rexEgg1 from './sprites/avatars/rex/egg-1.png';
import rexEgg2 from './sprites/avatars/rex/egg-2.png';
import rexEgg3 from './sprites/avatars/rex/egg-3.png';
import rexEgg4 from './sprites/avatars/rex/egg-4.png';
import rexHatch from './sprites/avatars/rex/hatchling.png';
import rexAdult from './sprites/avatars/rex/adult.png';
import rexEvolved from './sprites/avatars/rex/evolved.png';

import tricEgg1 from './sprites/avatars/triceratops/egg-1.png';
import tricEgg2 from './sprites/avatars/triceratops/egg-2.png';
import tricEgg3 from './sprites/avatars/triceratops/egg-3.png';
import tricEgg4 from './sprites/avatars/triceratops/egg-4.png';
import tricHatch from './sprites/avatars/triceratops/hatchling.png';
import tricAdult from './sprites/avatars/triceratops/adult.png';
import tricEvolved from './sprites/avatars/triceratops/evolved.png';

import spinoEgg1 from './sprites/avatars/spino/egg-1.png';
import spinoEgg2 from './sprites/avatars/spino/egg-2.png';
import spinoEgg3 from './sprites/avatars/spino/egg-3.png';
import spinoEgg4 from './sprites/avatars/spino/egg-4.png';
import spinoHatch from './sprites/avatars/spino/hatchling.png';
import spinoAdult from './sprites/avatars/spino/adult.png';
import spinoEvolved from './sprites/avatars/spino/evolved.png';

import brontoEgg1 from './sprites/avatars/bronto/egg-1.png';
import brontoEgg2 from './sprites/avatars/bronto/egg-2.png';
import brontoEgg3 from './sprites/avatars/bronto/egg-3.png';
import brontoEgg4 from './sprites/avatars/bronto/egg-4.png';
import brontoHatch1 from './sprites/avatars/bronto/hatchling-1.png';
import brontoHatch2 from './sprites/avatars/bronto/hatchling-2.png';
import brontoAdult from './sprites/avatars/bronto/adult.png';

import pteraEgg1 from './sprites/avatars/pteradon/egg-1.png';
import pteraEgg2 from './sprites/avatars/pteradon/egg-2.png';
import pteraEgg3 from './sprites/avatars/pteradon/egg-3.png';
import pteraEgg4 from './sprites/avatars/pteradon/egg-4.png';
import pteraHatch from './sprites/avatars/pteradon/hatchling-1.png';
import pteraAdult from './sprites/avatars/pteradon/adult.png';

const AVATAR_KEY = 'avatar';

export type AvatarSpecies = 'rex' | 'tric' | 'bronto' | 'spino' | 'ptera';

export interface Avatar {
  species: AvatarSpecies;
  color: string;
  name?: string;
  createdAt?: number;
}

export const AVATAR_SPECIES: { species: AvatarSpecies; label: string }[] = [
  { species: 'rex', label: 'T-Rex' },
  { species: 'tric', label: 'Triceratops' },
  { species: 'bronto', label: 'Bronto' },
  { species: 'spino', label: 'Spino' },
  { species: 'ptera', label: 'Pteranodon' },
];

export const AVATAR_COLORS: { value: string; label: string }[] = [
  { value: '#4CAF50', label: 'Green' },
  { value: '#FF9800', label: 'Orange' },
  { value: '#E91E63', label: 'Pink' },
  { value: '#2196F3', label: 'Blue' },
  { value: '#9C27B0', label: 'Purple' },
  { value: '#FFEB3B', label: 'Yellow' },
  { value: '#F44336', label: 'Red' },
  { value: '#00BCD4', label: 'Teal' },
];

// 7 growth stages driven by unique stickers earned.
// Thresholds chosen so first few stages fire quickly (kids feel progress within
// their first session) then space out to cover the ~14 stickers available.
export interface GrowthStage {
  index: number;
  name: string;
  threshold: number;
  description: string;
}

export const GROWTH_STAGES: GrowthStage[] = [
  { index: 0, name: 'Egg',      threshold: 0,  description: 'A mysterious egg!' },
  { index: 1, name: 'Wiggle',   threshold: 1,  description: 'Something is wiggling inside...' },
  { index: 2, name: 'Cracking', threshold: 3,  description: 'The shell is cracking open!' },
  { index: 3, name: 'Hatching', threshold: 5,  description: 'Almost here!' },
  { index: 4, name: 'Hatchling',threshold: 7,  description: 'Your baby dino is born!' },
  { index: 5, name: 'Juvenile', threshold: 10, description: 'Growing strong.' },
  { index: 6, name: 'Grown',    threshold: 14, description: 'A mighty dinosaur!' },
];

type SpriteSet = string[]; // length 7, one per stage

const SPRITES: Record<AvatarSpecies, SpriteSet> = {
  rex:   [rexEgg1, rexEgg2, rexEgg3, rexEgg4, rexHatch, rexAdult, rexEvolved],
  tric:  [tricEgg1, tricEgg2, tricEgg3, tricEgg4, tricHatch, tricAdult, tricEvolved],
  spino: [spinoEgg1, spinoEgg2, spinoEgg3, spinoEgg4, spinoHatch, spinoAdult, spinoEvolved],
  bronto:[brontoEgg1, brontoEgg2, brontoEgg3, brontoEgg4, brontoHatch1, brontoHatch2, brontoAdult],
  ptera: [pteraEgg1, pteraEgg2, pteraEgg3, pteraEgg4, pteraHatch, pteraAdult, pteraAdult],
};

const imageCache = new Map<string, HTMLImageElement>();

function loadUrl(url: string): HTMLImageElement {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const img = new Image();
  img.src = url;
  imageCache.set(url, img);
  return img;
}

export function getAvatar(): Avatar | null {
  try {
    const raw = localStorage.getItem(profileKey(AVATAR_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.species === 'string' && typeof parsed.color === 'string') {
      return parsed;
    }
  } catch {}
  return null;
}

export function setAvatar(avatar: Avatar) {
  try {
    const withDefaults: Avatar = {
      createdAt: Date.now(),
      ...avatar,
    };
    localStorage.setItem(profileKey(AVATAR_KEY), JSON.stringify(withDefaults));
  } catch {}
}

export function hasAvatar(): boolean {
  return getAvatar() !== null;
}

export function getEarnedStickerCount(): number {
  return loadStickers().filter((s) => s.earned).length;
}

export function getGrowthStage(stickerCount: number): GrowthStage {
  let current = GROWTH_STAGES[0];
  for (const stage of GROWTH_STAGES) {
    if (stickerCount >= stage.threshold) current = stage;
    else break;
  }
  return current;
}

export function getNextStage(stickerCount: number): GrowthStage | null {
  const current = getGrowthStage(stickerCount);
  return GROWTH_STAGES[current.index + 1] ?? null;
}

export function getAvatarStageImage(
  species: AvatarSpecies,
  stageIndex: number,
): HTMLImageElement {
  const set = SPRITES[species] ?? SPRITES.rex;
  const clamped = Math.max(0, Math.min(set.length - 1, stageIndex));
  return loadUrl(set[clamped]);
}

export function drawAvatarSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  species: AvatarSpecies,
  stageIndex: number,
  facingLeft = false,
) {
  const img = getAvatarStageImage(species, stageIndex);
  if (!img.complete || img.naturalWidth === 0) return;

  const aspect = img.naturalWidth / img.naturalHeight;
  const renderH = size * 1.4;
  const renderW = renderH * aspect;

  ctx.save();
  if (facingLeft) {
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }

  // subtle ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + renderH * 0.38, renderW * 0.32, renderH * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(img, x - renderW / 2, y - renderH * 0.42, renderW, renderH);
  ctx.restore();
}
