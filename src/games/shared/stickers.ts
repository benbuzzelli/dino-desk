import type { Sticker } from './types';
import { profileKey } from './profile';
import { tryAdvanceQuest, QUEST_LIBRARY, getEarnedQuestStickers } from './quests';
import type { QuestStepResult } from './quests';

// Sticker PNGs from awards/stickers. Each id maps to the corresponding image.
import stickerFirstHatch from './sprites/awards/stickers/first-match-1.png';
import stickerEggExpert from './sprites/awards/stickers/egg-expert.png';
import stickerFirstSteps from './sprites/awards/stickers/first-steps.png';
import stickerPathFinder from './sprites/awards/stickers/path-finder.png';
import stickerFirstWord from './sprites/awards/stickers/first-word.png';
import stickerDinoScholar from './sprites/awards/stickers/dino-scholar.png';
import stickerFirstEscape from './sprites/awards/stickers/first-escape.png';
import stickerEscapeArtist from './sprites/awards/stickers/escape-artist.png';
import stickerFirstMatch from './sprites/awards/stickers/first-match.png';
import stickerMemoryMaster from './sprites/awards/stickers/memory-master.png';
import stickerFirstDiscovery from './sprites/awards/stickers/first-discovery.png';
import stickerJungleExpert from './sprites/awards/stickers/jungle-expert.png';
import stickerFirstExpedition from './sprites/awards/stickers/first-expedition.png';
import stickerDungeonMaster from './sprites/awards/stickers/dungeon-master.png';

// Quest reward trophies from awards/quest-trophies. These already bake the
// sticker name into the artwork (carved on a wooden plaque), so StickerBook
// should not render a second Placard below them.
import trophyNestSaver from './sprites/awards/quest-trophies/nest-saver.png';
import trophyBraveRescuer from './sprites/awards/quest-trophies/brave-rescuer.png';
import trophyNameGiver from './sprites/awards/quest-trophies/name-giver.png';
import trophyNightWatcher from './sprites/awards/quest-trophies/night-watcher.png';
import trophyCaveExplorer from './sprites/awards/quest-trophies/cave-explorer.png';
import trophyFeastMaster from './sprites/awards/quest-trophies/feast-master.png';
import trophyFossilFinder from './sprites/awards/quest-trophies/fossil-finder.png';
import trophyStormSpotter from './sprites/awards/quest-trophies/storm-spotter.png';
import trophyTreasureHunter from './sprites/awards/quest-trophies/treasure-hunter.png';
import trophyPartyPlanner from './sprites/awards/quest-trophies/party-planner.png';

const STICKER_IMAGE_URLS: Record<string, string> = {
  'egg-hunt-1': stickerFirstHatch,
  'egg-hunt-5': stickerEggExpert,
  'dino-path-1': stickerFirstSteps,
  'dino-path-3': stickerPathFinder,
  'spell-dino-1': stickerFirstWord,
  'spell-dino-3': stickerDinoScholar,
  'volcano-1': stickerFirstEscape,
  'volcano-3': stickerEscapeArtist,
  'dino-match-1': stickerFirstMatch,
  'dino-match-3': stickerMemoryMaster,
  'jungle-explorer-1': stickerFirstDiscovery,
  'jungle-explorer-3': stickerJungleExpert,
  'dino-dungeon-1': stickerFirstExpedition,
  'dino-dungeon-3': stickerDungeonMaster,
  // Quest reward trophies
  'quest-lost-eggs': trophyNestSaver,
  'quest-volcano-rescue': trophyBraveRescuer,
  'quest-name-newborn': trophyNameGiver,
  'quest-museum-night': trophyNightWatcher,
  'quest-deep-cave': trophyCaveExplorer,
  'quest-jungle-feast': trophyFeastMaster,
  'quest-fossil-puzzle': trophyFossilFinder,
  'quest-storm-warning': trophyStormSpotter,
  'quest-treasure': trophyTreasureHunter,
  'quest-birthday': trophyPartyPlanner,
};

export function getStickerImageUrl(id: string): string | null {
  return STICKER_IMAGE_URLS[id] ?? null;
}

export const QUEST_STICKER_GAME = 'quest';

// Light-weight bus so game code can trigger Quill bubbles without importing React.
const QUILL_EVENT = 'quill:bubble';
function dispatchQuillBubble(detail: { emote: string; message: string; durationMs?: number }) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(QUILL_EVENT, { detail }));
  } catch {}
}

export interface StickerDef {
  id: string;
  emoji: string;
  name: string;
  game: string;
  threshold: number;
}

const ALL_STICKERS: StickerDef[] = [
  { id: 'egg-hunt-1', emoji: '🥚', name: 'First Hatch', game: 'egg-hunt', threshold: 1 },
  { id: 'egg-hunt-5', emoji: '🐣', name: 'Egg Expert', game: 'egg-hunt', threshold: 5 },
  { id: 'dino-path-1', emoji: '🦶', name: 'First Steps', game: 'dino-path', threshold: 1 },
  { id: 'dino-path-3', emoji: '🌟', name: 'Path Finder', game: 'dino-path', threshold: 3 },
  { id: 'spell-dino-1', emoji: '🔤', name: 'First Word', game: 'spell-dino', threshold: 1 },
  { id: 'spell-dino-3', emoji: '📖', name: 'Dino Scholar', game: 'spell-dino', threshold: 3 },
  { id: 'volcano-1', emoji: '🌋', name: 'First Escape', game: 'volcano', threshold: 1 },
  { id: 'volcano-3', emoji: '🏆', name: 'Escape Artist', game: 'volcano', threshold: 3 },
  { id: 'dino-match-1', emoji: '🃏', name: 'First Match', game: 'dino-match', threshold: 1 },
  { id: 'dino-match-3', emoji: '🧠', name: 'Memory Master', game: 'dino-match', threshold: 3 },
  { id: 'jungle-explorer-1', emoji: '🔍', name: 'First Discovery', game: 'jungle-explorer', threshold: 1 },
  { id: 'jungle-explorer-3', emoji: '🌴', name: 'Jungle Expert', game: 'jungle-explorer', threshold: 3 },
  { id: 'dino-dungeon-1', emoji: '🏰', name: 'First Expedition', game: 'dino-dungeon', threshold: 1 },
  { id: 'dino-dungeon-3', emoji: '⚔️', name: 'Dungeon Master', game: 'dino-dungeon', threshold: 3 },
];

