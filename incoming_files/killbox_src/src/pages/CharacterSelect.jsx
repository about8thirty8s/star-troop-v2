import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHARACTERS, CHARACTER_ORDER } from '@/lib/game/data/characters.config';
import CharacterCard from '@/components/game/CharacterCard';

// Full portraits
const PORTRAITS = {
  mac:    'https://media.base44.com/images/public/6a07d557e104123d6d54764f/b48b44bd3_generated_image.png',
  ponchi: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/b01f75e95_generated_image.png',
  annie:  'https://media.base44.com/images/public/6a07d557e104123d6d54764f/148c494c2_generated_image.png',
  blaze:  'https://media.base44.com/images/public/6a07d557e104123d6d54764f/21f0f7fa9_generated_image.png',
};

// Squad face thumbnails (same image, just smaller)
const FACES = PORTRAITS;

// Squad insert text color per character
const SQUAD_COLOR = {
  mac:    '#f5c518',
  ponchi: '#7ecf6e',
  annie:  '#7ecf6e',
  blaze:  '#ff6633',
};

// Corner ornament component
function CornerOrnament({ pos }) {
  const corners = {
    tl: 'top-0 left-0 border-t-2 border-l-2',
    tr: 'top-0 right-0 border-t-2 border-r-2',
    bl: 'bottom-0 left-0 border-b-2 border-l-2',
    br: 'bottom-0 right-0 border-b-2 border-r-2',
  };
  return <div className={`absolute w-6 h-6 ${corners[pos]}`} style={{ borderColor: '#8a6a20' }} />;
}

export default function CharacterSelect() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState('annie');

  const handleStartHunt = () => {
    sessionStorage.setItem('selectedCharacter', selectedId);
    navigate('/');
  };

  const squadMates = CHARACTER_ORDER.filter(id => id !== selectedId);
  const selectedChar = CHARACTERS[selectedId];

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #221e0a 0%, #080804 80%)',
        fontFamily: '"Press Start 2P", monospace',
      }}
    >
      <div
        className="relative w-full max-w-[960px] mx-auto px-6 py-6"
        style={{
          background: 'rgba(8,8,4,0.97)',
          border: '2px solid rgba(140,110,30,0.4)',
          boxShadow: '0 0 80px rgba(0,0,0,0.95)',
        }}
      >
        {/* Corner ornaments */}
        <CornerOrnament pos="tl" />
        <CornerOrnament pos="tr" />
        <CornerOrnament pos="bl" />
        <CornerOrnament pos="br" />

        {/* ── HEADER ── */}
        <div className="text-center mb-6">
          <h1
            style={{
              fontSize: 28,
              color: '#f5c518',
              textShadow: '0 0 24px rgba(245,197,24,0.55), 2px 2px 0 #000',
              letterSpacing: 3,
              lineHeight: 1.2,
            }}
          >
            SELECT YOUR HUNTER
          </h1>
          <p style={{ fontSize: 8, color: '#7a7a5a', marginTop: 8, letterSpacing: 1 }}>
            Choose your loadout. The rest of the squad inserts with you.
          </p>
          {/* Ornamental rule */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <div style={{ height: 1, width: 100, background: 'linear-gradient(to right, transparent, #8a6a20)' }} />
            <div style={{ width: 5, height: 5, background: '#8a6a20', transform: 'rotate(45deg)' }} />
            <div style={{ height: 1, width: 100, background: 'linear-gradient(to left, transparent, #8a6a20)' }} />
          </div>
        </div>

        {/* ── CHARACTER CARDS ── */}
        <div className="flex gap-3 justify-center mb-4">
          {CHARACTER_ORDER.map(charId => (
            <CharacterCard
              key={charId}
              character={CHARACTERS[charId]}
              isSelected={selectedId === charId}
              onClick={() => setSelectedId(charId)}
              portrait={PORTRAITS[charId]}
            />
          ))}
        </div>

        {/* ── BOTTOM BAR ── */}
        <div
          className="flex items-stretch gap-3 mt-2"
          style={{ borderTop: '1px solid rgba(140,110,30,0.3)', paddingTop: 12 }}
        >
          {/* BACK */}
           <button
             onClick={() => {
               sessionStorage.removeItem('selectedCharacter');
               navigate('/');
             }}
             className="flex-shrink-0 flex items-center justify-center gap-2 px-5 transition-all"
            style={{
              border: '2px solid rgba(140,110,30,0.5)',
              background: 'rgba(16,14,4,0.95)',
              color: '#b8902a',
              fontSize: 9,
              letterSpacing: 2,
              minWidth: 110,
              minHeight: 56,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#f5c518'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(140,110,30,0.5)'}
          >
            ‹ BACK
          </button>

          {/* SQUAD INSERTION PREVIEW */}
          <div
            className="flex-1 flex items-center gap-4 px-5 py-3"
            style={{
              border: '1px solid rgba(140,110,30,0.3)',
              background: 'rgba(255,255,255,0.015)',
            }}
          >
            {/* Label */}
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 7, color: '#8a6a20', letterSpacing: 1 }}>SQUAD INSERTION PREVIEW</p>

              {/* Faces row */}
              <div className="flex gap-2 items-end">
                {/* Selected (you) */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    style={{
                      width: 50, height: 52,
                      border: `2px solid ${SQUAD_COLOR[selectedId]}`,
                      boxShadow: `0 0 10px ${SQUAD_COLOR[selectedId]}55`,
                      overflow: 'hidden',
                    }}
                  >
                    <img src={FACES[selectedId]} alt="" className="w-full h-full object-cover object-top" />
                  </div>
                  <span style={{ fontSize: 5, color: SQUAD_COLOR[selectedId] }}>YOU</span>
                </div>
                {/* Squad */}
                {squadMates.map(id => (
                  <div key={id} className="flex flex-col items-center gap-1">
                    <div
                      style={{
                        width: 50, height: 52,
                        border: '1px solid rgba(140,110,30,0.35)',
                        overflow: 'hidden',
                        filter: 'brightness(0.6) saturate(0.65)',
                      }}
                    >
                      <img src={FACES[id]} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                    <span style={{ fontSize: 5, color: '#5a5a3a' }}>{CHARACTERS[id].displayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Text */}
            <div style={{ fontSize: 7.5, color: '#6a6a4a', lineHeight: 2.4, paddingLeft: 8 }}>
              You select{' '}
              <span style={{ color: SQUAD_COLOR[selectedId] }}>{selectedChar.displayName}</span>.
              <br />
              {squadMates.map((id, i) => (
                <React.Fragment key={id}>
                  <span style={{ color: SQUAD_COLOR[id] }}>{CHARACTERS[id].displayName}</span>
                  {i < squadMates.length - 2 ? ', ' : i === squadMates.length - 2 ? ' and ' : ' '}
                </React.Fragment>
              ))}
              will insert with you.
            </div>
          </div>

          {/* START HUNT */}
          <button
            onClick={handleStartHunt}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-6 transition-all"
            style={{
              border: '2px solid #f5c518',
              background: 'rgba(20,18,4,0.98)',
              color: '#f5c518',
              fontSize: 10,
              letterSpacing: 2,
              minWidth: 160,
              minHeight: 56,
              textShadow: '0 0 10px rgba(245,197,24,0.5)',
              boxShadow: '0 0 14px rgba(245,197,24,0.15)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(50,44,8,0.98)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(245,197,24,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(20,18,4,0.98)';
              e.currentTarget.style.boxShadow = '0 0 14px rgba(245,197,24,0.15)';
            }}
          >
            START HUNT ›
          </button>
        </div>
      </div>
    </div>
  );
}