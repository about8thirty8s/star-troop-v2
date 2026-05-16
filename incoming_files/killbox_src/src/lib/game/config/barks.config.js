// LAST HUNT: KILLBOX - Squad One-Liner Barks
// Original, cinematic lines inspired by jungle war cinema energy (no movie quotes)

export const BARKS_CONFIG = {
  INSERTION: [
    "Touching down. Stay sharp.",
    "Jungle's too quiet.",
    "I hate quiet.",
    "Rope down. Move.",
    "Eyes open. Weapons hot.",
    "This is our house now.",
  ],

  LANDING: [
    "Boots on dirt.",
    "We're in.",
    "Form up. Watch the perimeter.",
    "No sign of contact yet.",
    "Stay frosty.",
  ],

  HUNTER_SPOTTED: [
    "Something moved up there.",
    "That wasn't wind.",
    "Eyes high.",
    "I saw a shimmer.",
    "Contact. Moving.",
    "There. Did you see it?",
    "It's close.",
  ],

  HUNTER_NEAR: [
    "It's hunting us.",
    "Don't move.",
    "Breathe. Just breathe.",
    "It's listening.",
    "Freeze.",
  ],

  GUNG_HO: [
    "I'm going after it.",
    "Draw it out!",
    "Light it up!",
    "Keep pressure on it!",
    "Push hard. Push now.",
    "We've got the numbers. Use them.",
    "Pin it down!",
  ],

  LOW_PROFILE: [
    "Get low. Let it pass.",
    "Mud up. Heat down.",
    "Hide first. Bleed it later.",
    "Quiet hands. Quiet feet.",
    "Patience. It'll slip.",
    "Stay out of sight.",
  ],

  TREE_AMBUSH: [
    "I'll take the high line.",
    "Let it walk under me.",
    "Canopy's mine.",
    "I've got the drop.",
    "Height advantage. Use it.",
    "I'm going vertical.",
  ],

  TREE_CHOPPING: [
    "This tree's coming down.",
    "Make the jungle work for us.",
    "Cut it high, drop it hard.",
    "That'll leave a mark.",
    "Timber!",
    "Bring it down.",
    "Watch the fall.",
  ],

  TRAP_PLACED: [
    "Set it ugly. Set it deep.",
    "This should slow it.",
    "Bait goes here.",
    "Hope it likes surprises.",
    "Trap's armed.",
    "Wait for it.",
  ],

  PLASMA_LOCK: [
    "Red light! Move!",
    "It's painting us!",
    "Break line of sight!",
    "Incoming!",
    "Energy signature. Scatter!",
    "Run! Now!",
  ],

  WOUNDED: [
    "I'm hit!",
    "Still standing.",
    "Keep moving!",
    "Not done yet.",
    "Damage sustained. Pushing on.",
    "It hurt. So what.",
  ],

  PANIC: [
    "Where is it?",
    "It's everywhere!",
    "I can't see it!",
    "Fall back!",
    "It's in the trees!",
    "Spread out!",
  ],

  HUNTER_DAMAGED: [
    "It bleeds!",
    "That hurt it!",
    "Again! Hit it again!",
    "Now we know.",
    "We can hurt it.",
    "Keep firing!",
    "It's not invincible.",
  ],

  TRAP_SUCCESS: [
    "Got you!",
    "That's the killbox!",
    "It walked right in!",
    "Finish it!",
    "Trap triggered!",
    "Right where we want it.",
  ],

  DEATH: [
    "Tell them we fought.",
    "Don't let it take me.",
    "Run the trap.",
    "Make it pay.",
    "End this thing.",
    "For the team.",
  ],

  STORM: [
    "Storm's rolling in.",
    "Rain'll hide the noise.",
    "Lightning's messing with my eyes.",
    "Good weather for bad decisions.",
    "Visibility's dropping.",
    "It uses storms too.",
  ],

  PLAYER_NEARBY: [
    "Sir, you're exposed.",
    "Watch your six.",
    "Cover's thin here.",
    "Eyes on you, boss.",
  ],

  GENERAL: [
    "Stay alert.",
    "Movement discipline.",
    "Weapons ready.",
    "Stay sharp.",
  ],
};

// Bark metadata: cooldown, behavior filters, event triggers
export const BARK_RULES = {
  INSERTION: { cooldown: 15, maxBarksNear: 1 },
  LANDING: { cooldown: 12, maxBarksNear: 1 },
  HUNTER_SPOTTED: { cooldown: 8, maxBarksNear: 2 },
  HUNTER_NEAR: { cooldown: 10, maxBarksNear: 1 },
  GUNG_HO: { cooldown: 9, behaviorFilter: 'gung_ho' },
  LOW_PROFILE: { cooldown: 10, behaviorFilter: 'low_profile' },
  TREE_AMBUSH: { cooldown: 9, behaviorFilter: 'tree_ambush' },
  TREE_CHOPPING: { cooldown: 12, maxBarksNear: 1 },
  TRAP_PLACED: { cooldown: 8 },
  PLASMA_LOCK: { cooldown: 6, priority: true },
  WOUNDED: { cooldown: 15, priority: true },
  PANIC: { cooldown: 10 },
  HUNTER_DAMAGED: { cooldown: 7 },
  TRAP_SUCCESS: { cooldown: 8 },
  DEATH: { cooldown: 20, priority: true },
  STORM: { cooldown: 20 },
  PLAYER_NEARBY: { cooldown: 15 },
};