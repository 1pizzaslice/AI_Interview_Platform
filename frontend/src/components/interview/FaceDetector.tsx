'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface FaceDetectorProps {
  onAntiCheatEvent: (event: { type: string; timestamp: Date; metadata: Record<string, unknown> }) => void;
  enabled?: boolean;
}

/**
 * Browser-based face detection using TensorFlow.js BlazeFace.
 * Runs at ~2 FPS in browser. Emits anti-cheat events:
 * - 0 faces detected → GAZE_LOST
 * - 2+ faces detected → MULTIPLE_FACES
 * Shows a small webcam preview to the candidate.
 */
export default function FaceDetector({ onAntiCheatEvent, enabled = true }: FaceDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const modelRef = useRef<BlazeFaceModel | null>(null);
  const lastEventRef = useRef<string | null>(null);
  const cooldownRef = useRef(0);
  const [status, setStatus] = useState<'loading' | 'active' | 'error' | 'disabled'>('loading');

  const detectFaces = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return; // not enough data

    try {
      const predictions = await modelRef.current.estimateFaces(video, false);
      const faceCount = predictions.length;
      const now = Date.now();

      // Cooldown: don't fire events more than once every 5s per event type
      if (now - cooldownRef.current > 5000) {
        if (faceCount === 0 && lastEventRef.current !== 'GAZE_LOST') {
          lastEventRef.current = 'GAZE_LOST';
          cooldownRef.current = now;
          onAntiCheatEvent({
            type: 'GAZE_LOST',
            timestamp: new Date(),
            metadata: { faceCount: 0 },
          });
        } else if (faceCount >= 2 && lastEventRef.current !== 'MULTIPLE_FACES') {
          lastEventRef.current = 'MULTIPLE_FACES';
          cooldownRef.current = now;
          onAntiCheatEvent({
            type: 'MULTIPLE_FACES',
            timestamp: new Date(),
            metadata: { faceCount },
          });
        } else if (faceCount === 1) {
          lastEventRef.current = null; // Reset when face count is normal
        }
      }
    } catch {
      // Detection error — skip this frame
    }
  }, [onAntiCheatEvent]);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        // Dynamically import TensorFlow.js to avoid SSR issues
        const [tf, blazeface] = await Promise.all([
          import('@tensorflow/tfjs-core'),
          import('@tensorflow-models/blazeface'),
        ]);

        // Load a light backend
        await import('@tensorflow/tfjs-backend-webgl');
        await tf.ready();

        if (cancelled) return;

        const model = await blazeface.load();
        modelRef.current = model as unknown as BlazeFaceModel;

        // Request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('active');

        // Detection loop at ~2 FPS (every 500ms)
        const loop = async () => {
          if (cancelled) return;
          await detectFaces();
          animFrameRef.current = window.setTimeout(loop, 500) as unknown as number;
        };
        void loop();
      } catch (err) {
        console.error('[FaceDetector] Init error:', err);
        setStatus('error');
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (animFrameRef.current) clearTimeout(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [enabled, detectFaces]);

  if (!enabled || status === 'disabled') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="relative rounded-lg overflow-hidden shadow-lg border-2 border-gray-200 bg-black" style={{ width: 160, height: 120 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover mirror"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-white text-xs">Loading camera...</span>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-red-300 text-xs">Camera unavailable</span>
          </div>
        )}
        <div className="absolute top-1 left-1">
          <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
        </div>
      </div>
    </div>
  );
}

// Minimal type for BlazeFace model (avoids importing the full type)
interface BlazeFaceModel {
  estimateFaces(input: HTMLVideoElement, returnTensors: boolean): Promise<Array<{ topLeft: number[]; bottomRight: number[] }>>;
}
