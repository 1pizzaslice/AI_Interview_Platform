import mongoose, { type Document, type Model } from 'mongoose';

export interface IQuestionBankItem {
  text: string;
  topicArea: string;
  difficulty: 'easy' | 'medium' | 'hard';
  followUpPrompts: string[];
}

export interface IQuestionBank extends Document {
  recruiterId: mongoose.Types.ObjectId;
  jobRoleId: mongoose.Types.ObjectId | null;
  name: string;
  questions: IQuestionBankItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const questionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    topicArea: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    followUpPrompts: [{ type: String }],
  },
  { _id: false },
);

const questionBankSchema = new mongoose.Schema<IQuestionBank>(
  {
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    jobRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRole', default: null },
    name: { type: String, required: true, trim: true },
    questions: [questionItemSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

questionBankSchema.index({ recruiterId: 1 });
questionBankSchema.index({ jobRoleId: 1 });

export const QuestionBankModel: Model<IQuestionBank> = mongoose.model<IQuestionBank>('QuestionBank', questionBankSchema);
