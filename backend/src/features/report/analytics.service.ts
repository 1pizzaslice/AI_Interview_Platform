import mongoose from 'mongoose';
import { ReportModel } from './report.model';
import { JobRoleModel } from '../job/job.model';

export interface ScoreDistributionBucket {
  range: string;
  count: number;
}

export interface RecommendationBreakdown {
  recommendation: string;
  count: number;
}

export interface DimensionAverage {
  technical: number;
  communication: number;
  problemSolving: number;
  culturalFit: number;
  resumeAlignment: number;
}

export interface TimeTrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
  avgScore: number;
}

export interface RoleBreakdown {
  jobRoleId: string;
  title: string;
  domain: string;
  count: number;
  avgScore: number;
  passRate: number; // percentage of HIRE + STRONG_HIRE
}

export interface AnalyticsResult {
  totalReports: number;
  avgScore: number;
  passRate: number;
  avgConfidence: number;
  scoreDistribution: ScoreDistributionBucket[];
  recommendationBreakdown: RecommendationBreakdown[];
  dimensionAverages: DimensionAverage;
  timeTrend: TimeTrendPoint[];
  roleBreakdown: RoleBreakdown[];
}

interface AnalyticsFilters {
  recruiterId: string;
  jobRoleId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResult> {
  const jobs = await JobRoleModel.find({ recruiterId: filters.recruiterId }, '_id title domain').lean();
  const jobIds = jobs.map(j => j._id);

  if (jobIds.length === 0) {
    return emptyAnalytics();
  }

  // Build match stage
  const match: Record<string, unknown> = {
    jobRoleId: filters.jobRoleId
      ? new mongoose.Types.ObjectId(filters.jobRoleId)
      : { $in: jobIds },
  };

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateFrom) dateFilter.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) dateFilter.$lte = new Date(filters.dateTo);
    match.generatedAt = dateFilter;
  }

  // Run all aggregations in parallel
  const [
    summaryResult,
    scoreDistResult,
    recBreakdownResult,
    dimensionResult,
    timeTrendResult,
    roleResult,
  ] = await Promise.all([
    // 1. Summary stats
    ReportModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          avgScore: { $avg: '$overallScore' },
          avgConfidence: { $avg: '$averageConfidence' },
          passCount: {
            $sum: { $cond: [{ $in: ['$recommendation', ['STRONG_HIRE', 'HIRE']] }, 1, 0] },
          },
        },
      },
    ]),

    // 2. Score distribution (10-point buckets)
    ReportModel.aggregate([
      { $match: match },
      {
        $bucket: {
          groupBy: '$overallScore',
          boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101],
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ]),

    // 3. Recommendation breakdown
    ReportModel.aggregate([
      { $match: match },
      { $group: { _id: '$recommendation', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // 4. Dimension averages
    ReportModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          technical: { $avg: '$dimensionScores.technical' },
          communication: { $avg: '$dimensionScores.communication' },
          problemSolving: { $avg: '$dimensionScores.problemSolving' },
          culturalFit: { $avg: '$dimensionScores.culturalFit' },
          resumeAlignment: { $avg: '$dimensionScores.resumeAlignment' },
        },
      },
    ]),

    // 5. Time trend (daily)
    ReportModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$generatedAt' } },
          count: { $sum: 1 },
          avgScore: { $avg: '$overallScore' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 6. Role breakdown
    ReportModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$jobRoleId',
          count: { $sum: 1 },
          avgScore: { $avg: '$overallScore' },
          passCount: {
            $sum: { $cond: [{ $in: ['$recommendation', ['STRONG_HIRE', 'HIRE']] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'jobroles',
          localField: '_id',
          foreignField: '_id',
          as: 'job',
        },
      },
      { $unwind: '$job' },
      { $sort: { count: -1 } },
    ]),
  ]);

  // Process summary
  const summary = summaryResult[0] ?? { totalReports: 0, avgScore: 0, avgConfidence: 0, passCount: 0 };
  const totalReports = summary.totalReports;
  const passRate = totalReports > 0 ? Math.round((summary.passCount / totalReports) * 100) : 0;

  // Process score distribution
  const bucketLabels: Record<number, string> = {
    0: '0-9', 10: '10-19', 20: '20-29', 30: '30-39', 40: '40-49',
    50: '50-59', 60: '60-69', 70: '70-79', 80: '80-89', 90: '90-100',
  };
  const scoreDistribution: ScoreDistributionBucket[] = scoreDistResult.map(
    (b: { _id: number; count: number }) => ({
      range: bucketLabels[b._id] ?? `${b._id}+`,
      count: b.count,
    }),
  );

  // Process recommendation breakdown
  const recommendationBreakdown: RecommendationBreakdown[] = recBreakdownResult.map(
    (r: { _id: string; count: number }) => ({
      recommendation: r._id,
      count: r.count,
    }),
  );

  // Process dimension averages
  const dimRaw = dimensionResult[0];
  const dimensionAverages: DimensionAverage = dimRaw
    ? {
        technical: Math.round(dimRaw.technical ?? 0),
        communication: Math.round(dimRaw.communication ?? 0),
        problemSolving: Math.round(dimRaw.problemSolving ?? 0),
        culturalFit: Math.round(dimRaw.culturalFit ?? 0),
        resumeAlignment: Math.round(dimRaw.resumeAlignment ?? 0),
      }
    : { technical: 0, communication: 0, problemSolving: 0, culturalFit: 0, resumeAlignment: 0 };

  // Process time trend
  const timeTrend: TimeTrendPoint[] = timeTrendResult.map(
    (t: { _id: string; count: number; avgScore: number }) => ({
      date: t._id,
      count: t.count,
      avgScore: Math.round(t.avgScore),
    }),
  );

  // Process role breakdown
  const roleBreakdown: RoleBreakdown[] = roleResult.map(
    (r: { _id: mongoose.Types.ObjectId; count: number; avgScore: number; passCount: number; job: { title: string; domain: string } }) => ({
      jobRoleId: r._id.toString(),
      title: r.job.title,
      domain: r.job.domain,
      count: r.count,
      avgScore: Math.round(r.avgScore),
      passRate: Math.round((r.passCount / r.count) * 100),
    }),
  );

  return {
    totalReports,
    avgScore: Math.round(summary.avgScore ?? 0),
    passRate,
    avgConfidence: Math.round((summary.avgConfidence ?? 0.7) * 100) / 100,
    scoreDistribution,
    recommendationBreakdown,
    dimensionAverages,
    timeTrend,
    roleBreakdown,
  };
}

function emptyAnalytics(): AnalyticsResult {
  return {
    totalReports: 0,
    avgScore: 0,
    passRate: 0,
    avgConfidence: 0,
    scoreDistribution: [],
    recommendationBreakdown: [],
    dimensionAverages: { technical: 0, communication: 0, problemSolving: 0, culturalFit: 0, resumeAlignment: 0 },
    timeTrend: [],
    roleBreakdown: [],
  };
}
