# EEG EDF Reader — Build Instructions

## Features

- **EDF / EDF+ / BDF file parsing** — full binary format support, 16-bit and 24-bit samples
- **Multi-channel EEG visualization** — custom canvas renderer, up to 16 visible channels
- **Artifact cancellation** — bandpass filter (1–40 Hz), notch filter (50/60 Hz), amplitude threshold rejection with linear interpolation
- **Eye movement recognition** — blink detection (vertical EOG) and saccade detection (horizontal EOG/frontal channels)
- **PDF report export** — recording info, channel statistics, artifact summary, eye movement events table
- **Standalone Windows EXE** — packaged via Electron + electron-builder

---

## Quick Start (development)

```bash
npm install
npm run electron-dev      # Opens Electron with Next.js dev server
```

---

## Build for Windows

```bash
npm install
npm run dist:win
```

Outputs to `dist/`:
- `EEG EDF Reader Setup x.x.x.exe` — NSIS installer
- `EEG EDF Reader x.x.x.exe` — portable executable

### Requirements for Windows build:
- Node.js 18+ (works on any OS for cross-compilation)
- On Windows: no extra dependencies
- On Linux/macOS: Wine is needed for native Windows icons (optional)

---

## Build for all platforms

```bash
npm run dist           # Current platform
electron-builder --linux   # AppImage
electron-builder --mac     # DMG
electron-builder --win     # NSIS + Portable EXE
```

---

## Architecture

```
/
├── electron/
│   ├── main.js          Electron main process — BrowserWindow, IPC, file dialog
│   └── preload.js       contextBridge — exposes electronAPI to renderer
├── lib/
│   ├── edfParser.ts     EDF/BDF binary parser (16-bit + 24-bit samples)
│   ├── signalProcessing.ts  Biquad IIR filters, artifact detection, eye movement recognition
│   └── reportGenerator.ts   jsPDF-based PDF report generator
├── pages/
│   └── index.tsx        Main EEG viewer React component + canvas renderer
├── styles/
│   └── globals.css      Dark-theme UI
├── out/                 Static export (created by `npm run export`)
└── dist/                Windows EXE output (created by `npm run dist:win`)
```

---

## Signal Processing Details

### Filtering (zero-phase IIR)
- **Highpass (HP)**: 2nd-order Butterworth, default 1 Hz — removes slow DC drift
- **Lowpass (LP)**: 2nd-order Butterworth, default 40 Hz — removes high-frequency noise
- **Notch**: default 50 Hz (+ 2nd harmonic at 100 Hz) — removes power-line interference

Zero-phase filtering is achieved via forward + backward pass (equivalent to `filtfilt`).

### Artifact Detection
- **Amplitude**: epochs exceeding ±150 μV are flagged (configurable)
- **Flatline**: epochs with < 0.1 μV variation flagged as disconnected electrode
- **Cancellation**: artifact spans replaced by linear interpolation

### Eye Movement Recognition
- **Blinks**: detected on VEOG/frontal channels — peaks 80–600 ms, threshold = 2.5× std
- **Saccades**: detected on HEOG — velocity threshold = 3× std of velocity signal, duration 10–200 ms
- Channels are auto-detected by label (EOG, VEOG, HEOG, LOC, ROC, Fp1, Fp2, etc.)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` | Next page |
| `←` | Previous page |
| `Ctrl+O` | Open file (Electron only) |
