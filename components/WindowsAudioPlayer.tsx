import React, { useState, useRef, useEffect, useCallback, ChangeEvent, DragEvent } from 'react'
import styles from '../styles/WindowsAudioPlayer.module.css'

interface Track {
  id: string
  name: string
  url: string
  duration: number
  format: string
}

const SUPPORTED_FORMATS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'webm', 'wma', 'aiff', 'ape', 'mp4']

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getFormat(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? 'unknown'
}

export default function WindowsAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none')
  const [isShuffle, setIsShuffle] = useState(false)
  const [visualizerBars, setVisualizerBars] = useState<number[]>(Array(20).fill(2))
  const visualizerRef = useRef<NodeJS.Timeout | null>(null)

  const currentTrack = tracks[currentIndex] ?? null

  // Animate visualizer bars while playing
  useEffect(() => {
    if (isPlaying) {
      visualizerRef.current = setInterval(() => {
        setVisualizerBars(Array(20).fill(0).map(() => Math.random() * 28 + 4))
      }, 120)
    } else {
      if (visualizerRef.current) clearInterval(visualizerRef.current)
      setVisualizerBars(Array(20).fill(2))
    }
    return () => {
      if (visualizerRef.current) clearInterval(visualizerRef.current)
    }
  }, [isPlaying])

  const loadTrack = useCallback((index: number) => {
    const audio = audioRef.current
    if (!audio || !tracks[index]) return
    audio.src = tracks[index].url
    audio.load()
    setCurrentTime(0)
    setDuration(0)
  }, [tracks])

  useEffect(() => {
    if (tracks.length > 0) loadTrack(currentIndex)
  }, [currentIndex, tracks, loadTrack])

  const play = useCallback(() => {
    audioRef.current?.play()
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
  }, [])

  const playNext = useCallback(() => {
    if (!tracks.length) return
    let next: number
    if (isShuffle) {
      next = Math.floor(Math.random() * tracks.length)
    } else {
      next = (currentIndex + 1) % tracks.length
    }
    setCurrentIndex(next)
    setTimeout(() => audioRef.current?.play(), 100)
    setIsPlaying(true)
  }, [currentIndex, tracks.length, isShuffle])

  const playPrev = useCallback(() => {
    if (!tracks.length) return
    const prev = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1
    setCurrentIndex(prev)
    setTimeout(() => audioRef.current?.play(), 100)
    setIsPlaying(true)
  }, [currentIndex, tracks.length])

  const handleEnded = useCallback(() => {
    if (repeatMode === 'one') {
      audioRef.current!.currentTime = 0
      audioRef.current!.play()
    } else if (repeatMode === 'all' || currentIndex < tracks.length - 1) {
      playNext()
    } else {
      setIsPlaying(false)
    }
  }, [repeatMode, currentIndex, tracks.length, playNext])

  const handleTimeUpdate = useCallback(() => {
    if (!isSeeking && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }, [isSeeking])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }, [])

  const handleVolumeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (audioRef.current) {
      audioRef.current.volume = v / 100
      audioRef.current.muted = false
    }
    setIsMuted(false)
  }, [])

  const handleSeekChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    setCurrentTime(t)
    if (audioRef.current) audioRef.current.currentTime = t
  }, [])

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return
    const next = !isMuted
    audioRef.current.muted = next
    setIsMuted(next)
  }, [isMuted])

  const cycleRepeat = useCallback(() => {
    setRepeatMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none')
  }, [])

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const newTracks: Track[] = []
    Array.from(files).forEach(file => {
      const fmt = getFormat(file.name)
      if (!SUPPORTED_FORMATS.includes(fmt)) return
      const url = URL.createObjectURL(file)
      newTracks.push({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url,
        duration: 0,
        format: fmt.toUpperCase(),
      })
    })
    setTracks(prev => {
      const updated = [...prev, ...newTracks]
      if (prev.length === 0 && newTracks.length > 0) {
        setTimeout(() => setCurrentIndex(0), 0)
      }
      return updated
    })
  }, [])

  const handleFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
    e.target.value = ''
  }, [addFiles])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const removeTrack = useCallback((id: string, idx: number) => {
    setTracks(prev => {
      const next = prev.filter(t => t.id !== id)
      if (idx === currentIndex && isPlaying) {
        audioRef.current?.pause()
        setIsPlaying(false)
      }
      if (idx < currentIndex) setCurrentIndex(c => Math.max(0, c - 1))
      else if (idx === currentIndex) setCurrentIndex(0)
      return next
    })
  }, [currentIndex, isPlaying])

  const selectTrack = useCallback((idx: number) => {
    setCurrentIndex(idx)
    setIsPlaying(true)
    setTimeout(() => audioRef.current?.play(), 100)
  }, [])

  // Set volume on mount
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const repeatLabel = repeatMode === 'none' ? '↻' : repeatMode === 'all' ? '↻' : '↺'
  const repeatTitle = repeatMode === 'none' ? 'Repeat: Off' : repeatMode === 'all' ? 'Repeat: All' : 'Repeat: One'

  return (
    <div className={styles.playerWrapper}>
      {/* Title Bar */}
      <div className={styles.titleBar}>
        <div className={styles.titleBarLeft}>
          <span className={styles.titleBarIcon}>♪</span>
          <span className={styles.titleBarText}>Windows Audio Player</span>
        </div>
        <div className={styles.titleBarButtons}>
          <button className={styles.titleBtn} onClick={() => setIsMinimized(m => !m)} title="Minimize">_</button>
          <button className={styles.titleBtn} title="Maximize">□</button>
          <button className={`${styles.titleBtn} ${styles.closeBtn}`} title="Close">✕</button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Menu Bar */}
          <div className={styles.menuBar}>
            <span className={styles.menuItem}>File</span>
            <span className={styles.menuItem}>View</span>
            <span className={styles.menuItem}>Playback</span>
            <span className={styles.menuItem}>Help</span>
          </div>

          <div className={styles.playerBody}>
            {/* Visualizer + Now Playing */}
            <div className={styles.displayArea}>
              <div className={styles.nowPlaying}>
                <div className={styles.trackInfo}>
                  <div className={styles.trackName}>{currentTrack ? currentTrack.name : 'No track loaded'}</div>
                  <div className={styles.trackMeta}>
                    {currentTrack && <span className={styles.formatBadge}>{currentTrack.format}</span>}
                    <span className={styles.timeDisplay}>{formatTime(currentTime)} / {formatTime(duration)}</span>
                  </div>
                </div>
                <div className={styles.visualizer}>
                  {visualizerBars.map((h, i) => (
                    <div
                      key={i}
                      className={styles.bar}
                      style={{ height: `${h}px`, opacity: isPlaying ? 1 : 0.3 }}
                    />
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              <div className={styles.seekRow}>
                <input
                  ref={progressRef}
                  type="range"
                  className={styles.seekBar}
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onMouseDown={() => setIsSeeking(true)}
                  onMouseUp={() => setIsSeeking(false)}
                  onChange={handleSeekChange}
                  disabled={!currentTrack}
                />
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
              <div className={styles.transportRow}>
                <button
                  className={`${styles.ctrlBtn} ${isShuffle ? styles.active : ''}`}
                  onClick={() => setIsShuffle(s => !s)}
                  title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
                >⇄</button>
                <button className={styles.ctrlBtn} onClick={playPrev} disabled={!tracks.length} title="Previous">⏮</button>
                <button className={styles.playBtn} onClick={isPlaying ? pause : play} disabled={!currentTrack} title={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button className={styles.ctrlBtn} onClick={stop} disabled={!currentTrack} title="Stop">⏹</button>
                <button className={styles.ctrlBtn} onClick={playNext} disabled={!tracks.length} title="Next">⏭</button>
                <button
                  className={`${styles.ctrlBtn} ${repeatMode !== 'none' ? styles.active : ''}`}
                  onClick={cycleRepeat}
                  title={repeatTitle}
                >{repeatLabel}{repeatMode === 'one' ? '¹' : ''}</button>
              </div>

              <div className={styles.volumeRow}>
                <button className={styles.muteBtn} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
                </button>
                <input
                  type="range"
                  className={styles.volumeSlider}
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  title={`Volume: ${volume}%`}
                />
                <span className={styles.volLabel}>{isMuted ? 0 : volume}%</span>
              </div>
            </div>

            {/* Playlist */}
            <div
              className={`${styles.playlist} ${isDragging ? styles.dragging : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className={styles.playlistHeader}>
                <span>Playlist ({tracks.length})</span>
                <button
                  className={styles.addBtn}
                  onClick={() => fileInputRef.current?.click()}
                  title="Add files"
                >+ Add Files</button>
              </div>
              <div className={styles.playlistBody}>
                {tracks.length === 0 ? (
                  <div className={styles.emptyMsg}>
                    <div>Drop audio files here or click &quot;+ Add Files&quot;</div>
                    <div className={styles.supportedFormats}>
                      Supported: {SUPPORTED_FORMATS.map(f => f.toUpperCase()).join(', ')}
                    </div>
                  </div>
                ) : (
                  tracks.map((track, idx) => (
                    <div
                      key={track.id}
                      className={`${styles.playlistItem} ${idx === currentIndex ? styles.playlistItemActive : ''}`}
                      onClick={() => selectTrack(idx)}
                    >
                      <span className={styles.trackNum}>{idx + 1}.</span>
                      <span className={styles.playlistIcon}>{idx === currentIndex && isPlaying ? '▶' : '♪'}</span>
                      <span className={styles.playlistName}>{track.name}</span>
                      <span className={styles.playlistFormat}>{track.format}</span>
                      <button
                        className={styles.removeBtn}
                        onClick={e => { e.stopPropagation(); removeTrack(track.id, idx) }}
                        title="Remove"
                      >✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className={styles.statusBar}>
            <span>{isPlaying ? `Playing: ${currentTrack?.name}` : currentTrack ? `Ready: ${currentTrack.name}` : 'Ready'}</span>
            <span>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
          </div>
        </>
      )}

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_FORMATS.map(f => `.${f}`).join(',')}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />
    </div>
  )
}
