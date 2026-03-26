import React, { useState, useRef, useEffect, useCallback, ChangeEvent, DragEvent } from 'react'
import styles from '../styles/MacAudioPlayer.module.css'

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

export default function MacAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
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
  const [visualizerBars, setVisualizerBars] = useState<number[]>(Array(28).fill(2))
  const [titleHovered, setTitleHovered] = useState(false)
  const visualizerRef = useRef<NodeJS.Timeout | null>(null)

  const currentTrack = tracks[currentIndex] ?? null

  useEffect(() => {
    if (isPlaying) {
      visualizerRef.current = setInterval(() => {
        setVisualizerBars(Array(28).fill(0).map((_, i) => {
          const center = 14
          const dist = Math.abs(i - center) / center
          const base = (1 - dist * 0.5) * 32
          return Math.random() * base + 4
        }))
      }, 100)
    } else {
      if (visualizerRef.current) clearInterval(visualizerRef.current)
      setVisualizerBars(Array(28).fill(2))
    }
    return () => { if (visualizerRef.current) clearInterval(visualizerRef.current) }
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

  const play = useCallback(() => { audioRef.current?.play(); setIsPlaying(true) }, [])
  const pause = useCallback(() => { audioRef.current?.pause(); setIsPlaying(false) }, [])

  const playNext = useCallback(() => {
    if (!tracks.length) return
    const next = isShuffle
      ? Math.floor(Math.random() * tracks.length)
      : (currentIndex + 1) % tracks.length
    setCurrentIndex(next)
    setTimeout(() => audioRef.current?.play(), 100)
    setIsPlaying(true)
  }, [currentIndex, tracks.length, isShuffle])

  const playPrev = useCallback(() => {
    if (!tracks.length) return
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      return
    }
    const prev = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1
    setCurrentIndex(prev)
    setTimeout(() => audioRef.current?.play(), 100)
    setIsPlaying(true)
  }, [currentIndex, tracks.length, currentTime])

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
    if (!isSeeking && audioRef.current) setCurrentTime(audioRef.current.currentTime)
  }, [isSeeking])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }, [])

  const handleVolumeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (audioRef.current) { audioRef.current.volume = v / 100; audioRef.current.muted = false }
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
      newTracks.push({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: URL.createObjectURL(file),
        duration: 0,
        format: fmt.toUpperCase(),
      })
    })
    setTracks(prev => {
      if (prev.length === 0 && newTracks.length > 0) setTimeout(() => setCurrentIndex(0), 0)
      return [...prev, ...newTracks]
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
      if (idx === currentIndex && isPlaying) { audioRef.current?.pause(); setIsPlaying(false) }
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

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const volumeIcon = isMuted || volume === 0
    ? <VolumeOff /> : volume < 40
    ? <VolumeLow /> : <VolumeHigh />

  return (
    <div className={`${styles.window} ${isMinimized ? styles.windowMinimized : ''}`}>
      {/* Title Bar */}
      <div
        className={styles.titleBar}
        onMouseEnter={() => setTitleHovered(true)}
        onMouseLeave={() => setTitleHovered(false)}
      >
        <div className={styles.trafficLights}>
          <button className={`${styles.trafficBtn} ${styles.close}`} title="Close">
            {titleHovered && <span>✕</span>}
          </button>
          <button
            className={`${styles.trafficBtn} ${styles.minimize}`}
            onClick={() => setIsMinimized(m => !m)}
            title="Minimize"
          >
            {titleHovered && <span>–</span>}
          </button>
          <button className={`${styles.trafficBtn} ${styles.maximize}`} title="Zoom">
            {titleHovered && <span>+</span>}
          </button>
        </div>
        <span className={styles.titleText}>
          {currentTrack ? currentTrack.name : 'Music'}
        </span>
        <div style={{ width: 52 }} />
      </div>

      {!isMinimized && (
        <div className={styles.body}>
          {/* Left: artwork + controls */}
          <div className={styles.leftPanel}>
            {/* Album Art */}
            <div className={`${styles.artwork} ${isPlaying ? styles.artworkPlaying : ''}`}>
              {currentTrack ? (
                <div className={styles.artworkInner}>
                  <div className={styles.artworkNote}>♫</div>
                  <div className={styles.artworkTitle}>{currentTrack.name}</div>
                  <div className={styles.artworkFormat}>{currentTrack.format}</div>
                </div>
              ) : (
                <div className={styles.artworkEmpty}>
                  <MusicNoteIcon />
                </div>
              )}
            </div>

            {/* Visualizer */}
            <div className={styles.visualizer}>
              {visualizerBars.map((h, i) => (
                <div
                  key={i}
                  className={styles.bar}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>

            {/* Track info */}
            <div className={styles.trackInfo}>
              <div className={styles.trackName}>
                {currentTrack ? currentTrack.name : 'No track selected'}
              </div>
              <div className={styles.trackSub}>
                {currentTrack ? currentTrack.format : 'Add files to get started'}
              </div>
            </div>

            {/* Seek */}
            <div className={styles.seekArea}>
              <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
              <div className={styles.seekTrack}>
                <div className={styles.seekFill} style={{ width: `${progress}%` }} />
                <input
                  type="range"
                  className={styles.seekInput}
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onMouseDown={() => setIsSeeking(true)}
                  onMouseUp={() => setIsSeeking(false)}
                  onChange={handleSeekChange}
                  disabled={!currentTrack}
                />
              </div>
              <span className={styles.timeLabel}>{formatTime(duration)}</span>
            </div>

            {/* Transport */}
            <div className={styles.transport}>
              <button
                className={`${styles.iconBtn} ${isShuffle ? styles.iconBtnActive : ''}`}
                onClick={() => setIsShuffle(s => !s)}
                title="Shuffle"
              ><ShuffleIcon /></button>

              <button
                className={styles.iconBtn}
                onClick={playPrev}
                disabled={!tracks.length}
                title="Previous"
              ><PrevIcon /></button>

              <button
                className={styles.playBtn}
                onClick={isPlaying ? pause : play}
                disabled={!currentTrack}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>

              <button
                className={styles.iconBtn}
                onClick={playNext}
                disabled={!tracks.length}
                title="Next"
              ><NextIcon /></button>

              <button
                className={`${styles.iconBtn} ${repeatMode !== 'none' ? styles.iconBtnActive : ''}`}
                onClick={cycleRepeat}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
              </button>
            </div>

            {/* Volume */}
            <div className={styles.volumeRow}>
              <button className={styles.muteBtn} onClick={toggleMute}>{volumeIcon}</button>
              <div className={styles.volumeTrack}>
                <div
                  className={styles.volumeFill}
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
                <input
                  type="range"
                  className={styles.volumeInput}
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                />
              </div>
              <VolumeHighIcon />
            </div>
          </div>

          {/* Right: playlist */}
          <div
            className={`${styles.playlist} ${isDragging ? styles.playlistDragging : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={styles.playlistTop}>
              <span className={styles.playlistTitle}>Library</span>
              <button
                className={styles.addBtn}
                onClick={() => fileInputRef.current?.click()}
                title="Add files"
              >
                <AddIcon /> Add
              </button>
            </div>

            <div className={styles.playlistList}>
              {tracks.length === 0 ? (
                <div className={styles.emptyState}>
                  <MusicNoteIcon />
                  <p>Drop audio files here</p>
                  <p className={styles.emptyFormats}>
                    {SUPPORTED_FORMATS.map(f => f.toUpperCase()).join(' · ')}
                  </p>
                </div>
              ) : (
                tracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className={`${styles.trackRow} ${idx === currentIndex ? styles.trackRowActive : ''}`}
                    onClick={() => selectTrack(idx)}
                  >
                    <div className={styles.trackRowLeft}>
                      <span className={styles.trackRowIcon}>
                        {idx === currentIndex && isPlaying
                          ? <PlayingWave />
                          : <span className={styles.trackRowNum}>{idx + 1}</span>
                        }
                      </span>
                      <span className={styles.trackRowName}>{track.name}</span>
                    </div>
                    <div className={styles.trackRowRight}>
                      <span className={styles.trackRowFmt}>{track.format}</span>
                      <button
                        className={styles.removeBtn}
                        onClick={e => { e.stopPropagation(); removeTrack(track.id, idx) }}
                      >✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.playlistFooter}>
              {tracks.length} song{tracks.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
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

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  )
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
    </svg>
  )
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M6 18l8.5-6L6 6v12zm2.5-6L16 6v12z" transform="scale(-1,1) translate(-24,0)"/>
      <path d="M16 6h2v12h-2zM6 6l8.5 6-8.5 6V6z"/>
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </svg>
  )
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    </svg>
  )
}

function RepeatOneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 2 .71.71L12 11v4h1z"/>
    </svg>
  )
}

function MusicNoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  )
}

function VolumeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>
    </svg>
  )
}

function VolumeLow() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
    </svg>
  )
}

function VolumeHigh() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  )
}

function VolumeHighIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ opacity: 0.5 }}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  )
}

function AddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  )
}

function PlayingWave() {
  return (
    <span className={styles.wave}>
      <span />
      <span />
      <span />
    </span>
  )
}
