import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Input, Button, Select, Alert } from '@mindflow/ui';
import { createLectureSchema, type CreateLectureInput } from '@mindflow/validation';
import { mockCourses } from '../lib/mock-data';
import { apiClient } from '../lib/api';

export function NewLecturePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLectureInput>({
    resolver: zodResolver(createLectureSchema),
    defaultValues: { consentAcknowledged: true },
  });

  async function onSubmit(data: CreateLectureInput) {
    try {
      await apiClient.post('/lectures', data);
    } catch {
      // Demo mode: continue without backend.
    }
    navigate('/recorder');
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{t('lectures.new')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card>
          <div className="flex flex-col gap-4">
            <Input label={t('nav.lectures')} {...register('title')} error={errors.title?.message} />
            <Select label={t('nav.courses')} {...register('courseId')}>
              <option value="">—</option>
              {mockCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </Select>
          </div>
        </Card>
        <Alert tone="warning">
          <label className="flex items-start gap-2">
            <input type="checkbox" {...register('consentAcknowledged')} className="mt-1" />
            <span>{t('recorder.consentRequired')}</span>
          </label>
        </Alert>
        <Button type="submit" loading={isSubmitting}>
          {t('common.create')}
        </Button>
      </form>
    </div>
  );
}
