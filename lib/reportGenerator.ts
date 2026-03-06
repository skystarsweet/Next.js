/**
 * PDF Report Generator for EEG recordings.
 * Uses jsPDF + jspdf-autotable.
 *
 * Generates:
 *   - Recording information
 *   - Channel summary statistics
 *   - Artifact analysis table
 *   - Eye movement events table
 *   - Signal quality summary
 */

import type { EDFFile } from './edfParser';
import type { ArtifactSegment, EyeMovementEvent, SignalStats } from './signalProcessing';

interface ChannelReport {
  label: string;
  unit: string;
  sampleRate: number;
  stats: SignalStats;
  artifactCount: number;
  artifactPercent: number;
}

interface ReportData {
  edfFile: EDFFile;
  channelReports: ChannelReport[];
  artifacts: { channelLabel: string; segments: ArtifactSegment[] }[];
  eyeEvents: EyeMovementEvent[];
  filterDescription: string;
  canvasDataURL?: string; // optional EEG trace screenshot
}

function fmtNum(n: number, decimals = 2): string {
  if (!isFinite(n)) return 'N/A';
  return n.toFixed(decimals);
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function drawHeader(doc: any, title: string, pageWidth: number) {
  // Dark header band
  doc.setFillColor(15, 15, 40);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(79, 195, 247); // #4FC3F7
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 200);
  doc.text(
    `Generated: ${new Date().toLocaleString()}   |   EEG EDF Reader v1.0`,
    14,
    22
  );
}

