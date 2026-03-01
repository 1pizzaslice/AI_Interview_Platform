import type { InterviewState } from '../../shared/types';

/**
 * Pure state transition logic — no side effects, no I/O.
 * All transitions return the next state or throw if invalid.
 */

export interface StateMachineContext {
  currentState: InterviewState;
  totalTopics: number;
  currentQuestionIndex: number;
  followUpCount: number;
  maxFollowUpsPerQuestion: number;
}

export type TransitionEvent =
  | 'CANDIDATE_READY'
  | 'WARMUP_COMPLETE'
  | 'ANSWER_RECEIVED'
  | 'FOLLOWUP_EXHAUSTED'
  | 'TOPIC_COMPLETE'
  | 'ALL_TOPICS_COMPLETE'
  | 'WRAP_UP_COMPLETE'
  | 'SCORING_COMPLETE'
  | 'ABANDON'
  | 'FORCE_WRAP_UP';

export function getTopicState(n: number): InterviewState {
  return `TOPIC_${n}` as InterviewState;
}

export function getCurrentTopicNumber(state: InterviewState): number | null {
  const match = state.match(/^TOPIC_(\d+)$/);
  return match ? parseInt(match[1]!, 10) : null;
}

export function isTopicState(state: InterviewState): boolean {
  return /^TOPIC_\d+$/.test(state);
}

export function transition(
  ctx: StateMachineContext,
  event: TransitionEvent,
): InterviewState {
  const { currentState, totalTopics, currentQuestionIndex } = ctx;

  // ABANDON is valid from any state
  if (event === 'ABANDON') return 'ABANDONED';

  // Force wrap up is valid from any active state
  if (event === 'FORCE_WRAP_UP' && !['SCORING', 'DONE', 'ABANDONED'].includes(currentState)) {
    return 'WRAP_UP';
  }

  switch (currentState) {
    case 'INTRO':
      if (event === 'CANDIDATE_READY') return 'WARMUP';
      break;

    case 'WARMUP':
      if (event === 'WARMUP_COMPLETE') return totalTopics > 0 ? getTopicState(1) : 'WRAP_UP';
      break;

    case 'WRAP_UP':
      if (event === 'WRAP_UP_COMPLETE') return 'SCORING';
      break;

    case 'SCORING':
      if (event === 'SCORING_COMPLETE') return 'DONE';
      break;

    case 'DONE':
    case 'ABANDONED':
      // Terminal states — no transitions
      break;

    default: {
      const topicNum = getCurrentTopicNumber(currentState);
      if (topicNum !== null) {
        if (event === 'ANSWER_RECEIVED') {
          // Stay in same TOPIC state — follow-up or next question handled by service
          return currentState;
        }
        if (event === 'TOPIC_COMPLETE') {
          if (topicNum < totalTopics) return getTopicState(topicNum + 1);
          return 'WRAP_UP';
        }
        if (event === 'ALL_TOPICS_COMPLETE') return 'WRAP_UP';
      }
    }
  }

  throw new Error(`Invalid transition: ${event} from state ${currentState}`);
}

export function isTerminalState(state: InterviewState): boolean {
  return state === 'DONE' || state === 'ABANDONED';
}

export function isActiveState(state: InterviewState): boolean {
  return !['SCORING', 'DONE', 'ABANDONED'].includes(state);
}

export function needsAIResponse(state: InterviewState): boolean {
  return ['INTRO', 'WARMUP', 'WRAP_UP'].includes(state) || isTopicState(state);
}
