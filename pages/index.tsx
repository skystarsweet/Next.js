import type { NextPage } from 'next';
import Head from 'next/head';
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
} from 'react';
import { parseEDF, getChannelColor, formatTime, EDFFile, EDFSignal } from '../lib/edfParser';
import {
  filterSignal,
  detectAndRemoveArtifacts,
  detectEyeMovements,
  computeStats,
  FilterParams,
  ArtifactSegment,
  EyeMovementEvent,
  SignalStats,
} from '../lib/signalProcessing';

// ── Electron global type ───────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      openFile: () => Promise<{ name: string; path: string; buffer: number[] } | null>;
      saveFileDialog: (opts: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      }) => Promise<string | null>;
      writeFile: (
        filePath: string,
        data: number[]
      ) => Promise<{ success?: boolean; error?: string }>;
      onFileOpened: (cb: (data: { name: string; buffer: number[] }) => void) => void;
      offFileOpened: (cb: (data: { name: string; buffer: number[] }) => void) => void;
    };
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ChannelState {
  visible: boolean;
  scale: number;
  color: string;
  artifacts: ArtifactSegment[];
  artifactFraction: number;
  filteredSamples: Float64Array | null;
  stats: SignalStats | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_FILTER: FilterParams = { lowCutHz: 1, highCutHz: 40, notchHz: 50, notchBW: 2 };
const CHANNEL_HEIGHT_PX = 80;
const LABEL_WIDTH = 110;
const TIME_AXIS_HEIGHT = 28;

// ── EEG Canvas Renderer ────────────────────────────────────────────────────

function renderEEGCanvas(
  canvas: HTMLCanvasElement,
  edfFile: EDFFile,
  channelStates: ChannelState[],
  visibleChannelIndices: number[],
  startTime: number,
  pageSeconds: number,
  showArtifacts: boolean,
  eyeEvents: EyeMovementEvent[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const nCh = visibleChannelIndices.length;
  if (nCh === 0) return;

  const plotW = W - LABEL_WIDTH;
  const plotH = H - TIME_AXIS_HEIGHT;
  const chH = plotH / nCh;

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#12122a';
  ctx.fillRect(0, 0, LABEL_WIDTH, H);

  // Grid
  ctx.strokeStyle = '#1e1e3a';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= nCh; i++) {
    const y = i * chH;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let t = 0; t <= pageSeconds; t++) {
    const x = LABEL_WIDTH + (t / pageSeconds) * plotW;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, plotH); ctx.stroke();
  }

  // Channels
  visibleChannelIndices.forEach((sigIdx, chIdx) => {
    const sig: EDFSignal = edfFile.signals[sigIdx];
    const cs = channelStates[sigIdx];
    if (!cs || !sig) return;

    const midY = chIdx * chH + chH / 2;
    const samples = cs.filteredSamples || sig.samples;
    const sr = sig.sampleRate;
    const startSample = Math.floor(startTime * sr);
    const numSamples = Math.ceil(pageSeconds * sr);
    const endSample = Math.min(startSample + numSamples, samples.length);
    const scale = (chH * 0.45) / (cs.scale || 100);

    // Artifact highlights
    if (showArtifacts && cs.artifacts.length > 0) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.18)';
      for (const art of cs.artifacts) {
        const ax1 = LABEL_WIDTH + ((art.startTime - startTime) / pageSeconds) * plotW;
        const ax2 = LABEL_WIDTH + ((art.endTime - startTime) / pageSeconds) * plotW;
        if (ax2 < LABEL_WIDTH || ax1 > W) continue;
        ctx.fillRect(
          Math.max(ax1, LABEL_WIDTH), chIdx * chH,
          Math.min(ax2, W) - Math.max(ax1, LABEL_WIDTH), chH
        );
      }
    }

    // Waveform
    ctx.strokeStyle = cs.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = Math.max(1, Math.floor((endSample - startSample) / (plotW * 2)));
    let started = false;
    for (let i = startSample; i < endSample; i += step) {
      const x = LABEL_WIDTH + ((i - startSample) / numSamples) * plotW;
      const y = midY - samples[i] * scale;
      const clampedY = Math.max(chIdx * chH + 2, Math.min((chIdx + 1) * chH - 2, y));
      if (!started) { ctx.moveTo(x, clampedY); started = true; }
      else ctx.lineTo(x, clampedY);
    }
    ctx.stroke();

    // Label
    ctx.fillStyle = cs.color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(sig.label.slice(0, 14), LABEL_WIDTH - 6, midY - 2);
    ctx.fillStyle = '#5a5a8a';
    ctx.font = '9px monospace';
    ctx.fillText(`${cs.scale}μV`, LABEL_WIDTH - 6, midY + 11);
    if (cs.artifactFraction > 0.01) {
      ctx.fillStyle = `rgba(255,80,80,${Math.min(1, cs.artifactFraction * 3)})`;
      ctx.font = '8px monospace';
      ctx.fillText(`art:${(cs.artifactFraction * 100).toFixed(0)}%`, LABEL_WIDTH - 6, midY + 22);
    }
  });

  // Eye events
  for (const evt of eyeEvents) {
    if (evt.startTime < startTime || evt.startTime > startTime + pageSeconds) continue;
    const x = LABEL_WIDTH + ((evt.startTime - startTime) / pageSeconds) * plotW;
    const isB = evt.type === 'blink';
    ctx.strokeStyle = isB ? '#FFD700' : '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isB ? '#FFD700' : '#00E5FF';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isB ? 'B' : evt.type === 'saccade_right' ? '→' : '←', x, 10);
  }

  // Time axis
  ctx.fillStyle = '#0a0a20';
  ctx.fillRect(0, plotH, W, TIME_AXIS_HEIGHT);
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, plotH); ctx.lineTo(W, plotH); ctx.stroke();
  ctx.fillStyle = '#7070a0';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  for (let t = 0; t <= pageSeconds; t++) {
    const x = LABEL_WIDTH + (t / pageSeconds) * plotW;
    ctx.fillText(formatTime(startTime + t), x, plotH + 18);
    ctx.strokeStyle = '#2a2a4a'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, plotH); ctx.lineTo(x, plotH + 5); ctx.stroke();
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

