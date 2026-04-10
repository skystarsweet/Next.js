import React from 'react';
import { useVoiceRecorder, VoiceNote } from '../hooks/useVoiceRecorder';
import styles from './VoiceRecorder.module.css';

interface VoiceRecorderProps {
  onNoteSaved: (note: VoiceNote) => void;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceRecorder({ onNoteSaved }: VoiceRecorderProps) {
  const {
    isRecording,
    isPaused,
    isTranscribing,
    transcript,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
    isSupported,
  } = useVoiceRecorder();

  if (!isSupported) {
    return (
      <div className={styles.recorder}>
        <div className={styles.unsupported}>
          <div className={styles.unsupportedTitle}>Browser Not Supported</div>
          <div className={styles.unsupportedText}>
            Voice recording requires a modern browser with microphone access and Web Speech API support.
            <br />
            Please try Chrome, Edge, or Safari.
          </div>
        </div>
      </div>
    );
  }

  const handleStop = async () => {
    const note = await stopRecording();
    if (note) {
      onNoteSaved(note);
    }
  };

  const barCount = 24;
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (!isRecording || isPaused) return 3;
    const center = barCount / 2;
    const distFromCenter = Math.abs(i - center) / center;
    const base = audioLevel * 35 * (1 - distFromCenter * 0.6);
    const variation = Math.sin(Date.now() / 200 + i * 0.5) * audioLevel * 8;
    return Math.max(3, base + variation);
  });

  return (
    <div className={isRecording ? styles.recorderActive : styles.recorder}>
      {error && <div className={styles.error}>{error}</div>}

      {isRecording && (
        <>
          <div className={styles.timer}>{formatTimer(duration)}</div>
          <div className={isPaused ? styles.statusPaused : styles.statusRecording}>
            {isPaused ? 'Paused' : isTranscribing ? 'Processing...' : 'Recording...'}
          </div>

          <div className={styles.visualizer}>
            {bars.map((height, i) => (
              <div
                key={i}
                className={styles.bar}
                style={{
                  height: `${height}px`,
                  opacity: isPaused ? 0.3 : 0.5 + audioLevel * 0.5,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className={styles.controls}>
        {isRecording && (
          <button
            className={styles.secondaryBtn}
            onClick={isPaused ? resumeRecording : pauseRecording}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            )}
          </button>
        )}

        <button
          className={isRecording ? styles.recordBtnActive : styles.recordBtn}
          onClick={isRecording ? handleStop : startRecording}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {isRecording && (
          <div style={{ width: 48 }} />
        )}
      </div>

      {isRecording && transcript && (
        <div className={styles.liveTranscript}>
          <div className={styles.liveTranscriptLabel}>Live Transcription</div>
          <div className={styles.liveTranscriptText}>{transcript}</div>
        </div>
      )}

      {isRecording && !transcript && (
        <div className={styles.liveTranscript}>
          <div className={styles.liveTranscriptLabel}>Live Transcription</div>
          <div className={styles.placeholder}>Listening for speech...</div>
        </div>
      )}

      {!isRecording && (
        <div className={styles.hint}>
          Click the microphone to start recording a voice note
        </div>
      )}
    </div>
  );
}
