import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Mic, Plus, Clock, ChevronRight, BookOpen, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Badge, EmptyState, Alert } from '@mindflow/ui';
import { mockLectures } from '../lib/mock-data';
import { useLectureStore } from '../store/lecture';

interface LocalLecture {
  id: string;
  title: string;
  state: string;
  durationSeconds?: number | null;
}

const stateTone = (state: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
  if (state === 'READY') return 'success';
  if (state === 'TRANSCRIBING' || state === 'PROCESSING') return 'info';
  if (state === 'ERROR') return 'danger';
  return 'neutral';
};

function LectureSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-20 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export function LecturesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectLecture = useLectureStore((s) => s.selectLecture);
  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  const lecturesQuery = useQuery({
    queryKey: ['lectures'],
    queryFn: async (): Promise<LocalLecture[]> => {
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.listLectures();
        if (!res.ok) {
          throw new Error(res.error ?? 'Failed to load lectures');
        }
        return Array.isArray(res.data) ? (res.data as LocalLecture[]) : [];
      }
      return mockLectures;
    },
  });

  const lectures = useMemo(() => lecturesQuery.data ?? [], [lecturesQuery.data]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('lectures.title')}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {lectures.length > 0 ? `${lectures.length} lecture${lectures.length !== 1 ? 's' : ''}` : 'No lectures yet'}
          </p>
        </div>
        <Link to="/lectures/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('lectures.new')}
          </Button>
        </Link>
      </div>

      {/* Content */}
      {lecturesQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <LectureSkeleton key={i} />)}
        </div>
      ) : lecturesQuery.isError ? (
        <Alert tone="danger">
          {lecturesQuery.error instanceof Error ? lecturesQuery.error.message : 'Failed to load lectures.'}
        </Alert>
      ) : lectures.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-12 w-12 text-slate-300" />}
          title={t('lectures.noLectures')}
          description="Record your first lecture to get started with AI-powered notes and summaries."
          action={
            <Link to="/lectures/new">
              <Button>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t('lectures.new')}
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {lectures.map((lecture, i) => {
            const mins = lecture.durationSeconds ? Math.round(lecture.durationSeconds / 60) : null;
            const isProcessing = lecture.state === 'TRANSCRIBING' || lecture.state === 'PROCESSING';

            return (
              <motion.li
                key={lecture.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.18 }}
              >
                <div className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-150 hover:border-brand-200 hover:shadow-md">
                  {/* Thumbnail / icon */}
                  <button
                    type="button"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100"
                    onClick={() => {
                      selectLecture({ id: lecture.id, title: lecture.title });
                      navigate(`/lectures/${lecture.id}`);
                    }}
                    aria-label={`Open ${lecture.title}`}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-label="Processing" />
                    ) : (
                      <Mic className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>

                  {/* Info */}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      selectLecture({ id: lecture.id, title: lecture.title });
                      navigate(`/lectures/${lecture.id}`);
                    }}
                  >
                    <p className="truncate font-semibold text-slate-800 transition-colors group-hover:text-brand-700">
                      {lecture.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      {mins && (
                        <>
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>{mins} min</span>
                        </>
                      )}
                    </div>
                  </button>

                  {/* Status badge */}
                  <Badge tone={stateTone(lecture.state)}>{lecture.state}</Badge>

                  {/* Continue / Record button */}
                  <Button
                    variant="secondary"
                    aria-label={`Record more for ${lecture.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectLecture({ id: lecture.id, title: lecture.title });
                      navigate('/recorder', { state: { lectureId: lecture.id, lectureTitle: lecture.title } });
                    }}
                  >
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  </Button>

                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" aria-hidden="true" />
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
