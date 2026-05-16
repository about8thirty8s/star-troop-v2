// Tree sprite variant config — VULCAN Biome v2
// Spritesheet: 5 trees in horizontal strip, each ~120px wide × ~200px tall
// Sheet total: ~600px × ~200px
// Uses cropX/cropW to select which tree from the sheet.

const TREE_SHEET = 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/09d61c78a_generated_image.png';
const SHEET_W = 600;  // approximate sheet width
const TREE_W  = 120;  // approximate width per tree on sheet

export const TREE_VARIANTS = {
  GNARLED_JUNGLE: {
    id: 'gnarled_jungle',
    name: 'Gnarled Jungle Tree',
    url: TREE_SHEET,
    cropX: 0,          // first tree on sheet
    cropW: TREE_W,
    baseW: 110,
    baseH: 170,
    renderScale: 1.1,
  },
  WIDE_CANOPY: {
    id: 'wide_canopy',
    name: 'Wide Tropical Canopy',
    url: TREE_SHEET,
    cropX: TREE_W,     // second tree
    cropW: TREE_W,
    baseW: 140,
    baseH: 145,
    renderScale: 1.2,
  },
  TALL_EMERGENT: {
    id: 'tall_emergent',
    name: 'Tall Emergent Tree',
    url: TREE_SHEET,
    cropX: TREE_W * 2, // third tree
    cropW: TREE_W,
    baseW: 80,
    baseH: 210,
    renderScale: 0.95,
  },
  DENSE_MID: {
    id: 'dense_mid',
    name: 'Dense Mid Tree',
    url: TREE_SHEET,
    cropX: TREE_W * 3, // fourth tree
    cropW: TREE_W,
    baseW: 100,
    baseH: 155,
    renderScale: 1.0,
  },
  VINE_DRAPED: {
    id: 'vine_draped',
    name: 'Vine-Draped Tree',
    url: TREE_SHEET,
    cropX: TREE_W * 4, // fifth tree
    cropW: TREE_W,
    baseW: 105,
    baseH: 165,
    renderScale: 1.05,
  },
};

export const TREE_VARIANT_LIST = Object.values(TREE_VARIANTS);

export function getRandomTreeVariant() {
  return TREE_VARIANT_LIST[Math.floor(Math.random() * TREE_VARIANT_LIST.length)];
}

export function createTreeVariantInstance(variant, x, y, scale = 1.0) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    variant,
    x, y,
    scale,
    parallaxDepth: 0.18 + Math.random() * 0.12,
    alive: true,
  };
}
