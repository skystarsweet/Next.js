/**
 * EEG Signal Processing Library
 *
 * Implements:
 *   1. Biquad IIR filters (lowpass, highpass, notch) — Audio EQ Cookbook approach
 *   2. Butterworth bandpass (cascaded biquads)
 *   3. Artifact detection and soft cancellation
 *   4. Eye movement recognition (blinks, horizontal saccades)
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface FilterParams {
  lowCutHz: number;   // 0 = no highpass
  highCutHz: number;  // 0 = no lowpass
  notchHz: number;    // 0 = no notch
  notchBW: number;    // notch bandwidth in Hz (default 2)
}

export interface ArtifactSegment {
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
  type: 'amplitude' | 'flatline' | 'noise';
  maxAmplitude: number;
}

export interface EyeMovementEvent {
  type: 'blink' | 'saccade_left' | 'saccade_right' | 'slow_drift';
  startSample: number;
  endSample: number;
  startTime: number; // seconds
  endTime: number;
  amplitude: number; // μV peak-to-peak
  channelLabel: string;
}

export interface ProcessedSignal {
  samples: Float64Array;
  artifacts: ArtifactSegment[];
  artifactFraction: number; // 0–1
}

export interface SignalStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  rms: number;
  peakToPeak: number;
}

// ── Biquad filter core ─────────────────────────────────────────────────────

interface BiquadCoeffs {
  b0: number; b1: number; b2: number;
  a0: number; a1: number; a2: number;
}

/** Apply a single biquad section (Direct Form II Transposed). */
function applyBiquad(signal: Float64Array | number[], coeffs: BiquadCoeffs): Float64Array {
  const { b0, b1, b2, a0, a1, a2 } = coeffs;
  const rb0 = b0 / a0, rb1 = b1 / a0, rb2 = b2 / a0;
  const ra1 = a1 / a0, ra2 = a2 / a0;

  const out = new Float64Array(signal.length);
  let w1 = 0, w2 = 0;

  for (let n = 0; n < signal.length; n++) {
    const x = signal[n];
    const y = rb0 * x + w1;
    w1 = rb1 * x - ra1 * y + w2;
    w2 = rb2 * x - ra2 * y;
    out[n] = y;
  }
  return out;
}

/** Apply biquad forward + backward (zero-phase). */
function applyBiquadZeroPhase(signal: Float64Array | number[], coeffs: BiquadCoeffs): Float64Array {
  const forward = applyBiquad(signal, coeffs);
  // Reverse
  const reversed = new Float64Array(forward.length);
  for (let i = 0; i < forward.length; i++) reversed[i] = forward[forward.length - 1 - i];
  const backward = applyBiquad(reversed, coeffs);
  // Reverse back
  const out = new Float64Array(backward.length);
  for (let i = 0; i < backward.length; i++) out[i] = backward[backward.length - 1 - i];
  return out;
}

// ── Filter design (Audio EQ Cookbook) ─────────────────────────────────────

function designLowpass(cutoffHz: number, sampleRate: number, Q = 0.7071): BiquadCoeffs {
  const w0 = 2 * Math.PI * cutoffHz / sampleRate;
  const cosW = Math.cos(w0);
  const sinW = Math.sin(w0);
  const alpha = sinW / (2 * Q);
  return {
    b0: (1 - cosW) / 2,
    b1:  1 - cosW,
    b2: (1 - cosW) / 2,
    a0:  1 + alpha,
    a1: -2 * cosW,
    a2:  1 - alpha,
  };
}

function designHighpass(cutoffHz: number, sampleRate: number, Q = 0.7071): BiquadCoeffs {
  const w0 = 2 * Math.PI * cutoffHz / sampleRate;
  const cosW = Math.cos(w0);
  const sinW = Math.sin(w0);
  const alpha = sinW / (2 * Q);
  return {
    b0:  (1 + cosW) / 2,
    b1: -(1 + cosW),
    b2:  (1 + cosW) / 2,
    a0:  1 + alpha,
    a1: -2 * cosW,
    a2:  1 - alpha,
  };
}

