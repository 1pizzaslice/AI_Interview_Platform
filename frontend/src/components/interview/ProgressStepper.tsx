'use client';

import { cn } from '@/lib/cn';

interface ProgressStepperProps {
  currentState: string;
  totalQuestions: number;
  currentQuestionIndex: number;
}

interface Step {
  id: string;
  label: string;
  state: 'completed' | 'active' | 'upcoming';
}

function parseSteps(currentState: string, totalQuestions: number, currentQuestionIndex: number): Step[] {
  const steps: Step[] = [];

  const stateOrder = ['INTRO', 'WARMUP'];
  for (let i = 1; i <= totalQuestions; i++) stateOrder.push(`TOPIC_${i}`);
  stateOrder.push('WRAP_UP', 'SCORING', 'DONE');

  const currentIndex = stateOrder.indexOf(currentState);

  // Intro
  steps.push({
    id: 'INTRO',
    label: 'Intro',
    state: currentIndex > 0 ? 'completed' : currentIndex === 0 ? 'active' : 'upcoming',
  });

  // Warmup
  steps.push({
    id: 'WARMUP',
    label: 'Warmup',
    state: currentIndex > 1 ? 'completed' : currentIndex === 1 ? 'active' : 'upcoming',
  });

  // Topics (collapsed into single step with counter)
  const topicStartIdx = 2;
  const topicEndIdx = topicStartIdx + totalQuestions - 1;
  const isInTopic = currentIndex >= topicStartIdx && currentIndex <= topicEndIdx;
  steps.push({
    id: 'TOPICS',
    label: isInTopic
      ? `Q${currentQuestionIndex + 1}/${totalQuestions}`
      : currentIndex > topicEndIdx
        ? `${totalQuestions}/${totalQuestions}`
        : `0/${totalQuestions}`,
    state: currentIndex > topicEndIdx ? 'completed' : isInTopic ? 'active' : 'upcoming',
  });

  // Wrap Up
  const wrapUpIdx = topicEndIdx + 1;
  steps.push({
    id: 'WRAP_UP',
    label: 'Wrap Up',
    state: currentIndex > wrapUpIdx ? 'completed' : currentIndex === wrapUpIdx ? 'active' : 'upcoming',
  });

  return steps;
}

export default function ProgressStepper({ currentState, totalQuestions, currentQuestionIndex }: ProgressStepperProps) {
  const steps = parseSteps(currentState, totalQuestions, currentQuestionIndex);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-zinc-900/80 backdrop-blur-xl border-b border-white/5">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          {i > 0 && (
            <div className={cn(
              'w-6 h-0.5 mx-1',
              step.state === 'upcoming' ? 'bg-zinc-800' : 'bg-gradient-to-r from-purple-500 to-violet-500',
            )} />
          )}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              step.state === 'completed' && 'bg-purple-500 text-white',
              step.state === 'active' && 'bg-zinc-800 text-purple-400 ring-2 ring-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]',
              step.state === 'upcoming' && 'bg-zinc-800 text-zinc-500',
            )}>
              {step.state === 'completed' ? '\u2713' : i + 1}
            </div>
            <span className={cn(
              'text-xs font-medium',
              step.state === 'active' ? 'text-purple-400' : step.state === 'completed' ? 'text-zinc-400' : 'text-zinc-600',
            )}>
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
