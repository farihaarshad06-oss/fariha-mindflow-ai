import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Mic, Sparkles, ShieldCheck, BookOpen, Brain, ArrowRight } from 'lucide-react';
import { Button, Card } from '@mindflow/ui';

const benefits = [
  { icon: BookOpen, key: 'benefit1' },
  { icon: Brain, key: 'benefit2' },
  { icon: Sparkles, key: 'benefit3' },
  { icon: ShieldCheck, key: 'benefit4' },
] as const;

export function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold text-slate-900">{t('appName')}</span>
        <Link to="/login" className="text-sm font-medium text-brand-700">
          {t('nav.dashboard')}
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-24">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('tagline')}
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl"
        >
          {t('home.heroTitle')}
        </motion.h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{t('home.heroSubtitle')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/recorder">
            <Button>
              <Mic className="h-4 w-4" aria-hidden="true" /> {t('home.ctaRecord')}
            </Button>
          </Link>
          <Link to="/chat">
            <Button variant="secondary">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('home.ctaTutor')}
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">{t('home.privacyNote')}</p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="text-center text-2xl font-semibold text-slate-900">{t('home.benefitsTitle')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <Card key={benefit.key} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-slate-700">{t(`home.${benefit.key}`)}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
        <p>
          {t('appName')} — {t('tagline')}
        </p>
        <Link to="/privacy" className="mt-2 inline-flex items-center gap-1 text-brand-700">
          {t('nav.privacy')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