function designNotch(centerHz: number, sampleRate: number, bandwidthHz = 2): BiquadCoeffs {
  const w0 = 2 * Math.PI * centerHz / sampleRate;
  const cosW = Math.cos(w0);
  const Q = centerHz / bandwidthHz;
  const alpha = Math.sin(w0) / (2 * Q);
  return {
    b0:  1,
    b1: -2 * cosW,
    b2:  1,
    a0:  1 + alpha,
    a1: -2 * cosW,
    a2:  1 - alpha,
  };
}

// ── Public filtering API ───────────────────────────────────────────────────

/**
 * Apply bandpass + notch filter chain (zero-phase).
 * Uses cascaded 2nd-order Butterworth sections.
 */
export function filterSignal(
  signal: Float64Array,
  sampleRate: number,
  params: FilterParams
): Float64Array {
  const nyquist = sampleRate / 2;
  let out: Float64Array = new Float64Array(signal);

  // Highpass (low cutoff)
  if (params.lowCutHz > 0 && params.lowCutHz < nyquist) {
    const hp = designHighpass(params.lowCutHz, sampleRate);
    out = applyBiquadZeroPhase(out, hp);
  }

  // Lowpass (high cutoff)
  if (params.highCutHz > 0 && params.highCutHz < nyquist) {
    const lp = designLowpass(params.highCutHz, sampleRate);
    out = applyBiquadZeroPhase(out, lp);
  }

  // Notch filter (power line noise)
  if (params.notchHz > 0 && params.notchHz < nyquist) {
    const bw = params.notchBW > 0 ? params.notchBW : 2;
    const notch = designNotch(params.notchHz, sampleRate, bw);
    out = applyBiquadZeroPhase(out, notch);
    // Also remove 2nd harmonic if present
    const harmonic2 = params.notchHz * 2;
    if (harmonic2 < nyquist) {
      const notch2 = designNotch(harmonic2, sampleRate, bw * 2);
      out = applyBiquadZeroPhase(out, notch2);
    }
  }

  return out;
}

// ── Artifact detection ─────────────────────────────────────────────────────

export interface ArtifactOptions {
  amplitudeThresholdUV: number; // default 150 μV
  flatlineThresholdUV: number;  // default 0.1 μV variation → flatline
  epochSeconds: number;          // epoch length for analysis, default 1 s
}

const DEFAULT_ARTIFACT_OPTS: ArtifactOptions = {
  amplitudeThresholdUV: 150,
  flatlineThresholdUV: 0.1,
  epochSeconds: 0.25,
};

/**
 * Detect artifact segments in a signal.
 * Returns artifact list and a cleaned signal (artifacts zeroed / linearly interpolated).
 */
export function detectAndRemoveArtifacts(
  signal: Float64Array,
  sampleRate: number,
  opts: Partial<ArtifactOptions> = {}
): ProcessedSignal {
  const o = { ...DEFAULT_ARTIFACT_OPTS, ...opts };
  const epochLen = Math.max(1, Math.round(sampleRate * o.epochSeconds));
  const n = signal.length;

  // Per-sample artifact flag
  const isArtifact = new Uint8Array(n);
  const artifacts: ArtifactSegment[] = [];

  for (let i = 0; i < n; i += epochLen) {
    const end = Math.min(i + epochLen, n);
    let maxAbs = 0;
    let sumVal = 0;
    let minEpoch = Infinity, maxEpoch = -Infinity;

    for (let j = i; j < end; j++) {
      const v = signal[j];
      const abs = Math.abs(v);
      if (abs > maxAbs) maxAbs = abs;
      sumVal += v;
      if (v < minEpoch) minEpoch = v;
      if (v > maxEpoch) maxEpoch = v;
    }

    const range = maxEpoch - minEpoch;
    let artifactType: ArtifactSegment['type'] | null = null;

    if (maxAbs > o.amplitudeThresholdUV) {
      artifactType = 'amplitude';
    } else if (range < o.flatlineThresholdUV && end - i > 4) {
      artifactType = 'flatline';
    }

    if (artifactType !== null) {
      for (let j = i; j < end; j++) isArtifact[j] = 1;
      artifacts.push({
        startSample: i,
        endSample: end,
        startTime: i / sampleRate,
        endTime: end / sampleRate,
        type: artifactType,
        maxAmplitude: maxAbs,
      });
    }
  }

  // Merge adjacent artifact segments
  const merged: ArtifactSegment[] = [];
  for (const seg of artifacts) {
    const last = merged[merged.length - 1];
    if (last && seg.startSample <= last.endSample + epochLen) {
      last.endSample = Math.max(last.endSample, seg.endSample);
      last.endTime = last.endSample / sampleRate;
      last.maxAmplitude = Math.max(last.maxAmplitude, seg.maxAmplitude);
    } else {
      merged.push({ ...seg });
    }
  }

  // Artifact cancellation: linear interpolation across artifact spans
  const cleaned = new Float64Array(signal);
  for (const seg of merged) {
    const s = seg.startSample;
    const e = Math.min(seg.endSample, n - 1);
    const startVal = s > 0 ? signal[s - 1] : 0;
    const endVal = e < n - 1 ? signal[e + 1] : 0;
    const span = e - s + 1;
    for (let j = s; j <= e; j++) {
      const t = span > 1 ? (j - s) / (span - 1) : 0;
      cleaned[j] = startVal + t * (endVal - startVal);
    }
  }

  const artifactFraction = isArtifact.reduce((a, b) => a + b, 0) / n;

  return { samples: cleaned, artifacts: merged, artifactFraction };
}

