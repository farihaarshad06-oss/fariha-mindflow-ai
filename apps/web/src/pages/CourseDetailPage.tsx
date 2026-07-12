import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { PageHeader, Card, CardBody, Button, Badge, EmptyState } from '@mindflow/ui';
import { mockCourses, mockLectures, mockFlashcards } from '../lib/mock-data';

export function CourseDetailPage() {
  const { courseId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const course = mockCourses.find((item) => item.id === courseId);

  if (!course) {
    return <EmptyState title={t('courses.noCourses')} />;
  }

  const lectures = mockLectures.filter((item) => item.courseId === courseId);

  return (
    <div>
      <PageHeader
        title={course.title}
        description={course.description}
        actions={
          <Button onClick={() => navigate('/chat')}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('courseDetail.chat')}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">{t('courses.progress')}</p>
            <p className="text-lg font-semibold text-slate-900">{course.progress}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">{t('courses.nextExam')}</p>
            <p className="text-sm font-semibold text-slate-900">
              {course.nextExamDate ? new Date(course.nextExamDate).toLocaleDateString() : '—'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500">{t('courses.lectures')}</p>
            <p className="text-lg font-semibold text-slate-900">{course.lectureCount}</p>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-slate-900">{t('courseDetail.recentLectures')}</h2>
      <ul className="flex flex-col gap-2">
        {lectures.map((lecture) => (
          <li key={lecture.id}>
            <Link
              to={`/lectures/${lecture.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-800">{lecture.title}</span>
              <Badge tone="info">{lecture.state}</Badge>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-slate-900">{t('courseDetail.flashcards')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {mockFlashcards.map((card) => (
          <Card key={card.id}>
            <CardBody>
              <p className="font-medium text-slate-800">{card.question}</p>
              <p className="mt-1 text-sm text-slate-500">{card.answer}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
