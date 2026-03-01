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

type RecordingState = 'idle' | 'recording' | 'processing' | 'ai_speaking';
type InputMode = 'voice' | 'text';

export default function InterviewPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.accessToken);
  const { currentState, setCurrentState } = useInterviewStore();

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [noSpeechToast, setNoSpeechToast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((speaker: 'ai' | 'candidate', text: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      speaker,
      text,
      timestamp: new Date(),
    }]);
  }, []);

  const playAudio = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (arrayBuffer.byteLength === 0) {
      setRecordingState('idle');
      return;
    }
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      setRecordingState('ai_speaking');
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      source.onended = () => setRecordingState('idle');
      source.start();
    } catch (err) {
      console.error('[Interview] Audio playback error:', err);
      setRecordingState('idle');
    }
  }, []);

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
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', sessionId, token }));
    };

    ws.onmessage = (event: MessageEvent) => {
      // Binary frame = TTS audio
      if (event.data instanceof ArrayBuffer) {
        void playAudio(event.data);
        return;
      }

      const data = JSON.parse(event.data as string) as {
        type: string;
        text?: string;
        state?: string;
        reportId?: string;
      };

      if (data.type === 'ai_message' && data.text) {
        addMessage('ai', data.text);
      }

      if (data.type === 'candidate_transcript' && data.text) {
        addMessage('candidate', data.text);
      }

      if (data.type === 'stt_empty') {
        setRecordingState('idle');
        setNoSpeechToast(true);
        setTimeout(() => setNoSpeechToast(false), 3000);
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
  }, [sessionId, token, setCurrentState, addMessage, playAudio]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recordingState === 'recording') {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    if (recordingState !== 'idle') return;

    setMicError(null);

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          setRecordingState('processing');
          // Initialize AudioContext on first user interaction
          if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext();
          }
          void blob.arrayBuffer().then(buf => {
            wsRef.current?.send(buf);
          });
        } else {
          setRecordingState('idle');
        }
      };

      recorder.start(250);
      setRecordingState('recording');
    } catch (err) {
      console.error('[Interview] Mic access error:', err);
      setMicError('Microphone access denied. Please allow mic access or use text mode.');
      setRecordingState('idle');
    }
  }, [recordingState]);

  const sendTextAnswer = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    addMessage('candidate', text);
    wsRef.current.send(JSON.stringify({ type: 'answer', sessionId, text }));
    setInput('');
    setRecordingState('processing');
  }, [input, sessionId, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextAnswer();
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

  const micButtonLabel = {
    idle: 'Click to speak',
    recording: 'Listening... (click to stop)',
    processing: 'Processing...',
    ai_speaking: 'AI speaking...',
  }[recordingState];

  const micButtonDisabled = recordingState === 'processing' || recordingState === 'ai_speaking' || !connected;

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

      {/* No-speech toast */}
      {noSpeechToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 text-sm px-4 py-2 rounded-full shadow z-10">
          No speech detected — try again
        </div>
      )}

      {/* Transcript */}
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

      {/* Input area */}
      <div className="bg-white border-t px-6 py-5">
        {micError && (
          <p className="text-red-500 text-xs mb-3 text-center">{micError}</p>
        )}

        {inputMode === 'voice' ? (
          <div className="flex flex-col items-center gap-3">
            {/* Mic button */}
            <button
              onClick={() => void toggleRecording()}
              disabled={micButtonDisabled}
              className={[
                'w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all focus:outline-none',
                recordingState === 'idle'
                  ? 'bg-gray-100 hover:bg-gray-200 ring-4 ring-gray-200 disabled:opacity-50'
                  : recordingState === 'recording'
                    ? 'bg-red-500 ring-4 ring-red-300 animate-pulse'
                    : recordingState === 'processing'
                      ? 'bg-yellow-100 ring-4 ring-yellow-200 cursor-not-allowed'
                      : 'bg-blue-100 ring-4 ring-blue-300 animate-pulse cursor-not-allowed',
              ].join(' ')}
              aria-label={micButtonLabel}
            >
              {recordingState === 'processing'
                ? <span className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                : recordingState === 'ai_speaking'
                  ? '🔊'
                  : '🎙'}
            </button>
            <p className="text-sm text-gray-500">{micButtonLabel}</p>
          </div>
        ) : (
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer... (Enter to send, Shift+Enter for new line)"
              rows={2}
              disabled={recordingState === 'processing' || recordingState === 'ai_speaking' || !connected}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            />
            <button
              onClick={sendTextAnswer}
              disabled={!input.trim() || !connected || recordingState === 'processing' || recordingState === 'ai_speaking'}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors self-end"
            >
              Send
            </button>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex justify-center mt-4">
          <div className="flex rounded-full border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setInputMode('voice')}
              className={`px-4 py-1.5 transition-colors ${inputMode === 'voice' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              🎙 Voice
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`px-4 py-1.5 transition-colors ${inputMode === 'text' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              ⌨ Text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
