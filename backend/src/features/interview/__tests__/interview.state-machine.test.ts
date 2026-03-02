import { describe, it, expect } from 'vitest';
import {
  transition,
  isTerminalState,
  isActiveState,
  isTopicState,
  getCurrentTopicNumber,
  getTopicState,
  type StateMachineContext,
} from '../interview.state-machine';

function makeCtx(overrides: Partial<StateMachineContext> = {}): StateMachineContext {
  return {
    currentState: 'INTRO',
    totalTopics: 3,
    currentQuestionIndex: 0,
    followUpCount: 0,
    maxFollowUpsPerQuestion: 2,
    ...overrides,
  };
}

describe('interview state machine', () => {
  describe('transition', () => {
    it('transitions from INTRO to WARMUP on CANDIDATE_READY', () => {
      const ctx = makeCtx({ currentState: 'INTRO' });
      expect(transition(ctx, 'CANDIDATE_READY')).toBe('WARMUP');
    });

    it('transitions from WARMUP to TOPIC_1 on WARMUP_COMPLETE', () => {
      const ctx = makeCtx({ currentState: 'WARMUP', totalTopics: 3 });
      expect(transition(ctx, 'WARMUP_COMPLETE')).toBe('TOPIC_1');
    });

    it('transitions from WARMUP to WRAP_UP when no topics', () => {
      const ctx = makeCtx({ currentState: 'WARMUP', totalTopics: 0 });
      expect(transition(ctx, 'WARMUP_COMPLETE')).toBe('WRAP_UP');
    });

    it('transitions from TOPIC_1 to TOPIC_2 on TOPIC_COMPLETE', () => {
      const ctx = makeCtx({ currentState: 'TOPIC_1' as const, totalTopics: 3, currentQuestionIndex: 0 });
      expect(transition(ctx, 'TOPIC_COMPLETE')).toBe('TOPIC_2');
    });

    it('transitions from last TOPIC to WRAP_UP on TOPIC_COMPLETE', () => {
      const ctx = makeCtx({ currentState: 'TOPIC_3' as const, totalTopics: 3, currentQuestionIndex: 2 });
      expect(transition(ctx, 'TOPIC_COMPLETE')).toBe('WRAP_UP');
    });

    it('transitions from TOPIC to WRAP_UP on ALL_TOPICS_COMPLETE', () => {
      const ctx = makeCtx({ currentState: 'TOPIC_2' as const, totalTopics: 3 });
      expect(transition(ctx, 'ALL_TOPICS_COMPLETE')).toBe('WRAP_UP');
    });

    it('transitions from WRAP_UP to SCORING', () => {
      const ctx = makeCtx({ currentState: 'WRAP_UP' });
      expect(transition(ctx, 'WRAP_UP_COMPLETE')).toBe('SCORING');
    });

    it('transitions from SCORING to DONE', () => {
      const ctx = makeCtx({ currentState: 'SCORING' });
      expect(transition(ctx, 'SCORING_COMPLETE')).toBe('DONE');
    });

    it('ABANDON transitions from any state', () => {
      for (const state of ['INTRO', 'WARMUP', 'TOPIC_1', 'WRAP_UP'] as const) {
        const ctx = makeCtx({ currentState: state });
        expect(transition(ctx, 'ABANDON')).toBe('ABANDONED');
      }
    });

    it('FORCE_WRAP_UP works from active states', () => {
      const ctx = makeCtx({ currentState: 'TOPIC_2' as const });
      expect(transition(ctx, 'FORCE_WRAP_UP')).toBe('WRAP_UP');
    });

    it('throws on invalid transition', () => {
      const ctx = makeCtx({ currentState: 'INTRO' });
      expect(() => transition(ctx, 'WARMUP_COMPLETE')).toThrow('Invalid transition');
    });

    it('terminal states have no transitions', () => {
      const ctx = makeCtx({ currentState: 'DONE' });
      expect(() => transition(ctx, 'CANDIDATE_READY')).toThrow();
    });
  });

  describe('helpers', () => {
    it('isTerminalState returns true for DONE and ABANDONED', () => {
      expect(isTerminalState('DONE')).toBe(true);
      expect(isTerminalState('ABANDONED')).toBe(true);
      expect(isTerminalState('INTRO')).toBe(false);
    });

    it('isActiveState returns false for terminal/scoring states', () => {
      expect(isActiveState('SCORING')).toBe(false);
      expect(isActiveState('DONE')).toBe(false);
      expect(isActiveState('ABANDONED')).toBe(false);
      expect(isActiveState('TOPIC_1')).toBe(true);
    });

    it('isTopicState detects TOPIC_N pattern', () => {
      expect(isTopicState('TOPIC_1')).toBe(true);
      expect(isTopicState('TOPIC_99')).toBe(true);
      expect(isTopicState('INTRO')).toBe(false);
      expect(isTopicState('WRAP_UP')).toBe(false);
    });

    it('getCurrentTopicNumber extracts number from TOPIC_N', () => {
      expect(getCurrentTopicNumber('TOPIC_1')).toBe(1);
      expect(getCurrentTopicNumber('TOPIC_5')).toBe(5);
      expect(getCurrentTopicNumber('INTRO')).toBe(null);
    });

    it('getTopicState creates correct state string', () => {
      expect(getTopicState(1)).toBe('TOPIC_1');
      expect(getTopicState(3)).toBe('TOPIC_3');
    });
  });
});
