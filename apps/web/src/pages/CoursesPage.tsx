import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  Progress,
  Modal,
  Input,
  EmptyState,
} from '@mindflow/ui';
import type { Course } from '@mindflow/types';
import { mockCourses } from '../lib/mock-data';

function CourseCardItem({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-2 text-start"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {course.title}
          </span>
          <Badge tone="neutral">{course.lectureCount} {t('courses.lectures')}</Badge>
        </div>
        <p className="text-sm text-slate-500">{course.description}</p>
        <Progress value={course.progress} label={t('courses.progress')} />
      </button>
    </Card>
  );
}

export function CoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>(mockCourses);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function createCourse() {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    setCourses((prev) => [
      {
        id: `course-${prev.length + 1}`,
        ownerId: 'user-1',
        title: title.trim(),
        lectureCount: 0,
        weakTopics: [],
        progress: 0,
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
    setTitle('');
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title={t('courses.title')}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('courses.create')}
          </Button>
        }
      />

      {courses.length === 0 ? (
        <EmptyState title={t('courses.noCourses')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCardItem
              key={course.id}
              course={course}
              onOpen={() => navigate(`/courses/${course.id}`)}
            />
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('courses.create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={createCourse}>{t('common.create')}</Button>
          </>
        }
      >
        <Input label={t('courses.title')} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Modal>
    </div>
  );
}
