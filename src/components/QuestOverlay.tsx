import type { Quest, QuestStep } from '../games/shared/quests';
import { getQuillBillboardUrl, billboardFromEmote } from '../games/shared/quill';
import type { QuillBillboard } from '../games/shared/quill';
import { getStickerImageUrl } from '../games/shared/stickers';
import {
  Button,
  Label,
  FONT,
  color,
  fontSize,
  radius,
  shadow,
  gradient,
  textShadow,
} from '../ui';

export type QuestOverlayMode =
  | { kind: 'intro'; quest: Quest; alreadyCompletedToday: boolean }
  | { kind: 'stepComplete'; quest: Quest; nextStep: QuestStep; stepIndex: number }
  | { kind: 'questComplete'; quest: Quest }
  | { kind: 'quillIntro' }
  | { kind: 'questContinue'; quest: Quest; currentStep: QuestStep; stepIndex: number }
  | null;

interface QuestOverlayProps {
  mode: QuestOverlayMode;
  onAccept?: () => void;
  onContinue?: () => void;
  onClose: () => void;
  onGoToGame?: (gameId: string) => void;
  onMeetQuillDone?: () => void;
}

// Debug toggle — shows a translucent blue rectangle behind the text zone
// so we can verify content aligns with the billboard's papyrus area.
const DEBUG_TEXT_ZONE = false;

// Shared style presets that are specific to the QuestOverlay's papyrus zone.
// Everything cross-cutting lives in ../ui/theme.
const bodyTextStyle: React.CSSProperties = {
  fontSize: fontSize.base,
  lineHeight: 1.45,
  padding: '2px 2px',
  color: color.woodDarkest,
  textShadow: textShadow.parchment,
};

const panelStyle: React.CSSProperties = {
  background: gradient.parchmentPanel,
  borderRadius: radius.md,
  padding: '8px 10px',
  border: '1px solid rgba(111,78,55,0.4)',
  boxShadow: 'inset 0 1px 0 rgba(255,248,220,0.55), 0 1px 2px rgba(62,39,35,0.15)',
};

// Dark wood plaque used to hero the next-step call-to-action.
function NextPlaque({ text }: { text: string }) {
  return (
    <div style={{
      background: gradient.woodPlaque,
      borderRadius: radius.sm,
      padding: '8px 10px',
      textAlign: 'center',
      fontSize: fontSize.md,
      fontWeight: 700,
      border: `1px solid ${color.woodDarkest}`,
      color: '#FFECB3',
      letterSpacing: 0.3,
      textShadow: textShadow.plaque,
      boxShadow: 'inset 0 1px 0 rgba(255,236,179,0.2), 0 2px 4px rgba(62,39,35,0.3)',
    }}>
      <Label tone="light" size="xxs" style={{ marginRight: 6, opacity: 0.75, letterSpacing: 2 }}>
        Next
      </Label>
      {text}
    </div>
  );
}

// Billboard PNGs are ~593×650 (portrait) stone tablets with Quill peeking
// over the top-left. The papyrus text zone is inset from the frame runes;
// Quill's head overhangs the TOP of the tablet, so the text area starts
// below where he is.
function CardShell({
  billboard,
  children,
  footer,
}: {
  billboard: QuillBillboard;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'relative',
        width: 'min(520px, 92vw)',
        aspectRatio: '593 / 653',
        maxHeight: '94dvh',
        fontFamily: FONT,
        color: color.woodDarkest,
        filter: `drop-shadow(${shadow.stone})`,
        // shift the whole card up a bit so it doesn't sit dead-center
        transform: 'translateY(-5%)',
      }}
    >
      <img
        src={getQuillBillboardUrl(billboard)}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          // Papyrus text zone inside the stone tablet.
          top: '38%',
          bottom: '14%',
          left: '14%',
          right: '14%',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
          minHeight: 0,
          background: DEBUG_TEXT_ZONE ? 'rgba(30,120,220,0.35)' : 'transparent',
          outline: DEBUG_TEXT_ZONE ? '2px dashed rgba(30,120,220,0.8)' : 'none',
        }}
      >
        <div
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
            paddingRight: 4,
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              flex: '0 0 auto',
              paddingTop: 8,
              paddingBottom: 2,
              display: 'flex',
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function TitleBanner({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{
        fontSize: fontSize.xl,
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: 0.3,
        color: color.woodDarkest,
        textShadow: textShadow.soft,
      }}>{title}</div>
      {subtitle && <Label>{subtitle}</Label>}
    </div>
  );
}