// ── Eye movement recognition ───────────────────────────────────────────────

/** Smooth signal with a simple moving average (causal). */
function movingAverage(signal: Float64Array, windowSamples: number): Float64Array {
  const out = new Float64Array(signal.length);
  let sum = 0;
  const half = Math.floor(windowSamples / 2);
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
    if (i >= windowSamples) sum -= signal[i - windowSamples];
    out[Math.max(0, i - half)] = sum / Math.min(i + 1, windowSamples);
  }
  return out;
}

/** Compute the first derivative (discrete diff). */
function diff(signal: Float64Array, sampleRate: number): Float64Array {
  const out = new Float64Array(signal.length);
  for (let i = 1; i < signal.length; i++) {
    out[i] = (signal[i] - signal[i - 1]) * sampleRate;
  }
  return out;
}

/**
 * Detect eye movement events from EOG channels.
 * @param veogSignal - vertical EOG (or best available EOG channel)
 * @param heogSignal - horizontal EOG (optional)
 * @param sampleRate
 * @param channelLabel
 */
export function detectEyeMovements(
  veogSignal: Float64Array | null,
  heogSignal: Float64Array | null,
  sampleRate: number,
  channelLabel = 'EOG'
): EyeMovementEvent[] {
  const events: EyeMovementEvent[] = [];

  // ── Blink detection (vertical EOG) ──────────────────────────────────────
  if (veogSignal && veogSignal.length > 0) {
    // Filter: 0.5–10 Hz bandpass for blink envelope
    const filtered = filterSignal(veogSignal, sampleRate, {
      lowCutHz: 0.5,
      highCutHz: 10,
      notchHz: 0,
      notchBW: 2,
    });

    // Adaptive threshold: 2.5× std
    let mean = 0, std = 0;
    for (let i = 0; i < filtered.length; i++) mean += Math.abs(filtered[i]);
    mean /= filtered.length;
    for (let i = 0; i < filtered.length; i++) {
      const d = Math.abs(filtered[i]) - mean;
      std += d * d;
    }
    std = Math.sqrt(std / filtered.length);
    const blinkThresh = Math.max(50, mean + 2.5 * std);

    let inBlink = false;
    let blinkStart = 0;
    let blinkPeak = 0;

    for (let i = 0; i < filtered.length; i++) {
      const amp = Math.abs(filtered[i]);
      if (!inBlink && amp > blinkThresh) {
        inBlink = true;
        blinkStart = i;
        blinkPeak = amp;
      } else if (inBlink) {
        if (amp > blinkPeak) blinkPeak = amp;
        if (amp < blinkThresh * 0.4 || i === filtered.length - 1) {
          const durationMs = ((i - blinkStart) / sampleRate) * 1000;
          // Blinks: 80–600 ms
          if (durationMs >= 80 && durationMs <= 600) {
            events.push({
              type: 'blink',
              startSample: blinkStart,
              endSample: i,
              startTime: blinkStart / sampleRate,
              endTime: i / sampleRate,
              amplitude: blinkPeak,
              channelLabel,
            });
          }
          inBlink = false;
        }
      }
    }
  }

  // ── Saccade detection (horizontal EOG) ──────────────────────────────────
  if (heogSignal && heogSignal.length > 0) {
    const filtered = filterSignal(heogSignal, sampleRate, {
      lowCutHz: 0.5,
      highCutHz: 15,
      notchHz: 0,
      notchBW: 2,
    });

    // Velocity signal
    const velocity = diff(filtered, sampleRate);
    const smoothVel = movingAverage(velocity instanceof Float64Array ? velocity : new Float64Array(velocity), Math.max(1, Math.round(sampleRate * 0.01)));

    // Saccade velocity threshold (deg/s ≈ 30; proxy ≈ amplitude-dependent)
    let velMean = 0, velStd = 0;
    for (let i = 0; i < smoothVel.length; i++) velMean += Math.abs(smoothVel[i]);
    velMean /= smoothVel.length;
    for (let i = 0; i < smoothVel.length; i++) {
      const d = Math.abs(smoothVel[i]) - velMean;
      velStd += d * d;
    }
    velStd = Math.sqrt(velStd / smoothVel.length);
    const saccadeThresh = Math.max(500, velMean + 3 * velStd);

    let inSaccade = false;
    let sacStart = 0;
    let sacPeakVel = 0;
    let sacStartAmp = 0;

    for (let i = 0; i < smoothVel.length; i++) {
      const v = Math.abs(smoothVel[i]);
      if (!inSaccade && v > saccadeThresh) {
        inSaccade = true;
        sacStart = i;
        sacPeakVel = v;
        sacStartAmp = filtered[i];
      } else if (inSaccade) {
        if (v > sacPeakVel) sacPeakVel = v;
        if (v < saccadeThresh * 0.3 || i === smoothVel.length - 1) {
          const durationMs = ((i - sacStart) / sampleRate) * 1000;
          // Saccades: 10–200 ms
          if (durationMs >= 10 && durationMs <= 200) {
            const ampChange = filtered[i] - sacStartAmp;
            events.push({
              type: ampChange > 0 ? 'saccade_right' : 'saccade_left',
              startSample: sacStart,
              endSample: i,
              startTime: sacStart / sampleRate,
              endTime: i / sampleRate,
              amplitude: Math.abs(ampChange),
              channelLabel,
            });
          }
          inSaccade = false;
        }
      }
    }
  }

  // Sort events by time
  events.sort((a, b) => a.startTime - b.startTime);
  return events;
}