const EEGReader: NextPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [edfFile, setEdfFile] = useState<EDFFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [channelStates, setChannelStates] = useState<ChannelState[]>([]);
  const [visibleChannels, setVisibleChannels] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [pageSeconds, setPageSeconds] = useState(10);
  const [eyeEvents, setEyeEvents] = useState<EyeMovementEvent[]>([]);
  const [filterParams, setFilterParams] = useState<FilterParams>(DEFAULT_FILTER);
  const [showArtifacts, setShowArtifacts] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('Load an EDF or BDF file to begin');
  const [reportGenerating, setReportGenerating] = useState(false);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = Math.max(300, visibleChannels.length * CHANNEL_HEIGHT_PX + TIME_AXIS_HEIGHT);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [visibleChannels.length]);

  // Redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !edfFile || visibleChannels.length === 0) return;
    renderEEGCanvas(
      canvas, edfFile, channelStates, visibleChannels,
      startTime, pageSeconds, showArtifacts, eyeEvents
    );
  }, [edfFile, channelStates, visibleChannels, startTime, pageSeconds, showArtifacts, eyeEvents]);

  // Electron file-open from menu
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;
    const handler = (fileData: { name: string; buffer: number[] }) =>
      handleRawFileData(fileData);
    window.electronAPI.onFileOpened(handler);
    return () => window.electronAPI?.offFileOpened(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Core file processing ───────────────────────────────────────────────

  const handleRawFileData = useCallback(
    async (fileData: { name: string; buffer: number[] | ArrayBuffer }) => {
      setProcessing(true);
      setStatus('Parsing EDF file…');
      try {
        let buffer: ArrayBuffer;
        if (fileData.buffer instanceof ArrayBuffer) {
          buffer = fileData.buffer;
        } else {
          buffer = new Uint8Array(fileData.buffer as number[]).buffer;
        }

        const edf = parseEDF(buffer);
        setEdfFile(edf);
        setFileName(fileData.name);
        setStartTime(0);
        setStatus(`Parsed ${edf.signals.length} channels, ${edf.duration.toFixed(1)}s. Applying filters…`);

        const newStates: ChannelState[] = edf.signals.map((sig) => ({
          visible: !sig.isAnnotation,
          scale: 100,
          color: getChannelColor(sig.label, sig.physicalDimension),
          artifacts: [],
          artifactFraction: 0,
          filteredSamples: null,
          stats: null,
        }));

        for (let i = 0; i < edf.signals.length; i++) {
          const sig = edf.signals[i];
          if (sig.isAnnotation || sig.samples.length === 0) continue;
          const filtered = filterSignal(sig.samples, sig.sampleRate, filterParams);
          const { samples: cleaned, artifacts, artifactFraction } =
            detectAndRemoveArtifacts(filtered, sig.sampleRate, { amplitudeThresholdUV: 150 });
          newStates[i] = {
            ...newStates[i],
            filteredSamples: cleaned,
            artifacts,
            artifactFraction,
            stats: computeStats(sig.samples),
          };
        }

        setStatus('Detecting eye movements…');

        // Assign VEOG / HEOG
        let veogSig: Float64Array | null = null;
        let heogSig: Float64Array | null = null;
        let eogLabel = 'EOG';
        let eogSR = 256;

        for (const idx of edf.eogChannels) {
          const lbl = edf.signals[idx].label.toLowerCase();
          const filt = newStates[idx].filteredSamples || edf.signals[idx].samples;
          eogSR = edf.signals[idx].sampleRate;
          if (/veog|vertical/.test(lbl)) { veogSig = filt; eogLabel = edf.signals[idx].label; }
          else if (/heog|horizontal|loc|roc/.test(lbl)) heogSig = filt;
          else if (!veogSig) { veogSig = filt; eogLabel = edf.signals[idx].label; }
          else if (!heogSig) heogSig = filt;
        }

        if (!veogSig && edf.eegChannels.length > 0) {
          const fp = edf.eegChannels.find((i) =>
            /fp1|fp2|af7|af8/.test(edf.signals[i].label.toLowerCase())
          );
          if (fp !== undefined) {
            veogSig = newStates[fp].filteredSamples || edf.signals[fp].samples;
            eogLabel = edf.signals[fp].label;
            eogSR = edf.signals[fp].sampleRate;
          }
        }

        const allEvents =
          veogSig || heogSig
            ? detectEyeMovements(veogSig, heogSig, eogSR, eogLabel)
            : [];
        setEyeEvents(allEvents);
        setChannelStates(newStates);

        const vis = edf.signals
          .map((s, i) => (!s.isAnnotation ? i : -1))
          .filter((i) => i >= 0)
          .slice(0, 16);
        setVisibleChannels(vis);

        const artCh = newStates.filter((cs) => cs.artifactFraction > 0.01).length;
        const blinks = allEvents.filter((e) => e.type === 'blink').length;
        const saccades = allEvents.filter((e) => e.type.startsWith('saccade')).length;
        setStatus(
          `${edf.signals.length} channels · ${edf.duration.toFixed(1)}s · Artifacts: ${artCh} ch · Blinks: ${blinks} · Saccades: ${saccades}`
        );
      } catch (err: unknown) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setProcessing(false);
      }
    },
    [filterParams]
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result instanceof ArrayBuffer) {
          handleRawFileData({ name: file.name, buffer: ev.target.result });
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [handleRawFileData]
  );

  const handleOpenClick = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      const result = await window.electronAPI.openFile();
      if (result) handleRawFileData(result);
    } else {
      fileInputRef.current?.click();
    }
  }, [handleRawFileData]);

  // ── Navigation ─────────────────────────────────────────────────────────

  const maxStartTime = edfFile ? Math.max(0, edfFile.duration - pageSeconds) : 0;
  const navigate = useCallback(
    (delta: number) => setStartTime((t) => Math.max(0, Math.min(t + delta, maxStartTime))),
    [maxStartTime]
  );

  // ── Re-apply filters ───────────────────────────────────────────────────

  const reapplyFilters = useCallback(async () => {
    if (!edfFile) return;
    setProcessing(true);
    setStatus('Re-applying filters…');
    const updated = [...channelStates];
    for (let i = 0; i < edfFile.signals.length; i++) {
      const sig = edfFile.signals[i];
      if (sig.isAnnotation || sig.samples.length === 0) continue;
      const filtered = filterSignal(sig.samples, sig.sampleRate, filterParams);
      const { samples, artifacts, artifactFraction } =
        detectAndRemoveArtifacts(filtered, sig.sampleRate);
      updated[i] = { ...updated[i], filteredSamples: samples, artifacts, artifactFraction };
    }
    setChannelStates(updated);
    setProcessing(false);
    setStatus('Filters applied.');
  }, [edfFile, filterParams, channelStates]);

  // ── PDF Report ─────────────────────────────────────────────────────────

  const generateReport = useCallback(async () => {
    if (!edfFile) return;
    setReportGenerating(true);
    setStatus('Generating PDF report…');
    try {
      const { generatePDFReport } = await import('../lib/reportGenerator');
      const canvasDataURL = canvasRef.current?.toDataURL('image/png');

      const channelReports = edfFile.signals.map((sig, i) => ({
        label: sig.label,
        unit: sig.physicalDimension,
        sampleRate: sig.sampleRate,
        stats: channelStates[i]?.stats || computeStats(sig.samples),
        artifactCount: channelStates[i]?.artifacts.length || 0,
        artifactPercent: channelStates[i]?.artifactFraction || 0,
      }));
      const artifactsData = edfFile.signals.map((sig, i) => ({
        channelLabel: sig.label,
        segments: channelStates[i]?.artifacts || [],
      }));
      const filterDesc = [
        filterParams.lowCutHz > 0 ? `HP: ${filterParams.lowCutHz} Hz` : '',
        filterParams.highCutHz > 0 ? `LP: ${filterParams.highCutHz} Hz` : '',
        filterParams.notchHz > 0 ? `Notch: ${filterParams.notchHz} Hz` : '',
      ].filter(Boolean).join(', ') || 'None';

      const pdfData = await generatePDFReport({
        edfFile, channelReports, artifacts: artifactsData,
        eyeEvents, filterDescription: filterDesc, canvasDataURL,
      });

      const reportName = fileName.replace(/\.(edf|bdf)$/i, '') + '_report.pdf';

      if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
        const savePath = await window.electronAPI.saveFileDialog({
          title: 'Save EEG Report',
          defaultPath: reportName,
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });
        if (savePath) {
          await window.electronAPI.writeFile(savePath, Array.from(pdfData));
          setStatus(`Report saved: ${savePath}`);
        } else {
          setStatus('Save cancelled.');
        }
      } else {
        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = reportName; a.click();
        URL.revokeObjectURL(url);
        setStatus('Report downloaded.');
      }
    } catch (err: unknown) {
      setStatus(`Report error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReportGenerating(false);
    }
  }, [edfFile, channelStates, eyeEvents, filterParams, fileName]);

  // ── Stats ──────────────────────────────────────────────────────────────

  const totalArtifacts = channelStates.reduce((s, cs) => s + cs.artifacts.length, 0);
  const blinkCount = eyeEvents.filter((e) => e.type === 'blink').length;
  const saccadeCount = eyeEvents.filter((e) => e.type.startsWith('saccade')).length;

  // ── JSX ────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>EEG EDF Reader</title>
        <meta name="description" content="EEG EDF/BDF viewer with artifact cancellation and eye movement recognition" />
      </Head>

      <div className="app-root" tabIndex={0} onKeyDown={(e) => {
        if (e.key === 'ArrowRight') navigate(pageSeconds);
        else if (e.key === 'ArrowLeft') navigate(-pageSeconds);
      }}>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <header className="toolbar">
          <div className="toolbar-left">
            <span className="app-title">🧠 EEG EDF Reader</span>
            <button className="btn-primary" onClick={handleOpenClick} disabled={processing}>
              📂 Open EDF / BDF
            </button>
            {edfFile && (
              <button className="btn-secondary" onClick={generateReport}
                disabled={reportGenerating || processing}>
                {reportGenerating ? '⏳ Generating…' : '📄 Export PDF Report'}
              </button>
            )}
          </div>
          <div className="toolbar-right">
            {fileName && <span className="file-name">{fileName}</span>}
            {edfFile && <span className="duration-badge">⏱ {formatTime(edfFile.duration)}</span>}
          </div>
        </header>

        {/* ── Filter Bar ──────────────────────────────────────────────── */}
        {edfFile && (
          <div className="filter-bar">
            <label>HP Hz<input type="number" min="0" max="20" step="0.5"
              value={filterParams.lowCutHz}
              onChange={(e) => setFilterParams((p) => ({ ...p, lowCutHz: +e.target.value }))} />
            </label>
            <label>LP Hz<input type="number" min="0" max="500" step="1"
              value={filterParams.highCutHz}
              onChange={(e) => setFilterParams((p) => ({ ...p, highCutHz: +e.target.value }))} />
            </label>
            <label>Notch Hz<input type="number" min="0" max="500" step="10"
              value={filterParams.notchHz}
              onChange={(e) => setFilterParams((p) => ({ ...p, notchHz: +e.target.value }))} />
            </label>
            <button className="btn-apply" onClick={reapplyFilters} disabled={processing}>
              ⚙ Apply Filters
            </button>
            <label className="toggle-label">
              <input type="checkbox" checked={showArtifacts}
                onChange={(e) => setShowArtifacts(e.target.checked)} />
              Show Artifacts
            </label>
          </div>
        )}

        <div className="main-layout">

          {/* ── Channel Panel ────────────────────────────────────────── */}
          {edfFile && (
            <aside className="channel-panel">
              <h3>Channels</h3>
              <div className="channel-list">
                {edfFile.signals.map((sig, i) => {
                  if (sig.isAnnotation) return null;
                  const cs = channelStates[i];
                  const isVis = visibleChannels.includes(i);
                  return (
                    <div key={i} className={`channel-item${isVis ? ' active' : ''}`}
                      onClick={() => setVisibleChannels((prev) =>
                        prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])}>
                      <span className="ch-dot" style={{ background: cs?.color || '#4FC3F7' }} />
                      <span className="ch-label">{sig.label}</span>
                      {cs?.artifactFraction > 0.01 && <span className="art-warn">⚠</span>}
                    </div>
                  );
                })}
              </div>

              {/* Stats */}
              {visibleChannels.length > 0 && channelStates[visibleChannels[0]]?.stats && (() => {
                const s = channelStates[visibleChannels[0]].stats!;
                return (
                  <div className="stats-panel">
                    <h4>{edfFile.signals[visibleChannels[0]].label}</h4>
                    <table className="stats-table">
                      <tbody>
                        <tr><td>Mean</td><td>{s.mean.toFixed(2)} μV</td></tr>
                        <tr><td>Std</td><td>{s.std.toFixed(2)} μV</td></tr>
                        <tr><td>Min</td><td>{s.min.toFixed(1)} μV</td></tr>
                        <tr><td>Max</td><td>{s.max.toFixed(1)} μV</td></tr>
                        <tr><td>RMS</td><td>{s.rms.toFixed(2)} μV</td></tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Eye summary */}
              {(blinkCount + saccadeCount) > 0 && (
                <div className="info-box">
                  <h4>👁 Eye Movements</h4>
                  <div>Blinks: <strong>{blinkCount}</strong></div>
                  <div>Saccades: <strong>{saccadeCount}</strong></div>
                </div>
              )}

              {/* Artifact summary */}
              <div className="info-box">
                <h4>⚠ Artifacts</h4>
                <div>Segments: <strong>{totalArtifacts}</strong></div>
                <div>Channels: <strong>{channelStates.filter((cs) => cs.artifactFraction > 0.01).length}</strong></div>
              </div>

              {/* Amplitude scale */}
              {visibleChannels.length > 0 && (
                <div className="scale-panel">
                  <h4>Amplitude</h4>
                  {visibleChannels.slice(0, 8).map((i) => (
                    <div key={i} className="scale-row">
                      <span style={{ color: channelStates[i]?.color, fontSize: 11 }}>
                        {edfFile.signals[i].label.slice(0, 8)}
                      </span>
                      <select value={channelStates[i]?.scale || 100}
                        onChange={(e) => setChannelStates((prev) => {
                          const n = [...prev];
                          n[i] = { ...n[i], scale: +e.target.value };
                          return n;
                        })}>
                        {[10, 25, 50, 75, 100, 150, 200, 500, 1000].map((v) => (
                          <option key={v} value={v}>{v}μV</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          )}

          {/* ── Canvas area ──────────────────────────────────────────── */}
          <div className="canvas-area" ref={containerRef}>
            {!edfFile && !processing && (
              <div className="drop-zone" onClick={handleOpenClick}>
                <div className="drop-icon">🧠</div>
                <h2>Open an EDF or BDF File</h2>
                <p>Click here or use File → Open</p>
                <ul className="feature-list">
                  <li>✅ EDF / EDF+ / BDF format support</li>
                  <li>✅ Bandpass &amp; notch filtering</li>
                  <li>✅ Artifact cancellation</li>
                  <li>✅ Eye movement recognition (blinks &amp; saccades)</li>
                  <li>✅ Multi-channel visualization</li>
                  <li>✅ PDF report export</li>
                </ul>
              </div>
            )}
            {processing && (
              <div className="processing-overlay">
                <div className="spinner" />
                <p>Processing EEG data…</p>
              </div>
            )}
            {edfFile && visibleChannels.length > 0 && (
              <canvas ref={canvasRef} className="eeg-canvas"
                style={{ height: `${visibleChannels.length * CHANNEL_HEIGHT_PX + TIME_AXIS_HEIGHT}px` }} />
            )}
            {edfFile && visibleChannels.length === 0 && !processing && (
              <div className="no-channels">Select channels from the left panel.</div>
            )}
          </div>

          {/* ── Event panel ──────────────────────────────────────────── */}
          {edfFile && eyeEvents.length > 0 && (
            <aside className="event-panel">
              <h3>Events ({eyeEvents.length})</h3>
              <div className="event-list">
                {eyeEvents.slice(0, 120).map((evt, i) => (
                  <div key={i}
                    className={`event-item ${evt.type}`}
                    onClick={() => setStartTime(Math.max(0, evt.startTime - pageSeconds / 4))}
                    title="Click to navigate">
                    <span className="ev-time">{formatTime(evt.startTime)}</span>
                    <span className="ev-type">
                      {evt.type === 'blink' ? '👁 Blink' :
                        evt.type === 'saccade_right' ? '→ Right' : '← Left'}
                    </span>
                    <span className="ev-amp">{evt.amplitude.toFixed(0)}μV</span>
                  </div>
                ))}
                {eyeEvents.length > 120 && (
                  <div className="event-more">+{eyeEvents.length - 120} more events</div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* ── Navigation bar ───────────────────────────────────────────── */}
        {edfFile && (
          <nav className="nav-bar">
            <button className="nav-btn" onClick={() => setStartTime(0)} title="Start">⏮</button>
            <button className="nav-btn" onClick={() => navigate(-pageSeconds * 5)}>⏪</button>
            <button className="nav-btn" onClick={() => navigate(-pageSeconds)}>◀</button>
            <input type="range" className="time-slider"
              min={0} max={maxStartTime} step={0.5} value={startTime}
              onChange={(e) => setStartTime(+e.target.value)} />
            <button className="nav-btn" onClick={() => navigate(pageSeconds)}>▶</button>
            <button className="nav-btn" onClick={() => navigate(pageSeconds * 5)}>⏩</button>
            <button className="nav-btn" onClick={() => setStartTime(maxStartTime)}>⏭</button>
            <span className="time-display">{formatTime(startTime)}</span>
            <label className="page-len">
              Page:
              <select value={pageSeconds} onChange={(e) => setPageSeconds(+e.target.value)}>
                {[5, 10, 15, 20, 30, 60].map((s) => (
                  <option key={s} value={s}>{s}s</option>
                ))}
              </select>
            </label>
          </nav>
        )}

        {/* ── Status bar ──────────────────────────────────────────────── */}
        <div className="status-bar">
          {processing && <span>⏳ </span>}
          <span>{status}</span>
          {edfFile && (
            <span className="legend">
              <span style={{ color: '#FFD700' }}>─ Blink</span>{'  '}
              <span style={{ color: '#00E5FF' }}>─ Saccade</span>{'  '}
              <span style={{ color: 'rgba(255,60,60,0.8)' }}>■ Artifact</span>
            </span>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".edf,.bdf"
          style={{ display: 'none' }} onChange={handleFileInputChange} />
      </div>
    </>
  );
};

export default EEGReader;
