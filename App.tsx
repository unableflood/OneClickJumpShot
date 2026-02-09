
import React, { useState, useEffect, useRef } from 'react';
import Game from './components/Game';
import { GameConfig, Vector2D } from './types';
import { PICO8_COLORS } from './constants';

const CurveEditor: React.FC<{ 
  points: number[], 
  onChange: (newPoints: number[]) => void,
  showCustomCursor: boolean 
}> = ({ points, onChange, showCustomCursor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePoint, setActivePoint] = useState<number | null>(null);

  const handlePointClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePoint === index) {
      setActivePoint(null);
    } else {
      setActivePoint(index);
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (activePoint === null || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      const newPoints = [...points];
      newPoints[activePoint] = y;
      onChange(newPoints);
    };

    const handleGlobalClick = () => {
      if (activePoint !== null) {
        setActivePoint(null);
      }
    };

    if (activePoint !== null) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mousedown', handleGlobalClick);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [activePoint, points, onChange]);

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between text-[8px] text-[#83769C] mb-1 uppercase tracking-tighter">
        <span>Intensity Curve (120s Cycle)</span>
      </div>
      <div 
        ref={containerRef}
        className={`relative h-24 bg-[#1a1c2c] border-2 border-[#83769C] rounded-sm overflow-visible cursor-default`}
      >
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 opacity-10 pointer-events-none">
          {[...Array(8)].map((_, i) => <div key={i} className="border border-[#FFF1E8]" />)}
        </div>

        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          <path 
            d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / (points.length - 1)) * 100}% ${100 - p * 100}%`).join(' ')}
            fill="none"
            stroke={PICO8_COLORS.BLUE}
            strokeWidth="2"
          />
        </svg>

        {points.map((p, i) => (
          <div 
            key={i}
            onMouseDown={(e) => handlePointClick(i, e)}
            className={`absolute w-3 h-3 bg-white border-2 border-[#29ADFF] rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer hover:scale-125 z-10 ${activePoint === i ? 'scale-150 bg-[#FFEC27] border-white' : ''}`}
            style={{ 
              left: `${(i / (points.length - 1)) * 100}%`, 
              top: `${100 - p * 100}%`,
              boxShadow: activePoint === i ? '0 0 10px #FFEC27' : 'none'
            }}
          />
        ))}
        
        {activePoint !== null && (
           <div className="absolute bottom-1 right-1 text-[7px] text-[#FFEC27] animate-pulse pointer-events-none uppercase">
             Active: Point {activePoint + 1}
           </div>
        )}
      </div>
    </div>
  );
};

