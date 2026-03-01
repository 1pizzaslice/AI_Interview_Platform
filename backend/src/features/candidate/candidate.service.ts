import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CandidateModel } from './candidate.model';
import { AppError } from '../../shared/errors/app-error';
import { createStorageAdapter } from '../../adapters/storage';
import { createLLMAdapter } from '../../adapters/llm';

export async function getMyProfile(userId: string) {
  const candidate = await CandidateModel.findById(userId).lean();
  if (!candidate) throw AppError.notFound('User not found');
  return candidate;
}

export async function updateMyProfile(userId: string, updates: { name?: string }) {
  const candidate = await CandidateModel.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true },
  ).lean();
  if (!candidate) throw AppError.notFound('User not found');
  return candidate;
}

export async function uploadAndParseResume(userId: string, file: Express.Multer.File) {
  const storage = createStorageAdapter();
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `resumes/${userId}/${uuidv4()}${ext}`;

  const uploadResult = await storage.upload(file.buffer, key, file.mimetype);

  // Extract text from buffer (simple text for now; Phase 5 could add PDF parsing)
  const resumeText = file.buffer.toString('utf-8');

  const parsedResume = await parseResumeWithLLM(resumeText);

  const candidate = await CandidateModel.findByIdAndUpdate(
    userId,
    { $set: { resumeUrl: uploadResult.url, parsedResume } },
    { new: true },
  ).lean();

  if (!candidate) throw AppError.notFound('User not found');
  return candidate;
}

async function parseResumeWithLLM(resumeText: string) {
  const llm = createLLMAdapter();

  const prompt = `You are a resume parser. Extract structured information from the following resume text and return ONLY valid JSON in exactly this format:
{
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null",
      "description": "Brief description"
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor's",
      "field": "Computer Science",
      "graduationYear": 2020
    }
  ],
  "summary": "2-3 sentence professional summary"
}

Resume text:
${resumeText.slice(0, 8000)}`;

  const response = await llm.complete([
    { role: 'system', content: 'You are a resume parsing assistant. Return only valid JSON, no markdown, no explanation.' },
    { role: 'user', content: prompt },
  ], { maxTokens: 2000, temperature: 0 });

  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as {
      skills: string[];
      experience: Array<{ company: string; title: string; startDate: string; endDate: string | null; description: string }>;
      education: Array<{ institution: string; degree: string; field: string; graduationYear: number }>;
      summary: string;
    };
  } catch {
    console.error('[ResumeParser] Failed to parse LLM response:', response.slice(0, 200));
    return {
      skills: [],
      experience: [],
      education: [],
      summary: 'Resume parsing failed. Please review manually.',
    };
  }
}
