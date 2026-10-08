import { useState, useCallback, useEffect, useRef } from 'react';
import { Valley } from './components/Valley';
import { AllDoneScreen } from './components/AllDoneScreen';
import { EggHunt } from './games/egg-hunt/EggHunt';
import { SpellDino } from './games/spell-dino/SpellDino';
import { VolcanoEscape } from './games/volcano-escape/VolcanoEscape';
import { DinoMatch } from './games/dino-match/DinoMatch';
import { JungleExplorer } from './games/jungle-explorer/JungleExplorer';
import { DinoDungeon } from './games/dino-dungeon/DinoDungeon';
import { DinoCollection } from './components/DinoCollection';
import { MyDino } from './components/MyDino';
import { StickerBook } from './components/StickerBook';
import { ParentDashboard } from './components/ParentDashboard';
import { DinoCreation } from './components/DinoCreation';
import { LevelEditor } from './components/LevelEditor';
import { TesterNotes } from './components/TesterNotes';
import { QuestOverlay } from './components/QuestOverlay';
import type { QuestOverlayMode } from './components/QuestOverlay';
import { QuillBubble, emitQuillBubble } from './components/QuillBubble';
import { preloadQuillEmotes } from './games/shared/quill';
import { initAudio } from './games/shared/audio';
import { profileKey, getActiveProfile } from './games/shared/profile';
import { hasAvatar } from './games/shared/avatar';
import {
  getTodaysQuest,
  completedToday,
  acceptQuest,
  getQuestById,
  getActiveQuest,
  hasSeenQuillIntro,
  markQuillIntroSeen,
  QUEST_GAME_TO_APP,
} from './games/shared/quests';
import { consumePendingQuestEvent } from './games/shared/stickers';
import type { GameId } from './games/shared/types';

function getTimerMinutes(): number {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('timer');
  if (fromUrl) {
    const mins = parseInt(fromUrl, 10);
    if (mins > 0) {
      try { localStorage.setItem(profileKey('timerMinutes'), String(mins)); } catch {}
      return mins;
    }
  }
  try {
    const saved = localStorage.getItem(profileKey('timerMinutes'));
    if (saved) return Math.max(0, parseInt(saved, 10) || 0);
  } catch {}
  return 0;
}

