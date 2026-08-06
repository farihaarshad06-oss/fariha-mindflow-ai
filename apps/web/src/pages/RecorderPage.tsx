import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  Mic, Square, Pause, Play, AlertTriangle, CheckCircle2, HardDrive,
  Shield, FileText, Radio, FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardBody,
  Button,
  Alert,
  Badge,
  Spinner,
  Select,
} from '@mindflow/ui';
import { FILE_LIMITS } from '@mindflow/config';
import { normalizeLanguageCode } from '../lib/language';
import { useLectureStore } from '../store/lecture';

// ── Types ──────────────────────────────────────────────────────────────────

type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'done'
  | 'error';

type RecorderError =
  | 'permissionDenied'
  | 'unsupported'
  | 'noMic'
  | 'interrupted'
  | 'emptyAudio'
  | 'maxLength'
  | 'saveFailed'
  | 'diskFull'
  | 'noLectureId'
  | null;

interface MicDevice {
  deviceId: string;
  label: string;
}

const CHUNK_INTERVAL_MS = 5 * 1000; // 5 seconds — matches main-process CHUNK_DURATION_MS

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

// ── Component ──────────────────────────────────────────────────────────────

export function RecorderPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const selectedLecture = useLectureStore((s) => s.selectedLecture);

  // lectureId MUST come from navigation state (set by NewLecturePage after
  // creating the lecture in the Electron database). A fake timestamp-based ID
  // fails Zod .cuid() validation in every IPC handler.
  const navState = (location.state ?? {}) as { lectureId?: string; lectureTitle?: string };
  const lectureId = navState.lectureId ?? selectedLecture?.id ?? '';
  const lectureTitle = navState.lectureTitle ?? selectedLecture?.title;

  const [consent, setConsent] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<RecorderError>(null);
  const [seconds, setSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 24 }, () => 0.3));
  const [audioLevel, setAudioLevel] = useState(0);
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [diskFreeBytes, setDiskFreeBytes] = useState<number | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [importantTimes, setImportantTimes] = useState<number[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveTranscriptActive, setLiveTranscriptActive] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState(() => normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language));

  const liveTranscriptRef = useRef<HTMLDivElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentChunkRef = useRef<BlobPart[]>([]);
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const secondsRef = useRef(0);
  // Keep a ref so onstop/flushChunk always see the current sessionId even when
  // the callback was created before setSessionId() was called.
  const sessionIdRef = useRef<string | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  const supported =
    typeof window !== 'undefined' &&
    'MediaRecorder' in window &&
    !!navigator.mediaDevices?.getUserMedia;

  // ── Enumerate microphones ────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const audioInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}` }));
      setMics(audioInputs);
      if (audioInputs.length > 0 && !selectedMic) {
        setSelectedMic(audioInputs[0]?.deviceId ?? '');
      }
    });
  }, []);

  useEffect(() => {
    if (!isDesktop || !window.electronAPI) return;
    void (async () => {
      const res = await window.electronAPI.getSettings();
      if (!res.ok || !res.data) return;
      const desktopSettings = res.data as {
        preferredLanguage?: string;
        recordingConsentGiven?: boolean;
        privacyModeDefault?: boolean;
      };
      setPreferredLanguage(normalizeLanguageCode(desktopSettings.preferredLanguage));
      setConsent(Boolean(desktopSettings.recordingConsentGiven));
      setPrivacyMode(Boolean(desktopSettings.privacyModeDefault));
    })();
  }, [isDesktop, lectureId]);

  // ── Disk space monitor ───────────────────────────────────────────────
  useEffect(() => {
    const checkDisk = async () => {
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.checkDiskSpace();
        if (res.ok && res.data) setDiskFreeBytes(res.data.freeBytes);
      } else if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        setDiskFreeBytes((est.quota ?? 0) - (est.usage ?? 0));
      }
    };
    void checkDisk();
    const id = setInterval(() => void checkDisk(), 30_000);
    return () => clearInterval(id);
  }, [isDesktop, lectureId]);

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimers();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Recording error listener ─────────────────────────────────────────
  useEffect(() => {
    if (!isDesktop || !window.electronAPI) return;
    const unsub = window.electronAPI.onRecordingError((data) => {
      if (data.code === 'INSUFFICIENT_DISK_SPACE') {
        setError('diskFull');
        void stopRecording();
      } else {
        setError('interrupted');
        setStatus('error');
      }
    });
    return unsub;
  }, [isDesktop, sessionId]);

  // ── Live transcript listener ─────────────────────────────────────────
  useEffect(() => {
    if (!isDesktop || !window.electronAPI) return;
    const unsub = window.electronAPI.onLiveTranscript((data) => {
      if (data.lectureId !== lectureId) return;
      if (data.partial) {
        // Append text from newly transcribed segments
        const newText = data.segments.map((s) => s.text).join(' ').trim();
        if (newText) {
          setLiveTranscript((prev) => (prev ? `${prev} ${newText}` : newText));
          setLiveTranscriptActive(true);
          // Fade the "live" pulse after 2 seconds of no new text
          setTimeout(() => setLiveTranscriptActive(false), 2000);
        }
      }
    });
    return unsub;
  }, [isDesktop, lectureId]);

  // ── Auto-scroll live transcript to bottom ────────────────────────────
  useEffect(() => {
    if (liveTranscriptRef.current) {
      liveTranscriptRef.current.scrollTop = liveTranscriptRef.current.scrollHeight;
    }
  }, [liveTranscript]);

  // ── Helpers ──────────────────────────────────────────────────────────
  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveRef.current) clearInterval(waveRef.current);
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
  }

  function startTimers() {
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= FILE_LIMITS.maxRecordingSeconds) {
        void stopRecording();
      }
    }, 1000);
    waveRef.current = setInterval(() => {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setAudioLevel(avg);
        setWaveform((prev) =>
          prev.map(() => 0.1 + avg * 0.9 + Math.random() * 0.1)
        );
      } else {
        setWaveform((prev) => prev.map(() => 0.2 + Math.random() * 0.6));
      }
    }, 100);
  }

  // ── Flush current chunk to disk/IPC ─────────────────────────────────
  const flushChunk = useCallback(async (data: BlobPart[], idx: number, startOffsetMs: number) => {
    if (data.length === 0) return;
    const blob = new Blob(data, { type: 'audio/webm;codecs=opus' });
    const arrayBuffer = await blob.arrayBuffer();

    // Use the ref so we always get the current sessionId even if this callback
    // was closed over before setSessionId() was called in startRecording.
    const currentSessionId = sessionIdRef.current;

    if (isDesktop && window.electronAPI && currentSessionId) {
      const res = await window.electronAPI.saveAudioChunk({
        sessionId: currentSessionId,
        lectureId,
        index: idx,
        arrayBuffer,
        durationMs: CHUNK_INTERVAL_MS,
        startOffsetMs,
      });
      if (!res.ok) {
        if (res.error?.includes('INSUFFICIENT_DISK_SPACE')) {
          setError('diskFull');
          void stopRecording();
        } else {
          console.error('[recorder] chunk save failed:', res.error);
        }
      }
    } else if (isDesktop && window.electronAPI && !currentSessionId) {
      // Session ID not yet set — this can happen if startRecording IPC call is
      // still in-flight. Log clearly so the issue is visible.
      console.error('[recorder] flushChunk called with no sessionId — chunk lost for index', idx);
    } else {
      // Browser fallback: save to IndexedDB/memory (non-persistent)
      const fileName = `${lectureId}-chunk-${String(idx).padStart(4, '0')}.webm`;
      if (window.electronAPI) {
        void window.electronAPI.saveAudio(fileName, arrayBuffer);
      }
    }
  }, [isDesktop, lectureId]);

  // ── Start recording ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!supported) { setError('unsupported'); setStatus('error'); return; }
    // In Electron the lectureId must be a real CUID obtained from the database.
    // If none was supplied via navigation state the user shouldn't be here — show an error.
    if (isDesktop && !lectureId) { setError('noLectureId'); setStatus('error'); return; }
    setStatus('requesting');
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!stream.getAudioTracks().length) { setError('noMic'); setStatus('error'); return; }

      streamRef.current = stream;

      // Audio analyser for real level monitoring
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch { /* analyser setup optional */ }

      // Create a persistent session in main process
      let newSessionId: string | null = null;
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.startRecording({
          lectureId,
          microphoneId: selectedMic,
          privacyMode,
          language: preferredLanguage,
        });
        if (res.ok && res.data) {
          newSessionId = (res.data as { id: string }).id;
          sessionIdRef.current = newSessionId;
          setSessionId(newSessionId);
        } else if (!res.ok) {
          // Surface the IPC error so it's not silently swallowed
          setError('interrupted');
          setStatus('error');
          console.error('[recorder] startRecording IPC error:', res.error);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
      }

      // Set up MediaRecorder with 5-minute chunk rotation
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      currentChunkRef.current = [];
      chunkIndexRef.current = 0;
      secondsRef.current = 0;
      setChunkIndex(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) currentChunkRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const data = [...currentChunkRef.current];
        const idx = chunkIndexRef.current;
        const offset = idx * CHUNK_INTERVAL_MS;
        currentChunkRef.current = [];
        if (data.length > 0) void flushChunk(data, idx, offset);
      };

      recorder.onerror = () => { setError('interrupted'); setStatus('error'); };

      mediaRecorderRef.current = recorder;
      // Request data every second so we get regular ondataavailable events
      recorder.start(1000);

      // Rotate chunk every 5 minutes
      chunkTimerRef.current = setInterval(async () => {
        const data = [...currentChunkRef.current];
        const idx = chunkIndexRef.current;
        currentChunkRef.current = [];
        chunkIndexRef.current += 1;
        setChunkIndex(chunkIndexRef.current);
        await flushChunk(data, idx, idx * CHUNK_INTERVAL_MS);
      }, CHUNK_INTERVAL_MS);

      setStatus('recording');
      startTimers();
    } catch (e) {
      const isPermission = e instanceof DOMException && e.name === 'NotAllowedError';
      setError(isPermission ? 'permissionDenied' : 'interrupted');
      setStatus('error');
    }
  }, [supported, selectedMic, privacyMode, isDesktop, lectureId, flushChunk, preferredLanguage]);

  // ── Pause ────────────────────────────────────────────────────────────
  const pauseRecording = useCallback(async () => {
    mediaRecorderRef.current?.pause();
    clearTimers();
    setStatus('paused');
    if (isDesktop && window.electronAPI && sessionId) {
      await window.electronAPI.pauseRecording(sessionId);
    }
  }, [isDesktop, sessionId]);

  // ── Resume ───────────────────────────────────────────────────────────
  const resumeRecording = useCallback(async () => {
    mediaRecorderRef.current?.resume();
    startTimers();
    setStatus('recording');
    if (isDesktop && window.electronAPI && sessionId) {
      await window.electronAPI.resumeRecording(sessionId);
    }
  }, [isDesktop, sessionId]);

  // ── Stop ─────────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    clearTimers();
    setStatus('stopping');
    const recorder = mediaRecorderRef.current;
    const stopPromise = recorder
      ? new Promise<void>((resolve) => {
          recorder.addEventListener('stop', () => resolve(), { once: true });
        })
      : Promise.resolve();
    recorder?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    await stopPromise;

    if (isDesktop && window.electronAPI && sessionId) {
      await window.electronAPI.stopRecording(sessionId);
    }
    setStatus('done');
  }, [isDesktop, sessionId]);

  const reset = () => {
    setStatus('idle');
    setError(null);
    setSeconds(0);
    secondsRef.current = 0;
    setImportantTimes([]);
    setSessionId(null);
    sessionIdRef.current = null;
    setChunkIndex(0);
    setAudioLevel(0);
    setWaveform(Array.from({ length: 24 }, () => 0.3));
    setLiveTranscript('');
    setLiveTranscriptActive(false);
  };

  const markImportant = () => setImportantTimes((prev) => [...prev, seconds]);

  const errorMessages: Record<Exclude<RecorderError, null>, string> = {
    permissionDenied: t('recorder.permissionDenied'),
    unsupported: t('recorder.unsupported'),
    noMic: t('recorder.noMic'),
    interrupted: t('recorder.interrupted'),
    emptyAudio: t('recorder.emptyAudio'),
    maxLength: t('recorder.maxLength'),
    saveFailed: t('recorder.uploadFailed'),
    diskFull: 'Insufficient disk space. Recording stopped.',
    noLectureId: 'No lecture selected. Please go back and create or select a lecture before recording.',
  };

  const diskFreeGb = diskFreeBytes !== null ? (diskFreeBytes / 1024 / 1024 / 1024).toFixed(1) : null;
  const diskWarning = diskFreeBytes !== null && diskFreeBytes < 500 * 1024 * 1024;
  const estimatedMinsRemaining = diskFreeBytes !== null
    ? Math.floor(diskFreeBytes / (1024 * 1024 * 0.5)) // ~0.5 MB/min for opus
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {lectureTitle ? `${t('recorder.title')}: ${lectureTitle}` : t('recorder.title')}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {status === 'idle' ? 'Ready to record' : status === 'recording' ? 'Recording in progress…' : status === 'paused' ? 'Recording paused' : status === 'done' ? 'Saved successfully' : ''}
        </p>
      </div>

      {/* Disk warning card */}
      <AnimatePresence>
        {diskWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-amber-200 bg-amber-50">
              <CardBody>
                <div className="flex items-start gap-3">
                  <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-800">Low Disk Space</p>
                    <p className="text-sm text-amber-700">
                      {diskFreeGb} GB remaining
                      {estimatedMinsRemaining !== null && ` · ~${estimatedMinsRemaining} min of recording left`}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-600">Recording will stop automatically when disk is full.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (isDesktop && window.electronAPI && 'openStorageSettings' in window.electronAPI) {
                          void (window.electronAPI as Record<string, () => void>).openStorageSettings?.();
                        }
                      }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Open Storage
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Microphone selection */}
      {mics.length > 1 && status === 'idle' && (
        <Card>
          <CardBody>
            <Select
              label={t('recorder.micStatus')}
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
              className="max-w-xs"
            >
              {mics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
              ))}
            </Select>
          </CardBody>
        </Card>
      )}

      {/* Main recording card */}
      <Card>
        <CardBody className="flex flex-col items-center gap-6 py-10">
          {/* Waveform visualizer */}
          <div
            className="flex items-center gap-[3px]"
            aria-hidden="true"
            data-testid="waveform"
          >
            {waveform.map((value, index) => (
              <motion.span
                key={index}
                className={`w-1.5 rounded-full ${
                  status === 'recording'
                    ? audioLevel > 0.5 ? 'bg-red-500' : 'bg-brand-500'
                    : status === 'paused'
                    ? 'bg-amber-400'
                    : 'bg-slate-200'
                }`}
                animate={{ height: `${Math.max(6, value * 64)}px` }}
                transition={{ duration: 0.1 }}
                style={{ height: `${Math.max(6, value * 64)}px` }}
              />
            ))}
          </div>

          {/* Large timer */}
          <div
            className="font-mono text-5xl font-bold tabular-nums text-slate-900"
            aria-live="polite"
          >
            {formatTime(seconds)}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {status === 'recording' && (
              <Badge tone="danger">
                <Radio className="me-1 h-3 w-3 animate-pulse" aria-hidden="true" />
                RECORDING
              </Badge>
            )}
            {status === 'paused' && <Badge tone="warning">⏸ PAUSED</Badge>}
            {status === 'stopping' && <Badge tone="info">SAVING…</Badge>}
            {status === 'done' && (
              <Badge tone="success">
                <CheckCircle2 className="me-1 h-3.5 w-3.5" /> SAVED
              </Badge>
            )}
            {chunkIndex > 0 && (status === 'recording' || status === 'paused') && (
              <Badge tone="neutral">Chunk {chunkIndex + 1}</Badge>
            )}
            {privacyMode && (
              <Badge tone="warning">
                <Shield className="me-1 h-3 w-3" aria-hidden="true" /> Privacy Mode
              </Badge>
            )}
          </div>

          {/* Consent + privacy options (idle only) */}
          {status === 'idle' && (
            <div className="w-full max-w-sm space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-slate-700">{t('recorder.giveConsent')}</span>
                <input
                  type="checkbox"
                  data-testid="consent-checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Shield className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                  Privacy mode
                </span>
                <input
                  type="checkbox"
                  checked={privacyMode}
                  onChange={(e) => setPrivacyMode(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
            </div>
          )}

          {!consent && status === 'idle' && (
            <p data-testid="consent-notice" className="text-xs text-amber-600">
              {t('recorder.consentRequired')}
            </p>
          )}

          {/* Controls */}
          <div className="flex items-center gap-3">
            {(status === 'idle' || status === 'error') && (
              <Button
                data-testid="record-button"
                disabled={!consent}
                onClick={() => void startRecording()}
                aria-label={t('recorder.record')}
                className="gap-2 px-6"
              >
                <Mic className="h-5 w-5" aria-hidden="true" /> {t('recorder.record')}
              </Button>
            )}
            {status === 'recording' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void pauseRecording()}
                  aria-label={t('recorder.pause')}
                  className="h-12 w-12 rounded-full p-0"
                >
                  <Pause className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void stopRecording()}
                  aria-label={t('recorder.stop')}
                  className="h-12 w-12 rounded-full p-0"
                >
                  <Square className="h-5 w-5" aria-hidden="true" />
                </Button>
              </>
            )}
            {status === 'paused' && (
              <>
                <Button
                  onClick={() => void resumeRecording()}
                  aria-label={t('recorder.resume')}
                  className="h-12 w-12 rounded-full p-0"
                >
                  <Play className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void stopRecording()}
                  aria-label={t('recorder.stop')}
                  className="h-12 w-12 rounded-full p-0"
                >
                  <Square className="h-5 w-5" aria-hidden="true" />
                </Button>
              </>
            )}
            {status === 'stopping' && <Spinner label="Saving…" />}
          </div>

          {/* Mark important */}
          {(status === 'recording' || status === 'paused') && (
            <Button variant="ghost" onClick={markImportant} aria-label={t('recorder.markImportant')}>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t('recorder.markImportant')}
              {importantTimes.length > 0 && ` (${importantTimes.length})`}
            </Button>
          )}

          {/* Done state */}
          {status === 'done' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-600">
                Recording saved.{privacyMode ? ' Transcription skipped (privacy mode).' : ' Transcription queued.'}
              </p>
              <Button variant="secondary" onClick={reset}>{t('common.back')}</Button>
            </motion.div>
          )}

          {/* Disk info strip */}
          {diskFreeGb !== null && (status === 'recording' || status === 'paused') && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-500">
              <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{diskFreeGb} GB free</span>
              {estimatedMinsRemaining !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>~{estimatedMinsRemaining} min remaining</span>
                </>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Important timestamps */}
      {importantTimes.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-medium text-slate-700">{t('recorder.markImportant')}</p>
            <div className="flex flex-wrap gap-1">
              {importantTimes.map((time, i) => (
                <span key={i} className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {formatTime(time)}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Live Transcript panel */}
      {isDesktop && (status === 'recording' || status === 'paused') && liveTranscript && (
        <Card data-testid="live-transcript-panel">
          <CardBody>
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-500" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700">Live Transcript</span>
              {liveTranscriptActive && (
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500"
                  aria-label="Transcribing…"
                />
              )}
            </div>
            <div
              ref={liveTranscriptRef}
              className="max-h-48 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800"
              aria-live="polite"
              aria-label="Live transcript"
            >
              {liveTranscript}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert tone="danger">
          {errorMessages[error]}
          <Button variant="ghost" onClick={reset} className="mt-2">{t('common.retry')}</Button>
        </Alert>
      )}

      {/* Session info (dev use) */}
      {isDesktop && sessionId && (
        <p className="text-xs text-slate-300">Session: {sessionId.slice(-8)}</p>
      )}
    </div>
  );
}
