import { QuestionBankModel, type IQuestionBank } from './question-bank.model';
import { AppError } from '../../shared/errors/app-error';

export async function createQuestionBank(
  recruiterId: string,
  data: { name: string; jobRoleId?: string; questions: Array<{ text: string; topicArea: string; difficulty?: string; followUpPrompts?: string[] }> },
): Promise<IQuestionBank> {
  return QuestionBankModel.create({
    recruiterId,
    jobRoleId: data.jobRoleId ?? null,
    name: data.name,
    questions: data.questions.map(q => ({
      text: q.text,
      topicArea: q.topicArea,
      difficulty: q.difficulty ?? 'medium',
      followUpPrompts: q.followUpPrompts ?? [],
    })),
  });
}

export async function listQuestionBanks(recruiterId: string) {
  return QuestionBankModel.find({ recruiterId, isActive: true })
    .populate('jobRoleId', 'title domain')
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getQuestionBank(id: string, recruiterId: string) {
  const bank = await QuestionBankModel.findById(id)
    .populate('jobRoleId', 'title domain')
    .lean();
  if (!bank) throw AppError.notFound('Question bank not found');
  if (bank.recruiterId.toString() !== recruiterId) throw AppError.forbidden('Access denied');
  return bank;
}

export async function updateQuestionBank(
  id: string,
  recruiterId: string,
  updates: Partial<{ name: string; questions: Array<{ text: string; topicArea: string; difficulty?: string; followUpPrompts?: string[] }> }>,
) {
  const bank = await QuestionBankModel.findById(id);
  if (!bank) throw AppError.notFound('Question bank not found');
  if (bank.recruiterId.toString() !== recruiterId) throw AppError.forbidden('Access denied');

  if (updates.name) bank.name = updates.name;
  if (updates.questions) {
    bank.questions = updates.questions.map(q => ({
      text: q.text,
      topicArea: q.topicArea,
      difficulty: (q.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard',
      followUpPrompts: q.followUpPrompts ?? [],
    }));
  }

  await bank.save();
  return bank;
}

export async function deleteQuestionBank(id: string, recruiterId: string) {
  const bank = await QuestionBankModel.findById(id);
  if (!bank) throw AppError.notFound('Question bank not found');
  if (bank.recruiterId.toString() !== recruiterId) throw AppError.forbidden('Access denied');
  bank.isActive = false;
  await bank.save();
}

export async function getQuestionsForJob(jobRoleId: string) {
  const bank = await QuestionBankModel.findOne({
    jobRoleId,
    isActive: true,
  }).lean();
  return bank?.questions ?? null;
}
