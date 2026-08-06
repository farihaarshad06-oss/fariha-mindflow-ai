import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody, Button, Badge, EmptyState, Spinner, Alert } from '@mindflow/ui';
import { Sparkles, Pencil, Check, X, Clock } from 'lucide-react';
import { mockLectures } from '../lib/mock-data';
import { useLectureStore } from '../store/lecture';

interface TranscriptSeg {
  id: string;
  segmentIndex: number;
  text: string;
  editedText: string | null;
  timestampStart: number;
  timestampEnd: number;
  speaker?: string | null;
}

interface LocalLecture {
  id: string;
  title: string;
  state: string;
  durationSeconds?: number | null;
  courseId?: string | null;
  language?: string | null;
}

function formatTs(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function SegmentRow({ seg, onSave }: { seg: TranscriptSeg; onSave: (id: string, text: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(seg.editedText ?? seg.text);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(seg.id, value);
    setSaving(false);
    setEditing(false);
  };

  const displayText = seg.editedText ?? seg.text;

  return (
    <div className="group flex gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
      <span className="shrink-0 font-mono text-xs text-slate-400 pt-0.5 w-10">
        {formatTs(seg.timestampStart)}
      </span>
      <div className="flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full rounded border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} loading={saving} aria-label="Save edit">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setValue(seg.editedText ?? seg.text); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-slate-800 leading-relaxed">
              {displayText}
              {seg.editedText && (
                <span className="ml-2 text-xs text-brand-500">(edited)</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-brand-500"
              aria-label="Edit segment"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LectureDetailPage() {
  const { lectureId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectLecture = useLectureStore((s) => s.selectLecture);
  const [lecture, setLecture] = useState<LocalLecture | null>(null);
  const [segments, setSegments] = useState<TranscriptSeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    const load = async () => {
      if (!lectureId) return;
      setLoading(true);
      if (isDesktop && window.electronAPI) {
        const lRes = await window.electronAPI.getLecture(lectureId);
        if (lRes.ok && lRes.data) {
          const loadedLecture = lRes.data as LocalLecture;
          setLecture(loadedLecture);
          selectLecture({ id: loadedLecture.id, title: loadedLecture.title });
        } else {
          setError('Lecture not found');
        }
        const tRes = await window.electronAPI.listTranscript(lectureId);
        if (tRes.ok && Array.isArray(tRes.data)) {
          setSegments(tRes.data as TranscriptSeg[]);
        }
      } else {
        const mock = mockLectures.find((l) => l.id === lectureId);
        if (mock) setLecture({ id: mock.id, title: mock.title, state: mock.state });
        else setError('Lecture not found');
      }
      setLoading(false);
    };
    void load();
  }, [lectureId, isDesktop, selectLecture]);

  const saveEdit = async (segId: string, editedText: string) => {
    if (!isDesktop || !window.electronAPI) return;
    const res = await window.electronAPI.editTranscriptSegment({ segmentId: segId, editedText });
    if (res.ok && res.data) {
      const updated = res.data as TranscriptSeg;
      setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, editedText: updated.editedText } : s));
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner label={t('common.loading')} /></div>;
  if (error || !lecture) return <Alert tone="danger">{error ?? 'Lecture not found'}</Alert>;

  const stateColors: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
    READY: 'success',
    PROCESSING: 'info',
    RECORDING: 'warning',
    ERROR: 'danger',
    PENDING: 'neutral',
  };

  return (
    <div>
      <PageHeader
        title={lecture.title}
        description={lecture.durationSeconds ? `${Math.round(lecture.durationSeconds / 60)} min` : undefined}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                selectLecture({ id: lecture.id, title: lecture.title });
                navigate('/recorder', { state: { lectureId: lecture.id, lectureTitle: lecture.title } });
              }}
            >
              Record
            </Button>
            <Link to="/chat">
              <Button>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('courseDetail.chat')}
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={stateColors[lecture.state] ?? 'neutral'}>{lecture.state}</Badge>
        {lecture.language && <Badge tone="neutral">{lecture.language.toUpperCase()}</Badge>}
      </div>

      {segments.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title={lecture.state === 'PROCESSING' ? 'Transcription in progress…' : 'No transcript yet'}
            />
            {lecture.state === 'PROCESSING' && <Spinner label="Processing…" className="mx-auto mt-4" />}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {segments.length} segments
              </div>
              <p className="text-xs text-slate-400">Click pencil icon to edit a segment</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {segments.map((seg) => (
                <SegmentRow key={seg.id} seg={seg} onSave={saveEdit} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
