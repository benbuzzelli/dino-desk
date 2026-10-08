export interface Point {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Sticker {
  id: string;
  emoji: string;
  name: string;
  earned: boolean;
}

export type GameId = 'egg-hunt' | 'spell-dino' | 'volcano-escape' | 'dino-match' | 'jungle-explorer' | 'dino-dungeon' | 'collection';
