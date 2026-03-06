/**
 * EDF (European Data Format) and BDF (BioSemi Data Format) file parser.
 *
 * EDF format specification:
 *   - 256-byte global header
 *   - ns × 256-byte per-signal headers
 *   - Data records with 16-bit (EDF) or 24-bit (BDF) signed integers
 *
 * Reference: https://www.edfplus.info/specs/edf.html
 */

export interface EDFHeader {
  version: string;
  patientId: string;
  recordingId: string;
  startDate: string;
  startTime: string;
  headerBytes: number;
  reserved: string;
  numRecords: number;
  recordDuration: number; // seconds per data record
  numSignals: number;
  isBDF: boolean; // BDF uses 24-bit samples
  isEDFPlus: boolean;
}

export interface EDFSignal {
  index: number;
  label: string;
  transducerType: string;
  physicalDimension: string; // unit, e.g. "uV"
  physicalMin: number;
  physicalMax: number;
  digitalMin: number;
  digitalMax: number;
  prefiltering: string;
  samplesPerRecord: number;
  sampleRate: number; // Hz
  samples: Float64Array; // physical values
  isAnnotation: boolean;
}

export interface EDFFile {
  header: EDFHeader;
  signals: EDFSignal[];
  duration: number; // total seconds
  eegChannels: number[]; // indices of likely EEG channels
  eogChannels: number[]; // indices of likely EOG channels
  emgChannels: number[]; // indices of likely EMG channels
}

