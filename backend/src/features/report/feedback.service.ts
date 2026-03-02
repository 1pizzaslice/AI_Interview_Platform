import { ReportModel } from './report.model';
import { InterviewSessionModel } from '../interview/interview.model';
import { AppError } from '../../shared/errors/app-error';

export interface CandidateFeedback {
  candidateName: string;
  jobTitle: string;
  performanceTier: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
  dimensionRatings: Array<{
    dimension: string;
    rating: 'Strong' | 'Competent' | 'Developing' | 'Weak';
  }>;
  tips: string[];
  completedAt: string;
}

function scoreTier(score: number): CandidateFeedback['performanceTier'] {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Average';
  return 'Needs Improvement';
}

function dimensionRating(score: number): 'Strong' | 'Competent' | 'Developing' | 'Weak' {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Competent';
  if (score >= 35) return 'Developing';
  return 'Weak';
}

export async function getCandidateFeedback(sessionId: string, candidateId: string): Promise<CandidateFeedback> {
  // Verify the session belongs to this candidate
  const session = await InterviewSessionModel.findById(sessionId).lean();
  if (!session) throw AppError.notFound('Session not found');
  if (session.candidateId.toString() !== candidateId) throw AppError.forbidden('Access denied');
  if (session.currentState !== 'DONE') throw AppError.badRequest('Interview not yet completed');

  const report = await ReportModel.findOne({ sessionId })
    .populate('candidateId', 'name')
    .populate('jobRoleId', 'title')
    .lean();

  if (!report) throw AppError.notFound('Feedback not yet available');

  const candidate = report.candidateId as unknown as { name: string };
  const job = report.jobRoleId as unknown as { title: string };

  // Generate general tips based on dimension scores (NOT revealing exact scores)
  const tips: string[] = [];
  if (report.dimensionScores.technical < 50) {
    tips.push('Consider deepening your technical knowledge in the areas discussed. Practice explaining technical concepts clearly.');
  }
  if (report.dimensionScores.communication < 50) {
    tips.push('Try to structure your answers more clearly. Use the STAR method (Situation, Task, Action, Result) for behavioral questions.');
  }
  if (report.dimensionScores.problemSolving < 50) {
    tips.push('When facing technical problems, talk through your reasoning out loud. Show your thought process, not just the final answer.');
  }
  if (report.dimensionScores.culturalFit < 50) {
    tips.push('Research the company culture before interviews. Prepare examples of teamwork and collaboration from your experience.');
  }
  if (tips.length === 0) {
    tips.push('Great performance overall! Continue refining your interview skills with practice.');
  }

  return {
    candidateName: candidate.name,
    jobTitle: job.title,
    performanceTier: scoreTier(report.overallScore),
    dimensionRatings: [
      { dimension: 'Technical Skills', rating: dimensionRating(report.dimensionScores.technical) },
      { dimension: 'Communication', rating: dimensionRating(report.dimensionScores.communication) },
      { dimension: 'Problem Solving', rating: dimensionRating(report.dimensionScores.problemSolving) },
      { dimension: 'Cultural Fit', rating: dimensionRating(report.dimensionScores.culturalFit) },
    ],
    tips,
    completedAt: report.generatedAt.toISOString(),
  };
}
