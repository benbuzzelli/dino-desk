import { useMemo, useState } from 'react';
import { loadStickers, getStickerImageUrl, QUEST_STICKER_GAME } from '../games/shared/stickers';
import type { StickerWithProgress } from '../games/shared/stickers';
import { playPop } from '../games/shared/audio';
import {
  Button,
  Label,
  Placard,
  FONT,
  color,
  fontSize,
  radius,
  shadow,
  gradient,
} from '../ui';

const GAME_LABELS: Record<string, string> = {
  'egg-hunt': 'Egg Hunt',
  'dino-path': 'Dino Path',
  'spell-dino': 'Spell Dino',
  'volcano': 'Volcano Escape',
  'dino-match': 'Dino Match',
  'jungle-explorer': 'Jungle Explorer',
  'dino-dungeon': 'Dino Dungeon',
  [QUEST_STICKER_GAME]: 'Quest Rewards',
};

function StickerCard({ sticker, onTap }: { sticker: StickerWithProgress; onTap: () => void }) {
  const imageUrl = getStickerImageUrl(sticker.id);
  const hasImage = !!imageUrl;
  // Quest trophies bake the sticker name onto a wooden plaque directly in
  // the artwork, so we skip the separate Placard below them to avoid
  // duplicating the title.
  const hasEmbeddedLabel = sticker.game === QUEST_STICKER_GAME;
  // Quest trophies are taller (art + plaque) so give them a bigger slot.
  const imageBoxSize = hasEmbeddedLabel ? 136 : 104;

  return (
    <button
      onClick={onTap}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
        cursor: 'pointer',
        minHeight: 150,
        fontFamily: 'inherit',
        transition: 'transform 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: imageBoxSize,
        height: imageBoxSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: sticker.earned
          ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
          : 'grayscale(1) opacity(0.4) drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
      }}>
        {hasImage ? (
          <img
            src={imageUrl}
            alt={sticker.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{
            fontSize: 72,
            lineHeight: 1,
          }}>{sticker.emoji}</div>
        )}
      </div>

      {/* Wooden placard — skipped for quest trophies (artwork has its own) */}
      {!hasEmbeddedLabel && (
        <Placard label={sticker.earned ? sticker.name : '???'} dim={!sticker.earned} />
      )}
    </button>
  );
}

export function StickerBook({ onBack }: { onBack: () => void }) {
  const stickers = useMemo(() => loadStickers(), []);
  const [detail, setDetail] = useState<StickerWithProgress | null>(null);

  const earnedCount = stickers.filter((s) => s.earned).length;

  const byGame = useMemo(() => {
    const groups: Record<string, StickerWithProgress[]> = {};
    for (const s of stickers) {
      if (!groups[s.game]) groups[s.game] = [];
      groups[s.game].push(s);
    }
    return groups;
  }, [stickers]);

  // Stable display order: known games first, quests last
  const gameOrder = [
    'egg-hunt',
    'jungle-explorer',
    'dino-match',
    'spell-dino',
    'volcano',
    'dino-dungeon',
    'dino-path',
    QUEST_STICKER_GAME,
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 900,
        height: '100dvh',
        maxHeight: 700,
        background: 'linear-gradient(180deg, #FFE4B5 0%, #FFD9A3 60%, #D7B48B 100%)',
        borderRadius: radius['2xl'],
        color: color.woodDarkest,
        fontFamily: FONT,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '18px 22px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderBottom: '2px dashed rgba(111,78,55,0.3)',
      }}>
        <Button
          label="← Back"
          onClick={() => { playPop(); onBack(); }}
          flex={false}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: fontSize.hero, fontWeight: 700, lineHeight: 1 }}>Sticker Book</div>
          <div style={{ fontSize: fontSize.base, opacity: 0.75, marginTop: 4 }}>
            ⭐ {earnedCount} of {stickers.length} collected
          </div>
        </div>
      </div>

      {/* Grid body */}
      <div style={{
        flex: '1 1 auto',
        overflowY: 'auto',
        padding: '14px 22px 22px',
      }}>
        {gameOrder.map((gameId) => {
          const group = byGame[gameId];
          if (!group?.length) return null;
          const earnedInGroup = group.filter((s) => s.earned).length;
          return (
            <section key={gameId} style={{ marginBottom: 18 }}>
              <h3 style={{
                margin: '0 0 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Label size="sm" style={{ letterSpacing: 1.2, fontWeight: 700, fontSize: 16 }}>
                  {GAME_LABELS[gameId] ?? gameId}
                </Label>
                <span style={{ fontSize: fontSize.sm, opacity: 0.7, fontWeight: 500, color: color.wood }}>
                  {earnedInGroup}/{group.length}
                </span>
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
              }}>
                {group.map((s) => (
                  <StickerCard key={s.id} sticker={s} onTap={() => { playPop(); setDetail(s); }} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Detail modal */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: gradient.parchment,
              color: color.woodDarkest,
              borderRadius: 18,
              border: `3px solid ${color.woodMid}`,
              padding: 22,
              width: 'min(380px, 90vw)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              boxShadow: shadow.card,
              fontFamily: FONT,
            }}
          >
            <div style={{
              width: 180,
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {(() => {
                const url = getStickerImageUrl(detail.id);
                if (url) {
                  return (
                    <img
                      src={url}
                      alt={detail.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        filter: detail.earned ? 'none' : 'grayscale(1) opacity(0.4)',
                      }}
                    />
                  );
                }
                return (
                  <div style={{
                    fontSize: 110,
                    filter: detail.earned ? 'none' : 'grayscale(1) opacity(0.4)',
                  }}>{detail.emoji}</div>
                );
              })()}
            </div>
            <Label>{GAME_LABELS[detail.game] ?? detail.game}</Label>
            <div style={{
              fontSize: fontSize['2xl'],
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.15,
            }}>
              {detail.earned ? detail.name : 'Keep playing!'}
            </div>
            <div style={{ fontSize: fontSize.md, textAlign: 'center', opacity: 0.85, lineHeight: 1.4 }}>
              {detail.earned
                ? detail.game === QUEST_STICKER_GAME
                  ? `Earned by finishing Quill's quest.`
                  : `Earned after ${detail.threshold} win${detail.threshold === 1 ? '' : 's'}.`
                : detail.game === QUEST_STICKER_GAME
                  ? 'Finish this quest with Quill to earn it.'
                  : `Play ${GAME_LABELS[detail.game] ?? detail.game} to earn this sticker!`}
            </div>
            <div style={{ marginTop: 4, width: 140 }}>
              <Button
                label="Close"
                onClick={() => { playPop(); setDetail(null); }}
                variant="primary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
