// ─── WILDLIFE CONFIG ─────────────────────────────────────────────────────────
// Animal spawn rates, speeds, and behavior tuning.

export const WILDLIFE_CONFIG = {
  birds: [
    { id: 'parrot',  color: '#cc3322', wingColor: '#ff5533', size: 4 },
    { id: 'macaw',   color: '#3355cc', wingColor: '#5588ff', size: 5 },
    { id: 'toucan',  color: '#223322', wingColor: '#44aa44', size: 5 },
    { id: 'sparrow', color: '#886644', wingColor: '#aa8855', size: 3 },
  ],

  birdSpawnCount: 14,
  birdFlySpeed: 2.5,
  birdFleeSpeed: 4.5,
  birdFleeRange: 180,          // px from threat
  birdReturnSpeed: 1.2,
  birdReturnRange: 400,        // px — above this, bird turns back to perch

  rats: {
    count: 20,
    speed: 1.2,
    fleeSpeed: 2.8,
    fleeRange: 100,
    dirChangeInterval: 90,     // frames
    color: '#5a4a3a',
    eyeColor: '#ff2200',
  },
};