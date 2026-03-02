import mongoose, { type Document, type Model } from 'mongoose';

export type PipelineStage = 'applied' | 'screened' | 'interviewed' | 'offered' | 'rejected';

export interface IPipelineEntry extends Document {
  recruiterId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  jobRoleId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId | null;
  stage: PipelineStage;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const pipelineEntrySchema = new mongoose.Schema<IPipelineEntry>(
  {
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    jobRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRole', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', default: null },
    stage: {
      type: String,
      enum: ['applied', 'screened', 'interviewed', 'offered', 'rejected'],
      default: 'applied',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

pipelineEntrySchema.index({ recruiterId: 1, jobRoleId: 1 });
pipelineEntrySchema.index({ candidateId: 1, jobRoleId: 1 }, { unique: true });

export const PipelineEntryModel: Model<IPipelineEntry> = mongoose.model<IPipelineEntry>('PipelineEntry', pipelineEntrySchema);
