import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceNote {
  id: string;
  transcript: string;
  audioUrl: string | null;
  duration: number;
  createdAt: number;
  title: string;
  summary: string | null;
  tags: string[];
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  isTranscribing: boolean;
  transcript: string;
  duration: number;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceNote | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: string | null;
  isSupported: boolean;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timer | null>(null);
  const startTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');

  const isSupported = typeof window !== 'undefined' &&
    !!(navigator.mediaDevices?.getUserMedia) &&
    !!(window.MediaRecorder) &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const update = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();
  }, []);

  const stopMonitoringAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      transcriptRef.current = '';
      interimRef.current = '';
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000);

      // Set up Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTranscript = transcriptRef.current;
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) {
              finalTranscript += (finalTranscript ? ' ' : '') + text;
              transcriptRef.current = finalTranscript;
            }
          } else {
            interim += result[0].transcript;
          }
        }

        interimRef.current = interim;
        setTranscript(finalTranscript + (interim ? ' ' + interim : ''));
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.error('Speech recognition error:', event.error);
        }
      };

      recognition.onend = () => {
        // Restart recognition if still recording
        if (mediaRecorderRef.current?.state === 'recording') {
          try {
            recognition.start();
          } catch (e) {
            // Already started
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

      // Start timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);

      setIsRecording(true);
      setIsPaused(false);
      monitorAudioLevel();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to start recording: ' + err.message);
      }
    }
  }, [monitorAudioLevel]);

  const stopRecording = useCallback(async (): Promise<VoiceNote | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      setIsTranscribing(true);

      // Stop recognition
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);

        const finalTranscript = transcriptRef.current.trim() ||
          (interimRef.current ? interimRef.current.trim() : '');

        const note: VoiceNote = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          transcript: finalTranscript || '(No speech detected)',
          audioUrl,
          duration: finalDuration,
          createdAt: Date.now(),
          title: generateTitle(finalTranscript),
          summary: null,
          tags: [],
        };

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        stopMonitoringAudio();
        setIsRecording(false);
        setIsPaused(false);
        setIsTranscribing(false);
        setDuration(0);

        resolve(note);
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    });
  }, [stopMonitoringAudio]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopMonitoringAudio();
      setIsPaused(true);
    }
  }, [stopMonitoringAudio]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started
        }
      }
      startTimeRef.current = Date.now() - duration * 1000;
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
      monitorAudioLevel();
      setIsPaused(false);
    }
  }, [duration, monitorAudioLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      stopMonitoringAudio();
    };
  }, [stopMonitoringAudio]);

  return {
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
  };
}

function generateTitle(transcript: string): string {
  if (!transcript || transcript === '(No speech detected)') {
    return 'Untitled Note';
  }
  const words = transcript.split(/\s+/).slice(0, 6).join(' ');
  return words.length > 40 ? words.substring(0, 40) + '...' : words + (transcript.split(/\s+/).length > 6 ? '...' : '');
}
