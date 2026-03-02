import { PipelineEntryModel, type PipelineStage } from './pipeline.model';
import { AppError } from '../../shared/errors/app-error';

export async function listPipeline(recruiterId: string, jobRoleId?: string) {
  const filter: Record<string, unknown> = { recruiterId };
  if (jobRoleId) filter.jobRoleId = jobRoleId;

  return PipelineEntryModel.find(filter)
    .populate('candidateId', 'name email')
    .populate('jobRoleId', 'title domain')
    .sort({ updatedAt: -1 })
    .lean();
}

export async function addToPipeline(
  recruiterId: string,
  data: { candidateId: string; jobRoleId: string; sessionId?: string; stage?: PipelineStage; notes?: string },
) {
  const existing = await PipelineEntryModel.findOne({
    candidateId: data.candidateId,
    jobRoleId: data.jobRoleId,
  });
  if (existing) throw AppError.conflict('Candidate already in pipeline for this job');

  return PipelineEntryModel.create({
    recruiterId,
    candidateId: data.candidateId,
    jobRoleId: data.jobRoleId,
    sessionId: data.sessionId ?? null,
    stage: data.stage ?? 'applied',
    notes: data.notes ?? '',
  });
}

export async function updateStage(
  id: string,
  recruiterId: string,
  stage: PipelineStage,
  notes?: string,
) {
  const entry = await PipelineEntryModel.findById(id);
  if (!entry) throw AppError.notFound('Pipeline entry not found');
  if (entry.recruiterId.toString() !== recruiterId) throw AppError.forbidden('Access denied');

  entry.stage = stage;
  if (notes !== undefined) entry.notes = notes;
  await entry.save();
  return entry;
}

export async function removeFromPipeline(id: string, recruiterId: string) {
  const entry = await PipelineEntryModel.findById(id);
  if (!entry) throw AppError.notFound('Pipeline entry not found');
  if (entry.recruiterId.toString() !== recruiterId) throw AppError.forbidden('Access denied');
  await entry.deleteOne();
}
