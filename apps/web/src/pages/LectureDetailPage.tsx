import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  Alert,
  EmptyState,
} from '@mindflow/ui';
import {
  mockLectures,
  mockSummary,
  mockTranscript,
  mockKeyConcepts,
  mockFlashcards,
} from '../lib/mock-data';

type LectureView = 'transcribing' | 'ready' | 'failed';

export function LectureDetailPage({ view = 'ready' }: { view?: LectureView }) {
  const { lectureId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lecture = mockLectures.find((item) => item.id === lectureId) ?? mockLectures[0];

  if (view === 'transcribing') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={lecture.title} />
        <Alert tone="info">{t('lectureDetail.processing')}</Alert>
        <EmptyState title={t('lectureDetail.transcript')} />
      </div>
    );
  }

  if (view === 'failed') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={lecture.title} />
        <Alert tone="danger">{t('lectureDetail.failed')}</Alert>
        <Button variant="secondary" onClick={() => navigate(0)}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={lecture.title}
        actions={
          <Button variant="danger" onClick={() => navigate('/lectures')}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('lectureDetail.delete')}
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <h2 className="mb-2 font-semibold text-slate-900">{t('lectureDetail.summary')}</h2>
          <p className="text-sm text-slate-600">{mockSummary}</p>
        </CardBody>
      </Card>

      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t('lectureDetail.transcript')}</h2>
      <Card className="mb-4">
        <CardBody className="flex flex-col gap-2">
          {mockTranscript.map((segment) => (
            <p key={segment.id} className="text-sm text-slate-700">
              <button
                type="button"
                className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-brand-700"
              >
                {segment.start}s
              </button>
              {segment.text}
            </p>
          ))}
        </CardBody>
      </Card>

      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t('lectureDetail.keyConcepts')}</h2>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {mockKeyConcepts.map((concept) => (
          <Card key={concept.id}>
            <CardBody>
              <Badge tone="info">{concept.label}</Badge>
              <p className="mt-1 text-sm text-slate-600">{concept.description}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold text-slate-900">{t('lectureDetail.flashcards')}</h2>
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
