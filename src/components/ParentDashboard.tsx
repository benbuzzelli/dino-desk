import { useState, useEffect, useCallback } from 'react';
import { loadStickers, getStickerImageUrl } from '../games/shared/stickers';
import { getDifficulty, setDifficulty, AGE_LABELS, DIFFICULTY_LABELS, DIFFICULTY_ORDER } from '../games/shared/difficulty';
import type { Difficulty } from '../games/shared/difficulty';
import { getVolume, setVolume, getMuted, setMuted } from '../games/shared/audio';
import { getProfiles, getActiveProfile, setActiveProfile, addProfile, removeProfile, profileKey } from '../games/shared/profile';

function getTimerMinutes(): number {
  try {
    const saved = localStorage.getItem(profileKey('timerMinutes'));
    if (saved) return Math.max(0, parseInt(saved, 10) || 0);
  } catch {}
  return 0;
}

function setTimerMinutes(mins: number) {
  try {
    localStorage.setItem(profileKey('timerMinutes'), String(Math.max(0, mins)));
  } catch {}
}

function getProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(profileKey('progress'));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
  } catch {}
  return {};
}

function resetProgress() {
  try {
    localStorage.removeItem(profileKey('progress'));
    localStorage.removeItem(profileKey('stickers'));
    localStorage.removeItem(profileKey('collection'));
  } catch {}
}

const GAME_NAMES: Record<string, string> = {
  'egg-hunt': 'Dino Egg Hunt',
  'dino-path': 'Dino Path',
  'spell-dino': 'Spell the Dino',
  'volcano': 'Volcano Escape',
  'dino-match': 'Dino Match',
  'jungle-explorer': 'Jungle Explorer',
  'dino-dungeon': 'Dino Dungeon',
};

