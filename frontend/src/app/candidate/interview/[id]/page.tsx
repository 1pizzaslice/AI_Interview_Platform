'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useInterviewStore } from '@/stores/interview.store';

interface Message {
  id: string;
  speaker: 'ai' | 'candidate';
  text: string;
  timestamp: Date;
}

export default function InterviewPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.accessToken);
  const { currentState, setCurrentState } = useInterviewStore();

  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Anti-cheat: tab/window visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'anticheat',
          sessionId,
          event: { type: 'TAB_SWITCH', timestamp: new Date(), metadata: {} },
        }));
      }
    };
    const handleBlur = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'anticheat',
          sessionId,
          event: { type: 'WINDOW_BLUR', timestamp: new Date(), metadata: {} },
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sessionId]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}/interview`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', sessionId, token }));
    };

    ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as {
        type: string;
        text?: string;
        state?: string;
        reportId?: string;
      };

      if (data.type === 'ai_message' && data.text) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          speaker: 'ai',
          text: data.text!,
          timestamp: new Date(),
        }]);
      }

      if (data.type === 'state_change' && data.state) {
        setCurrentState(data.state);
      }

      if (data.type === 'interview_complete') {
        setIsComplete(true);
        setReportId(data.reportId ?? null);
      }

      if (data.type === 'session_abandoned') {
        setCurrentState('ABANDONED');
        setIsComplete(true);
      }
    };

    ws.onclose = () => setConnected(false);

    // Ping keepalive
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 30_000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [sessionId, token, setCurrentState]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendAnswer = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      speaker: 'candidate',
      text,
      timestamp: new Date(),
    }]);

    wsRef.current.send(JSON.stringify({ type: 'answer', sessionId, text }));
    setInput('');
  }, [input, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold">Interview Complete</h1>
          <p className="text-gray-500">
            {currentState === 'ABANDONED'
              ? 'The interview session was abandoned.'
              : "Your responses are being scored. You'll be notified when your report is ready."}
          </p>
          {reportId && (
            <a href={`/recruiter/reports/${reportId}`} className="text-brand-600 hover:underline text-sm">
              View Report
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">AI Interview</h1>
          <p className="text-xs text-gray-500">State: {currentState}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {connected ? 'Connected' : 'Connecting...'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
              msg.speaker === 'ai'
                ? 'bg-white border border-gray-200 text-gray-800'
                : 'bg-brand-600 text-white'
            }`}>
              {msg.speaker === 'ai' && <p className="text-xs font-medium text-gray-400 mb-1">AI Interviewer</p>}
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-6 py-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={sendAnswer}
            disabled={!input.trim() || !connected}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
