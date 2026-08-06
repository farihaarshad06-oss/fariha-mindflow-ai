import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Input, Button, Select, Alert } from '@mindflow/ui';
import { createLectureSchema, type CreateLectureInput } from '@mindflow/validation';
import { mockCourses } from '../lib/mock-data';
import { apiClient } from '../lib/api';
import { useLectureStore } from '../store/lecture';

function normalizeLanguageCode(language?: string): string {
  const code = language?.trim().slice(0, 2).toLowerCase();
  return code && /^[a-z]{2}$/.test(code) ? code : 'en';
}

export function NewLecturePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectLecture = useLectureStore((s) => s.selectLecture);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLectureInput>({
    resolver: zodResolver(createLectureSchema),
    defaultValues: { consentAcknowledged: true },
  });

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  async function onSubmit(data: CreateLectureInput) {
    setSubmitError(null);

    // In the Electron desktop app, create the lecture in the local database so
    // we get a real CUID to pass to the RecorderPage. Without a valid lecture ID
    // the recording IPC handlers reject every call (Zod .cuid() validation).
    if (isDesktop && window.electronAPI) {
      const settingsRes = await window.electronAPI.getSettings();
      const preferredLanguage =
        settingsRes.ok && settingsRes.data
          ? normalizeLanguageCode((settingsRes.data as { preferredLanguage?: string }).preferredLanguage)
          : normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language);
      const res = await window.electronAPI.createLecture({
        title: data.title,
        courseId: data.courseId || undefined,
        language: preferredLanguage,
      });
      if (!res.ok) {
        setSubmitError(res.error ?? 'Failed to create lecture. Please try again.');
        return;
      }
      const lecture = res.data as { id: string; title: string };
      selectLecture({ id: lecture.id, title: lecture.title });
      await queryClient.invalidateQueries({ queryKey: ['lectures'] });
      navigate(`/lectures/${lecture.id}`, { replace: true });
      return;
    }

    // Non-desktop / web fallback: call the HTTP API (may fail in demo mode).
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
        {submitError && <Alert tone="danger">{submitError}</Alert>}
        <Button type="submit" loading={isSubmitting}>
          {t('common.create')}
        </Button>
      </form>
    </div>
  );
}
