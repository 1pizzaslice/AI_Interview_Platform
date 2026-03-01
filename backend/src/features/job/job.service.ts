import mongoose from 'mongoose';
import { JobRoleModel } from './job.model';
import { AppError } from '../../shared/errors/app-error';
import type { CreateJobInput, UpdateJobInput } from '../../shared/validators';

export async function createJob(recruiterId: string, input: CreateJobInput) {
  const job = await JobRoleModel.create({ ...input, recruiterId });
  return job;
}

export async function listJobs(role: 'candidate' | 'recruiter', recruiterId?: string) {
  const filter = role === 'candidate'
    ? { isActive: true }
    : { recruiterId };
  return JobRoleModel.find(filter).sort({ createdAt: -1 }).lean();
}

export async function getJob(jobId: string, callerRole: 'candidate' | 'recruiter') {
  if (!mongoose.isValidObjectId(jobId)) throw AppError.notFound('Job not found');
  const job = await JobRoleModel.findById(jobId).lean();
  if (!job) throw AppError.notFound('Job not found');
  if (!job.isActive && callerRole === 'candidate') throw AppError.notFound('Job not found');
  return job;
}

export async function updateJob(jobId: string, recruiterId: string, input: UpdateJobInput) {
  if (!mongoose.isValidObjectId(jobId)) throw AppError.notFound('Job not found');
  const job = await JobRoleModel.findOneAndUpdate(
    { _id: jobId, recruiterId },
    { $set: input },
    { new: true, runValidators: true },
  ).lean();
  if (!job) throw AppError.notFound('Job not found or you do not own it');
  return job;
}

export async function deleteJob(jobId: string, recruiterId: string) {
  if (!mongoose.isValidObjectId(jobId)) throw AppError.notFound('Job not found');
  const job = await JobRoleModel.findOneAndUpdate(
    { _id: jobId, recruiterId },
    { $set: { isActive: false } },
    { new: true },
  ).lean();
  if (!job) throw AppError.notFound('Job not found or you do not own it');
  return job;
}
