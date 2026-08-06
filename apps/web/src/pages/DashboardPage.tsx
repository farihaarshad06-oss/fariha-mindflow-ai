import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mic, Sparkles, BookOpen, CalendarDays, Flame, TrendingUp,
  Clock, Target, ArrowRight, Zap, MessageSquare, BarChart2,
} from 'lucide-react';
import { motion } from 'framer-motion';
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

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.2 } }),
};

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

  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="space-y-6">
      {/* Greeting row */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {t('dashboard.greeting')}, Student 👋
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{dayOfWeek} — {t('tagline')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/recorder')} className="shrink-0">
            <Mic className="h-4 w-4" aria-hidden="true" /> {t('dashboard.quickRecord')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/chat')} className="shrink-0">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('dashboard.askAi')}
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: <CalendarDays className="h-5 w-5 text-brand-600" />,
            label: t('dashboard.todayClasses'),
            value: courses.length,
            sub: 'scheduled today',
            color: 'bg-brand-50',
          },
          {
            icon: <Flame className="h-5 w-5 text-amber-500" />,
            label: t('dashboard.streak'),
            value: 5,
            sub: 'days in a row 🔥',
            color: 'bg-amber-50',
          },
          {
            icon: <BookOpen className="h-5 w-5 text-emerald-600" />,
            label: t('dashboard.recentLectures'),
            value: lectures.length,
            sub: 'recorded lectures',
            color: 'bg-emerald-50',
          },
          {
            icon: <TrendingUp className="h-5 w-5 text-violet-600" />,
            label: 'Weekly Progress',
            value: '62%',
            sub: 'of weekly goal',
            color: 'bg-violet-50',
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
            <Card className="transition-shadow duration-200 hover:shadow-md">
              <CardBody className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.color}`}>
                  {stat.icon}
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.sub}</p>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Middle grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Lectures */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardBody>
              <div className="mb-3 flex items-center justify-between">
                <PageHeader title={t('dashboard.recentLectures')} className="mb-0" />
                <Link to="/lectures" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {lectures.length === 0 ? (
                <EmptyState
                  title={t('dashboard.noLectures')}
                  action={
                    <Link to="/recorder">
                      <Button size="sm">{t('dashboard.quickRecord')}</Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {lectures.map((lecture) => {
                    const mins = lecture.durationSeconds ? Math.round(lecture.durationSeconds / 60) : null;
                    return (
                      <li key={lecture.id}>
                        <Link
                          to={`/lectures/${lecture.id}`}
                          className="group flex items-center justify-between rounded-xl border border-transparent px-3 py-2.5 transition-all hover:border-slate-200 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                              <Mic className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-medium text-slate-800 group-hover:text-brand-700">
                                {lecture.title}
                              </p>
                              {mins && <p className="text-xs text-slate-400">{mins} min</p>}
                            </div>
                          </div>
                          <Badge tone={lecture.state === 'READY' ? 'success' : 'info'}>
                            {lecture.state}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Weekly Progress */}
          <Card>
            <CardBody>
              <div className="mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-800">{t('dashboard.weeklyProgress')}</h2>
              </div>
              <Progress value={62} label="62%" />
              <p className="mt-2 text-xs text-slate-400">Goal: 5 lectures/week</p>
            </CardBody>
          </Card>

          {/* Weak Topics */}
          <Card>
            <CardBody>
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-800">Focus Areas</h2>
              </div>
              {weakTopics.length === 0 ? (
                <p className="text-sm text-slate-400">No weak topics detected yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {weakTopics.map((topic) => (
                    <Badge key={topic} tone="warning">{topic}</Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Courses */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-800">Courses</h2>
              </div>
              <Link to="/courses" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</Link>
            </div>
            {courses.length === 0 ? (
              <p className="text-sm text-slate-400">No courses yet.</p>
            ) : (
              <ul className="space-y-2">
                {courses.map((course) => (
                  <li key={course.id}>
                    <Link to={`/courses/${course.id}`} className="group flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: course.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">
                          {course.title}
                        </p>
                        <Progress value={course.progress ?? 0} className="mt-1" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-800">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Record', icon: <Mic className="h-4 w-4" />, to: '/recorder' },
                { label: 'Ask AI', icon: <Sparkles className="h-4 w-4" />, to: '/chat' },
                { label: 'Study Plan', icon: <CalendarDays className="h-4 w-4" />, to: '/study-plan' },
                { label: 'Lectures', icon: <BookOpen className="h-4 w-4" />, to: '/lectures' },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-medium text-slate-600 transition-all hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Recent AI Chats / Study Tip */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-800">Recent AI Chats</h2>
            </div>
            {lectures.length === 0 ? (
              <EmptyState
                title="No chats yet"
                action={
                  <Button variant="secondary" onClick={() => navigate('/chat')}>
                    Start chatting
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg bg-brand-50 p-3">
                  <p className="text-xs font-medium text-brand-700">Principles of Bioethics</p>
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                    "Explain autonomy in clinical decision-making…"
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" /> 2 hours ago
                  </div>
                </div>
                <Button variant="ghost" fullWidth onClick={() => navigate('/chat')}>
                  Open Chat <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

