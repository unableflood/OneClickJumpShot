
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  PICO8_COLORS, 
  PHYSICS 
} from '../constants';
import { 
  Player, 
  Enemy, 
  Particle, 
  Pulse, 
  Shockwave,
  GameState,
  GameConfig,
  Vector2D
} from '../types';

interface GameProps {
  config: GameConfig;
  isMouseOver: boolean;
  onPlayerScreenPosUpdate?: (pos: Vector2D) => void;
}

const Game: React.FC<GameProps> = ({ config, isMouseOver, onPlayerScreenPosUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const elapsedTimeRef = useRef(0);
  const invincibilityFramesRef = useRef(0);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundPlayedRef = useRef<Record<string, number>>({});

  const playerRef = useRef<Player & { flashTimer: number }>({ 
    x: GAME_WIDTH / 2 - config.playerSize / 2, 
    y: GAME_HEIGHT / 2 - 100, 
    width: config.playerSize, 
    height: config.playerSize, 
    vx: 0, 
    vy: 0,
    fuel: PHYSICS.MAX_FUEL,
    maxFuel: PHYSICS.MAX_FUEL,
    flashTimer: 0
  });
  
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const frameIdRef = useRef<number>(0);
  const enemyIdCounter = useRef(0);
  const shockwaveIdCounter = useRef(0);

  const gameStateRef = useRef(gameState);
  const isMouseOverRef = useRef(isMouseOver);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isMouseOverRef.current = isMouseOver;
  }, [isMouseOver]);

  useEffect(() => {
    playerRef.current.width = config.playerSize;
    playerRef.current.height = config.playerSize;
  }, [config.playerSize]);

  // Audio Synthesis Helpers
  const playSound = (type: 'jump' | 'shockwave' | 'pulse' | 'kill' | 'deadjump') => {
    if (!config.audioEnabled || config.sfxVolume <= 0) return;

    const now_ts = Date.now();
    const throttleTime = type === 'kill' ? 60 : 50;
    if (lastSoundPlayedRef.current[type] && now_ts - lastSoundPlayedRef.current[type] < throttleTime) {
      return;
    }
    lastSoundPlayedRef.current[type] = now_ts;

    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
        case 'jump':
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(config.sfxVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.01 * (config.sfxVolume / 0.1), now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'deadjump':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(config.sfxVolume * 2, now);
            gain.gain.exponentialRampToValueAtTime(0.01 * (config.sfxVolume / 0.1), now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        case 'shockwave':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
            gain.gain.setValueAtTime(config.sfxVolume * 1.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            break;
        case 'pulse':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(400, now + 0.05);
            gain.gain.setValueAtTime(config.sfxVolume * 0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        case 'kill':
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.setValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(config.sfxVolume * 0.8, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
    }
  };

  const playBgmNote = () => {
    if (!config.audioEnabled || gameStateRef.current !== GameState.PLAYING || config.bgmVolume <= 0) return;
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const notes = [130.81, 146.83, 164.81, 196.00]; // C3, D3, E3, G3
    const freq = notes[Math.floor(elapsedTimeRef.current / 30) % notes.length];
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(config.bgmVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
  };

  useEffect(() => {
    if (config.audioEnabled && gameState === GameState.PLAYING) {
        const interval = window.setInterval(playBgmNote, 250);
        return () => window.clearInterval(interval);
    }
  }, [config.audioEnabled, gameState, config.bgmVolume]);

  const resetGame = useCallback(() => {
    playerRef.current = { 
      x: GAME_WIDTH / 2 - config.playerSize / 2, 
      y: GAME_HEIGHT / 2 - 100, 
      width: config.playerSize, 
      height: config.playerSize, 
      vx: 0, 
      vy: 0,
      fuel: PHYSICS.MAX_FUEL,
      maxFuel: PHYSICS.MAX_FUEL,
      flashTimer: 0
    };
    enemiesRef.current = [];
    particlesRef.current = [];
    pulsesRef.current = [];
    shockwavesRef.current = [];
    shakeRef.current = { x: 0, y: 0, intensity: 0 };
    elapsedTimeRef.current = 0;
    invincibilityFramesRef.current = 0;
    setScore(0);
    setGameState(GameState.PLAYING);
    if (config.audioEnabled) playSound('pulse');
  }, [config.playerSize, config.audioEnabled, config.sfxVolume]);

  const triggerShockwave = useCallback((x: number, y: number, radiusScale: number = 1.0) => {
    if (!config.burningEnabled) return;
    shockwavesRef.current.push({
      x,
      y,
      radius: 0,
      maxRadius: config.burningRadius * radiusScale,
      life: config.burningDuration,
      maxLife: config.burningDuration,
      id: shockwaveIdCounter.current++
    });
    playSound('shockwave');
  }, [config.burningEnabled, config.burningRadius, config.burningDuration]);

  const executeJump = useCallback((mouseX: number, mouseY: number) => {
    const player = playerRef.current;
    if (player.fuel < config.fuelConsumption) {
      shakeRef.current.intensity = 5;
      playSound('pulse'); 
      return;
    }

    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const dx = mouseX - px;
    const dy = mouseY - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    const deadZoneY = GAME_HEIGHT * (1 - config.deadZoneThreshold);
    const inDeadZone = config.deadJumpEnabled && (player.y + player.height > deadZoneY);
    
    let force = config.recoilForce;
    let isSuper = false;

    if (inDeadZone) {
      force *= config.superJumpMultiplier;
      isSuper = true;
      invincibilityFramesRef.current = 15;
      shakeRef.current.intensity = 30;
      playSound('deadjump');
    } else {
      playSound('jump');
    }

    player.vx = -ux * force;
    player.vy = -uy * force;
    player.fuel -= config.fuelConsumption;

    const pulseWidth = player.width + (isSuper ? 30 : 10);
    pulsesRef.current.push({
      x: px - pulseWidth / 2,
      y: py,
      width: pulseWidth,
      life: isSuper ? 15 : 8,
      maxLife: isSuper ? 15 : 8,
      isSuper: isSuper
    });

    enemiesRef.current.forEach(e => {
      const withinRayX = (e.x + e.radius > px - pulseWidth / 2) && (e.x - e.radius < px + pulseWidth / 2);
      const isAffected = isSuper ? (e.y < py) : (e.y > py);

      if (withinRayX && isAffected && !e.isDead) {
        e.isDead = true;
        player.fuel = player.maxFuel;
        player.flashTimer = 10;
        
        triggerShockwave(px, py);
        playSound('kill');

        for (let i = 0; i < (isSuper ? 20 : 12); i++) {
          particlesRef.current.push({
            x: e.x, y: e.y,
            vx: (Math.random() - 0.5) * 12,
            vy: (Math.random() - 0.5) * 12,
            life: 25, maxLife: 25,
            color: isSuper ? PICO8_COLORS.YELLOW : PICO8_COLORS.WHITE
          });
        }
      }
    });

    if (!isSuper) shakeRef.current.intensity = 15;

    for (let i = 0; i < (isSuper ? 40 : 20); i++) {
      const pAngle = Math.atan2(-uy, -ux) + (Math.random() - 0.5) * 1.5;
      const pSpeed = (isSuper ? 5 : 2) + Math.random() * 8;
      particlesRef.current.push({
        x: px,
        y: py,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color: isSuper ? PICO8_COLORS.ORANGE : PICO8_COLORS.HOT_PINK
      });
    }
  }, [config, triggerShockwave]);

  const handleGlobalInteraction = useCallback((e: MouseEvent | TouchEvent) => {
    const isTouch = window.TouchEvent && e instanceof TouchEvent;
    if (!isMouseOverRef.current && !isTouch) return;

    if (gameStateRef.current !== GameState.PLAYING) {
      if (gameStateRef.current === GameState.START || gameStateRef.current === GameState.GAMEOVER) {
        resetGame();
      }
      return;
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    let clientX, clientY;
    if (isTouch) {
      clientX = (e as TouchEvent).touches[0].clientX;
      clientY = (e as TouchEvent).touches[0].clientY;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    const mx = (clientX - rect.left) * (GAME_WIDTH / rect.width);
    const my = (clientY - rect.top) * (GAME_HEIGHT / rect.height);
    executeJump(mx, my);
  }, [resetGame, executeJump]);

  useEffect(() => {
    window.addEventListener('mousedown', handleGlobalInteraction);
    window.addEventListener('touchstart', handleGlobalInteraction);
    return () => {
      window.removeEventListener('mousedown', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
    };
  }, [handleGlobalInteraction]);

  const update = useCallback(() => {
    const dt = 1.0;
    elapsedTimeRef.current += dt;

    if (gameState !== GameState.PLAYING) return;
    
    // Score based on survival time (altitude simulation), +10 per second (60 frames)
    setScore(Math.floor(elapsedTimeRef.current / 60) * 10);
    
    if (invincibilityFramesRef.current > 0) invincibilityFramesRef.current -= dt;
    
    const player = playerRef.current;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    player.vy += config.gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.vx *= PHYSICS.AIR_RESISTANCE;

    if (player.flashTimer > 0) player.flashTimer -= dt;
    
    if (player.x < 0) { 
      player.x = 0; 
      player.vx = -player.vx * config.bounceElasticity;
      shakeRef.current.intensity = Math.abs(player.vx) * 0.5;
    }
    if (player.x > GAME_WIDTH - player.width) { 
      player.x = GAME_WIDTH - player.width; 
      player.vx = -player.vx * config.bounceElasticity;
      shakeRef.current.intensity = Math.abs(player.vx) * 0.5;
    }

    if (player.fuel < player.maxFuel) {
      player.fuel = Math.min(player.maxFuel, player.fuel + config.fuelRegen * dt);
    }

    if (player.y > GAME_HEIGHT) {
      setGameState(GameState.GAMEOVER);
      shakeRef.current.intensity = 25;
      playSound('shockwave');
    }

    if (shakeRef.current.intensity > 0) {
      shakeRef.current.x = (Math.random() - 0.5) * shakeRef.current.intensity;
      shakeRef.current.y = (Math.random() - 0.5) * shakeRef.current.intensity;
      shakeRef.current.intensity *= 0.9;
    }

    particlesRef.current.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += config.gravity * 0.3 * dt;
      p.life -= 1 * dt;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    pulsesRef.current.forEach(s => {
      s.life -= 1 * dt;
    });
    pulsesRef.current = pulsesRef.current.filter(s => s.life > 0);

    shockwavesRef.current.forEach(sw => {
      sw.x = playerCenterX;
      sw.y = playerCenterY;
      sw.life -= dt;
      const progress = 1 - sw.life / sw.maxLife;
      const easedProgress = Math.sin(progress * Math.PI);
      sw.radius = easedProgress * sw.maxRadius;

      enemiesRef.current.forEach(e => {
        if (!e.isDead) {
          const dx = e.x - sw.x;
          const dy = e.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < sw.radius + e.radius) {
            e.isDead = true;
            triggerShockwave(playerCenterX, playerCenterY, 0.8);
            playSound('kill');
          }
        }
      });
    });
    shockwavesRef.current = shockwavesRef.current.filter(sw => sw.life > 0);

    const seconds = elapsedTimeRef.current / 60;
    const waveFactor = 1.0 + 0.6 * Math.sin(seconds * 0.8);
    const cycleDuration = 120;
    const t = (seconds % cycleDuration) / cycleDuration;
    const points = config.spawnCurve;
    const n = points.length - 1;
    const idx = Math.floor(t * n);
    const nxtIdx = Math.min(idx + 1, n);
    const localT = (t * n) % 1;
    const curveValue = points[idx] * (1 - localT) + points[nxtIdx] * localT;
    const finalSpawnRate = (config.enemySpawnRate + curveValue * 0.1 * config.difficultyScale) * waveFactor;
    const finalSpeed = Math.min(1.5 + (seconds * 0.05 * config.difficultyScale), 8); 

    if (Math.random() < finalSpawnRate * dt) {
      let spawnX = Math.random() * (GAME_WIDTH - 40) + 20;
      if (Math.abs(spawnX - playerCenterX) < 60) {
        spawnX = spawnX < playerCenterX ? Math.max(20, spawnX - 60) : Math.min(GAME_WIDTH - 20, spawnX + 60);
      }
      enemiesRef.current.push({
        id: enemyIdCounter.current++,
        x: spawnX, y: -30, radius: 10 + Math.random() * 12, speed: finalSpeed + Math.random() * 1.0, isDead: false
      });
    }

    enemiesRef.current.forEach(e => {
      e.y += e.speed * dt;
      const pdx = e.x - playerCenterX;
      const pdy = e.y - playerCenterY;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (invincibilityFramesRef.current <= 0 && pdist < e.radius + player.width/2 - 2) {
        setGameState(GameState.GAMEOVER);
        playSound('shockwave');
      }
    });

    enemiesRef.current = enemiesRef.current.filter(e => !e.isDead && e.y < GAME_HEIGHT + 50);

    if (onPlayerScreenPosUpdate && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = rect.left + playerCenterX * (rect.width / GAME_WIDTH);
      const screenY = rect.top + playerCenterY * (rect.height / GAME_HEIGHT);
      onPlayerScreenPosUpdate({ x: screenX, y: screenY });
    }

  }, [gameState, config, onPlayerScreenPosUpdate, triggerShockwave]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = PICO8_COLORS.PINK;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (config.deadJumpEnabled) {
      const deadZoneY = GAME_HEIGHT * (1 - config.deadZoneThreshold);
      ctx.fillStyle = 'rgba(255, 163, 0, 0.05)';
      ctx.fillRect(0, deadZoneY, GAME_WIDTH, GAME_HEIGHT - deadZoneY);
      ctx.strokeStyle = 'rgba(255, 163, 0, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, deadZoneY); ctx.lineTo(GAME_WIDTH, deadZoneY); ctx.stroke();
    }

    ctx.save();
    ctx.translate(shakeRef.current.x, shakeRef.current.y);

    pulsesRef.current.forEach(s => {
      const alpha = s.life / s.maxLife;
      const gradient = ctx.createLinearGradient(s.x, s.y, s.x, s.isSuper ? 0 : GAME_HEIGHT);
      if (s.isSuper) {
        gradient.addColorStop(0, `rgba(255, 236, 39, ${alpha})`); gradient.addColorStop(0.5, `rgba(255, 163, 0, ${alpha * 0.5})`); gradient.addColorStop(1, `rgba(255, 163, 0, 0)`);
        ctx.fillStyle = gradient; ctx.fillRect(s.x, 0, s.width, s.y);
      } else {
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`); gradient.addColorStop(0.5, `rgba(255, 119, 168, ${alpha * 0.5})`); gradient.addColorStop(1, `rgba(255, 119, 168, 0)`);
        ctx.fillStyle = gradient; ctx.fillRect(s.x, s.y, s.width, GAME_HEIGHT - s.y);
      }
    });

    shockwavesRef.current.forEach(sw => {
      const alpha = Math.min(1, (sw.life / sw.maxLife) * 2);
      ctx.strokeStyle = PICO8_COLORS.YELLOW; ctx.lineWidth = 3; ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PICO8_COLORS.ORANGE; ctx.globalAlpha = alpha * 0.2; ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1.0;

    const p = playerRef.current;
    if (invincibilityFramesRef.current > 0) ctx.fillStyle = PICO8_COLORS.YELLOW; 
    else if (p.flashTimer > 0) ctx.fillStyle = PICO8_COLORS.WHITE; 
    else if (p.fuel < config.fuelConsumption) ctx.fillStyle = PICO8_COLORS.DARK_GRAY;
    else ctx.fillStyle = config.playerColor;
    
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    const size = p.width;

    if (gameState === GameState.PLAYING || gameState === GameState.GAMEOVER) {
      if (config.playerShape === 'square') {
        ctx.fillRect(p.x, p.y, size, size);
      } else if (config.playerShape === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (config.playerShape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(cx, p.y);
        ctx.lineTo(p.x, p.y + size);
        ctx.lineTo(p.x + size, p.y + size);
        ctx.closePath();
        ctx.fill();
      }

      enemiesRef.current.forEach(e => {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = PICO8_COLORS.RED; ctx.fill(); ctx.closePath();
        ctx.fillStyle = PICO8_COLORS.WHITE; ctx.fillRect(e.x - e.radius*0.4, e.y - e.radius*0.4, 4, 4);
      });
    }

    ctx.restore();

    // CRT Overlay Effect
    if (config.crtEnabled) {
        ctx.fillStyle = 'rgba(18, 16, 16, 0.1)';
        for (let i = 0; i < GAME_HEIGHT; i += 3) {
            ctx.fillRect(0, i, GAME_WIDTH, 1);
        }
        const gradient = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 50, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT / 1.5);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (gameState === GameState.PLAYING) {
      ctx.fillStyle = PICO8_COLORS.HOT_PINK; ctx.font = '16px "Press Start 2P"'; ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
      ctx.fillText(`SCORE: ${score}`, 20, 40);

      const fuelBarWidth = 120; const fuelBarHeight = 12; const fuelBarX = GAME_WIDTH - fuelBarWidth - 20; const fuelBarY = 28;
      ctx.font = '8px "Press Start 2P"'; ctx.fillStyle = PICO8_COLORS.HOT_PINK; ctx.fillText('FUEL', fuelBarX, fuelBarY - 8);
      ctx.fillStyle = PICO8_COLORS.DARK_BLUE; ctx.fillRect(fuelBarX, fuelBarY, fuelBarWidth, fuelBarHeight);
      ctx.fillStyle = p.fuel < config.fuelConsumption ? PICO8_COLORS.RED : PICO8_COLORS.BLUE;
      ctx.fillRect(fuelBarX, fuelBarY, (p.fuel / p.maxFuel) * fuelBarWidth, fuelBarHeight);
      ctx.strokeStyle = PICO8_COLORS.WHITE; ctx.lineWidth = 2; ctx.strokeRect(fuelBarX, fuelBarY, fuelBarWidth, fuelBarHeight);
    }

    ctx.shadowBlur = 0;

    if (gameState === GameState.START) {
      const floatY = Math.sin(elapsedTimeRef.current * 0.05) * 10;
      
      ctx.fillStyle = 'rgba(29, 43, 83, 0.4)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      ctx.textAlign = 'center';
      
      // Title
      ctx.font = '36px "Press Start 2P"';
      ctx.fillStyle = PICO8_COLORS.BLACK;
      ctx.fillText('PULSE', GAME_WIDTH / 2 + 4, GAME_HEIGHT / 2 - 40 + floatY + 4);
      ctx.fillStyle = PICO8_COLORS.HOT_PINK;
      ctx.fillText('PULSE', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40 + floatY);
      
      ctx.font = '12px "Press Start 2P"';
      ctx.fillStyle = PICO8_COLORS.DARK_BLUE;
      ctx.fillText('SHOCKWAVE SURVIVOR', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 5);
      
      // Subtitle pulsing
      const subPulse = 0.7 + Math.sin(elapsedTimeRef.current * 0.1) * 0.3;
      ctx.globalAlpha = subPulse;
      ctx.font = '10px "Press Start 2P"';
      ctx.fillStyle = PICO8_COLORS.WHITE;
      ctx.fillText('CLICK TO INITIATE LAUNCH', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
      ctx.globalAlpha = 1.0;
      
      // High Score display in menu
      if (highScore > 0) {
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = PICO8_COLORS.ORANGE;
        ctx.fillText(`BEST ALTITUDE: ${highScore}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100);
      }
      
      // Controls Hint
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = PICO8_COLORS.INDIGO;
      ctx.fillText('CLICK TO RECOIL / KILL ENEMIES TO REFUEL', GAME_WIDTH / 2, GAME_HEIGHT - 40);

    } else if (gameState === GameState.GAMEOVER) {
      ctx.fillStyle = 'rgba(126, 37, 83, 0.7)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = PICO8_COLORS.WHITE; ctx.textAlign = 'center'; ctx.font = '32px "Press Start 2P"';
      ctx.fillText('OFFLINE', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
      ctx.font = '12px "Press Start 2P"'; ctx.fillText(`FINAL SCORE: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
      ctx.font = '10px "Press Start 2P"'; ctx.fillText('CLICK TO RE-IGNITE', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80);
    }

  }, [gameState, score, config, triggerShockwave, highScore]);

  useEffect(() => {
    const loop = () => { update(); draw(); frameIdRef.current = requestAnimationFrame(loop); };
    frameIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [update, draw]);

  useEffect(() => { if (score > highScore) setHighScore(score); }, [score, highScore]);

  return <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="block" />;
};

export default Game;
