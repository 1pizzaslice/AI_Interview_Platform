'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationProgressContextValue {
  start: () => void;
  done: () => void;
}

const NavigationProgressContext = createContext<NavigationProgressContextValue>({
  start: () => {},
  done: () => {},
});

export function useNavigationProgress() {
  return useContext(NavigationProgressContext);
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathRef = useRef(pathname);

  const clearTrickle = useCallback(() => {
    if (trickleRef.current) {
      clearTimeout(trickleRef.current);
      trickleRef.current = null;
    }
  }, []);

  const trickle = useCallback(() => {
    const steps = [13, 40, 66, 80];
    let stepIndex = 0;

    function next() {
      if (stepIndex < steps.length) {
        setProgress(steps[stepIndex]);
        stepIndex++;
        trickleRef.current = setTimeout(next, 400 + Math.random() * 300);
      }
    }

    next();
  }, []);

  const start = useCallback(() => {
    clearTrickle();
    setProgress(0);
    setIsNavigating(true);
    setVisible(true);
    // Start trickle on next frame so the 0% state renders first
    requestAnimationFrame(() => trickle());
  }, [clearTrickle, trickle]);

  const done = useCallback(() => {
    clearTrickle();
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
    }, 200);
  }, [clearTrickle]);

  // Detect navigation end when pathname changes
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      if (isNavigating) {
        done();
      }
    }
  }, [pathname, isNavigating, done]);

  // Intercept <a> clicks for navigation start detection
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Skip external links, anchor hashes, target=_blank, and modified clicks
      if (
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('#') ||
        anchor.target === '_blank' ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      ) {
        return;
      }

      // Skip if already on the same path
      if (href === pathname) return;

      start();
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname, start]);

  return (
    <NavigationProgressContext.Provider value={{ start, done }}>
      {isNavigating && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-0.5"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-violet-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
            style={{
              width: `${progress}%`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      )}
      {children}
    </NavigationProgressContext.Provider>
  );
}
