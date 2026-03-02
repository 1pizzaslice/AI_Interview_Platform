'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useInterviewStore } from '@/stores/interview.store';
import dynamic from 'next/dynamic';
import ProgressStepper from '@/components/interview/ProgressStepper';
import EquipmentCheck from '@/components/interview/EquipmentCheck';
import { Mic, Volume2, Keyboard, Send, CheckCircle2 } from 'lucide-react';

const FaceDetector = dynamic(() => import('@/components/interview/FaceDetector'), { ssr: false });

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
  const aiSpeakingFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioStreamBufferRef = useRef<ArrayBuffer[]>([]);
  const isStreamingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [noSpeechToast, setNoSpeechToast] = useState(false);
  const [started, setStarted] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendAntiCheatEvent = useCallback((event: { type: string; timestamp: Date; metadata: Record<string, unknown> }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'anticheat', sessionId, event }));
    }
  }, [sessionId]);

  const addMessage = useCallback((speaker: 'ai' | 'candidate', text: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      speaker,
      text,
      timestamp: new Date(),
    }]);
  }, []);

  const sendPlaybackComplete = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
      wsRef.current.send(JSON.stringify({ type: 'playback_complete', sessionId }));
    }
  }, [sessionId]);

  const playAudio = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (arrayBuffer.byteLength === 0) {
      setRecordingState('idle');
      sendPlaybackComplete();
      return;
    }
    if (aiSpeakingFallbackRef.current) {
      clearTimeout(aiSpeakingFallbackRef.current);
      aiSpeakingFallbackRef.current = null;
    }
    // Stop any currently playing audio to prevent overlap
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch { /* already stopped */ }
      currentSourceRef.current = null;
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
      source.onended = () => {
        currentSourceRef.current = null;
        setRecordingState('idle');
        sendPlaybackComplete();
      };
      currentSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error('[Interview] Audio playback error:', err);
      currentSourceRef.current = null;
      setRecordingState('idle');
      sendPlaybackComplete();
    }
  }, [sendPlaybackComplete]);

  const handleStart = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    void audioCtxRef.current.resume();
    setStarted(true);
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

    const handlePaste = (e: ClipboardEvent) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pastedText = e.clipboardData?.getData('text') ?? '';
        wsRef.current.send(JSON.stringify({
          type: 'anticheat',
          sessionId,
          event: {
            type: 'COPY_PASTE',
            timestamp: new Date(),
            metadata: { pastedLength: pastedText.length },
          },
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('paste', handlePaste);
    };
  }, [sessionId]);

  // WebSocket connection
  useEffect(() => {
    if (!token || !started) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';
    const ws = new WebSocket(`${wsUrl}/interview`);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', sessionId, token }));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        if (isStreamingRef.current) {
          audioStreamBufferRef.current.push(event.data);
        } else {
          void playAudio(event.data);
        }
        return;
      }

      const data = JSON.parse(event.data as string) as {
        type: string;
        text?: string;
        state?: string;
        reportId?: string;
        totalQuestions?: number;
        currentQuestionIndex?: number;
      };

      if (data.type === 'joined') {
        if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
        if (data.currentQuestionIndex !== undefined) setCurrentQuestionIndex(data.currentQuestionIndex);
      }

      if (data.type === 'ai_message' && data.text) {
        addMessage('ai', data.text);
        setRecordingState('ai_speaking');
        if (aiSpeakingFallbackRef.current) clearTimeout(aiSpeakingFallbackRef.current);
        aiSpeakingFallbackRef.current = setTimeout(
          () => setRecordingState(s => s === 'ai_speaking' ? 'idle' : s),
          15_000,
        );
      }

      if (data.type === 'audio_start') {
        isStreamingRef.current = true;
        audioStreamBufferRef.current = [];
      }

      if (data.type === 'audio_end') {
        isStreamingRef.current = false;
        const chunks = audioStreamBufferRef.current;
        audioStreamBufferRef.current = [];

        if (chunks.length > 0) {
          const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0);
          const merged = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }
          void playAudio(merged.buffer);
        }
      }

      if (data.type === 'partial_transcript' && data.text) {
        setPartialTranscript(data.text);
      }

      if (data.type === 'candidate_transcript' && data.text) {
        setPartialTranscript('');
        addMessage('candidate', data.text);
      }

      if (data.type === 'audio_stop') {
        // Kill any active playback and clear streaming buffer
        if (currentSourceRef.current) {
          try {
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
          } catch { /* already stopped */ }
          currentSourceRef.current = null;
        }
        audioStreamBufferRef.current = [];
        isStreamingRef.current = false;
        setRecordingState('idle');
      }

      if (data.type === 'stt_empty') {
        setRecordingState('idle');
        setNoSpeechToast(true);
        setTimeout(() => setNoSpeechToast(false), 3000);
      }

      if (data.type === 'state_change' && data.state) {
        setCurrentState(data.state);
        const topicMatch = data.state.match(/^TOPIC_(\d+)$/);
        if (topicMatch) {
          setCurrentQuestionIndex(parseInt(topicMatch[1], 10) - 1);
        }
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

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 30_000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [sessionId, token, started, setCurrentState, addMessage, playAudio]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recordingState === 'recording') {
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
          void blob.arrayBuffer().then(buf => {
            wsRef.current?.send(buf);
          });
        } else {
          setRecordingState('idle');
        }
      };

      recorder.start(250);
      setRecordingState('recording');
      wsRef.current?.send(JSON.stringify({ type: 'recording_start', sessionId }));
    } catch (err) {
      console.error('[Interview] Mic access error:', err);
      setMicError('Microphone access denied. Please allow mic access or use text mode.');
      setRecordingState('idle');
    }
  }, [recordingState, sessionId]);

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

  if (!started) {
    return (
      <EquipmentCheck
        onReady={handleStart}
        onSkipToText={() => {
          setInputMode('text');
          handleStart();
        }}
      />
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-bold text-zinc-100">Interview Complete</h1>
          <p className="text-zinc-400">
            {currentState === 'ABANDONED'
              ? 'The interview session was abandoned.'
              : "Your responses are being scored. You'll be notified when your report is ready."}
          </p>
          <a href={`/candidate/feedback/${sessionId}`} className="text-purple-400 hover:text-purple-300 text-sm block mt-2 transition-colors">
            View Your Feedback
          </a>
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-zinc-100">AI Interview</h1>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${connected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]'}`} />
          {connected ? 'Connected' : 'Connecting...'}
        </span>
      </div>

      {/* Progress stepper */}
      {totalQuestions > 0 && (
        <ProgressStepper
          currentState={currentState}
          totalQuestions={totalQuestions}
          currentQuestionIndex={currentQuestionIndex}
        />
      )}

      {/* No-speech toast */}
      {noSpeechToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/10 text-amber-400 text-sm px-4 py-2 rounded-full shadow z-10">
          No speech detected — try again
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${
              msg.speaker === 'ai'
                ? 'bg-white/5 backdrop-blur-xl border border-white/10 text-zinc-200'
                : 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
            }`}>
              {msg.speaker === 'ai' && <p className="text-xs font-medium text-zinc-500 mb-1">AI Interviewer</p>}
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {partialTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[70%] rounded-2xl px-4 py-3 text-sm bg-purple-500/20 text-purple-200 italic border border-purple-500/20">
              {partialTranscript}...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 px-6 py-5">
        {micError && (
          <p className="text-rose-400 text-xs mb-3 text-center">{micError}</p>
        )}

        {inputMode === 'voice' ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => void toggleRecording()}
              disabled={micButtonDisabled}
              className={[
                'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none',
                recordingState === 'idle'
                  ? 'bg-white/5 hover:bg-white/10 ring-4 ring-white/10 disabled:opacity-50'
                  : recordingState === 'recording'
                    ? 'bg-rose-500/20 ring-4 ring-rose-500/30 animate-pulse shadow-[0_0_30px_rgba(244,63,94,0.3)]'
                    : recordingState === 'processing'
                      ? 'bg-purple-500/10 ring-4 ring-purple-500/20 cursor-not-allowed'
                      : 'bg-purple-500/10 ring-4 ring-purple-500/30 animate-pulse shadow-[0_0_30px_rgba(168,85,247,0.3)] cursor-not-allowed',
              ].join(' ')}
              aria-label={micButtonLabel}
            >
              {recordingState === 'processing'
                ? <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                : recordingState === 'ai_speaking'
                  ? <Volume2 className="w-7 h-7 text-purple-400" />
                  : <Mic className={`w-7 h-7 ${recordingState === 'recording' ? 'text-rose-400' : 'text-zinc-300'}`} />}
            </button>
            <p className="text-sm text-zinc-500">{micButtonLabel}</p>
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
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={sendTextAnswer}
              disabled={!input.trim() || !connected || recordingState === 'processing' || recordingState === 'ai_speaking'}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-violet-600 disabled:opacity-50 transition-all duration-200 self-end"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex justify-center mt-4">
          <div className="flex rounded-full bg-white/5 border border-white/10 overflow-hidden text-xs">
            <button
              onClick={() => setInputMode('voice')}
              className={`px-4 py-1.5 flex items-center gap-1.5 transition-all duration-200 ${inputMode === 'voice' ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Mic className="w-3 h-3" /> Voice
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`px-4 py-1.5 flex items-center gap-1.5 transition-all duration-200 ${inputMode === 'text' ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Keyboard className="w-3 h-3" /> Text
            </button>
          </div>
        </div>
      </div>

      {/* Face detection anti-cheat */}
      <FaceDetector onAntiCheatEvent={sendAntiCheatEvent} enabled={connected && !isComplete} />
    </div>
  );
}
