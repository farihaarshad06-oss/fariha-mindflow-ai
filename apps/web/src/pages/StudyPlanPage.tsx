import { useTranslation } from 'react-i18next';
import { PageHeader, Card, CardBody, EmptyState, Progress } from '@mindflow/ui';
import { mockCourses } from '../lib/mock-data';

export function StudyPlanPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('studyPlan.title')} />
      {mockCourses.length === 0 ? (
        <EmptyState title={t('studyPlan.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mockCourses.map((course) => (
            <Card key={course.id}>
              <CardBody>
                <p className="font-semibold text-slate-900">{course.title}</p>
                <Progress value={course.progress} label={t('courses.progress')} />
                <p className="mt-2 text-sm text-slate-500">
                  {t('dashboard.weakTopics')}: {course.weakTopics.join(', ')}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
