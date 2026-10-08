import neutral from './sprites/quill/neutral.png';
import excited from './sprites/quill/excited.png';
import grateful from './sprites/quill/grateful.png';
import confidentReady from './sprites/quill/confident-ready.png';
import seriousWarning from './sprites/quill/serious-warning.png';
import wink from './sprites/quill/wink.png';
import worried from './sprites/quill/worried.png';
import fullBody from './sprites/quill/quill.png';

// Billboard frames — Quill peeking over a stone-tablet frame with a
// different expression. Used as the full-card background in QuestOverlay.
import bbAdoring from './sprites/misc/adoring.png';
import bbAngry from './sprites/misc/angry.png';
import bbBanner from './sprites/misc/banner.png';
import bbBored from './sprites/misc/bored.png';
import bbDeeplyShocked from './sprites/misc/deeply-shocked.png';
import bbGiddy from './sprites/misc/giddy.png';
import bbLaughing from './sprites/misc/laughing.png';
import bbLaughing1 from './sprites/misc/laughing-1.png';
import bbMischievous from './sprites/misc/mischievous.png';
import bbNeutral from './sprites/misc/neutral.png';
import bbPompous from './sprites/misc/pompous.png';
import bbRelieved from './sprites/misc/relieved.png';
import bbSad from './sprites/misc/sad.png';
import bbWorried from './sprites/misc/worried.png';

export type QuillEmote =
  | 'neutral'
  | 'excited'
  | 'grateful'
  | 'confident-ready'
  | 'serious-warning'
  | 'wink'
  | 'worried';

const EMOTE_URLS: Record<QuillEmote, string> = {
  'neutral': neutral,
  'excited': excited,
  'grateful': grateful,
  'confident-ready': confidentReady,
  'serious-warning': seriousWarning,
  'wink': wink,
  'worried': worried,
};

export function getQuillEmoteUrl(emote: QuillEmote): string {
  return EMOTE_URLS[emote] ?? EMOTE_URLS.neutral;
}

// Billboard frames — each is Quill peeking over a rune-carved stone-tablet
// frame wearing a different expression. Aspect ratio is ~593×653 (portrait).
export type QuillBillboard =
  | 'adoring'
  | 'angry'
  | 'banner'
  | 'bored'
  | 'deeply-shocked'
  | 'giddy'
  | 'laughing'
  | 'laughing-1'
  | 'mischievous'
  | 'neutral'
  | 'pompous'
  | 'relieved'
  | 'sad'
  | 'worried';

const BILLBOARD_URLS: Record<QuillBillboard, string> = {
  'adoring': bbAdoring,
  'angry': bbAngry,
  'banner': bbBanner,
  'bored': bbBored,
  'deeply-shocked': bbDeeplyShocked,
  'giddy': bbGiddy,
  'laughing': bbLaughing,
  'laughing-1': bbLaughing1,
  'mischievous': bbMischievous,
  'neutral': bbNeutral,
  'pompous': bbPompous,
  'relieved': bbRelieved,
  'sad': bbSad,
  'worried': bbWorried,
};

export function getQuillBillboardUrl(b: QuillBillboard): string {
  return BILLBOARD_URLS[b] ?? BILLBOARD_URLS.neutral;
}

// Sensible fallback when a quest only specifies an emote and no billboard.
const EMOTE_TO_BILLBOARD: Record<QuillEmote, QuillBillboard> = {
  'neutral': 'neutral',
  'excited': 'giddy',
  'grateful': 'relieved',
  'confident-ready': 'mischievous',
  'serious-warning': 'angry',
  'wink': 'mischievous',
  'worried': 'worried',
};

export function billboardFromEmote(emote: QuillEmote): QuillBillboard {
  return EMOTE_TO_BILLBOARD[emote] ?? 'neutral';
}

const imageCache = new Map<string, HTMLImageElement>();

function loadUrl(url: string): HTMLImageElement {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const img = new Image();
  img.src = url;
  imageCache.set(url, img);
  return img;
}

// Full-body Quill sprite, used for the valley NPC marker.
export function getQuillSpriteImage(): HTMLImageElement {
  return loadUrl(fullBody);
}

// Kick off eager loads so the first popup isn't blank for a frame.
export function preloadQuillEmotes() {
  for (const url of Object.values(EMOTE_URLS)) loadUrl(url);
  for (const url of Object.values(BILLBOARD_URLS)) loadUrl(url);
  loadUrl(fullBody);
}
