'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface CheckResult {
  browser: 'pass' | 'fail' | 'pending';
  microphone: 'pass' | 'fail' | 'pending';
  speaker: 'pass' | 'fail' | 'pending';
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

      // Set up VU meter
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Monitor levels for a few seconds
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
          // If we got any audio signal, mic works
          setChecks(prev => ({
            ...prev,
            microphone: maxLevel > 5 ? 'pass' : 'pass', // pass even if quiet — mic is accessible
          }));
        }
      };
      monitor();

      setChecks(prev => ({ ...prev, microphone: 'pass' }));
    } catch {
      setChecks(prev => ({ ...prev, microphone: 'fail' }));
    }

    // 3. Speaker test (just check AudioContext works)
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.05; // very quiet
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

    // 4. Network latency check
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
    if (status === 'pass') return <span className="text-green-500 text-lg">&#10003;</span>;
    if (status === 'fail') return <span className="text-red-500 text-lg">&#10007;</span>;
    return <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl border shadow-sm p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Equipment Check</h1>
          <p className="text-sm text-gray-500 mt-1">Let&apos;s make sure everything is working before we start.</p>
        </div>

        <div className="space-y-4">
          {/* Browser */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Browser compatibility</span>
            {statusIcon(checks.browser)}
          </div>

          {/* Microphone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Microphone access</span>
              {statusIcon(checks.microphone)}
            </div>
            {checks.microphone === 'pass' && (
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-100"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
            )}
          </div>

          {/* Speaker */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Speaker output</span>
            {statusIcon(checks.speaker)}
          </div>

          {/* Network */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Network connection</span>
            {statusIcon(checks.network)}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={onReady}
            disabled={!allPassed && !hasFail}
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold text-base hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {checking ? 'Checking...' : allPassed ? 'Start Interview' : hasFail ? 'Start Anyway' : 'Checking...'}
          </button>
          <button
            onClick={onSkipToText}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip to text mode
          </button>
        </div>
      </div>
    </div>
  );
}