function readASCII(bytes: Uint8Array, start: number, length: number): string {
  let s = '';
  for (let i = start; i < start + length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s.trim();
}

function classifyChannels(signals: EDFSignal[]): {
  eeg: number[];
  eog: number[];
  emg: number[];
} {
  const eeg: number[] = [];
  const eog: number[] = [];
  const emg: number[] = [];

  const eogLabels = /eog|heog|veog|loc|roc|e1|e2|lefteye|righteye|eye/i;
  const emgLabels = /emg|muscle|chin|ekg|ecg|heart/i;
  const skipLabels = /edf.annotation|status|trigger|stim|mark/i;

  signals.forEach((sig, i) => {
    if (sig.isAnnotation || skipLabels.test(sig.label)) return;
    if (eogLabels.test(sig.label)) {
      eog.push(i);
    } else if (emgLabels.test(sig.label)) {
      emg.push(i);
    } else {
      // Default: treat as EEG
      eeg.push(i);
    }
  });

  return { eeg, eog, emg };
}

export function parseEDF(buffer: ArrayBuffer): EDFFile {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // ── Global header (256 bytes) ─────────────────────────────────────────────
  let pos = 0;

  const version = readASCII(bytes, pos, 8); pos += 8;
  const patientId = readASCII(bytes, pos, 80); pos += 80;
  const recordingId = readASCII(bytes, pos, 80); pos += 80;
  const startDate = readASCII(bytes, pos, 8); pos += 8;
  const startTime = readASCII(bytes, pos, 8); pos += 8;
  const headerBytes = parseInt(readASCII(bytes, pos, 8)); pos += 8;
  const reserved = readASCII(bytes, pos, 44); pos += 44;
  const numRecords = parseInt(readASCII(bytes, pos, 8)); pos += 8;
  const recordDuration = parseFloat(readASCII(bytes, pos, 8)); pos += 8;
  const numSignals = parseInt(readASCII(bytes, pos, 4)); pos += 4;

  const isBDF = version.startsWith('\xFF') || bytes[0] === 0xFF;
  const isEDFPlus = reserved.startsWith('EDF+');

  if (isNaN(numSignals) || numSignals <= 0 || numSignals > 512) {
    throw new Error(`Invalid EDF: numSignals=${numSignals}`);
  }

  // ── Per-signal headers ────────────────────────────────────────────────────
  // Each field is stored sequentially for ALL signals before the next field.
  const labels: string[] = [];
  const transducerTypes: string[] = [];
  const physicalDimensions: string[] = [];
  const physicalMins: number[] = [];
  const physicalMaxs: number[] = [];
  const digitalMins: number[] = [];
  const digitalMaxs: number[] = [];
  const prefilterings: string[] = [];
  const samplesPerRecord: number[] = [];

  for (let i = 0; i < numSignals; i++) { labels.push(readASCII(bytes, pos, 16)); pos += 16; }
  for (let i = 0; i < numSignals; i++) { transducerTypes.push(readASCII(bytes, pos, 80)); pos += 80; }
  for (let i = 0; i < numSignals; i++) { physicalDimensions.push(readASCII(bytes, pos, 8)); pos += 8; }
  for (let i = 0; i < numSignals; i++) { physicalMins.push(parseFloat(readASCII(bytes, pos, 8))); pos += 8; }
  for (let i = 0; i < numSignals; i++) { physicalMaxs.push(parseFloat(readASCII(bytes, pos, 8))); pos += 8; }
  for (let i = 0; i < numSignals; i++) { digitalMins.push(parseInt(readASCII(bytes, pos, 8))); pos += 8; }
  for (let i = 0; i < numSignals; i++) { digitalMaxs.push(parseInt(readASCII(bytes, pos, 8))); pos += 8; }
  for (let i = 0; i < numSignals; i++) { prefilterings.push(readASCII(bytes, pos, 80)); pos += 80; }
  for (let i = 0; i < numSignals; i++) { samplesPerRecord.push(parseInt(readASCII(bytes, pos, 8))); pos += 8; }
  // Skip reserved (32 bytes per signal)
  pos += 32 * numSignals;

  // ── Read data records ─────────────────────────────────────────────────────
  pos = headerBytes; // Start of data section

  // Allocate output arrays
  const totalSamples = samplesPerRecord.map((n) =>
    n * (numRecords > 0 ? numRecords : 1)
  );
  const rawSamples = totalSamples.map((n) => new Float64Array(n));
  const sampleIdx = new Int32Array(numSignals);

  // Precompute gain and offset per signal
  const gains = physicalMins.map((pMin, i) => {
    const dRange = digitalMaxs[i] - digitalMins[i];
    if (dRange === 0) return 1;
    return (physicalMaxs[i] - pMin) / dRange;
  });
  const offsets = physicalMins.map((pMin, i) => pMin - gains[i] * digitalMins[i]);

  const bytesPerSample = isBDF ? 3 : 2;
  const effectiveRecords = numRecords < 0 ? Math.floor((buffer.byteLength - headerBytes) / (samplesPerRecord.reduce((a, b) => a + b, 0) * bytesPerSample)) : numRecords;

  for (let r = 0; r < effectiveRecords; r++) {
    for (let s = 0; s < numSignals; s++) {
      const n = samplesPerRecord[s];
      const gain = gains[s];
      const off = offsets[s];
      const arr = rawSamples[s];
      let idx = sampleIdx[s];

      if (isBDF) {
        // 24-bit little-endian signed integers
        for (let k = 0; k < n; k++, pos += 3) {
          const lo = bytes[pos];
          const mid = bytes[pos + 1];
          const hi = bytes[pos + 2];
          let val = lo | (mid << 8) | (hi << 16);
          // Sign extend from 24-bit
          if (val & 0x800000) val |= 0xFF000000;
          arr[idx++] = gain * val + off;
        }
      } else {
        // 16-bit little-endian signed integers
        for (let k = 0; k < n; k++, pos += 2) {
          const digital = view.getInt16(pos, true);
          arr[idx++] = gain * digital + off;
        }
      }
      sampleIdx[s] = idx;
    }
  }

  // ── Build signal objects ──────────────────────────────────────────────────
  const actualDuration = effectiveRecords * (recordDuration || 1);

  const signals: EDFSignal[] = labels.map((label, i) => ({
    index: i,
    label,
    transducerType: transducerTypes[i],
    physicalDimension: physicalDimensions[i],
    physicalMin: physicalMins[i],
    physicalMax: physicalMaxs[i],
    digitalMin: digitalMins[i],
    digitalMax: digitalMaxs[i],
    prefiltering: prefilterings[i],
    samplesPerRecord: samplesPerRecord[i],
    sampleRate: recordDuration > 0 ? samplesPerRecord[i] / recordDuration : samplesPerRecord[i],
    samples: rawSamples[i].subarray(0, sampleIdx[i]),
    isAnnotation: label.toLowerCase().includes('annotation'),
  }));

  const { eeg, eog, emg } = classifyChannels(signals);

  return {
    header: {
      version,
      patientId,
      recordingId,
      startDate,
      startTime,
      headerBytes,
      reserved,
      numRecords: effectiveRecords,
      recordDuration: recordDuration || 1,
      numSignals,
      isBDF,
      isEDFPlus,
    },
    signals,
    duration: actualDuration,
    eegChannels: eeg,
    eogChannels: eog,
    emgChannels: emg,
  };
}

/** Return display-friendly channel color based on type */
export function getChannelColor(label: string, dim: string): string {
  const l = label.toLowerCase();
  if (/eog|heog|veog|loc|roc/.test(l)) return '#FFD700';  // gold – EOG
  if (/emg|chin|muscle/.test(l)) return '#FF6B6B';         // red – EMG
  if (/ecg|ekg|heart/.test(l)) return '#FF4500';           // orange-red – ECG
  if (/resp|breath/.test(l)) return '#98FB98';              // pale green – resp
  if (/temp/.test(l)) return '#FFA07A';                     // salmon – temp
  return '#4FC3F7';                                          // light blue – EEG
}

/** Format seconds as MM:SS.mmm */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.padStart(5, '0')}`;
  return `${String(m).padStart(2, '0')}:${s.padStart(5, '0')}`;
}
