import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Input, Button, Alert } from '@mindflow/ui';
import { loginSchema, type LoginInput } from '@mindflow/validation';
import { useAuthStore } from '../store/auth';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setError(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch {
      setError(t('common.error'));
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t('nav.dashboard')}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
        <Card>
          <div className="flex flex-col gap-4">
            <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />
          </div>
        </Card>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" loading={isSubmitting}>
          {t('nav.dashboard')}
        </Button>
        <p className="text-center text-sm text-slate-500">
          <Link to="/onboarding" className="text-brand-700">
            {t('onboarding.title')}
          </Link>
        </p>
      </form>
    </div>
  );
}
