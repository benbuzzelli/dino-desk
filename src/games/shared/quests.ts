import { profileKey } from './profile';
import type { QuillEmote, QuillBillboard } from './quill';

// Game IDs for quest steps match the string passed to trackProgress(...) in each game.
// NOTE: volcano-escape calls trackProgress('volcano'), not 'volcano-escape'.
export type QuestGameId =
  | 'egg-hunt'
  | 'spell-dino'
  | 'volcano'
  | 'dino-match'
  | 'jungle-explorer'
  | 'dino-dungeon';

// The GameId used for navigation (matches types.ts GameId). Translates quest step → app route.
export const QUEST_GAME_TO_APP: Record<QuestGameId, string> = {
  'egg-hunt': 'egg-hunt',
  'spell-dino': 'spell-dino',
  'volcano': 'volcano-escape',
  'dino-match': 'dino-match',
  'jungle-explorer': 'jungle-explorer',
  'dino-dungeon': 'dino-dungeon',
};

export interface QuestStep {
  gameId: QuestGameId;
  narrative: string;
  callToAction: string;
  emote?: QuillEmote;
  billboard?: QuillBillboard;
}

export interface QuestReward {
  stickerId: string;
  name: string;
  emoji: string;
}

export interface Quest {
  id: string;
  title: string;
  intro: string;
  introEmote?: QuillEmote;
  introBillboard?: QuillBillboard;
  steps: QuestStep[];
  outro: string;
  outroEmote?: QuillEmote;
  outroBillboard?: QuillBillboard;
  reward: QuestReward;
}