function App() {
  // Dev-only route: ?editor=1 opens the dungeon room editor, bypassing the rest of the app.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('editor') === '1') {
    return <LevelEditor />;
  }

  const [currentGame, setCurrentGame] = useState<GameId | null>(null);
  const [showMyDino, setShowMyDino] = useState(false);
  const [showStickerBook, setShowStickerBook] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [questOverlay, setQuestOverlay] = useState<QuestOverlayMode>(null);
  const [gameKey, setGameKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [showParentDash, setShowParentDash] = useState(false);
  const [timerVersion, setTimerVersion] = useState(0);
  const [needsAvatar, setNeedsAvatar] = useState(() => !hasAvatar());
  const [avatarProfile, setAvatarProfile] = useState(getActiveProfile());

  // long-press state for fullscreen button
  const longPressRef = useRef<number | null>(null);

  // transition state
  type TransitionPhase = 'idle' | 'fade-out' | 'fade-in';
  const [transPhase, setTransPhase] = useState<TransitionPhase>('idle');
  const pendingNavRef = useRef<GameId | null | undefined>(undefined);

  // preload Quill emotes once so the first bubble isn't a blank frame
  useEffect(() => {
    preloadQuillEmotes();
  }, []);

  // --- Keyboard blocker ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'w') { e.preventDefault(); return; }
      if (mod && e.key === 'q') { e.preventDefault(); return; }
      if (e.ctrlKey && e.key === 'F4') { e.preventDefault(); return; }
      if (mod && e.key === 'r') { e.preventDefault(); return; }
      if (e.key === 'F5') { e.preventDefault(); return; }
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); return; }
      }
      if (mod && e.key === 't') { e.preventDefault(); return; }
      if (mod && e.key === 'n') { e.preventDefault(); return; }
      if (mod && e.key === 'l') { e.preventDefault(); return; }
      if (e.key === 'F6') { e.preventDefault(); return; }
      if (mod && e.key === 'f') { e.preventDefault(); return; }
      if (mod && e.key === 'p') { e.preventDefault(); return; }
      if (mod && e.key === 'd') { e.preventDefault(); return; }
      if (mod && e.key === 'h') { e.preventDefault(); return; }
      if (e.key === 'F12') { e.preventDefault(); return; }
      if (mod && e.altKey && e.key === 'i') { e.preventDefault(); return; }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  // --- Fullscreen ---
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // --- Long press on fullscreen button to open parent dashboard ---
  const handleFsPointerDown = useCallback(() => {
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      setShowParentDash(true);
    }, 1000);
  }, []);

  const handleFsPointerUp = useCallback(() => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
      toggleFullscreen();
    }
  }, [toggleFullscreen]);

  const handleFsPointerLeave = useCallback(() => {
    if (longPressRef.current !== null) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  // --- Session timer (re-runs when timerVersion changes) ---
  useEffect(() => {
    const minutes = getTimerMinutes();
    if (minutes <= 0) {
      setRemainingMs(null);
      setSessionExpired(false);
      try { localStorage.removeItem(profileKey('timerStart')); } catch {}
      return;
    }

    const limit = minutes * 60 * 1000;

    // Restore or set start time
    let start: number;
    try {
      const saved = localStorage.getItem(profileKey('timerStart'));
      if (saved) {
        start = parseInt(saved, 10);
      } else {
        start = Date.now();
        localStorage.setItem(profileKey('timerStart'), String(start));
      }
    } catch {
      start = Date.now();
    }

    const initialLeft = limit - (Date.now() - start);
    if (initialLeft <= 0) {
      setSessionExpired(true);
      setRemainingMs(0);
      return;
    }
    setRemainingMs(initialLeft);
    setSessionExpired(false);

    const id = setInterval(() => {
      const left = limit - (Date.now() - start);
      if (left <= 0) {
        setSessionExpired(true);
        setRemainingMs(0);
        clearInterval(id);
      } else {
        setRemainingMs(left);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [timerVersion]);

  // called from ParentDashboard when timer changes or is reset
  const handleTimerRestart = useCallback(() => {
    try { localStorage.setItem(profileKey('timerStart'), String(Date.now())); } catch {}
    setTimerVersion((v) => v + 1);
  }, []);

  // --- Navigation with transitions ---
  const navigateTo = useCallback((target: GameId | null) => {
    if (transPhase !== 'idle') return;
    pendingNavRef.current = target;
    setTransPhase('fade-out');
  }, [transPhase]);

  const handleSelectGame = useCallback((id: GameId) => {
    initAudio();
    navigateTo(id);
  }, [navigateTo]);

  const handleBack = useCallback(() => {
    navigateTo(null);
  }, [navigateTo]);

  const handleTransitionEnd = useCallback(() => {
    if (transPhase === 'fade-out') {
      if (pendingNavRef.current !== undefined) {
        setCurrentGame(pendingNavRef.current);
        if (pendingNavRef.current !== null) {
          setGameKey((k) => k + 1);
        }
        pendingNavRef.current = undefined;
      }
      setTransPhase('fade-in');
    } else if (transPhase === 'fade-in') {
      setTransPhase('idle');
    }
  }, [transPhase]);

  const overlayOpacity = transPhase === 'fade-out' ? 1 : 0;

  // When returning to the Valley (currentGame became null), drain any pending
  // quest advancement event and show the appropriate overlay.
  useEffect(() => {
    if (currentGame !== null) return;
    const evt = consumePendingQuestEvent();
    if (!evt) return;
    const quest = evt.questId ? getQuestById(evt.questId) : null;
    if (!quest) return;
    if (evt.completed) {
      setQuestOverlay({ kind: 'questComplete', quest });
    } else if (evt.nextGameId) {
      const nextStep = quest.steps.find((s) => s.gameId === evt.nextGameId);
      if (nextStep) {
        const stepIndex = quest.steps.indexOf(nextStep);
        setQuestOverlay({ kind: 'stepComplete', quest, nextStep, stepIndex });
      }
    }
  }, [currentGame]);

  const showDailyQuestOverlay = useCallback(() => {
    // Active quest wins: show the continue flow so Quill doesn't re-pitch a
    // different randomly-picked daily on top of an in-progress adventure.
    const active = getActiveQuest();
    if (active) {
      const quest = getQuestById(active.id);
      const step = quest?.steps[active.stepIndex];
      if (quest && step) {
        setQuestOverlay({
          kind: 'questContinue',
          quest,
          currentStep: step,
          stepIndex: active.stepIndex,
        });
        return;
      }
    }
    const quest = getTodaysQuest();
    setQuestOverlay({
      kind: 'intro',
      quest,
      alreadyCompletedToday: completedToday(),
    });
  }, []);

  const handleOpenQuestGiver = useCallback(() => {
    if (!hasSeenQuillIntro()) {
      setQuestOverlay({ kind: 'quillIntro' });
      return;
    }
    showDailyQuestOverlay();
  }, [showDailyQuestOverlay]);

  const handleMeetQuillDone = useCallback(() => {
    markQuillIntroSeen();
    showDailyQuestOverlay();
  }, [showDailyQuestOverlay]);

  const handleAcceptQuest = useCallback(() => {
    if (questOverlay?.kind !== 'intro') return;
    const quest = questOverlay.quest;
    acceptQuest(quest.id);
    const firstStep = quest.steps[0];
    setQuestOverlay(null);
    if (firstStep) {
      const appGameId = QUEST_GAME_TO_APP[firstStep.gameId] as GameId;
      initAudio();
      emitQuillBubble({
        emote: firstStep.emote ?? 'confident-ready',
        message: `Let's do it! ${firstStep.callToAction}`,
        durationMs: 5000,
      });
      navigateTo(appGameId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questOverlay]);

  const handleQuestGoToGame = useCallback(
    (gameId: string) => {
      const appGameId = (QUEST_GAME_TO_APP[gameId as keyof typeof QUEST_GAME_TO_APP] ?? gameId) as GameId;
      setQuestOverlay(null);
      initAudio();
      navigateTo(appGameId);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getLocationLabel = useCallback((): string => {
    if (sessionExpired) return 'All Done screen';
    if (needsAvatar) return 'Dino Creation';
    if (showParentDash) return 'Parent Dashboard';
    if (currentGame) {
      const labels: Record<GameId, string> = {
        'egg-hunt': 'Egg Hunt',
        'spell-dino': 'Spell Dino',
        'volcano-escape': 'Volcano Escape',
        'dino-match': 'Dino Match',
        'jungle-explorer': 'Jungle Explorer',
        'dino-dungeon': 'Dino Dungeon',
        'collection': 'Dino Museum',
      };
      return labels[currentGame];
    }
    if (showStickerBook) return 'Sticker Book';
    if (showMyDino) return 'My Dino';
    return 'Dino Valley';
  }, [sessionExpired, needsAvatar, showParentDash, currentGame, showMyDino, showStickerBook]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        overflow: 'hidden',
      }}
    >
      {sessionExpired ? (
        <AllDoneScreen />
      ) : needsAvatar ? (
        <DinoCreation
          key={avatarProfile}
          onDone={() => {
            setNeedsAvatar(false);
          }}
        />
      ) : (
        <>
          {currentGame === null && !showMyDino && !showStickerBook && (
            <Valley
              onSelectGame={handleSelectGame}
              onOpenMyDino={() => setShowMyDino(true)}
              onOpenQuestGiver={handleOpenQuestGiver}
            />
          )}
          {currentGame === null && showMyDino && !showStickerBook && (
            <MyDino
              onBack={() => setShowMyDino(false)}
              onOpenStickerBook={() => setShowStickerBook(true)}
            />
          )}
          {currentGame === null && showStickerBook && (
            <StickerBook onBack={() => setShowStickerBook(false)} />
          )}
          {currentGame === 'egg-hunt' && <EggHunt key={gameKey} onBack={handleBack} />}
          {currentGame === 'spell-dino' && <SpellDino key={gameKey} onBack={handleBack} />}
          {currentGame === 'volcano-escape' && <VolcanoEscape key={gameKey} onBack={handleBack} />}
          {currentGame === 'dino-match' && <DinoMatch key={gameKey} onBack={handleBack} />}
          {currentGame === 'jungle-explorer' && <JungleExplorer key={gameKey} onBack={handleBack} />}
          {currentGame === 'dino-dungeon' && <DinoDungeon key={gameKey} onBack={handleBack} />}
          {currentGame === 'collection' && <DinoCollection key={gameKey} onBack={handleBack} />}
        </>
      )}

      {/* Transition overlay */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#1a1a2e',
          opacity: overlayOpacity,
          transition: 'opacity 300ms ease-in-out',
          pointerEvents: transPhase !== 'idle' ? 'all' : 'none',
          zIndex: 10,
        }}
      />

      {/* Timer display */}
      {remainingMs !== null && remainingMs > 0 && !sessionExpired && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            background: remainingMs < 60000 ? 'rgba(200,50,50,0.6)' : 'rgba(0,0,0,0.35)',
            border: `2px solid ${remainingMs < 60000 ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 12,
            color: '#fff',
            fontSize: 14,
            fontFamily: 'Fredoka, sans-serif',
            padding: '6px 16px',
            pointerEvents: 'none',
            opacity: 0.8,
          }}
        >
          {(() => {
            const totalSec = Math.ceil(remainingMs / 1000);
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            return `${min}:${sec.toString().padStart(2, '0')} left`;
          })()}
        </div>
      )}

      {/* Fullscreen button — long press opens parent dashboard */}
      {document.fullscreenEnabled && (
        <button
          onPointerDown={handleFsPointerDown}
          onPointerUp={handleFsPointerUp}
          onPointerLeave={handleFsPointerLeave}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 20,
            background: 'rgba(0,0,0,0.4)',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 18,
            width: 40,
            height: 40,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
            transition: 'opacity 200ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
          title={isFullscreen ? 'Exit fullscreen (hold for settings)' : 'Enter fullscreen (hold for settings)'}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      )}

      {/* Fallback for no fullscreen: invisible long-press zone */}
      {!document.fullscreenEnabled && (
        <div
          onPointerDown={handleFsPointerDown}
          onPointerUp={() => {
            if (longPressRef.current !== null) {
              clearTimeout(longPressRef.current);
              longPressRef.current = null;
            }
          }}
          onPointerLeave={handleFsPointerLeave}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 50,
            height: 50,
            zIndex: 20,
            cursor: 'default',
          }}
        />
      )}

      {/* Tester notes button (bottom-left) */}
      <button
        onClick={() => setShowNotes(true)}
        title="Tester notes"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 20,
          background: 'rgba(0,0,0,0.4)',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: 12,
          color: '#fff',
          fontSize: 26,
          width: 56,
          height: 56,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.75,
          transition: 'opacity 200ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.75'; }}
      >
        📝
      </button>

      <TesterNotes
        open={showNotes}
        onClose={() => setShowNotes(false)}
        getLocation={getLocationLabel}
      />

      <QuestOverlay
        mode={questOverlay}
        onClose={() => setQuestOverlay(null)}
        onAccept={handleAcceptQuest}
        onContinue={() => setQuestOverlay(null)}
        onGoToGame={handleQuestGoToGame}
        onMeetQuillDone={handleMeetQuillDone}
      />

      <QuillBubble />

      {/* Parent dashboard overlay */}
      {showParentDash && (
        <ParentDashboard
          onClose={() => {
            setShowParentDash(false);
            // re-check avatar in case the parent switched profiles
            const profile = getActiveProfile();
            if (profile !== avatarProfile) {
              setAvatarProfile(profile);
            }
            setNeedsAvatar(!hasAvatar());
          }}
          onTimerRestart={handleTimerRestart}
        />
      )}
    </div>
  );
}

export default App;
