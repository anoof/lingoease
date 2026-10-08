// URL is the source of truth for which Study Talk/level is open, so
// back/forward and direct links work (FRONTEND_BRIEF.md change 4).

export function buildStudyUrl(talkId: string | null, level: string | null): string {
  if (!talkId) return '/';
  const params = new URLSearchParams();
  params.set('talk', talkId);
  if (level) params.set('level', level);
  return `/?${params.toString()}`;
}
