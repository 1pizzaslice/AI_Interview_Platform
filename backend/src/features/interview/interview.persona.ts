import type { TranscriptEntry, Question } from '../../shared/types';
import type { LLMMessage } from '../../adapters/llm/llm.interface';

export interface PersonaContext {
  candidateName: string;
  resumeSummary: string;
  resumeSkills: string[];
  jobTitle: string;
  experienceLevel: string;
}

const PERSONA_SYSTEM_PROMPT = `You are Alex, a senior technical interviewer at a leading tech company. You conduct conversational, human-feeling interviews.

Your personality:
- Warm but professional — you put candidates at ease while maintaining rigor
- You listen carefully and reference specific things the candidate says
- You acknowledge good answers with specific praise ("That's a solid approach to cache invalidation")
- You push gently on weak answers ("I'd like to understand that more deeply — can you walk me through a specific example?")
- You use the candidate's name naturally (not every sentence, but occasionally)
- You create natural bridges between topics instead of mechanical transitions
- You never say "Good answer. Moving on:" — you flow conversationally

Rules:
- Keep responses concise (2-4 sentences unless asking a complex question)
- Never break character or reference being an AI
- Never use markdown formatting, bullet points, or numbered lists in your spoken responses
- Speak as you would in a real conversation`;

export function buildSystemPrompt(ctx: PersonaContext): string {
  return `${PERSONA_SYSTEM_PROMPT}

Interview context:
- Candidate: ${ctx.candidateName}
- Role: ${ctx.experienceLevel} ${ctx.jobTitle}
- Key skills from resume: ${ctx.resumeSkills.slice(0, 10).join(', ')}
- Resume summary: ${ctx.resumeSummary.slice(0, 300)}`;
}

export function buildConversationHistory(
  transcript: TranscriptEntry[],
  systemPrompt: string,
): LLMMessage[] {
  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const entry of transcript) {
    messages.push({
      role: entry.speaker === 'ai' ? 'assistant' : 'user',
      content: entry.text,
    });
  }

  return messages;
}

export function buildEvaluationPrompt(
  questionText: string,
  answerText: string,
  resumeSummary: string,
  difficulty: string,
): string {
  return `Evaluate this interview answer for depth and quality.

Question (${difficulty} difficulty): "${questionText}"
Candidate's answer: "${answerText}"
Resume context: "${resumeSummary.slice(0, 300)}"

Return ONLY valid JSON:
{
  "needsFollowUp": true/false,
  "reason": "shallow" | "vague" | "contradicts_resume" | "off_topic" | "adequate" | "excellent",
  "detectedStrength": "specific strength or null",
  "detectedWeakness": "specific weakness or null",
  "suggestedProbe": "a specific follow-up question referencing their answer, or null",
  "confidenceLevel": 0.0-1.0
}

Guidelines:
- "shallow": answer lacks detail or specifics (< 2 sentences of substance)
- "vague": answer is generic without concrete examples
- "contradicts_resume": answer conflicts with resume claims
- "off_topic": answer doesn't address the question
- "adequate": answer is solid with reasonable depth
- "excellent": answer shows deep understanding with specific examples
- needsFollowUp should be true for shallow, vague, contradicts_resume
- suggestedProbe should reference specific claims from the answer`;
}

export function buildTransitionPrompt(
  previousTopicArea: string,
  previousAnswer: string,
  nextQuestion: Question,
): string {
  return `Generate a natural conversational transition from the previous topic to the next question.

Previous topic: ${previousTopicArea}
What the candidate just said (summary): "${previousAnswer.slice(0, 200)}"
Next question to ask: "${nextQuestion.text}"
Next topic area: ${nextQuestion.topicArea}

Create a 1-2 sentence transition that:
1. Briefly acknowledges or references something specific from their previous answer
2. Naturally bridges to the next topic
3. Ends by asking the next question

Do NOT say "Good answer" or "Moving on" or "Let's switch gears". Make it flow like a real conversation.
Return only the transition text, nothing else.`;
}

export function buildFollowUpPrompt(
  questionText: string,
  answerText: string,
  evaluation: { reason: string; suggestedProbe: string | null },
  resumeSummary: string,
): string {
  return `Generate a follow-up question based on the candidate's answer.

Original question: "${questionText}"
Candidate's answer: "${answerText}"
Evaluation: The answer was ${evaluation.reason}.
${evaluation.suggestedProbe ? `Suggested probe direction: "${evaluation.suggestedProbe}"` : ''}
Resume context: "${resumeSummary.slice(0, 200)}"

Generate a single follow-up question that:
- References something specific the candidate said
- Probes deeper into a claim or concept they mentioned
- Cross-references resume data when relevant
- Is conversational, not interrogative

Return only the follow-up question text, nothing else.`;
}

export function buildWarmupPrompt(
  candidateName: string,
  transcript: TranscriptEntry[],
  questionNumber: number,
  totalWarmup: number,
): string {
  const lastAnswer = transcript.filter(e => e.speaker === 'candidate').pop()?.text ?? '';

  if (questionNumber === 1) {
    return `Start the warmup by asking ${candidateName} a casual question about their background or what they're currently working on. Keep it brief and conversational. Return only the question.`;
  }

  return `The candidate just said: "${lastAnswer.slice(0, 200)}"

Ask warmup question ${questionNumber} of ${totalWarmup}. Build on what they said — acknowledge something interesting, then ask a natural follow-up about their work or interests. Keep it brief. Return only the question.`;
}
