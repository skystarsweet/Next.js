import React, { useState } from 'react';
import { VoiceNote } from '../hooks/useVoiceRecorder';
import styles from './NoteCard.module.css';

interface NoteCardProps {
  note: VoiceNote;
  onDelete: (id: string) => void;
  onUpdate: (note: VoiceNote) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NoteCard({ note, onDelete, onUpdate }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [summarizing, setSummarizing] = useState(false);

  const handleSummarize = async () => {
    if (note.summary || summarizing) return;
    if (note.transcript === '(No speech detected)') return;

    setSummarizing(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: note.transcript }),
      });

      if (res.ok) {
        const data = await res.json();
        onUpdate({
          ...note,
          summary: data.summary,
          tags: data.tags,
          title: note.title === 'Untitled Note' ? data.title : note.title,
        });
      }
    } catch (err) {
      console.error('Summarize failed:', err);
    } finally {
      setSummarizing(false);
    }
  };

  const handleSaveTitle = () => {
    setEditing(false);
    if (editTitle.trim() && editTitle !== note.title) {
      onUpdate({ ...note, title: editTitle.trim() });
    } else {
      setEditTitle(note.title);
    }
  };

  const needsTruncation = note.transcript.length > 200;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {editing ? (
            <input
              className={styles.titleInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setEditTitle(note.title);
                  setEditing(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div
              className={styles.title}
              onDoubleClick={() => {
                setEditing(true);
                setEditTitle(note.title);
              }}
            >
              {note.title}
            </div>
          )}
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatDuration(note.duration)}
            </span>
            <span className={styles.metaItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {formatDate(note.createdAt)}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => {
              setEditing(true);
              setEditTitle(note.title);
            }}
            title="Edit title"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={() => onDelete(note.id)}
            title="Delete note"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {note.audioUrl && (
        <audio className={styles.audioPlayer} controls src={note.audioUrl} preload="metadata" />
      )}

      <div className={needsTruncation && !expanded ? styles.transcriptCollapsed : styles.transcriptExpanded}>
        {note.transcript}
      </div>

      {needsTruncation && (
        <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {note.summary && (
        <div className={styles.summary}>
          <div className={styles.summaryLabel}>AI Summary</div>
          <div className={styles.summaryText}>{note.summary}</div>
        </div>
      )}

      {note.tags.length > 0 && (
        <div className={styles.tags}>
          {note.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        {!note.summary && note.transcript !== '(No speech detected)' && (
          <button
            className={summarizing ? styles.summarizing : styles.summarizeBtn}
            onClick={handleSummarize}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {summarizing ? 'Analyzing...' : 'AI Summarize'}
          </button>
        )}
        <button
          className={styles.footerBtn}
          onClick={() => {
            navigator.clipboard.writeText(note.transcript);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </button>
      </div>
    </div>
  );
}
