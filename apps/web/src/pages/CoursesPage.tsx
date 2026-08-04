import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, Trash2 } from 'lucide-react';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Progress,
  Modal,
  Input,
  EmptyState,
  Spinner,
  Alert,
} from '@mindflow/ui';
import type { Course } from '@mindflow/types';
import { mockCourses } from '../lib/mock-data';

interface LocalCourse extends Course {
  lectureCount: number;
}

function CourseCardItem({ course, onOpen, onDelete }: { course: LocalCourse; onOpen: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="flex items-start justify-between">
        <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-2 text-start">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {course.title}
          </div>
          {course.description && <p className="text-sm text-slate-500">{course.description}</p>}
          <Progress value={course.progress} label={t('courses.progress')} />
          <Badge tone="neutral">{course.lectureCount} {t('courses.lectures')}</Badge>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-2 rounded p-1 text-slate-400 hover:text-red-500"
          aria-label="Delete course"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

export function CoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  const loadCourses = async () => {
    setLoading(true);
    if (isDesktop && window.electronAPI) {
      const res = await window.electronAPI.listCourses();
      if (res.ok && Array.isArray(res.data)) {
        setCourses(
          (res.data as Record<string, unknown>[]).map((c) => ({
            ...(c as unknown as Course),
            lectureCount: (c['lectureCount'] as number | undefined) ?? 0,
            weakTopics: Array.isArray(c['weakTopics']) ? (c['weakTopics'] as string[]) : [],
            progress: (c['progress'] as number | undefined) ?? 0,
          }))
        );
      }
    } else {
      setCourses(mockCourses.map((c) => ({ ...c, lectureCount: c.lectureCount })));
    }
    setLoading(false);
  };

  useEffect(() => { void loadCourses(); }, []);

  const createCourse = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      if (isDesktop && window.electronAPI) {
        const res = await window.electronAPI.createCourse({ title: title.trim(), description: description.trim() });
        if (!res.ok) { setError(res.error ?? 'Failed to create course'); return; }
      } else {
        const newCourse: LocalCourse = {
          id: `course-${Date.now()}`,
          ownerId: 'local',
          title: title.trim(),
          description: description.trim(),
          lectureCount: 0,
          weakTopics: [],
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCourses((prev) => [newCourse, ...prev]);
      }
      setTitle('');
      setDescription('');
      setOpen(false);
      await loadCourses();
    } finally {
      setCreating(false);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course and all its lectures?')) return;
    if (isDesktop && window.electronAPI) {
      await window.electronAPI.deleteCourse(id);
      await loadCourses();
    } else {
      setCourses((prev) => prev.filter((c) => c.id !== id));
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner label={t('common.loading')} /></div>;

  return (
    <div>
      <PageHeader
        title={t('nav.courses')}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('common.create')}
          </Button>
        }
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {courses.length === 0 ? (
        <EmptyState title={t('courses.noCourses')} />
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((course) => (
            <CourseCardItem
              key={course.id}
              course={course}
              onOpen={() => navigate(`/courses/${course.id}`)}
              onDelete={() => void deleteCourse(course.id)}
            />
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('courses.create')}>
        <div className="flex flex-col gap-3">
          <Input label={t('courses.title')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void createCourse()} loading={creating} disabled={!title.trim()}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
