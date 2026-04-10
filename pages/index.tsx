import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import VoiceRecorder from '../components/VoiceRecorder';
import NoteCard from '../components/NoteCard';
import { VoiceNote } from '../hooks/useVoiceRecorder';
import styles from '../styles/Home.module.css';

const STORAGE_KEY = 'voice-notes-app';

function loadNotes(): VoiceNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const notes = JSON.parse(saved) as VoiceNote[];
      // Audio URLs can't persist across sessions, so nullify them
      return notes.map((n) => ({ ...n, audioUrl: null }));
    }
  } catch {}
  return [];
}

function saveNotes(notes: VoiceNote[]) {
  try {
    // Don't persist blob URLs
    const toSave = notes.map((n) => ({ ...n, audioUrl: null }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

const Home: NextPage = () => {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setNotes(loadNotes());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveNotes(notes);
    }
  }, [notes, mounted]);

  const handleNoteSaved = useCallback((note: VoiceNote) => {
    setNotes((prev) => [note, ...prev]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleUpdate = useCallback((updated: VoiceNote) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm('Delete all notes? This cannot be undone.')) {
      setNotes([]);
    }
  }, []);

  const filteredNotes = search.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.transcript.toLowerCase().includes(search.toLowerCase()) ||
          n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : notes;

  return (
    <div className={styles.container}>
      <Head>
        <title>VoiceNotes AI - Smart Voice Note Taking</title>
        <meta
          name="description"
          content="Record voice notes with live transcription and AI-powered summaries"
        />
        <link rel="icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logoSection}>
            <div className={styles.logoIcon}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className={styles.logoText}>
              <div className={styles.appName}>VoiceNotes AI</div>
              <div className={styles.appTagline}>Record, Transcribe, Summarize</div>
            </div>
          </div>

          {notes.length > 0 && (
            <span className={styles.noteCount}>
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.recorderSection}>
          <VoiceRecorder onNoteSaved={handleNoteSaved} />
        </section>

        <section className={styles.notesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {search ? `Search Results (${filteredNotes.length})` : 'Your Notes'}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {notes.length > 0 && (
                <div className={styles.searchBox}>
                  <svg
                    className={styles.searchIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    className={styles.searchInput}
                    type="text"
                    placeholder="Search notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
              {notes.length > 1 && (
                <button className={styles.clearBtn} onClick={handleClearAll}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          {filteredNotes.length > 0 ? (
            <div className={styles.notesList}>
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <div className={styles.emptyTitle}>
                {search ? 'No notes found' : 'No voice notes yet'}
              </div>
              <div className={styles.emptyText}>
                {search
                  ? `No notes match "${search}". Try a different search term.`
                  : 'Tap the microphone button above to record your first voice note. Your speech will be transcribed in real-time.'}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Home;
