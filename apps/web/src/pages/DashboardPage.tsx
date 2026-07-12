import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mic, Sparkles, BookOpen, CalendarDays, Flame } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  Progress,
  Spinner,
  EmptyState,
  ErrorState,
} from '@mindflow/ui';
import { mockCourses, mockLectures } from '../lib/mock-data';

export type DashboardView = 'loading' | 'empty' | 'error' | 'data';

export function DashboardPage({ view = 'data' }: { view?: DashboardView }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (view === 'loading') {
    return (
      <div className="flex justify-center py-20">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  if (view === 'error') {
    return <ErrorState message={t('common.error')} onRetry={() => navigate(0)} />;
  }

  const lectures = view === 'empty' ? [] : mockLectures;
  const courses = view === 'empty' ? [] : mockCourses;
  const weakTopics = courses.flatMap((course) => course.weakTopics);

  return (
    <div>
      <PageHeader
        title={`${t('dashboard.greeting')}, Student`}
        description={t('tagline')}
        actions={
          <>
            <Button onClick={() => navigate('/recorder')}>
              <Mic className="h-4 w-4" aria-hidden="true" /> {t('dashboard.quickRecord')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/chat')}>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('dashboard.askAi')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">{t('dashboard.todayClasses')}</p>
              <p className="text-lg font-semibold text-slate-900">{courses.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">{t('dashboard.streak')}</p>
              <p className="text-lg font-semibold text-slate-900">5</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">{t('dashboard.recentLectures')}</p>
              <p className="text-lg font-semibold text-slate-900">{lectures.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">{t('dashboard.weakTopics')}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {weakTopics.length === 0 ? (
                <span className="text-sm text-slate-400">—</span>
              ) : (
                weakTopics.map((topic) => (
                  <Badge key={topic} tone="warning">
                    {topic}
                  </Badge>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <PageHeader title={t('dashboard.weeklyProgress')} className="mb-3" />
          <Progress value={62} label="62%" />
        </Card>
        <Card className="lg:col-span-2">
          <PageHeader title={t('dashboard.recentLectures')} className="mb-3" />
          {lectures.length === 0 ? (
            <EmptyState
              title={t('dashboard.noLectures')}
              action={
                <Link to="/recorder">
                  <Button>{t('dashboard.quickRecord')}</Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {lectures.map((lecture) => (
                <li key={lecture.id}>
                  <Link
                    to={`/lectures/${lecture.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-800">{lecture.title}</span>
                    <Badge tone={lecture.state === 'READY' ? 'success' : 'info'}>{lecture.state}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
