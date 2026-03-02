import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../auth/auth.middleware';
import { getMeHandler, updateMeHandler, uploadResumeHandler } from './candidate.controller';
import { config } from '../../config';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, DOC, and DOCX files are allowed'));
    }
  },
});

const resumeUploadLimiter = rateLimit({
  windowMs: 3_600_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many resume uploads, please try again later' } },
});

router.use(requireAuth as RequestHandler);

router.get('/me', getMeHandler as unknown as RequestHandler);
router.patch('/me', updateMeHandler as unknown as RequestHandler);
router.post(
  '/resume',
  resumeUploadLimiter,
  upload.single('resume'),
  uploadResumeHandler as unknown as RequestHandler,
);

export default router;
