import { useState, useEffect } from 'react';

import { PageHeader, Card, CardBody, Button, Badge, Progress, Alert, Spinner } from '@mindflow/ui';
import { Download, Trash2, CheckCircle2, XCircle, Pause } from 'lucide-react';

interface WhisperModel {
  id: string;
  name: string;
  sizeBytes: number;
  state: string;
  downloadedBytes: number;
  localPath: string | null;
  downloadedAt: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function ModelManagerPage() {

  const [models, setModels] = useState<WhisperModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, { downloaded: number; total: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  const loadModels = async () => {
    if (!isDesktop || !window.electronAPI) { setLoading(false); return; }
    const res = await window.electronAPI.listModels();
    if (res.ok && Array.isArray(res.data)) {
      setModels(res.data as WhisperModel[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadModels();
    if (!isDesktop || !window.electronAPI) return;
    const unsub = window.electronAPI.onModelDownloadProgress((data) => {
      setProgress((prev) => ({ ...prev, [data.modelId]: { downloaded: data.downloaded, total: data.total } }));
      if (data.downloaded >= data.total) {
        void loadModels();
        setProgress((prev) => { const n = { ...prev }; delete n[data.modelId]; return n; });
      }
    });
    return unsub;
  }, [isDesktop]);

  const download = async (modelId: string) => {
    if (!window.electronAPI) return;
    setError(null);
    const res = await window.electronAPI.downloadModel({ modelId });
    if (!res.ok) setError(res.error ?? 'Download failed');
  };

  const cancel = async (modelId: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.cancelDownload(modelId);
    await loadModels();
  };

  const deleteModel = async (modelId: string) => {
    if (!confirm('Delete this model file?') || !window.electronAPI) return;
    await window.electronAPI.deleteModel(modelId);
    await loadModels();
  };

  if (!isDesktop) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Whisper Models" />
        <Alert tone="info">Model management is only available in the desktop app.</Alert>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner label="Loading…" /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Whisper Models" description="Download and manage local transcription models." />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      <div className="flex flex-col gap-3">
        {models.map((model) => {
          const dl = progress[model.id];
          const pct = dl ? Math.round((dl.downloaded / dl.total) * 100) : 0;
          const isDownloading = model.state === 'DOWNLOADING' || !!dl;

          return (
            <Card key={model.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{model.name}</span>
                      {model.state === 'READY' && (
                        <Badge tone="success"><CheckCircle2 className="me-1 h-3 w-3" />Ready</Badge>
                      )}
                      {model.state === 'DOWNLOADING' && (
                        <Badge tone="info">Downloading {pct}%</Badge>
                      )}
                      {model.state === 'ERROR' && (
                        <Badge tone="danger"><XCircle className="me-1 h-3 w-3" />Error</Badge>
                      )}
                      {model.state === 'AVAILABLE' && (
                        <Badge tone="neutral">Not downloaded</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{formatBytes(model.sizeBytes)}</p>
                    {isDownloading && (
                      <div className="mt-2">
                        <Progress value={pct} label="Downloading" />
                        <p className="mt-1 text-xs text-slate-500">
                          {dl ? `${formatBytes(dl.downloaded)} / ${formatBytes(dl.total)}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {model.state === 'AVAILABLE' || model.state === 'ERROR' ? (
                      <Button onClick={() => void download(model.id)} aria-label={`Download ${model.name}`}>
                        <Download className="h-4 w-4" aria-hidden="true" /> Download
                      </Button>
                    ) : null}
                    {isDownloading && (
                      <Button variant="secondary" onClick={() => void cancel(model.id)}>
                        <Pause className="h-4 w-4" aria-hidden="true" /> Cancel
                      </Button>
                    )}
                    {model.state === 'READY' && (
                      <Button variant="danger" onClick={() => void deleteModel(model.id)} aria-label={`Delete ${model.name}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
