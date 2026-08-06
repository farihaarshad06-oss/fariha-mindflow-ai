import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Mic, Plus } from 'lucide-react';
import { PageHeader, Card, CardBody, Button, Badge, EmptyState, Spinner, Alert } from '@mindflow/ui';
import { mockLectures } from '../lib/mock-data';
import { useLectureStore } from '../store/lecture';

interface LocalLecture {
  id: string;
  title: string;
  state: string;
  durationSeconds?: number | null;
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
    <div>
      <PageHeader
        title={t('lectures.title')}
        actions={
          <Link to="/lectures/new">
            <Button>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('lectures.new')}
            </Button>
          </Link>
        }
      />
      {lecturesQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner label={t('common.loading')} />
        </div>
      ) : lecturesQuery.isError ? (
        <Alert tone="danger">{lecturesQuery.error instanceof Error ? lecturesQuery.error.message : 'Failed to load lectures.'}</Alert>
      ) : lectures.length === 0 ? (
        <EmptyState
          title={t('lectures.noLectures')}
          action={
            <Link to="/lectures/new">
              <Button>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t('lectures.new')}
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lectures.map((lecture) => (
            <li key={lecture.id}>
              <Card>
                <CardBody className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                    onClick={() => {
                      selectLecture({ id: lecture.id, title: lecture.title });
                      navigate(`/lectures/${lecture.id}`);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{lecture.title}</p>
                      <p className="text-xs text-slate-500">
                        {lecture.durationSeconds ? `${Math.round(lecture.durationSeconds / 60)} min` : ''}
                      </p>
                    </div>
                    <Badge tone={lecture.state === 'READY' ? 'success' : 'info'}>{lecture.state}</Badge>
                  </button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      selectLecture({ id: lecture.id, title: lecture.title });
                      navigate('/recorder', { state: { lectureId: lecture.id, lectureTitle: lecture.title } });
                    }}
                  >
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