export const QUEST_LIBRARY: Quest[] = [
  {
    id: 'lost-eggs',
    title: 'The Lost Eggs',
    intro: 'Stego is in a panic! Her three eggs rolled down the hill and are hiding somewhere in the jungle. Can you help find them?',
    introEmote: 'worried',
    introBillboard: 'worried',
    steps: [
      {
        gameId: 'jungle-explorer',
        narrative: 'First, search the jungle for any signs of the eggs.',
        callToAction: 'Explore the jungle!',
        emote: 'confident-ready',
        billboard: 'mischievous',
      },
      {
        gameId: 'egg-hunt',
        narrative: 'You found tracks leading to a nest. Quick, gather up every egg you can!',
        callToAction: 'Hatch all the eggs!',
        emote: 'excited',
        billboard: 'giddy',
      },
    ],
    outro: "You found them all! Stego happily rolls them back into her nest. You're a hero!",
    outroEmote: 'grateful',
    outroBillboard: 'adoring',
    reward: { stickerId: 'quest-lost-eggs', name: 'Nest Saver', emoji: '🥚' },
  },
  {
    id: 'volcano-rescue',
    title: 'Volcano Rescue',
    intro: 'Rumble! The volcano is smoking! Some dinos are trapped on the slopes. We need to get them out FAST!',
    introEmote: 'serious-warning',
    introBillboard: 'deeply-shocked',
    steps: [
      {
        gameId: 'volcano',
        narrative: 'Race up the volcano and get everyone to safety!',
        callToAction: 'Escape the volcano!',
        emote: 'serious-warning',
        billboard: 'angry',
      },
      {
        gameId: 'dino-match',
        narrative: 'Now match the rescued dinos with their worried families.',
        callToAction: 'Match the pairs!',
        emote: 'confident-ready',
        billboard: 'worried',
      },
    ],
    outro: 'Every dino family is back together. The whole valley cheers for you!',
    outroEmote: 'grateful',
    outroBillboard: 'relieved',
    reward: { stickerId: 'quest-volcano-rescue', name: 'Brave Rescuer', emoji: '🔥' },
  },
  {
    id: 'name-the-newborn',
    title: 'Name the New Dino',
    intro: 'A brand-new baby dino just hatched! But it needs a name, and the name is written on a special egg deep in the valley.',
    introEmote: 'excited',
    introBillboard: 'adoring',
    steps: [
      {
        gameId: 'egg-hunt',
        narrative: "First, find the egg with a letter hidden inside.",
        callToAction: 'Hatch the eggs!',
        emote: 'confident-ready',
        billboard: 'giddy',
      },
      {
        gameId: 'spell-dino',
        narrative: "Great, you found the letters! Now spell the baby dino's name.",
        callToAction: 'Spell it out!',
        emote: 'excited',
        billboard: 'pompous',
      },
    ],
    outro: 'The baby dino squeaks with joy when it hears its new name. Welcome to the valley!',
    outroEmote: 'grateful',
    outroBillboard: 'adoring',
    reward: { stickerId: 'quest-name-newborn', name: 'Name Giver', emoji: '✨' },
  },
  {
    id: 'museum-night',
    title: 'Museum Night',
    intro: 'The museum dinos have come to life and wandered off! We have to find them before sunrise.',
    introEmote: 'worried',
    introBillboard: 'deeply-shocked',
    steps: [
      {
        gameId: 'jungle-explorer',
        narrative: 'Some of them hid in the jungle. Track them down.',
        callToAction: 'Find the runaway dinos!',
        emote: 'confident-ready',
        billboard: 'mischievous',
      },
      {
        gameId: 'dino-match',
        narrative: 'Now help each one find their matching fossil so they remember where to go.',
        callToAction: 'Match them up!',
        emote: 'neutral',
        billboard: 'neutral',
      },
    ],
    outro: 'Every fossil dino is back in its display case. The museum curator is SO grateful.',
    outroEmote: 'grateful',
    outroBillboard: 'relieved',
    reward: { stickerId: 'quest-museum-night', name: 'Night Watcher', emoji: '🏛️' },
  },
  {
    id: 'deep-cave-mystery',
    title: 'Deep Cave Mystery',
    intro: "Strange glowing rocks have appeared in the deep cave. Let's investigate!",
    introEmote: 'neutral',
    introBillboard: 'mischievous',
    steps: [
      {
        gameId: 'dino-dungeon',
        narrative: 'Make your way through the cave and collect the glowing rocks.',
        callToAction: 'Explore the dungeon!',
        emote: 'confident-ready',
        billboard: 'mischievous',
      },
      {
        gameId: 'spell-dino',
        narrative: 'The rocks spell out a secret word! Can you put it together?',
        callToAction: 'Spell the secret!',
        emote: 'excited',
        billboard: 'giddy',
      },
    ],
    outro: 'The word was "FRIEND". The cave was just saying hello! You make a new glowing buddy.',
    outroEmote: 'wink',
    outroBillboard: 'laughing',
    reward: { stickerId: 'quest-deep-cave', name: 'Cave Explorer', emoji: '💎' },
  },
  {
    id: 'jungle-feast',
    title: 'Jungle Feast',
    intro: 'The whole valley is invited to a big feast in the jungle! But we need to gather the food first.',
    introEmote: 'excited',
    introBillboard: 'giddy',
    steps: [
      {
        gameId: 'jungle-explorer',
        narrative: 'Pick fruits and leaves from all around the jungle.',
        callToAction: 'Forage for the feast!',
        emote: 'confident-ready',
        billboard: 'neutral',
      },
      {
        gameId: 'egg-hunt',
        narrative: "Tricia's chickens hid some special eggs for the feast. Find them all!",
        callToAction: 'Find the feast eggs!',
        emote: 'excited',
        billboard: 'mischievous',
      },
      {
        gameId: 'dino-match',
        narrative: 'Help set the table by matching plates with cups.',
        callToAction: 'Set the table!',
        emote: 'neutral',
        billboard: 'pompous',
      },
    ],
    outro: 'The feast is incredible! Everyone eats until their bellies are full. Burp!',
    outroEmote: 'wink',
    outroBillboard: 'laughing-1',
    reward: { stickerId: 'quest-jungle-feast', name: 'Feast Master', emoji: '🍓' },
  },
  {
    id: 'fossil-puzzle',
    title: 'The Fossil Puzzle',
    intro: "An ancient fossil was discovered, but it's scrambled into pieces. Can you put it together?",
    introEmote: 'neutral',
    introBillboard: 'neutral',
    steps: [
      {
        gameId: 'dino-match',
        narrative: 'Match the fossil pieces first.',
        callToAction: 'Match the fossils!',
        emote: 'confident-ready',
        billboard: 'pompous',
      },
      {
        gameId: 'spell-dino',
        narrative: 'Now spell out what kind of dino it is.',
        callToAction: 'Spell the name!',
        emote: 'excited',
        billboard: 'giddy',
      },
    ],
    outro: "It's an ANKYLOSAURUS! The museum is thrilled. They've never had one before.",
    outroEmote: 'excited',
    outroBillboard: 'pompous',
    reward: { stickerId: 'quest-fossil-puzzle', name: 'Fossil Finder', emoji: '🦴' },
  },
  {
    id: 'storm-warning',
    title: 'Storm Warning',
    intro: 'Big storm clouds are rolling in! We need to warn everyone and round them up before the rain starts.',
    introEmote: 'serious-warning',
    introBillboard: 'deeply-shocked',
    steps: [
      {
        gameId: 'volcano',
        narrative: 'Run to the high lookout to get a good view of the valley.',
        callToAction: 'Race to the lookout!',
        emote: 'serious-warning',
        billboard: 'worried',
      },
      {
        gameId: 'jungle-explorer',
        narrative: 'Find the dinos scattered around the jungle and send them home.',
        callToAction: 'Round everyone up!',
        emote: 'confident-ready',
        billboard: 'angry',
      },
    ],
    outro: 'The rain starts just as the last dino runs inside. Safe and cozy, thanks to you!',
    outroEmote: 'grateful',
    outroBillboard: 'relieved',
    reward: { stickerId: 'quest-storm-warning', name: 'Storm Spotter', emoji: '⛈️' },
  },
  {
    id: 'treasure-hunt',
    title: 'Pirate Dino Treasure',
    intro: 'Yaaarr! A pirate dino buried treasure somewhere in the valley, and left riddles to find it!',
    introEmote: 'wink',
    introBillboard: 'mischievous',
    steps: [
      {
        gameId: 'spell-dino',
        narrative: 'First clue: spell the word to unlock the map.',
        callToAction: 'Spell to unlock!',
        emote: 'confident-ready',
        billboard: 'mischievous',
      },
      {
        gameId: 'dino-dungeon',
        narrative: 'The map leads to the cave. Dig deep and find the treasure chest!',
        callToAction: 'Find the treasure!',
        emote: 'excited',
        billboard: 'giddy',
      },
    ],
    outro: 'JACKPOT! The chest was full of sparkly gems. Argh, matey!',
    outroEmote: 'excited',
    outroBillboard: 'laughing',
    reward: { stickerId: 'quest-treasure', name: 'Treasure Hunter', emoji: '💰' },
  },
  {
    id: 'baby-bronto-day',
    title: "Baby Bronto's Big Day",
    intro: "It's Baby Bronto's birthday! Let's throw a surprise party.",
    introEmote: 'excited',
    introBillboard: 'giddy',
    steps: [
      {
        gameId: 'egg-hunt',
        narrative: "Bronto's mom hid party eggs everywhere. Help find them!",
        callToAction: 'Find the party eggs!',
        emote: 'confident-ready',
        billboard: 'mischievous',
      },
      {
        gameId: 'dino-match',
        narrative: 'Now match the presents with their gift tags.',
        callToAction: 'Sort the gifts!',
        emote: 'neutral',
        billboard: 'pompous',
      },
      {
        gameId: 'spell-dino',
        narrative: 'Everyone sings! Can you spell the birthday word?',
        callToAction: 'Spell the word!',
        emote: 'excited',
        billboard: 'giddy',
      },
    ],
    outro: 'HAPPY BIRTHDAY BRONTO! The party was the best day ever.',
    outroEmote: 'wink',
    outroBillboard: 'adoring',
    reward: { stickerId: 'quest-birthday', name: 'Party Planner', emoji: '🎂' },
  },
];

