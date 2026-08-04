import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mic, Plus } from 'lucide-react';
import { PageHeader, Card, CardBody, Button, Badge, EmptyState } from '@mindflow/ui';
import { mockLectures } from '../lib/mock-data';

export function LecturesPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader
        title={t('lectures.title')}
        actions={
          <Link to="/lectures/new">
            <Button>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('lectures.new')}
            </Button>
          </Link>
        }
      />
      {mockLectures.length === 0 ? (
        <EmptyState
          title={t('lectures.noLectures')}
          action={
            <Link to="/recorder">
              <Button>
                <Mic className="h-4 w-4" aria-hidden="true" /> {t('nav.recorder')}
              </Button>
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {mockLectures.map((lecture) => (
            <li key={lecture.id}>
              <Link to={`/lectures/${lecture.id}`}>
                <Card>
                  <CardBody className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{lecture.title}</p>
                      <p className="text-xs text-slate-500">
                        {lecture.durationSeconds
                          ? `${Math.round(lecture.durationSeconds / 60)} min`
                          : ''}
                      </p>
                    </div>
                    <Badge tone={lecture.state === 'READY' ? 'success' : 'info'}>{lecture.state}</Badge>
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
