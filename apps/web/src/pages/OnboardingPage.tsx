import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Input, Button, Alert, Select } from '@mindflow/ui';
import { onboardingSchema, type OnboardingInput } from '@mindflow/validation';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@mindflow/config';

const roles = ['STUDENT', 'PROFESSIONAL', 'UNIVERSITY_ADMIN'];

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { consentAcknowledged: true as const },
  });

  function onSubmit(_data: OnboardingInput) {
    navigate('/dashboard');
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t('onboarding.title')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
        <Card>
          <div className="flex flex-col gap-4">
            <Select label={t('onboarding.role')} {...register('role')}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
            <Input label={t('onboarding.institution')} {...register('institution')} />
            <Input label={t('onboarding.degree')} {...register('degree')} />
            <Input label={t('onboarding.semester')} {...register('semester')} />
            <Select label={t('onboarding.language')} {...register('preferredLanguage')}>
              {SUPPORTED_LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </option>
              ))}
            </Select>
            <Input label={t('onboarding.goals')} {...register('studyGoals.0')} />
          </div>
        </Card>

        <Alert tone="warning">
          <label className="flex items-start gap-2">
            <input type="checkbox" {...register('consentAcknowledged')} className="mt-1" />
            <span>{t('onboarding.consent')}</span>
          </label>
        </Alert>

        {errors.consentAcknowledged && (
          <Alert tone="danger">{errors.consentAcknowledged.message as string}</Alert>
        )}

        <Button type="submit" loading={isSubmitting}>
          {t('onboarding.submit')}
        </Button>
      </form>
    </div>
  );
}
