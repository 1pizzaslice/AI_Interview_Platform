import { ReportModel } from './report.model';
import { AppError } from '../../shared/errors/app-error';

export async function exportReportAsCSV(sessionId: string): Promise<string> {
  const report = await ReportModel.findOne({ sessionId })
    .populate('candidateId', 'name email')
    .populate('jobRoleId', 'title domain experienceLevel')
    .lean();

  if (!report) throw AppError.notFound('Report not found');

  const candidate = report.candidateId as unknown as { name: string; email: string };
  const job = report.jobRoleId as unknown as { title: string; domain: string; experienceLevel: string };

  const rows: string[][] = [];

  // Header
  rows.push(['AI Interview Report']);
  rows.push([]);

  // Candidate info
  rows.push(['Candidate', candidate.name]);
  rows.push(['Email', candidate.email]);
  rows.push(['Role', job.title]);
  rows.push(['Domain', job.domain]);
  rows.push(['Experience Level', job.experienceLevel]);
  rows.push(['Generated At', new Date(report.generatedAt).toLocaleString()]);
  rows.push([]);

  // Summary
  rows.push(['Overall Score', String(report.overallScore)]);
  rows.push(['Recommendation', report.recommendation]);
  rows.push(['Confidence', String(report.averageConfidence)]);
  rows.push([]);

  // Dimensions
  rows.push(['Dimension', 'Score']);
  rows.push(['Technical', String(report.dimensionScores.technical)]);
  rows.push(['Communication', String(report.dimensionScores.communication)]);
  rows.push(['Problem Solving', String(report.dimensionScores.problemSolving)]);
  rows.push(['Cultural Fit', String(report.dimensionScores.culturalFit)]);
  rows.push(['Resume Alignment', String(report.dimensionScores.resumeAlignment)]);
  rows.push([]);

  // Strengths
  rows.push(['Strengths']);
  report.strengths.forEach(s => rows.push(['', s]));
  rows.push([]);

  // Weaknesses
  rows.push(['Weaknesses']);
  report.weaknesses.forEach(w => rows.push(['', w]));
  rows.push([]);

  // Question Scores
  rows.push(['Question', 'Score', 'Confidence', 'Summary']);
  report.questionScores.forEach(qs => {
    rows.push([qs.questionText, String(qs.score), String(qs.confidence), qs.summary]);
  });
  rows.push([]);

  // Red Flags
  if (report.redFlags.length > 0) {
    rows.push(['Red Flags']);
    rows.push(['Type', 'Severity', 'Description']);
    report.redFlags.forEach(rf => {
      rows.push([rf.type, rf.severity, rf.description]);
    });
    rows.push([]);
  }

  // Anti-cheat
  if (report.antiCheatFlags.length > 0) {
    rows.push(['Anti-Cheat Flags']);
    report.antiCheatFlags.forEach(f => rows.push(['', f]));
  }

  // Summary narrative
  rows.push([]);
  rows.push(['Summary']);
  rows.push([report.summary]);

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function exportReportAsPDF(sessionId: string): Promise<Buffer> {
  const report = await ReportModel.findOne({ sessionId })
    .populate('candidateId', 'name email')
    .populate('jobRoleId', 'title domain experienceLevel')
    .lean();

  if (!report) throw AppError.notFound('Report not found');

  const candidate = report.candidateId as unknown as { name: string; email: string };
  const job = report.jobRoleId as unknown as { title: string; domain: string; experienceLevel: string };

  const recColor: Record<string, string> = {
    STRONG_HIRE: '#16a34a',
    HIRE: '#2563eb',
    BORDERLINE: '#ca8a04',
    NO_HIRE: '#dc2626',
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1f2937; line-height: 1.5; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #6b7280; margin-top: 32px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .meta { color: #6b7280; font-size: 14px; }
    .score-box { display: inline-flex; align-items: center; gap: 16px; margin: 20px 0; }
    .score { font-size: 48px; font-weight: bold; }
    .rec { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; color: white; }
    .dim-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .dim-table th, .dim-table td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .dim-table th { color: #6b7280; font-weight: 500; }
    .bar { height: 8px; border-radius: 4px; background: #e5e7eb; }
    .bar-fill { height: 100%; border-radius: 4px; background: #6366f1; }
    .list { padding-left: 20px; }
    .list li { margin-bottom: 4px; font-size: 13px; }
    .strength { color: #16a34a; }
    .weakness { color: #dc2626; }
    .red-flag { background: #fef2f2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 8px; margin: 8px 0; font-size: 13px; }
    .summary { font-size: 14px; margin: 12px 0; }
    .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <h1>Interview Report</h1>
  <p class="meta">${candidate.name} &middot; ${candidate.email}</p>
  <p class="meta">${job.title} (${job.domain}) &middot; ${job.experienceLevel} level</p>

  <div class="score-box">
    <span class="score">${report.overallScore}</span>
    <span class="rec" style="background:${recColor[report.recommendation] ?? '#6b7280'}">${report.recommendation.replace('_', ' ')}</span>
  </div>

  <h2>Dimension Scores</h2>
  <table class="dim-table">
    <tr><th>Dimension</th><th>Score</th><th style="width:40%"></th></tr>
    ${[
      ['Technical', report.dimensionScores.technical],
      ['Communication', report.dimensionScores.communication],
      ['Problem Solving', report.dimensionScores.problemSolving],
      ['Cultural Fit', report.dimensionScores.culturalFit],
      ['Resume Alignment', report.dimensionScores.resumeAlignment],
    ].map(([name, score]) => `
      <tr>
        <td>${name}</td>
        <td><strong>${score}/100</strong></td>
        <td><div class="bar"><div class="bar-fill" style="width:${score}%"></div></div></td>
      </tr>
    `).join('')}
  </table>

  <h2>Strengths</h2>
  <ul class="list">${report.strengths.map(s => `<li class="strength">+ ${s}</li>`).join('')}</ul>

  <h2>Weaknesses</h2>
  <ul class="list">${report.weaknesses.map(w => `<li class="weakness">- ${w}</li>`).join('')}</ul>

  <h2>Question Scores</h2>
  <table class="dim-table">
    <tr><th>Question</th><th>Score</th><th>Summary</th></tr>
    ${report.questionScores.map(qs => `
      <tr>
        <td style="max-width:200px">${qs.questionText.slice(0, 80)}${qs.questionText.length > 80 ? '...' : ''}</td>
        <td><strong>${qs.score}/100</strong></td>
        <td style="font-size:12px;color:#6b7280">${qs.summary.slice(0, 120)}${qs.summary.length > 120 ? '...' : ''}</td>
      </tr>
    `).join('')}
  </table>

  ${report.redFlags.length > 0 ? `
    <h2>Red Flags</h2>
    ${report.redFlags.map(rf => `
      <div class="red-flag">
        <strong>${rf.type}</strong> (${rf.severity}) &mdash; ${rf.description}
      </div>
    `).join('')}
  ` : ''}

  ${report.antiCheatFlags.length > 0 ? `
    <h2>Anti-Cheat Flags</h2>
    <ul class="list">${report.antiCheatFlags.map(f => `<li>${f}</li>`).join('')}</ul>
  ` : ''}

  <h2>Summary</h2>
  <p class="summary">${report.summary}</p>

  <div class="footer">
    Generated ${new Date(report.generatedAt).toLocaleString()} &middot; AI Interview Platform
  </div>
</body>
</html>`;

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
