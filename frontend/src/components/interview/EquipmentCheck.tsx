'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Monitor, Mic, Volume2, Camera, Wifi } from 'lucide-react';

interface CheckResult {
  browser: 'pass' | 'fail' | 'pending';
  microphone: 'pass' | 'fail' | 'pending';
  speaker: 'pass' | 'fail' | 'pending';
  camera: 'pass' | 'fail' | 'pending';
  network: 'pass' | 'fail' | 'pending';
}

interface EquipmentCheckProps {
  onReady: () => void;
  onSkipToText: () => void;
}

export default function EquipmentCheck({ onReady, onSkipToText }: EquipmentCheckProps) {
  const [checks, setChecks] = useState<CheckResult>({
    browser: 'pending',
    microphone: 'pending',
    speaker: 'pending',
    camera: 'pending',
    network: 'pending',
  });
  const [micLevel, setMicLevel] = useState(0);
  const [checking, setChecking] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);

  const allPassed = Object.values(checks).every(v => v === 'pass');
  const hasFail = Object.values(checks).some(v => v === 'fail');

  const runChecks = useCallback(async () => {
    setChecking(true);

    // 1. Browser compatibility
    const hasMediaDevices = !!(navigator.mediaDevices?.getUserMedia);
    const hasWebSocket = typeof WebSocket !== 'undefined';
    const hasAudioContext = typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext !== 'undefined';
    setChecks(prev => ({
      ...prev,
      browser: hasMediaDevices && hasWebSocket && hasAudioContext ? 'pass' : 'fail',
    }));

    // 2. Microphone access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let maxLevel = 0;
      const startTime = Date.now();

      const monitor = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        const normalized = Math.min(100, Math.round(avg * 2));
        setMicLevel(normalized);
        if (normalized > maxLevel) maxLevel = normalized;

        if (Date.now() - startTime < 3000) {
          animRef.current = requestAnimationFrame(monitor);
        } else {
          setChecks(prev => ({
            ...prev,
            microphone: maxLevel > 5 ? 'pass' : 'fail',
          }));
        }
      };
      monitor();
    } catch {
      setChecks(prev => ({ ...prev, microphone: 'fail' }));
    }

    // 3. Speaker test
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 440;
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
      }, 200);
      setChecks(prev => ({ ...prev, speaker: 'pass' }));
    } catch {
      setChecks(prev => ({ ...prev, speaker: 'fail' }));
    }

    // 4. Camera access
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      camStream.getTracks().forEach(t => t.stop());
      setChecks(prev => ({ ...prev, camera: 'pass' }));
    } catch {
      setChecks(prev => ({ ...prev, camera: 'fail' }));
    }

    // 5. Network latency check
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const start = Date.now();
      await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
      const latency = Date.now() - start;
      setChecks(prev => ({
        ...prev,
        network: latency < 3000 ? 'pass' : 'fail',
      }));
    } catch {
      setChecks(prev => ({ ...prev, network: 'fail' }));
    }

    setChecking(false);
  }, []);

  useEffect(() => {
    void runChecks();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [runChecks]);

  const statusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    if (status === 'fail') return <XCircle className="w-5 h-5 text-rose-400" />;
    return <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />;
  };

  const checkItems = [
    { key: 'browser', label: 'Browser compatibility', icon: Monitor },
    { key: 'microphone', label: 'Microphone access', icon: Mic },
    { key: 'speaker', label: 'Speaker output', icon: Volume2 },
    { key: 'camera', label: 'Camera access', icon: Camera },
    { key: 'network', label: 'Network connection', icon: Wifi },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full space-y-6"
      >
        <div className="text-center">
          <h1 className="text-xl font-bold text-zinc-100">Equipment Check</h1>
          <p className="text-sm text-zinc-400 mt-1">Let&apos;s make sure everything is working before we start.</p>
        </div>

        <div className="space-y-4">
          {checkItems.map(item => (
            <div key={item.key}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-300">{item.label}</span>
                </div>
                {statusIcon(checks[item.key])}
              </div>
              {item.key === 'microphone' && checks.microphone === 'pass' && (
                <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-100"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={onReady}
            disabled={!allPassed && !hasFail}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-violet-500 text-white rounded-xl font-semibold text-base hover:from-purple-600 hover:to-violet-600 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
          >
            {checking ? 'Checking...' : allPassed ? 'Start Interview' : hasFail ? 'Start Anyway' : 'Checking...'}
          </button>
          <button
            onClick={onSkipToText}
            className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip to text mode
          </button>
        </div>
      </motion.div>
    </div>
  );
}
