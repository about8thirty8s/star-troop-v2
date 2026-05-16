import React from 'react';
import GameCanvas from '../components/game/GameCanvas';

export default function Game() {
  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <GameCanvas />
    </div>
  );
}