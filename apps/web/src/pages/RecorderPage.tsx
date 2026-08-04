import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Pause, Play, AlertTriangle, CheckCircle2, UploadCloud, FolderOpen } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Alert,
  Badge,
  Spinner,
} from '@mindflow/ui';
import { FILE_LIMITS } from '@mindflow/config';

type RecorderStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'uploading'
  | 'uploaded'
  | 'error';

type RecorderError =
  | 'permissionDenied'
  | 'unsupported'
  | 'noMic'
  | 'interrupted'
  | 'emptyAudio'
  | 'maxLength'
  | 'uploadFailed'
  | 'fileTooBig'
  | 'fileTypeInvalid'
  | null;

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
};

const ALLOWED_AUDIO_TYPES = new Set(FILE_LIMITS.allowedAudioMimeTypes as readonly string[]);
const ALLOWED_AUDIO_EXT = new Set(FILE_LIMITS.allowedAudioExtensions as readonly string[]);

function isAudioFile(file: File): boolean {
  if (ALLOWED_AUDIO_TYPES.has(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_AUDIO_EXT.has(ext);
}

export function RecorderPage() {
  const { t } = useTranslation();
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<RecorderError>(null);
  const [seconds, setSeconds] = useState(0);
  const [storageFree, setStorageFree] = useState<number | null>(null);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 24 }, () => 0.3));
  const [topics, setTopics] = useState<string[]>([]);
  const [importantTimes, setImportantTimes] = useState<number[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const supported =
    typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage.estimate().then((estimate) => setStorageFree(estimate.usage ?? 0));
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveRef.current) clearInterval(waveRef.current);
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev + 1 >= FILE_LIMITS.maxRecordingSeconds) {
          void stop();
          return FILE_LIMITS.maxRecordingSeconds;
        }
        return prev + 1;
      });
    }, 1000);
    waveRef.current = setInterval(() => {
      setWaveform((prev) => prev.map(() => 0.2 + Math.random() * 0.8));
    }, 180);
  }, []);

  const stop = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    if (!supported) {
      setError('unsupported');
      setStatus('error');
      return;
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!stream.getAudioTracks().length) {
        setError('noMic');
        setStatus('error');
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          setError('emptyAudio');
          setStatus('error');
          return;
        }
        simulateTopics();
        uploadAudio();
      };
      recorder.onerror = () => {
        setError('interrupted');
        setStatus('error');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      startTimer();
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'permissionDenied' : 'interrupted');
      setStatus('error');
    }
  }, [supported, startTimer, stopTimer]);

  const simulateTopics = () => {
    const candidates = ['Autonomy', 'Beneficence', 'Justice', 'Methodology'];
    setTopics(candidates.slice(0, 2 + Math.floor(Math.random() * 2)));
  };

  const uploadAudio = useCallback(() => {
    setStatus('uploading');
    window.setTimeout(() => {
      setStatus('uploaded');
    }, 1200);
  }, []);

  const processUploadedFile = useCallback(
    (file: File) => {
      if (!isAudioFile(file)) {
        setError('fileTypeInvalid');
        setStatus('error');
        return;
      }
      if (file.size > FILE_LIMITS.maxAudioBytes) {
        setError('fileTooBig');
        setStatus('error');
        return;
      }
      setUploadedFileName(file.name);
      simulateTopics();
      uploadAudio();
    },
    [uploadAudio],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processUploadedFile(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [processUploadedFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processUploadedFile(file);
    },
    [processUploadedFile],
  );

  const pause = () => {
    mediaRecorderRef.current?.pause();
    stopTimer();
    setStatus('paused');
  };

  const resume = () => {
    mediaRecorderRef.current?.resume();
    startTimer();
    setStatus('recording');
  };

  const markImportant = () => {
    setImportantTimes((prev) => [...prev, seconds]);
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
    setSeconds(0);
    setTopics([]);
    setImportantTimes([]);
    setUploadedFileName(null);
  };

  const isIdle = status === 'idle' || status === 'error';

  const errorMessages: Record<Exclude<RecorderError, null>, string> = {
    permissionDenied: t('recorder.permissionDenied'),
    unsupported: t('recorder.unsupported'),
    noMic: t('recorder.noMic'),
    interrupted: t('recorder.interrupted'),
    emptyAudio: t('recorder.emptyAudio'),
    maxLength: t('recorder.maxLength'),
    uploadFailed: t('recorder.uploadFailed'),
    fileTooBig: t('recorder.fileTooBig'),
    fileTypeInvalid: t('recorder.fileTypeInvalid'),
  };

  return (
    <div>
      <PageHeader title={t('recorder.title')} />

      <Alert tone="warning">{t('recorder.consentRequired')}</Alert>

      <Card className="mt-4">
        <CardBody className="flex flex-col items-center gap-5 py-8">
          <div
            className="flex gap-1"
            aria-hidden="true"
            data-testid="waveform"
          >
            {waveform.map((value, index) => (
              <span
                key={index}
                className={`w-1.5 rounded-full bg-brand-500 transition-all ${
                  status === 'recording' ? '' : 'opacity-40'
                }`}
                style={{ height: `${Math.max(8, value * 48)}px` }}
              />
            ))}
          </div>

          <div className="text-3xl font-semibold tabular-nums text-slate-900" aria-live="polite">
            {formatTime(seconds)}
          </div>

          <div className="flex items-center gap-2">
            {status === 'recording' && (
              <Badge tone="danger">
                <span className="me-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                REC
              </Badge>
            )}
            {status === 'paused' && <Badge tone="warning">PAUSED</Badge>}
            {status === 'uploading' && <Badge tone="info">UPLOAD</Badge>}
            {status === 'uploaded' && (
              <Badge tone="success">
                <CheckCircle2 className="me-1 h-3.5 w-3.5" /> OK
              </Badge>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              data-testid="consent-checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t('recorder.giveConsent')}
          </label>

          {!consent && (
            <p data-testid="consent-notice" className="text-xs text-amber-600">
              {t('recorder.consentRequired')}
            </p>
          )}

          <div className="flex items-center gap-3">
            {status === 'idle' || status === 'error' ? (
              <Button
                data-testid="record-button"
                disabled={!consent}
                onClick={startRecording}
                aria-label={t('recorder.record')}
              >
                <Mic className="h-5 w-5" aria-hidden="true" /> {t('recorder.record')}
              </Button>
            ) : status === 'recording' ? (
              <>
                <Button variant="secondary" onClick={pause} aria-label={t('recorder.pause')}>
                  <Pause className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button variant="danger" onClick={stop} aria-label={t('recorder.stop')}>
                  <Square className="h-5 w-5" aria-hidden="true" /> {t('recorder.stop')}
                </Button>
              </>
            ) : status === 'paused' ? (
              <>
                <Button onClick={resume} aria-label={t('recorder.resume')}>
                  <Play className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button variant="danger" onClick={stop} aria-label={t('recorder.stop')}>
                  <Square className="h-5 w-5" aria-hidden="true" />
                </Button>
              </>
            ) : null}
          </div>

          {(status === 'recording' || status === 'paused') && (
            <Button variant="ghost" onClick={markImportant}>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t('recorder.markImportant')}{' '}
              {importantTimes.length > 0 && `(${importantTimes.length})`}
            </Button>
          )}

          {status === 'uploading' && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> <UploadCloud className="h-4 w-4" aria-hidden="true" />{' '}
              {t('recorder.uploadStatus')}
            </div>
          )}

          {status === 'uploaded' && (
            <Button variant="secondary" onClick={reset}>
              {t('common.back')}
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Audio file upload section */}
      {isIdle && (
        <Card className="mt-4">
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">
              <UploadCloud className="me-2 inline h-5 w-5 text-brand-500" aria-hidden="true" />
              {t('recorder.uploadAudio')}
            </h2>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={[...FILE_LIMITS.allowedAudioMimeTypes, ...FILE_LIMITS.allowedAudioExtensions.map((e) => `.${e}`)].join(',')}
              className="sr-only"
              aria-label={t('recorder.uploadAudio')}
              onChange={handleFileInputChange}
              data-testid="audio-file-input"
            />

            {/* Drag-and-drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label={t('recorder.uploadAudioHint')}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isDragOver
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
            >
              <FolderOpen
                className={`h-10 w-10 ${isDragOver ? 'text-brand-500' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">{t('recorder.uploadAudioHint')}</p>
              <p className="text-xs text-slate-400">{t('recorder.uploadAudioFormats')}</p>
              <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <FolderOpen className="me-1 h-4 w-4" aria-hidden="true" /> {t('recorder.uploadAudio')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Uploaded file name confirmation */}
      {status === 'uploaded' && uploadedFileName && (
        <Alert tone="success" className="mt-4">
          <CheckCircle2 className="me-2 inline h-4 w-4" aria-hidden="true" />
          {t('recorder.fileReady')}: <strong>{uploadedFileName}</strong>
        </Alert>
      )}

      {error && (
        <Alert tone="danger" className="mt-4">
          {errorMessages[error]}
          <div className="mt-2">
            <Button variant="ghost" onClick={reset}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      )}

      <Card className="mt-4">
        <CardBody>
          <h2 className="mb-2 font-semibold text-slate-900">{t('recorder.detectedTopics')}</h2>
          {topics.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <Badge key={topic} tone="info">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
          {importantTimes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-500">{t('recorder.markImportant')}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {importantTimes.map((time) => (
                  <span key={time} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    {formatTime(time)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {storageFree !== null && (
        <p className="mt-3 text-xs text-slate-400">
          {t('recorder.micStatus')}: {(storageFree / 1024 / 1024).toFixed(1)} MB used
        </p>
      )}
    </div>
  );
}