// ---------- Active quest state ----------

export interface ActiveQuest {
  id: string;
  stepIndex: number;      // which step is next
  startedAt: number;
  acceptedDateISO: string; // YYYY-MM-DD of accept day, used to detect cross-day stale quests
}

const ACTIVE_KEY = 'activeQuest';
const LAST_COMPLETED_KEY = 'questLastCompletedDate';
const HISTORY_KEY = 'questHistory'; // { [date]: questId }

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getActiveQuest(): ActiveQuest | null {
  try {
    const raw = localStorage.getItem(profileKey(ACTIVE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.stepIndex === 'number') {
      return parsed;
    }
  } catch {}
  return null;
}

export function setActiveQuest(q: ActiveQuest | null) {
  try {
    if (q === null) localStorage.removeItem(profileKey(ACTIVE_KEY));
    else localStorage.setItem(profileKey(ACTIVE_KEY), JSON.stringify(q));
  } catch {}
}

export function getQuestById(id: string): Quest | null {
  return QUEST_LIBRARY.find((q) => q.id === id) ?? null;
}

function getHistory(): Record<string, string> {
  try {
    const raw = localStorage.getItem(profileKey(HISTORY_KEY));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
  } catch {}
  return {};
}

function saveHistory(h: Record<string, string>) {
  try {
    localStorage.setItem(profileKey(HISTORY_KEY), JSON.stringify(h));
  } catch {}
}

export function completedToday(): boolean {
  try {
    return localStorage.getItem(profileKey(LAST_COMPLETED_KEY)) === todayISO();
  } catch {
    return false;
  }
}

function markCompletedToday(questId: string) {
  try {
    const today = todayISO();
    localStorage.setItem(profileKey(LAST_COMPLETED_KEY), today);
    const h = getHistory();
    h[today] = questId;
    saveHistory(h);
  } catch {}
}

// Pick today's quest deterministically based on date + profile + recent history.
// We pick one the child hasn't done in the last N days (if possible).
export function getTodaysQuest(): Quest {
  const history = getHistory();
  const recentlyDoneIds = new Set(Object.values(history).slice(-5));

  // seed: days-since-epoch + sum of char codes of profile id (handled via profileKey already)
  const today = todayISO();
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) & 0xffff;

  const fresh = QUEST_LIBRARY.filter((q) => !recentlyDoneIds.has(q.id));
  const pool = fresh.length > 0 ? fresh : QUEST_LIBRARY;
  return pool[seed % pool.length];
}

