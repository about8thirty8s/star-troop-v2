import React from 'react';

const STAT_LABELS = {
  health: 'HEALTH',
  speed: 'SPEED',
  stamina: 'STAMINA',
  recoilControl: 'RECOIL CONTROL',
  trapSpeed: 'TRAP SPEED',
};

const CHAR_CONFIG = {
  mac:    { label: '★ MAC ★',       labelColor: '#f5c518', statColor: '#c8a030', roleColor: '#f5c518' },
  ponchi: { label: '☠ PONCHI ☠',    labelColor: '#7ecf6e', statColor: '#5aaa4a', roleColor: '#7ecf6e' },
  annie:  { label: '⊣ ANNIE ⊢',     labelColor: '#7ecf6e', statColor: '#5aaa4a', roleColor: '#7ecf6e' },
  blaze:  { label: '🔥 BLAZE 🔥',   labelColor: '#ff6633', statColor: '#cc4422', roleColor: '#ff6633' },
};

export const WEAPON_IMAGES = {
  m60:              'https://media.base44.com/images/public/6a06ed19120e7e74497baea4/4a492478a_generated_image.png',
  grenade_launcher: 'https://media.base44.com/images/public/6a06ed19120e7e74497baea4/173e6dd86_generated_image.png',
  m16_m203:         'https://media.base44.com/images/public/6a06ed19120e7e74497baea4/c89313b8a_generated_image.png',
  minigun:          'https://media.base44.com/images/public/6a06ed19120e7e74497baea4/ae2ea08c6_generated_image.png',
};

export const WEAPON_LABELS = {
  m60:              'M60',
  grenade_launcher: 'GRENADE LAUNCHER',
  m16_m203:         'M16 / M203',
  minigun:          'MINIGUN',
};

function StatBar({ value, max = 1.15, color }) {
  const segments = 10;
  const filled = Math.round(Math.min(value / max, 1) * segments);
  return (
    <div className="flex gap-px">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 11,
            height: 7,
            background: i < filled ? color : 'rgba(255,255,255,0.07)',
            border: `1px solid ${i < filled ? color : 'rgba(255,255,255,0.1)'}`,
          }}
        />
      ))}
    </div>
  );
}

export default function CharacterCard({ character, isSelected, onClick, portrait }) {
  const cfg = CHAR_CONFIG[character.id] || CHAR_CONFIG.mac;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col text-left focus:outline-none transition-all duration-150"
      style={{
        width: 215,
        background: 'linear-gradient(180deg, #1c1a0c 0%, #0d0c05 100%)',
        border: `2px solid ${isSelected ? cfg.labelColor : 'rgba(120,100,40,0.3)'}`,
        boxShadow: isSelected
          ? `0 0 22px 5px ${cfg.labelColor}44, inset 0 0 30px rgba(0,0,0,0.7)`
          : 'inset 0 0 20px rgba(0,0,0,0.6)',
      }}
    >
      {/* Selection triangle indicator at top */}
      {isSelected && (
        <div
          className="absolute -top-px left-1/2 -translate-x-1/2"
          style={{
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `10px solid ${cfg.labelColor}`,
          }}
        />
      )}

      {/* Corner brackets */}
      {isSelected && (
        <>
          <div className="absolute top-1 left-1 w-3 h-3" style={{ borderTop: `2px solid ${cfg.labelColor}`, borderLeft: `2px solid ${cfg.labelColor}` }} />
          <div className="absolute top-1 right-1 w-3 h-3" style={{ borderTop: `2px solid ${cfg.labelColor}`, borderRight: `2px solid ${cfg.labelColor}` }} />
          <div className="absolute bottom-1 left-1 w-3 h-3" style={{ borderBottom: `2px solid ${cfg.labelColor}`, borderLeft: `2px solid ${cfg.labelColor}` }} />
          <div className="absolute bottom-1 right-1 w-3 h-3" style={{ borderBottom: `2px solid ${cfg.labelColor}`, borderRight: `2px solid ${cfg.labelColor}` }} />
        </>
      )}

      {/* Portrait */}
      <div className="relative w-full overflow-hidden" style={{ height: 190, background: '#0d0c05' }}>
        {portrait ? (
          <img
            src={portrait}
            alt={character.displayName}
            className="w-full h-full object-cover object-center"
            style={{
              filter: isSelected ? 'brightness(1)' : 'brightness(0.7) saturate(0.75)',
              display: 'block',
              mixBlendMode: 'normal',
            }}
          />
        ) : (
          <div className="w-full h-full" style={{ background: character.color }} />
        )}
        <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: 'linear-gradient(transparent, #0d0c05)' }} />
      </div>

      {/* Name */}
      <div
        className="text-center px-2 py-2"
        style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 10,
          color: cfg.labelColor,
          textShadow: isSelected ? `0 0 10px ${cfg.labelColor}` : 'none',
          letterSpacing: 1,
        }}
      >
        {cfg.label}
      </div>

      {/* Weapon row */}
      <div
        className="mx-3 mb-2 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}
      >
        <img
          src={WEAPON_IMAGES[character.weaponId]}
          alt={character.weaponId}
          style={{ width: 44, height: 22, objectFit: 'cover', imageRendering: 'pixelated' }}
        />
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#b0a060', letterSpacing: 0.5 }}>
          {WEAPON_LABELS[character.weaponId] || character.weaponId.toUpperCase()}
        </span>
      </div>

      {/* Role */}
      <div
        className="px-3 pb-1"
        style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 7, color: cfg.roleColor, letterSpacing: 0.5 }}
      >
        ROLE: {character.role.toUpperCase()}
      </div>

      {/* Description */}
      <div
        className="px-3 pb-3"
        style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 6, color: '#7a7a5a', lineHeight: 1.9 }}
      >
        {character.description}
      </div>

      {/* Stats */}
      <div
        className="px-3 pb-4 space-y-1.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8 }}
      >
        {Object.entries(character.stats).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 5, color: '#6a6a4a', minWidth: 68 }}>
              {STAT_LABELS[key]}
            </span>
            <StatBar value={val} color={cfg.statColor} />
          </div>
        ))}
      </div>
    </button>
  );
}