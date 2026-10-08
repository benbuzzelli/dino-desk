import { useState, useEffect, useRef } from 'react';
import { FONT, color, fontSize, radius, shadow } from '../ui';

const NOTES_KEY = 'testerNotes';
const DRAFT_KEY = 'testerNotesDraft';

interface Note {
  id: string;
  text: string;
  location: string;
  timestamp: number;
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {}
}

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveDraft(text: string) {
  try {
    localStorage.setItem(DRAFT_KEY, text);
  } catch {}
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TesterNotes({
  open,
  onClose,
  getLocation,
}: {
  open: boolean;
  onClose: () => void;
  getLocation: () => string;
}) {
  const [draft, setDraft] = useState(() => loadDraft());
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // persist draft on every keystroke
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const note: Note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: trimmed,
      location: getLocation(),
      timestamp: Date.now(),
    };
    const next = [note, ...notes];
    setNotes(next);
    saveNotes(next);
    setDraft('');
    saveDraft('');
  };

  const handleDelete = (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(next);
  };

  const handleExport = () => {
    const text = notes
      .map((n) => `[${formatTimestamp(n.timestamp)}] (${n.location})\n${n.text}`)
      .join('\n\n---\n\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: color.overlaySoft,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(680px, 94vw)',
          maxHeight: '90dvh',
          background: '#1f1f2e',
          color: '#fff',
          borderRadius: radius['2xl'],
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: shadow.card,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 28 }}>Tester notes</div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: fontSize.lg }}>
          Currently in: <strong style={{ color: color.goldLight }}>{getLocation()}</strong>
        </div>

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What did you notice? (saves as you type)"
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            background: '#12121b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: 14,
            fontFamily: 'inherit',
            fontSize: 22,
            lineHeight: 1.35,
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            style={{
              background: draft.trim() ? '#4CAF50' : '#3a3a4a',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 22px',
              cursor: draft.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: 20,
              fontFamily: 'inherit',
            }}
          >
            Save note
          </button>
          <button
            onClick={handleExport}
            disabled={notes.length === 0}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12,
              padding: '12px 18px',
              cursor: notes.length === 0 ? 'not-allowed' : 'pointer',
              opacity: notes.length === 0 ? 0.5 : 1,
              fontSize: 18,
              fontFamily: 'inherit',
            }}
            title="Copy all notes to clipboard"
          >
            Copy all
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 16, opacity: 0.7 }}>
            {notes.length} saved
          </div>
        </div>

        <div
          style={{
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: notes.length === 0 ? 20 : 8,
            minHeight: 100,
            maxHeight: '40dvh',
          }}
        >
          {notes.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: 18, textAlign: 'center' }}>
              No notes yet. Notes save where you were in the app.
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '12px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 4 }}>
                    {formatTimestamp(n.timestamp)} · {n.location}
                  </div>
                  <div style={{ fontSize: 18, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {n.text}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 20,
                    padding: '4px 8px',
                  }}
                  title="Delete note"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
