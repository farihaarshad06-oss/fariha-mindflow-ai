import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Sparkles, Lightbulb, BrainCircuit, User, Copy, RefreshCw, ThumbsUp, ThumbsDown, BookOpen, AlertTriangle, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  Badge,
  EmptyState,
} from '@mindflow/ui';
import { mockCourses } from '../lib/mock-data';
import type { Citation } from '@mindflow/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface CourseOption {
  id: string;
  title: string;
}

const mockAssistantReply =
  'Based on your lecture, **autonomy** means respecting the patient\'s right to make their own medical decisions.\n\nThis principle requires healthcare providers to:\n- Provide complete and accurate information\n- Ensure the patient understands their options\n- Respect the patient\'s final decision, even if you disagree';

type ChatView = 'idle' | 'loading';

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
        <BrainCircuit className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
        <div className="flex gap-1" aria-label="AI is typing">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-slate-400"
              animate={{ y: [0, -5, 0] }}
              transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.6, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onCopy }: { message: Message; onCopy: (text: string) => void }) {
  const isUser = message.role === 'user';

  // Safely render basic markdown: bold, bullet lists, line breaks
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('- ')) {
        const parts = line.slice(2).split(/\*\*(.*?)\*\*/g);
        return (
          <li key={i} className="ml-4 list-disc">
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          </li>
        );
      }
      if (!line) return <br key={i} />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        </p>
      );
    });
  };

  const timeStr = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${isUser ? 'bg-slate-700' : 'bg-brand-600'}`}>
        {isUser
          ? <User className="h-4 w-4" aria-hidden="true" />
          : <BrainCircuit className="h-4 w-4" aria-hidden="true" />
        }
      </div>

      {/* Bubble */}
      <div className={`group max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm bg-brand-600 text-white'
              : 'rounded-bl-sm bg-slate-100 text-slate-800'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-strong:font-semibold prose-li:my-0">
              {renderContent(message.content)}
            </div>
          )}

          {message.citations && message.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 border-t border-white/20 pt-2">
              {message.citations.map((citation) => (
                <Badge key={citation.id} tone="info">
                  <BookOpen className="me-1 h-2.5 w-2.5" />
                  {citation.sourceLabel} · {citation.timestampStart}s
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className={`flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-400">{timeStr}</span>
          {!isUser && (
            <>
              <button
                type="button"
                onClick={() => onCopy(message.content)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Copy message"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-green-600"
                aria-label="Thumbs up"
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                aria-label="Thumbs down"
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ChatPage({ view: _view = 'idle' }: { view?: ChatView }) {
  const { t } = useTranslation();
  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  const [courses, setCourses] = useState<CourseOption[]>(
    mockCourses.map((c) => ({ id: c.id, title: c.title }))
  );
  const [courseId, setCourseId] = useState(mockCourses[0]?.id ?? '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<'AI_NOT_CONFIGURED' | 'ERROR' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedCourse = courses.find((c) => c.id === courseId);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Load real courses from desktop API
  useEffect(() => {
    if (!isDesktop || !window.electronAPI) return;
    void (async () => {
      const res = await window.electronAPI!.listCourses();
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const loaded = (res.data as Array<{ id: string; title: string }>).map((c) => ({ id: c.id, title: c.title }));
        setCourses(loaded);
        setCourseId(loaded[0]!.id);
      }
    })();
  }, [isDesktop]);

  // Load chat history when course changes (desktop only)
  useEffect(() => {
    if (!isDesktop || !window.electronAPI || !courseId) return;
    void (async () => {
      const res = await window.electronAPI!.getChatHistory(courseId);
      if (res.ok && Array.isArray(res.data)) {
        const history: Message[] = (res.data as Array<{ id: string; role: string; content: string; createdAt: string }>).map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
        }));
        setMessages(history);
      }
    })();
  }, [isDesktop, courseId]);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setAiError(null);

    if (isDesktop && window.electronAPI) {
      void (async () => {
        const res = await window.electronAPI!.sendChatMessage({ courseId: courseId || undefined, message: text });
        if (res.ok && res.data) {
          const data = res.data as { message: { id: string; content: string; createdAt: string }; sources?: Array<{ segmentId: string; lectureId: string; text: string }> };
          const citations: Citation[] = (data.sources ?? []).map((s) => ({
            id: s.segmentId,
            sourceType: 'TRANSCRIPT_SEGMENT' as const,
            lectureId: s.lectureId,
            transcriptSegmentId: s.segmentId,
            timestampStart: 0,
            timestampEnd: 0,
            sourceLabel: s.text.slice(0, 40),
          }));
          setMessages((prev) => [
            ...prev,
            {
              id: data.message.id,
              role: 'assistant',
              content: data.message.content,
              citations: citations.length > 0 ? citations : undefined,
              timestamp: new Date(data.message.createdAt),
            },
          ]);
        } else {
          const code = res.code ?? '';
          if (code === 'AI_NOT_CONFIGURED') {
            setAiError('AI_NOT_CONFIGURED');
          } else {
            setAiError('ERROR');
          }
          // Remove the optimistically-added user message on error
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        }
        setLoading(false);
      })();
    } else {
      // Fallback mock for non-desktop / development
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: mockAssistantReply, timestamp: new Date() },
        ]);
        setLoading(false);
      }, 900);
    }
  }, [isDesktop, courseId]);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const suggestedPrompts = [
    { label: t('chat.explainSimpler'), icon: <Sparkles className="h-3.5 w-3.5" /> },
    { label: t('chat.giveExample'), icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { label: 'Summarize key points', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-1 pb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('chat.title')}</h1>
          {selectedCourse && (
            <p className="text-xs text-slate-500">Context: {selectedCourse.title}</p>
          )}
        </div>
        <Select
          aria-label={t('chat.courseSelector')}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-48"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </Select>
      </div>

      {/* AI not configured banner */}
      <AnimatePresence>
        {aiError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-1 mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {aiError === 'AI_NOT_CONFIGURED' ? (
              <span>
                AI provider not configured.{' '}
                <a href="/settings" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:text-amber-900">
                  <Settings className="h-3 w-3" /> Open Settings
                </a>{' '}
                to add your API key.
              </span>
            ) : (
              <span>Failed to get a response. Please try again.</span>
            )}
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="ml-auto text-amber-600 hover:text-amber-900"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-y-auto px-1 py-4">
        {messages.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <EmptyState
              icon={<BrainCircuit className="h-12 w-12 text-slate-300" />}
              title={t('chat.empty')}
              description={selectedCourse ? `Ask anything about "${selectedCourse.title}"` : 'Select a course and start chatting.'}
            />
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => send(p.label)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onCopy={copyToClipboard} />
            ))}
            <AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white pt-3">
        {messages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestedPrompts.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => send(p.label)}
                className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
          <textarea
            ref={textareaRef}
            aria-label={t('chat.placeholder')}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            placeholder={t('chat.placeholder')}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            aria-label={t('chat.send')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}


