export interface Vector2D {
  x: number;
  y: number;
}

export interface Player extends Vector2D {
  width: number;
  height: number;
  vx: number;
  vy: number;
  fuel: number;
  maxFuel: number;
}

export interface Enemy extends Vector2D {
  radius: number;
  speed: number;
  id: number;
  isDead: boolean;
}

export interface Particle extends Vector2D {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Pulse extends Vector2D {
  width: number;
  life: number;
  maxLife: number;
  isSuper?: boolean;
}

export interface Shockwave extends Vector2D {
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  id: number;
}

export enum GameState {
  START,
  PLAYING,
  GAMEOVER
}

export interface GameConfig {
  gravity: number;
  recoilForce: number;
  fuelRegen: number;
  fuelConsumption: number;
  enemySpawnRate: number;
  bounceElasticity: number;
  cursorScale: number;
  cursorColor: string;
  footerText: string;
  showCustomCursor: boolean;
  difficultyScale: number;
  deadZoneThreshold: number;
  superJumpMultiplier: number;
  spawnCurve: number[];
  deadJumpEnabled: boolean;
  burningEnabled: boolean;
  burningRadius: number;
  burningDuration: number;
  playerColor: string;
  playerShape: 'square' | 'circle' | 'triangle';
  playerSize: number;
  // New VFX & Audio Parameters
  crtEnabled: boolean;
  audioEnabled: boolean;
  bgmVolume: number;
  sfxVolume: number;
}