function stepBillboard(step: QuestStep): QuillBillboard {
  if (step.billboard) return step.billboard;
  if (step.emote) return billboardFromEmote(step.emote);
  return 'mischievous';
}

function introBillboardFor(q: Quest): QuillBillboard {
  if (q.introBillboard) return q.introBillboard;
  if (q.introEmote) return billboardFromEmote(q.introEmote);
  return 'neutral';
}

function outroBillboardFor(q: Quest): QuillBillboard {
  if (q.outroBillboard) return q.outroBillboard;
  if (q.outroEmote) return billboardFromEmote(q.outroEmote);
  return 'relieved';
}

export function QuestOverlay({ mode, onAccept, onContinue, onClose, onGoToGame, onMeetQuillDone }: QuestOverlayProps) {
  if (!mode) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: color.overlay,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {mode.kind === 'intro' && (
        <CardShell
          billboard={introBillboardFor(mode.quest)}
          footer={
            mode.alreadyCompletedToday ? (
              <Button label="Thanks!" onClick={onClose} variant="primary" />
            ) : (
              <>
                <Button label="Later" onClick={onClose} />
                <Button label="Let's go!" onClick={() => onAccept?.()} variant="primary" />
              </>
            )
          }
        >
          <TitleBanner title={mode.quest.title} subtitle="Today's Adventure" />
          <div style={bodyTextStyle}>{mode.quest.intro}</div>
          <div style={panelStyle}>
            <Label size="xxs" style={{ display: 'block', marginBottom: 4, letterSpacing: 1.4, opacity: 0.8 }}>
              {mode.quest.steps.length} steps
            </Label>
            {mode.quest.steps.map((s, i) => (
              <div key={i} style={{
                fontSize: fontSize.base,
                padding: '3px 0',
                borderTop: i === 0 ? 'none' : '1px dashed rgba(111,78,55,0.25)',
                color: color.woodDarkest,
              }}>
                <span style={{ fontWeight: 700, marginRight: 4, color: '#6F4E37' }}>{i + 1}.</span>
                {s.callToAction}
              </div>
            ))}
          </div>
          <div style={{
            fontSize: fontSize.sm,
            textAlign: 'center',
            color: '#6F4E37',
            fontStyle: 'italic',
          }}>
            Reward: <span style={{ fontStyle: 'normal', fontWeight: 700, color: color.woodDarkest }}>
              {mode.quest.reward.emoji} {mode.quest.reward.name}
            </span> sticker
          </div>
          {mode.alreadyCompletedToday && (
            <div style={{
              textAlign: 'center',
              fontSize: fontSize.base,
              color: color.greenDark,
              fontWeight: 700,
            }}>
              ✓ You finished today's quest! Come back tomorrow.
            </div>
          )}
        </CardShell>
      )}

      {mode.kind === 'stepComplete' && (
        <CardShell
          billboard={stepBillboard(mode.nextStep)}
          footer={
            <>
              <Button label="Later" onClick={onClose} />
              <Button
                label="Go!"
                onClick={() => onGoToGame?.(mode.nextStep.gameId)}
                variant="primary"
              />
            </>
          }
        >
          <TitleBanner
            title="Great job!"
            subtitle={`Step ${mode.stepIndex} of ${mode.quest.steps.length} complete`}
          />
          <div style={bodyTextStyle}>{mode.nextStep.narrative}</div>
          <NextPlaque text={mode.nextStep.callToAction} />
        </CardShell>
      )}

      {mode.kind === 'quillIntro' && (
        <CardShell
          billboard="neutral"
          footer={
            <Button
              label="Nice to meet you, Quill!"
              onClick={() => onMeetQuillDone?.()}
              variant="primary"
            />
          }
        >
          <TitleBanner title="Hi there!" subtitle="Nice to meet you" />
          <div style={bodyTextStyle}>
            I'm <strong>Quill</strong>, the valley's quest keeper! Every day I find
            new adventures for brave little dinos like you. Tap me whenever you want
            a new quest, and I'll tell you who needs help and where to go.
          </div>
          <div style={{
            ...panelStyle,
            fontSize: fontSize.sm,
            lineHeight: 1.45,
            color: color.woodDarkest,
            textShadow: textShadow.parchment,
          }}>
            Finish a quest and I'll give you a special sticker. Let's help the valley
            together!
          </div>
        </CardShell>
      )}

      {mode.kind === 'questContinue' && (
        <CardShell
          billboard={stepBillboard(mode.currentStep)}
          footer={
            <>
              <Button label="Later" onClick={onClose} />
              <Button
                label="Go!"
                onClick={() => onGoToGame?.(mode.currentStep.gameId)}
                variant="primary"
              />
            </>
          }
        >
          <TitleBanner
            title={mode.quest.title}
            subtitle={`Step ${mode.stepIndex + 1} of ${mode.quest.steps.length}`}
          />
          <div style={bodyTextStyle}>{mode.currentStep.narrative}</div>
          <NextPlaque text={mode.currentStep.callToAction} />
        </CardShell>
      )}

      {mode.kind === 'questComplete' && (
        <CardShell
          billboard={outroBillboardFor(mode.quest)}
          footer={
            <Button label="Awesome!" onClick={() => onContinue?.()} variant="primary" />
          }
        >
          <TitleBanner title="Quest Complete!" subtitle={mode.quest.title} />
          <div style={bodyTextStyle}>{mode.quest.outro}</div>
          {(() => {
            const trophyUrl = getStickerImageUrl(mode.quest.reward.stickerId);
            // Trophy artwork has the sticker name baked onto a wooden plaque,
            // so we drop the "New sticker / <name>" text when a PNG exists.
            if (trophyUrl) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Label size="xxs" style={{ letterSpacing: 2, color: '#8B4513', fontWeight: 700 }}>
                    New sticker
                  </Label>
                  <img
                    src={trophyUrl}
                    alt={mode.quest.reward.name}
                    style={{
                      maxWidth: '75%',
                      maxHeight: 150,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))',
                    }}
                  />
                </div>
              );
            }
            // Fallback for any quest that doesn't have a trophy PNG yet.
            return (
              <div style={{
                background: gradient.goldCoin,
                borderRadius: radius.xl,
                padding: 12,
                textAlign: 'center',
                border: `2px solid ${color.goldBronze}`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 10px rgba(201,122,0,0.35)',
              }}>
                <div style={{
                  fontSize: 38,
                  lineHeight: 1,
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
                }}>{mode.quest.reward.emoji}</div>
                <Label size="xxs" style={{ display: 'block', marginTop: 4, letterSpacing: 2, color: '#8B4513', fontWeight: 700 }}>
                  New sticker
                </Label>
                <div style={{
                  fontSize: fontSize.lg,
                  fontWeight: 800,
                  color: color.woodDarkest,
                  letterSpacing: 0.3,
                  textShadow: '0 1px 0 rgba(255,255,255,0.55)',
                }}>{mode.quest.reward.name}</div>
              </div>
            );
          })()}
        </CardShell>
      )}
    </div>
  );
}