const RocketCursor: React.FC<{ 
  scale: number, 
  color: string,
  isRecoiling: boolean,
  isVisible: boolean,
  cursorRef: React.RefObject<HTMLDivElement | null>
}> = ({ scale, color, isRecoiling, isVisible, cursorRef }) => {
  return (
    <div 
      ref={cursorRef}
      className="fixed pointer-events-none z-[9999]"
      style={{ 
        display: isVisible ? 'block' : 'none',
        transform: `translate(-50%, -50%) scale(${scale})`,
        imageRendering: 'pixelated',
        willChange: 'transform'
      }}
    >
      <svg width="16" height="24" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="8" height="12" fill="white" />
        <rect x="6" y="0" width="4" height="4" fill={color} />
        <rect x="0" y="12" width="4" height="4" fill={color} />
        <rect x="12" y="12" width="4" height="4" fill={color} />
        <rect x="7" y="6" width="2" height="2" fill="#29ADFF" />
        <rect 
          x="6" y="16" width="4" height={isRecoiling ? (4 + Math.random() * 4) : 2} 
          fill={isRecoiling ? PICO8_COLORS.ORANGE : PICO8_COLORS.LIGHT_GRAY} 
          opacity={isRecoiling ? 1 : 0.4}
        />
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const [config, setConfig] = useState<GameConfig>({
    gravity: 0.16,
    recoilForce: 6,
    fuelRegen: 0.1,
    fuelConsumption: 12,
    enemySpawnRate: 0.01,
    bounceElasticity: 1.2,
    cursorScale: 1.5,
    cursorColor: "#FF77A8",
    footerText: "One click to launch, one kill to trigger a shockwave, and endless blasts to clear your path to the peak",
    showCustomCursor: true,
    difficultyScale: 0.5,
    deadZoneThreshold: 0.15,
    superJumpMultiplier: 3,
    spawnCurve: [
      0.1,
      0.1785714285714286,
      0.29761904761904767,
      0.4,
      0.47619047619047616
    ],
    deadJumpEnabled: false,
    burningEnabled: true,
    burningRadius: 80,
    burningDuration: 44,
    playerColor: "#FFCCAA",
    playerShape: "square",
    playerSize: 20,
    crtEnabled: true,
    audioEnabled: true,
    bgmVolume: 0.05,
    sfxVolume: 0.04
  });

  const [isClicking, setIsClicking] = useState(false);
  const [isMouseOverGame, setIsMouseOverGame] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const handleChange = (key: keyof GameConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    const data = JSON.stringify(config, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(() => {
          alert("CONFIG COPIED TO CLIPBOARD!");
        }).catch(() => {
          fallbackCopy(data);
        });
      } else {
        fallbackCopy(data);
      }
    } catch (e) {
      fallbackCopy(data);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      alert("CONFIG COPIED (FALLBACK)!");
    } catch (err) {
      alert("UNABLE TO EXPORT CONFIG.");
    }
    document.body.removeChild(textArea);
  };

  const handleImport = () => {
    const input = window.prompt("PASTE CONFIG JSON HERE:");
    if (input) {
      try {
        const newConfig = JSON.parse(input);
        setConfig(prev => ({ ...prev, ...newConfig }));
        alert("CONFIG IMPORTED SUCCESS!");
      } catch (e) {
        alert("INVALID JSON CONFIG!");
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Update cursor position directly for 60fps performance
      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`;
        cursorRef.current.style.top = `${e.clientY}px`;
      }

      if (gameContainerRef.current) {
        const rect = gameContainerRef.current.getBoundingClientRect();
        const inside = e.clientX >= rect.left && e.clientX <= rect.right && 
                       e.clientY >= rect.top && e.clientY <= rect.bottom;
        setIsMouseOverGame(inside);
      }
    };
    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'F7') {
        setSidebarVisible(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div 
      className="flex flex-col lg:flex-row items-center lg:items-stretch min-h-screen bg-[#1a1c2c] p-0 overflow-hidden"
    >
      {sidebarVisible && (
        <div 
          className="w-full lg:w-72 bg-[#1D2B53] border-b-4 lg:border-b-0 lg:border-r-4 border-[#83769C] p-6 font-mono text-[10px] text-[#FFF1E8] shadow-2xl z-20 flex flex-col h-auto lg:h-screen overflow-y-auto cursor-default pointer-events-auto"
          onMouseEnter={() => setIsMouseOverGame(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <h2 className="text-[#FF77A8] mb-6 text-center border-b-2 border-[#83769C] pb-4 text-[14px] tracking-tighter uppercase">Parameters</h2>
          
          <div className="space-y-6 flex-grow">
            <div className="p-3 border border-[#29ADFF]/30 bg-[#29ADFF]/5 rounded-sm">
               <h3 className="text-[#29ADFF] mb-4 text-[11px] border-b border-[#29ADFF]/20 pb-1">AI DIRECTOR</h3>
               <label className="block group mb-4">
                <span className="flex justify-between mb-2">
                  <span>DIFF SCALE</span>
                  <span className="text-[#29ADFF]">{config.difficultyScale.toFixed(1)}x</span>
                </span>
                <input 
                  type="range" min="0.1" max="5.0" step="0.1" 
                  value={config.difficultyScale} 
                  onChange={(e) => handleChange('difficultyScale', parseFloat(e.target.value))}
                  className="w-full accent-[#29ADFF] cursor-pointer"
                />
              </label>
              
              <CurveEditor 
                points={config.spawnCurve} 
                showCustomCursor={config.showCustomCursor}
                onChange={(newPoints) => handleChange('spawnCurve', newPoints)} 
              />

               <label className="block group mt-4">
                <span className="flex justify-between mb-2">
                  <span>BASE SPAWN</span>
                  <span className="text-[#29ADFF]">{config.enemySpawnRate.toFixed(3)}</span>
                </span>
                <input 
                  type="range" min="0.005" max="0.1" step="0.005" 
                  value={config.enemySpawnRate} 
                  onChange={(e) => handleChange('enemySpawnRate', parseFloat(e.target.value))}
                  className="w-full accent-[#29ADFF] cursor-pointer"
                />
              </label>
            </div>

            <div className="p-3 border border-[#00E436]/30 bg-[#00E436]/5 rounded-sm">
              <h3 className="text-[#00E436] mb-4 text-[11px] border-b border-[#00E436]/20 pb-1">CHARACTER PROFILE</h3>
              <label className="block group mb-4">
                <span className="flex justify-between mb-2">
                  <span>SIZE</span>
                  <span className="text-[#00E436]">{config.playerSize}px</span>
                </span>
                <input 
                  type="range" min="10" max="40" step="2" 
                  value={config.playerSize} 
                  onChange={(e) => handleChange('playerSize', parseInt(e.target.value))}
                  className="w-full accent-[#00E436] cursor-pointer"
                />
              </label>
              
              <div className="mb-4">
                <span className="block mb-2 uppercase text-[8px] text-[#83769C]">Shape</span>
                <div className="flex gap-2">
                  {['square', 'circle', 'triangle'].map(shape => (
                    <button 
                      key={shape} 
                      onClick={() => handleChange('playerShape', shape)}
                      className={`flex-1 py-1 px-2 border-2 text-[8px] uppercase tracking-tighter transition-all ${config.playerShape === shape ? 'bg-[#00E436] border-white text-black' : 'bg-[#1a1c2c] border-[#83769C] text-[#FFF1E8]'}`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block mb-2 uppercase text-[8px] text-[#83769C]">Tint</span>
                <div className="flex flex-wrap gap-2">
                  {[PICO8_COLORS.WHITE, PICO8_COLORS.BLUE, PICO8_COLORS.GREEN, PICO8_COLORS.YELLOW, PICO8_COLORS.ORANGE, PICO8_COLORS.PEACH, PICO8_COLORS.HOT_PINK].map(color => (
                    <button 
                      key={color} 
                      onClick={() => handleChange('playerColor', color)} 
                      className={`w-5 h-5 border-2 transition-all ${config.playerColor === color ? 'border-white scale-110' : 'border-transparent hover:border-white/30'}`} 
                      style={{ backgroundColor: color }} 
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 border border-[#FFA300]/30 bg-[#FFA300]/5 rounded-sm">
              <h3 className="text-[#FFA300] mb-4 text-[11px] border-b border-[#FFA300]/20 pb-1">DEADJUMP PROTOCOL</h3>
              <label className="flex items-center space-x-3 mb-4 select-none group cursor-pointer">
                 <div className="relative">
                    <input type="checkbox" checked={config.deadJumpEnabled} onChange={(e) => handleChange('deadJumpEnabled', e.target.checked)} className="sr-only" />
                    <div className={`w-8 h-4 bg-[#1a1c2c] border-2 border-[#83769C] transition-colors ${config.deadJumpEnabled ? 'bg-[#FFA300] border-[#FFA300]' : ''}`}></div>
                    <div className={`absolute left-1 top-1 w-2 h-2 bg-white transition-transform ${config.deadJumpEnabled ? 'translate-x-4' : ''}`}></div>
                 </div>
                 <span className="text-[9px] uppercase tracking-wider text-[#FFF1E8]">Protocol Enabled</span>
              </label>
              <label className="block group mb-4">
                <span className="flex justify-between mb-2">
                  <span>DZ THRESHOLD</span>
                  <span className="text-[#FFA300]">{(config.deadZoneThreshold * 100).toFixed(0)}%</span>
                </span>
                <input 
                  type="range" min="0.05" max="0.4" step="0.01" 
                  value={config.deadZoneThreshold} 
                  onChange={(e) => handleChange('deadZoneThreshold', parseFloat(e.target.value))}
                  className="w-full accent-[#FFA300] cursor-pointer"
                />
              </label>
              <label className="block group">
                <span className="flex justify-between mb-2">
                  <span>SUPER MULTI</span>
                  <span className="text-[#FFA300]">{config.superJumpMultiplier.toFixed(1)}x</span>
                </span>
                <input 
                  type="range" min="1.5" max="5.0" step="0.1" 
                  value={config.superJumpMultiplier} 
                  onChange={(e) => handleChange('superJumpMultiplier', parseFloat(e.target.value))}
                  className="w-full accent-[#FFA300] cursor-pointer"
                />
              </label>
            </div>

            <div className="p-3 border border-[#FFEC27]/30 bg-[#FFEC27]/5 rounded-sm">
              <h3 className="text-[#FFEC27] mb-4 text-[11px] border-b border-[#FFEC27]/20 pb-1">BURNING ENGINE</h3>
              <label className="flex items-center space-x-3 mb-4 select-none group cursor-pointer">
                 <div className="relative">
                    <input type="checkbox" checked={config.burningEnabled} onChange={(e) => handleChange('burningEnabled', e.target.checked)} className="sr-only" />
                    <div className={`w-8 h-4 bg-[#1a1c2c] border-2 border-[#83769C] transition-colors ${config.burningEnabled ? 'bg-[#FFEC27] border-[#FFEC27]' : ''}`}></div>
                    <div className={`absolute left-1 top-1 w-2 h-2 bg-white transition-transform ${config.burningEnabled ? 'translate-x-4' : ''}`}></div>
                 </div>
                 <span className="text-[9px] uppercase tracking-wider text-[#FFF1E8]">Burning Active</span>
              </label>
              <label className="block group mb-4">
                <span className="flex justify-between mb-2">
                  <span>RADIUS</span>
                  <span className="text-[#FFEC27]">{config.burningRadius}px</span>
                </span>
                <input 
                  type="range" min="40" max="250" step="5" 
                  value={config.burningRadius} 
                  onChange={(e) => handleChange('burningRadius', parseInt(e.target.value))}
                  className="w-full accent-[#FFEC27] cursor-pointer"
                />
              </label>
              <label className="block group mb-4">
                <span className="flex justify-between mb-2">
                  <span>DURATION</span>
                  <span className="text-[#FFEC27]">{config.burningDuration}f</span>
                </span>
                <input 
                  type="range" min="5" max="120" step="1" 
                  value={config.burningDuration} 
                  onChange={(e) => handleChange('burningDuration', parseInt(e.target.value))}
                  className="w-full accent-[#FFEC27] cursor-pointer"
                />
              </label>
            </div>

            <div className="p-3 border border-[#29ADFF]/30 bg-[#29ADFF]/5 rounded-sm">
              <h3 className="text-[#29ADFF] mb-4 text-[11px] border-b border-[#29ADFF]/20 pb-1">PRESETS</h3>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleExport(); }}
                  className="flex-1 py-2 border-2 border-[#29ADFF] bg-[#1a1c2c] text-[#29ADFF] hover:bg-[#29ADFF] hover:text-white transition-all text-[8px] uppercase font-bold"
                >
                  Export
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleImport(); }}
                  className="flex-1 py-2 border-2 border-[#29ADFF] bg-[#1a1c2c] text-[#29ADFF] hover:bg-[#29ADFF] hover:text-white transition-all text-[8px] uppercase font-bold"
                >
                  Import
                </button>
              </div>
            </div>

            <div className="p-3 border border-[#FF77A8]/30 bg-[#FF77A8]/5 rounded-sm">
              <h3 className="text-[#FF77A8] mb-4 text-[11px] border-b border-[#FF77A8]/20 pb-1">DISPLAY</h3>
              <label className="block group mb-4">
                <span className="flex justify-between mb-2 text-[9px] uppercase">Footer Content</span>
                <input 
                  type="text" 
                  value={config.footerText} 
                  onChange={(e) => handleChange('footerText', e.target.value)}
                  className="w-full bg-[#1a1c2c] border border-[#83769C] p-2 text-[#FFF1E8] outline-none focus:border-[#FF77A8] text-[9px]"
                />
              </label>

              <label className="flex items-center space-x-3 mb-2 select-none group cursor-pointer">
                 <div className="relative">
                    <input type="checkbox" checked={config.crtEnabled} onChange={(e) => handleChange('crtEnabled', e.target.checked)} className="sr-only" />
                    <div className={`w-8 h-4 bg-[#1a1c2c] border-2 border-[#83769C] transition-colors ${config.crtEnabled ? 'bg-[#FF77A8] border-[#FF77A8]' : ''}`}></div>
                    <div className={`absolute left-1 top-1 w-2 h-2 bg-white transition-transform ${config.crtEnabled ? 'translate-x-4' : ''}`}></div>
                 </div>
                 <span className="text-[9px] uppercase tracking-wider text-[#FFF1E8]">CRT Scanlines</span>
              </label>

              <label className="flex items-center space-x-3 mb-4 select-none group cursor-pointer">
                 <div className="relative">
                    <input type="checkbox" checked={config.audioEnabled} onChange={(e) => handleChange('audioEnabled', e.target.checked)} className="sr-only" />
                    <div className={`w-8 h-4 bg-[#1a1c2c] border-2 border-[#83769C] transition-colors ${config.audioEnabled ? 'bg-[#FF77A8] border-[#FF77A8]' : ''}`}></div>
                    <div className={`absolute left-1 top-1 w-2 h-2 bg-white transition-transform ${config.audioEnabled ? 'translate-x-4' : ''}`}></div>
                 </div>
                 <span className="text-[9px] uppercase tracking-wider text-[#FFF1E8]">SFX/BGM Engine</span>
              </label>

              <label className="block group mb-4">
                <span className="flex justify-between mb-2">
                  <span>BGM VOL</span>
                  <span className="text-[#FF77A8]">{(config.bgmVolume * 1000).toFixed(0)}</span>
                </span>
                <input 
                  type="range" min="0" max="0.1" step="0.005" 
                  value={config.bgmVolume} 
                  onChange={(e) => handleChange('bgmVolume', parseFloat(e.target.value))}
                  className="w-full accent-[#FF77A8] cursor-pointer"
                />
              </label>

              <label className="block group mb-2">
                <span className="flex justify-between mb-2">
                  <span>SFX VOL</span>
                  <span className="text-[#FF77A8]">{(config.sfxVolume * 1000).toFixed(0)}</span>
                </span>
                <input 
                  type="range" min="0" max="0.1" step="0.005" 
                  value={config.sfxVolume} 
                  onChange={(e) => handleChange('sfxVolume', parseFloat(e.target.value))}
                  className="w-full accent-[#FF77A8] cursor-pointer"
                />
              </label>
            </div>

            <div className="p-3 border border-[#FF77A8]/30 bg-[#FF77A8]/5 rounded-sm">
              <h3 className="text-[#FF77A8] mb-4 text-[11px] border-b border-[#FF77A8]/20 pb-1">CURSOR ENGINE</h3>
              <label className="flex items-center space-x-3 mb-6 select-none group cursor-pointer">
                 <div className="relative">
                    <input type="checkbox" checked={config.showCustomCursor} onChange={(e) => handleChange('showCustomCursor', e.target.checked)} className="sr-only" />
                    <div className={`w-8 h-4 bg-[#1a1c2c] border-2 border-[#83769C] transition-colors ${config.showCustomCursor ? 'bg-[#FF77A8] border-[#FF77A8]' : ''}`}></div>
                    <div className={`absolute left-1 top-1 w-2 h-2 bg-white transition-transform ${config.showCustomCursor ? 'translate-x-4' : ''}`}></div>
                 </div>
                 <span className="text-[9px] uppercase tracking-wider text-[#FFF1E8]">Use Custom Rocket</span>
              </label>
            </div>

            <div className="space-y-4">
              <label className="block group">
                <span className="flex justify-between mb-2"><span>GRAVITY</span><span className="text-[#FF77A8]">{config.gravity.toFixed(2)}</span></span>
                <input type="range" min="0.05" max="0.5" step="0.01" value={config.gravity} onChange={(e) => handleChange('gravity', parseFloat(e.target.value))} className="w-full accent-[#FF77A8] cursor-pointer" />
              </label>
              <label className="block group">
                <span className="flex justify-between mb-2"><span>RECOIL</span><span className="text-[#FF77A8]">{config.recoilForce.toFixed(1)}</span></span>
                <input type="range" min="5" max="25" step="0.5" value={config.recoilForce} onChange={(e) => handleChange('recoilForce', parseFloat(e.target.value))} className="w-full accent-[#FF77A8] cursor-pointer" />
              </label>
              <label className="block group">
                <span className="flex justify-between mb-2"><span>BOUNCE Force</span><span className="text-[#FF77A8]">{config.bounceElasticity.toFixed(1)}</span></span>
                <input type="range" min="0.1" max="1.5" step="0.1" value={config.bounceElasticity} onChange={(e) => handleChange('bounceElasticity', parseFloat(e.target.value))} className="w-full accent-[#FF77A8] cursor-pointer" />
              </label>
              <label className="block group">
                <span className="flex justify-between mb-2 text-[#29ADFF]"><span>FUEL CONSUME</span><span>{config.fuelConsumption.toFixed(0)}</span></span>
                <input type="range" min="0" max="50" step="1" value={config.fuelConsumption} onChange={(e) => handleChange('fuelConsumption', parseFloat(e.target.value))} className="w-full accent-[#29ADFF] cursor-pointer" />
              </label>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-[#83769C] text-[#C2C3C7] text-[8px] leading-relaxed uppercase opacity-60">
            Pink Recoil V5.5<br/>
            Interaction Lock Engine
          </div>
        </div>
      )}

      <div 
        ref={gameContainerRef}
        className={`flex-grow flex flex-col items-center justify-center p-4 lg:p-0 relative overflow-hidden bg-[#1a1c2c] ${config.showCustomCursor && isMouseOverGame ? 'cursor-none' : 'cursor-default'}`}
      >
        <div className="relative border-8 border-[#FF77A8] shadow-[0_0_40px_rgba(255,119,168,0.3)] rounded-sm overflow-hidden bg-[#FDF2F4]">
          <Game 
            config={config} 
            isMouseOver={isMouseOverGame}
          />
        </div>
        <div className="mt-8 text-[#C2C3C7] text-[10px] text-center max-w-[400px] font-mono uppercase tracking-[0.2em] animate-pulse min-h-[1.5em]">
          <p className="text-[#FF77A8]">{config.footerText}</p>
        </div>

        <RocketCursor 
          scale={config.cursorScale} 
          color={config.cursorColor} 
          isRecoiling={isClicking}
          isVisible={config.showCustomCursor && isMouseOverGame}
          cursorRef={cursorRef}
        />
      </div>
    </div>
  );
};

export default App;