export function ParentDashboard({ onClose, onTimerRestart }: { onClose: () => void; onTimerRestart: () => void }) {
  const [timer, setTimer] = useState(getTimerMinutes());
  const [difficulty, setDiff] = useState<Difficulty>(getDifficulty());
  const [progress, setProgress] = useState(getProgress());
  const [stickers, setStickers] = useState(loadStickers());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [volume, setVol] = useState(getVolume());
  const [muted, setMut] = useState(getMuted());
  const [profiles, setProfiles] = useState(getProfiles());
  const [activeProfile, setActive] = useState(getActiveProfile());
  const [newProfileName, setNewProfileName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const refreshProfileData = useCallback(() => {
    setTimer(getTimerMinutes());
    setDiff(getDifficulty());
    setProgress(getProgress());
    setStickers(loadStickers());
    setShowResetConfirm(false);
  }, []);

  useEffect(() => {
    refreshProfileData();
  }, [refreshProfileData]);

  const handleSwitchProfile = useCallback((name: string) => {
    setActiveProfile(name);
    setActive(name);
    setTimer(getTimerMinutes());
    setDiff(getDifficulty());
    setProgress(getProgress());
    setStickers(loadStickers());
    setShowResetConfirm(false);
    onTimerRestart();
  }, [onTimerRestart]);

  const handleAddProfile = useCallback(() => {
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    if (addProfile(trimmed)) {
      setProfiles(getProfiles());
      setNewProfileName('');
      handleSwitchProfile(trimmed);
    }
  }, [newProfileName, handleSwitchProfile]);

  const handleDeleteProfile = useCallback((name: string) => {
    removeProfile(name);
    const updated = getProfiles();
    setProfiles(updated);
    setShowDeleteConfirm(null);
    if (activeProfile === name) {
      handleSwitchProfile(updated[0]);
    }
  }, [activeProfile, handleSwitchProfile]);

  const handleTimerChange = useCallback((mins: number) => {
    setTimer(mins);
    setTimerMinutes(mins);
    onTimerRestart();
  }, [onTimerRestart]);

  const handleDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d);
    setDiff(d);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVol(v);
    setVolume(v);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const next = !muted;
    setMut(next);
    setMuted(next);
  }, [muted]);

  const handleReset = useCallback(() => {
    resetProgress();
    setProgress({});
    setStickers(loadStickers());
    setShowResetConfirm(false);
  }, []);

  const earnedCount = stickers.filter((s) => s.earned).length;
  const totalCompletions = Object.values(progress).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      fontFamily: 'Fredoka, sans-serif',
    }}>
      <div style={{
        background: '#1a1a2e',
        borderRadius: 20,
        border: '2px solid rgba(255,255,255,0.15)',
        width: '90%',
        maxWidth: 600,
        maxHeight: '90vh',
        overflow: 'auto',
        padding: 28,
        color: '#fff',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24, color: '#FFD700' }}>Parent Dashboard</h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 16,
              padding: '6px 14px',
              cursor: 'pointer',
              fontFamily: 'Fredoka, sans-serif',
            }}
          >
            Close
          </button>
        </div>

        {/* Profiles */}
        <Section title="Player Profiles">
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 12px' }}>
            Each player has their own progress, stickers, and settings.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {profiles.map((name) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => handleSwitchProfile(name)}
                  style={{
                    background: activeProfile === name ? '#4CAF50' : 'rgba(255,255,255,0.08)',
                    border: activeProfile === name ? '2px solid #66BB6A' : '2px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 14,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontFamily: 'Fredoka, sans-serif',
                    fontWeight: activeProfile === name ? 'bold' : 'normal',
                  }}
                >
                  {name}
                </button>
                {profiles.length > 1 && (
                  showDeleteConfirm === name ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleDeleteProfile(name)}
                        style={{
                          background: '#EF5350',
                          border: 'none',
                          borderRadius: 6,
                          color: '#fff',
                          fontSize: 11,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontFamily: 'Fredoka, sans-serif',
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: 'none',
                          borderRadius: 6,
                          color: '#fff',
                          fontSize: 11,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontFamily: 'Fredoka, sans-serif',
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 14,
                        cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                      title={`Remove ${name}`}
                    >
                      x
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddProfile(); }}
              placeholder="New player name"
              maxLength={20}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                padding: '8px 12px',
                fontFamily: 'Fredoka, sans-serif',
                outline: 'none',
                width: 160,
              }}
            />
            <button
              onClick={handleAddProfile}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                padding: '8px 14px',
                cursor: 'pointer',
                fontFamily: 'Fredoka, sans-serif',
              }}
            >
              Add Player
            </button>
          </div>
        </Section>

        {/* Volume */}
        <Section title="Sound">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={handleMuteToggle}
              style={{
                background: muted ? 'rgba(244,67,54,0.2)' : 'rgba(76,175,80,0.2)',
                border: muted ? '2px solid rgba(244,67,54,0.4)' : '2px solid rgba(76,175,80,0.4)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 18,
                padding: '6px 12px',
                cursor: 'pointer',
                fontFamily: 'Fredoka, sans-serif',
                minWidth: 44,
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10) / 100)}
              disabled={muted}
              style={{
                flex: 1,
                accentColor: '#4CAF50',
                opacity: muted ? 0.3 : 1,
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, minWidth: 36, textAlign: 'right' }}>
              {muted ? 'Off' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </Section>

        {/* Time Limit */}
        <Section title="Time Limit">
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 12px' }}>
            Set a play time limit. When time runs out, the session ends with a friendly screen.
            Set to 0 for unlimited play.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[0, 10, 15, 20, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => handleTimerChange(mins)}
                style={{
                  background: timer === mins ? '#4CAF50' : 'rgba(255,255,255,0.08)',
                  border: timer === mins ? '2px solid #66BB6A' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 14,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontFamily: 'Fredoka, sans-serif',
                  fontWeight: timer === mins ? 'bold' : 'normal',
                }}
              >
                {mins === 0 ? 'No limit' : `${mins} min`}
              </button>
            ))}
          </div>
          {timer > 0 && (
            <button
              onClick={onTimerRestart}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'Fredoka, sans-serif',
                marginTop: 10,
              }}
            >
              Restart Timer Now
            </button>
          )}
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '8px 0 0' }}>
            Current: {timer === 0 ? 'Unlimited' : `${timer} minutes`}.
            Selecting a time starts it immediately.
          </p>
        </Section>

        {/* Difficulty */}
        <Section title="Difficulty">
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 12px' }}>
            Choose the difficulty level that fits your child's age and skill.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {DIFFICULTY_ORDER.map((d) => (
              <button
                key={d}
                onClick={() => handleDifficulty(d)}
                style={{
                  flex: '1 1 140px',
                  background: difficulty === d ? '#4CAF50' : 'rgba(255,255,255,0.08)',
                  border: difficulty === d ? '2px solid #66BB6A' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: '#fff',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontFamily: 'Fredoka, sans-serif',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  marginBottom: 2,
                }}>
                  {DIFFICULTY_LABELS[d]}
                </div>
                <div style={{
                  fontSize: 12,
                  color: difficulty === d ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
                }}>
                  {AGE_LABELS[d]}
                </div>
              </button>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '10px 0 0' }}>
            {difficulty === 'easy' && 'Bigger hit areas, hints on every step, fewer cards, and slower pace.'}
            {difficulty === 'medium' && 'Standard difficulty with normal pace and helpful visuals.'}
            {difficulty === 'hard' && 'Faster pace, no hints, and trickier challenges.'}
          </p>
        </Section>

        {/* Progress */}
        <Section title="Progress">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <StatCard label="Total Completions" value={totalCompletions} color="#4ECDC4" />
            <StatCard label="Stickers Earned" value={`${earnedCount}/${stickers.length}`} color="#FFD700" />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}>
            {Object.entries(GAME_NAMES).map(([key, name]) => (
              <div key={key} style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 10,
                padding: '10px 14px',
              }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>{progress[key] ?? 0}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>completions</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Stickers Detail */}
        <Section title="Stickers">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 8,
          }}>
            {stickers.map((s) => {
              const url = getStickerImageUrl(s.id);
              return (
                <div key={s.id} style={{
                  background: s.earned ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.03)',
                  border: s.earned ? '1px solid rgba(76,175,80,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {url ? (
                      <img
                        src={url}
                        alt={s.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          filter: s.earned ? 'none' : 'grayscale(1) opacity(0.35)',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 22, filter: s.earned ? 'none' : 'grayscale(1) opacity(0.35)' }}>
                        {s.earned ? s.emoji : '🔒'}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: s.earned ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                    {s.name}
                  </div>
                  {!s.earned && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                      {s.progress}/{s.threshold}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Reset */}
        <Section title="Reset Data">
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              style={{
                background: 'rgba(244,67,54,0.15)',
                border: '2px solid rgba(244,67,54,0.3)',
                borderRadius: 10,
                color: '#EF5350',
                fontSize: 14,
                padding: '8px 18px',
                cursor: 'pointer',
                fontFamily: 'Fredoka, sans-serif',
              }}
            >
              Reset All Progress
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: '#EF5350', fontSize: 13 }}>Are you sure?</span>
              <button
                onClick={handleReset}
                style={{
                  background: '#EF5350',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontFamily: 'Fredoka, sans-serif',
                }}
              >
                Yes, reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontFamily: 'Fredoka, sans-serif',
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '8px 0 0' }}>
            This clears all stickers and game progress for {activeProfile}. Settings are kept.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{
        margin: '0 0 10px',
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 6,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: '12px 18px',
      borderLeft: `4px solid ${color}`,
      minWidth: 130,
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}
