import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Sparkles, Lightbulb } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Select,
  Badge,
  EmptyState,
  Spinner,
} from '@mindflow/ui';
import { mockCourses } from '../lib/mock-data';
import type { Citation } from '@mindflow/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

const mockCitations: Citation[] = [
  {
    id: 'c1',
    sourceType: 'TRANSCRIPT_SEGMENT',
    lectureId: 'lecture-1',
    transcriptSegmentId: 'seg-2',
    timestampStart: 4,
    timestampEnd: 9,
    sourceLabel: 'Principles of Bioethics',
  },
];

const mockAssistantReply =
  'Based on your lecture, autonomy means respecting the patient’s right to make their own medical decisions.';

type ChatView = 'idle' | 'loading';

export function ChatPage({ view = 'idle' }: { view?: ChatView }) {
  const { t } = useTranslation();
  const [courseId, setCourseId] = useState(mockCourses[0]?.id ?? '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  function send(text: string) {
    if (!text.trim()) return;
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: mockAssistantReply, citations: mockCitations },
      ]);
      setLoading(false);
    }, 700);
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <PageHeader
        title={t('chat.title')}
        actions={
          <Select
            aria-label={t('chat.courseSelector')}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-48"
          >
            {mockCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
        }
      />

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardBody className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <EmptyState title={t('chat.empty')} />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <p>{message.content}</p>
                  {message.citations && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.citations.map((citation) => (
                        <Badge key={citation.id} tone="info">
                          {citation.sourceLabel} · {citation.timestampStart}s
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && <Spinner label={t('common.loading')} />}
        </CardBody>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <input
              aria-label={t('chat.placeholder')}
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder={t('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input);
              }}
            />
            <Button onClick={() => send(input)} aria-label={t('chat.send')}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="ghost" onClick={() => send('Explain simpler')}>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t('chat.explainSimpler')}
            </Button>
            <Button variant="ghost" onClick={() => send('Give an example')}>
              <Lightbulb className="h-4 w-4" aria-hidden="true" /> {t('chat.giveExample')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
