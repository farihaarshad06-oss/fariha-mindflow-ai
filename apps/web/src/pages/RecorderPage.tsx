import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Pause, Play, AlertTriangle, CheckCircle2, HardDrive, Shield } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Alert,
  Badge,
  Spinner,
  Select,
} from '@mindflow/ui';
import { FILE_LIMITS } from '@mindflow/config';

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
  | null;

interface MicDevice {
  deviceId: string;
  label: string;
}

const CHUNK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

// ── Component ──────────────────────────────────────────────────────────────

export function RecorderPage() {
  const { t } = useTranslation();
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
  const [lectureId] = useState<string>(() => `lecture-${Date.now()}`);
  const [importantTimes, setImportantTimes] = useState<number[]>([]);

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
        setSelectedMic(audioInputs[0]!.deviceId);
      }
    });
  }, []);

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
  }, [isDesktop]);

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

    if (isDesktop && window.electronAPI && sessionId) {
      const res = await window.electronAPI.saveAudioChunk({
        sessionId,
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
          console.warn('[recorder] chunk save failed:', res.error);
        }
      }
    } else {
      // Browser fallback: save to IndexedDB/memory (non-persistent)
      const fileName = `${lectureId}-chunk-${String(idx).padStart(4, '0')}.webm`;
      if (window.electronAPI) {
        void window.electronAPI.saveAudio(fileName, arrayBuffer);
      }
    }
  }, [isDesktop, sessionId, lectureId]);

  // ── Start recording ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!supported) { setError('unsupported'); setStatus('error'); return; }
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
      } catch {}

      // Create a persistent session in main process
      let newSessionId: string | null = null;
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.startRecording({
          lectureId,
          microphoneId: selectedMic,
          privacyMode,
          language: 'en',
        });
        if (res.ok && res.data) {
          newSessionId = (res.data as { id: string }).id;
          setSessionId(newSessionId);
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
  }, [supported, selectedMic, privacyMode, isDesktop, lectureId, flushChunk]);

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
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;

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
    setChunkIndex(0);
    setAudioLevel(0);
    setWaveform(Array.from({ length: 24 }, () => 0.3));
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
  };

  const diskFreeGb = diskFreeBytes !== null ? (diskFreeBytes / 1024 / 1024 / 1024).toFixed(1) : null;
  const diskWarning = diskFreeBytes !== null && diskFreeBytes < 500 * 1024 * 1024;

  return (
    <div>
      <PageHeader title={t('recorder.title')} />

      {diskWarning && (
        <Alert tone="danger" className="mb-3">
          <HardDrive className="me-2 inline h-4 w-4" aria-hidden="true" />
          Low disk space: {diskFreeGb} GB remaining. Recording may stop automatically.
        </Alert>
      )}

      {/* Microphone selection */}
      {mics.length > 1 && status === 'idle' && (
        <Card className="mb-4">
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

      <Card>
        <CardBody className="flex flex-col items-center gap-5 py-8">
          {/* Waveform visualizer */}
          <div className="flex gap-1" aria-hidden="true" data-testid="waveform">
            {waveform.map((value, index) => (
              <span
                key={index}
                className={`w-1.5 rounded-full transition-all ${
                  status === 'recording'
                    ? audioLevel > 0.5 ? 'bg-red-500' : 'bg-brand-500'
                    : 'bg-slate-300'
                }`}
                style={{ height: `${Math.max(6, value * 52)}px` }}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-3xl font-semibold tabular-nums text-slate-900" aria-live="polite">
            {formatTime(seconds)}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {status === 'recording' && (
              <Badge tone="danger">
                <span className="me-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                REC
              </Badge>
            )}
            {status === 'paused' && <Badge tone="warning">PAUSED</Badge>}
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
                <Shield className="me-1 h-3 w-3" aria-hidden="true" /> Privacy
              </Badge>
            )}
          </div>

          {/* Consent + privacy options */}
          {status === 'idle' && (
            <div className="flex flex-col gap-2 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  data-testid="consent-checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                {t('recorder.giveConsent')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={privacyMode}
                  onChange={(e) => setPrivacyMode(e.target.checked)}
                />
                <Shield className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                Privacy mode (no auto-transcription)
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
              >
                <Mic className="h-5 w-5" aria-hidden="true" /> {t('recorder.record')}
              </Button>
            )}
            {status === 'recording' && (
              <>
                <Button variant="secondary" onClick={() => void pauseRecording()} aria-label={t('recorder.pause')}>
                  <Pause className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button variant="danger" onClick={() => void stopRecording()} aria-label={t('recorder.stop')}>
                  <Square className="h-5 w-5" aria-hidden="true" /> {t('recorder.stop')}
                </Button>
              </>
            )}
            {status === 'paused' && (
              <>
                <Button onClick={() => void resumeRecording()} aria-label={t('recorder.resume')}>
                  <Play className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button variant="danger" onClick={() => void stopRecording()} aria-label={t('recorder.stop')}>
                  <Square className="h-5 w-5" aria-hidden="true" />
                </Button>
              </>
            )}
            {status === 'stopping' && <Spinner label="Saving…" />}
          </div>

          {(status === 'recording' || status === 'paused') && (
            <Button variant="ghost" onClick={markImportant} aria-label={t('recorder.markImportant')}>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t('recorder.markImportant')}
              {importantTimes.length > 0 && ` (${importantTimes.length})`}
            </Button>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-slate-600">
                Recording saved.{privacyMode ? ' Transcription skipped (privacy mode).' : ' Transcription queued.'}
              </p>
              <Button variant="secondary" onClick={reset}>{t('common.back')}</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Important timestamps */}
      {importantTimes.length > 0 && (
        <Card className="mt-4">
          <CardBody>
            <p className="mb-2 text-sm font-medium text-slate-700">{t('recorder.markImportant')}</p>
            <div className="flex flex-wrap gap-1">
              {importantTimes.map((time, i) => (
                <span key={i} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  {formatTime(time)}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert tone="danger" className="mt-4">
          {errorMessages[error]}
          <Button variant="ghost" onClick={reset} className="mt-2">{t('common.retry')}</Button>
        </Alert>
      )}

      {/* Disk space indicator */}
      {diskFreeGb !== null && (
        <p className="mt-3 text-xs text-slate-400">
          <HardDrive className="me-1 inline h-3 w-3" aria-hidden="true" />
          Free disk: {diskFreeGb} GB
          {isDesktop && sessionId && ` · Session: ${sessionId.slice(-8)}`}
        </p>
      )}
    </div>
  );
}