// ── Signal statistics ──────────────────────────────────────────────────────

export function computeStats(signal: Float64Array): SignalStats {
  if (signal.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, rms: 0, peakToPeak: 0 };
  }

  let sum = 0, sumSq = 0;
  let min = signal[0], max = signal[0];

  for (let i = 0; i < signal.length; i++) {
    const v = signal[i];
    sum += v;
    sumSq += v * v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const mean = sum / signal.length;
  const variance = sumSq / signal.length - mean * mean;
  const std = Math.sqrt(Math.max(0, variance));
  const rms = Math.sqrt(sumSq / signal.length);

  return { mean, std, min, max, rms, peakToPeak: max - min };
}

// ── Batch processing ───────────────────────────────────────────────────────

export interface ProcessingResult {
  filtered: Float64Array;
  processed: ProcessedSignal;
  stats: SignalStats;
  filteredStats: SignalStats;
}

export function processChannel(
  signal: Float64Array,
  sampleRate: number,
  filterParams: FilterParams,
  artifactOpts?: Partial<ArtifactOptions>
): ProcessingResult {
  const filtered = filterSignal(signal, sampleRate, filterParams);
  const processed = detectAndRemoveArtifacts(filtered, sampleRate, artifactOpts);

  return {
    filtered,
    processed,
    stats: computeStats(signal),
    filteredStats: computeStats(filtered),
  };
}