// ---------- Step progression ----------
// Called from trackProgress when any game increments — returns step result.

export interface QuestStepResult {
  advanced: boolean;
  completed: boolean;
  nextStep?: QuestStep;
  quest?: Quest;
}

export function tryAdvanceQuest(gameId: string): QuestStepResult {
  const active = getActiveQuest();
  if (!active) return { advanced: false, completed: false };

  const quest = getQuestById(active.id);
  if (!quest) {
    setActiveQuest(null);
    return { advanced: false, completed: false };
  }

  const currentStep = quest.steps[active.stepIndex];
  if (!currentStep) return { advanced: false, completed: false };

  // Does this game match the current required step?
  if (currentStep.gameId !== gameId) return { advanced: false, completed: false };

  const nextIndex = active.stepIndex + 1;
  if (nextIndex >= quest.steps.length) {
    // completed!
    markCompletedToday(quest.id);
    setActiveQuest(null);
    grantQuestReward(quest);
    return { advanced: true, completed: true, quest };
  }

  const updated: ActiveQuest = { ...active, stepIndex: nextIndex };
  setActiveQuest(updated);
  return {
    advanced: true,
    completed: false,
    quest,
    nextStep: quest.steps[nextIndex],
  };
}

const EARNED_QUEST_STICKERS_KEY = 'questStickers';

function grantQuestReward(quest: Quest) {
  try {
    const raw = localStorage.getItem(profileKey(EARNED_QUEST_STICKERS_KEY));
    const saved: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved) && !saved.includes(quest.reward.stickerId)) {
      saved.push(quest.reward.stickerId);
      localStorage.setItem(profileKey(EARNED_QUEST_STICKERS_KEY), JSON.stringify(saved));
    }
  } catch {}
}

export function getEarnedQuestStickers(): string[] {
  try {
    const raw = localStorage.getItem(profileKey(EARNED_QUEST_STICKERS_KEY));
    const saved: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved)) return saved;
  } catch {}
  return [];
}

export function acceptQuest(questId: string) {
  const active: ActiveQuest = {
    id: questId,
    stepIndex: 0,
    startedAt: Date.now(),
    acceptedDateISO: todayISO(),
  };
  setActiveQuest(active);
}

export function abandonQuest() {
  setActiveQuest(null);
}

// First-time Quill introduction flag. Profile-scoped so siblings each get
// their own meet-cute with the quest giver.
const QUILL_INTRO_KEY = 'quillIntroSeen';

export function hasSeenQuillIntro(): boolean {
  try {
    return localStorage.getItem(profileKey(QUILL_INTRO_KEY)) === '1';
  } catch {
    return true;
  }
}

export function markQuillIntroSeen() {
  try {
    localStorage.setItem(profileKey(QUILL_INTRO_KEY), '1');
  } catch {}
}