function drawSection(doc: any, title: string, y: number): number {
  doc.setFillColor(30, 30, 60);
  doc.rect(14, y, doc.internal.pageSize.getWidth() - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(79, 195, 247);
  doc.text(title, 16, y + 5.5);
  return y + 12;
}

export async function generatePDFReport(data: ReportData): Promise<Uint8Array> {
  // Lazy import to avoid SSR issues
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - 2 * margin;

  // ── Page 1: Recording Info ──────────────────────────────────────────────
  drawHeader(doc, 'EEG Recording Report', pageWidth);

  let y = 36;

  // Recording metadata
  y = drawSection(doc, 'Recording Information', y);

  const h = data.edfFile.header;
  const infoRows = [
    ['Patient ID', h.patientId || 'N/A'],
    ['Recording ID', h.recordingId || 'N/A'],
    ['Start Date', h.startDate || 'N/A'],
    ['Start Time', h.startTime || 'N/A'],
    ['Duration', fmtTime(data.edfFile.duration)],
    ['Total Channels', String(data.edfFile.signals.length)],
    ['EEG Channels', String(data.edfFile.eegChannels.length)],
    ['EOG Channels', String(data.edfFile.eogChannels.length)],
    ['EMG Channels', String(data.edfFile.emgChannels.length)],
    ['Format', h.isBDF ? 'BDF (24-bit)' : h.isEDFPlus ? 'EDF+ (16-bit)' : 'EDF (16-bit)'],
    ['Data Records', String(h.numRecords)],
    ['Record Duration', `${h.recordDuration} s`],
    ['Applied Filters', data.filterDescription],
  ];

  (doc as any).autoTable({
    startY: y,
    head: [],
    body: infoRows,
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: [20, 20, 50], textColor: [160, 160, 200] },
      1: { fillColor: [255, 255, 255] },
    },
    styles: { fontSize: 9, cellPadding: 2 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Channel Statistics ──────────────────────────────────────────────────
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }
  y = drawSection(doc, 'Channel Statistics', y);

  const statsHead = [['Channel', 'Unit', 'Fs (Hz)', 'Mean', 'Std Dev', 'Min', 'Max', 'RMS', 'Artifacts %']];
  const statsBody = data.channelReports.map((ch) => [
    ch.label,
    ch.unit || 'uV',
    fmtNum(ch.sampleRate, 1),
    fmtNum(ch.stats.mean, 1),
    fmtNum(ch.stats.std, 1),
    fmtNum(ch.stats.min, 1),
    fmtNum(ch.stats.max, 1),
    fmtNum(ch.stats.rms, 1),
    fmtNum(ch.artifactPercent * 100, 1) + '%',
  ]);

  (doc as any).autoTable({
    startY: y,
    head: statsHead,
    body: statsBody,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [15, 15, 40], textColor: [79, 195, 247], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: [245, 245, 255] },
    styles: { overflow: 'linebreak' },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Artifact Summary ────────────────────────────────────────────────────
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }
  y = drawSection(doc, 'Artifact Analysis', y);

  const totalArtifactCount = data.artifacts.reduce((s, a) => s + a.segments.length, 0);
  const artifactSummaryRows: string[][] = [];
  for (const ch of data.artifacts) {
    const totalDuration = ch.segments.reduce((s, seg) => s + (seg.endTime - seg.startTime), 0);
    const amplArtifacts = ch.segments.filter((s) => s.type === 'amplitude').length;
    const flatArtifacts = ch.segments.filter((s) => s.type === 'flatline').length;
    if (ch.segments.length > 0) {
      artifactSummaryRows.push([
        ch.channelLabel,
        String(ch.segments.length),
        fmtNum(totalDuration, 2) + ' s',
        String(amplArtifacts),
        String(flatArtifacts),
      ]);
    }
  }

  if (artifactSummaryRows.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(80, 160, 80);
    doc.text('No artifacts detected in any channel.', margin, y + 5);
    y += 12;
  } else {
    (doc as any).autoTable({
      startY: y,
      head: [['Channel', 'Total Segments', 'Total Duration', 'High Amplitude', 'Flatline']],
      body: artifactSummaryRows,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [15, 15, 40], textColor: [79, 195, 247], fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [255, 248, 245] },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 140);
    doc.text(`Total artifact segments across all channels: ${totalArtifactCount}`, margin, y + 4);
    y += 10;
  }

  // ── Eye Movement Events ─────────────────────────────────────────────────
  if (y > pageHeight - 70) { doc.addPage(); y = 20; }
  y = drawSection(doc, 'Eye Movement Events', y);

  const blinkEvents = data.eyeEvents.filter((e) => e.type === 'blink');
  const saccadeR = data.eyeEvents.filter((e) => e.type === 'saccade_right');
  const saccadeL = data.eyeEvents.filter((e) => e.type === 'saccade_left');

  const eyeSummary = [
    ['Blinks detected', String(blinkEvents.length)],
    ['Right saccades', String(saccadeR.length)],
    ['Left saccades', String(saccadeL.length)],
    [
      'Average blink amplitude',
      blinkEvents.length > 0
        ? fmtNum(blinkEvents.reduce((s, e) => s + e.amplitude, 0) / blinkEvents.length) + ' μV'
        : 'N/A',
    ],
    [
      'Average saccade amplitude',
      saccadeR.length + saccadeL.length > 0
        ? fmtNum(
            [...saccadeR, ...saccadeL].reduce((s, e) => s + e.amplitude, 0) /
              (saccadeR.length + saccadeL.length)
          ) + ' μV'
        : 'N/A',
    ],
  ];

  (doc as any).autoTable({
    startY: y,
    body: eyeSummary,
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65, fillColor: [20, 20, 50], textColor: [160, 160, 200] },
      1: { fillColor: [255, 255, 255] },
    },
    styles: { fontSize: 9, cellPadding: 2 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Detailed eye event list (up to 50 events)
  if (data.eyeEvents.length > 0) {
    if (y > pageHeight - 70) { doc.addPage(); y = 20; }

    const eventsToShow = data.eyeEvents.slice(0, 50);
    const eventRows = eventsToShow.map((e) => [
      fmtTime(e.startTime),
      e.type === 'blink' ? 'Blink' : e.type === 'saccade_right' ? 'Saccade →' : 'Saccade ←',
      fmtNum((e.endTime - e.startTime) * 1000, 0) + ' ms',
      fmtNum(e.amplitude, 1) + ' μV',
      e.channelLabel,
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [['Time', 'Event Type', 'Duration', 'Amplitude', 'Channel']],
      body: eventRows,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [15, 15, 40], textColor: [79, 195, 247], fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [245, 255, 245] },
    });

    if (data.eyeEvents.length > 50) {
      y = (doc as any).lastAutoTable.finalY + 3;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 140);
      doc.text(
        `... and ${data.eyeEvents.length - 50} more events (showing first 50)`,
        margin,
        y + 4
      );
    }
  }

  // ── EEG trace snapshot ──────────────────────────────────────────────────
  if (data.canvasDataURL) {
    doc.addPage();
    drawHeader(doc, 'EEG Trace Snapshot', pageWidth);
    y = 36;
    y = drawSection(doc, 'Signal Visualization', y);
    try {
      doc.addImage(data.canvasDataURL, 'PNG', margin, y, contentWidth, contentWidth * 0.45);
    } catch {
      // ignore image errors
    }
  }

  // ── Footer on all pages ─────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 160);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.text('EEG EDF Reader — for research use only', margin, pageHeight - 6);
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