export interface StickerWithProgress extends Sticker {
  game: string;
  threshold: number;
  progress: number;
}

export function loadStickers(): StickerWithProgress[] {
  try {
    const raw = localStorage.getItem(profileKey('stickers'));
    const earnedIds: string[] = raw ? JSON.parse(raw) : [];
    const progress = loadProgress();

    // auto-grant stickers if progress meets threshold but sticker wasn't saved
    let dirty = false;
    for (const s of ALL_STICKERS) {
      const prog = progress[s.game] ?? 0;
      if (prog >= s.threshold && Array.isArray(earnedIds) && !earnedIds.includes(s.id)) {
        earnedIds.push(s.id);
        dirty = true;
      }
    }
    if (dirty) {
      localStorage.setItem(profileKey('stickers'), JSON.stringify(earnedIds));
    }

    const gameplayStickers: StickerWithProgress[] = ALL_STICKERS.map((s) => ({
      id: s.id,
      emoji: s.emoji,
      name: s.name,
      game: s.game,
      threshold: s.threshold,
      earned: Array.isArray(earnedIds) && earnedIds.includes(s.id),
      progress: progress[s.game] ?? 0,
    }));

    // Quest reward stickers — merged in so the sticker book shows them
    // alongside the gameplay ones. Earned state comes from the profile-scoped
    // 'questStickers' list written by grantQuestReward().
    const earnedQuestIds = new Set(getEarnedQuestStickers());
    const questStickers: StickerWithProgress[] = QUEST_LIBRARY.map((q) => ({
      id: q.reward.stickerId,
      emoji: q.reward.emoji,
      name: q.reward.name,
      game: QUEST_STICKER_GAME,
      threshold: 1,
      earned: earnedQuestIds.has(q.reward.stickerId),
      progress: earnedQuestIds.has(q.reward.stickerId) ? 1 : 0,
    }));

    return [...gameplayStickers, ...questStickers];
  } catch {
    return ALL_STICKERS.map((s) => ({
      ...s,
      earned: false,
      progress: 0,
    }));
  }
}

export function earnSticker(id: string) {
  try {
    const raw = localStorage.getItem(profileKey('stickers'));
    const saved: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved) && !saved.includes(id)) {
      saved.push(id);
      localStorage.setItem(profileKey('stickers'), JSON.stringify(saved));
    }
  } catch {
    // ignore
  }
}

function loadProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(profileKey('progress'));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
    return {};
  } catch {
    return {};
  }
}

// Drains any pending quest step advancement event. Valley reads this when it
// re-mounts after a game ends to show the quest progress/complete overlay.
const PENDING_QUEST_EVENT_KEY = 'pendingQuestEvent';

export function trackProgress(game: string): number {
  try {
    const progress = loadProgress();
    const current = (progress[game] ?? 0) + 1;
    progress[game] = current;
    localStorage.setItem(profileKey('progress'), JSON.stringify(progress));

    // if an active quest's current step matches this game, advance it and
    // stash an event for the Valley to read next time it mounts.
    const result: QuestStepResult = tryAdvanceQuest(game);
    if (result.advanced) {
      try {
        localStorage.setItem(
          profileKey(PENDING_QUEST_EVENT_KEY),
          JSON.stringify({
            completed: result.completed,
            questId: result.quest?.id,
            nextGameId: result.nextStep?.gameId,
            at: Date.now(),
          }),
        );
      } catch {}

      // Pop Quill in the bottom-right so the kid gets immediate feedback
      // mid-game, in addition to the modal that shows on Valley return.
      if (result.completed && result.quest) {
        dispatchQuillBubble({
          emote: result.quest.outroEmote ?? 'grateful',
          message: `Quest complete! ${result.quest.reward.emoji} ${result.quest.reward.name} earned!`,
          durationMs: 5500,
        });
      } else if (result.nextStep) {
        dispatchQuillBubble({
          emote: result.nextStep.emote ?? 'excited',
          message: `Nice! Next up: ${result.nextStep.callToAction}`,
          durationMs: 5000,
        });
      }
    }

    return current;
  } catch {
    return 0;
  }
}

export interface PendingQuestEvent {
  completed: boolean;
  questId?: string;
  nextGameId?: string;
  at: number;
}

export function consumePendingQuestEvent(): PendingQuestEvent | null {
  try {
    const raw = localStorage.getItem(profileKey(PENDING_QUEST_EVENT_KEY));
    if (!raw) return null;
    localStorage.removeItem(profileKey(PENDING_QUEST_EVENT_KEY));
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.at === 'number') return parsed;
  } catch {}
  return null;
}
