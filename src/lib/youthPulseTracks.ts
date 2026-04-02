export type YouthPulseTrack =
  | 'campus-buzz'
  | 'govt-exam-updates'
  | 'career-boosters'
  | 'young-achievers'
  | 'student-voices';

export const YOUTH_PULSE_TRACK_OPTIONS: ReadonlyArray<{ value: YouthPulseTrack; label: string }> = [
  { value: 'campus-buzz', label: 'Campus Buzz' },
  { value: 'govt-exam-updates', label: 'Govt Exam Updates' },
  { value: 'career-boosters', label: 'Career Boosters' },
  { value: 'young-achievers', label: 'Young Achievers' },
  { value: 'student-voices', label: 'Student Voices' },
] as const;

export const YOUTH_PULSE_TRACK_LABELS: Record<YouthPulseTrack, string> = {
  'campus-buzz': 'Campus Buzz',
  'govt-exam-updates': 'Govt Exam Updates',
  'career-boosters': 'Career Boosters',
  'young-achievers': 'Young Achievers',
  'student-voices': 'Student Voices',
};

const TRACK_ALIASES: Record<string, YouthPulseTrack> = {
  campus: 'campus-buzz',
  'campus-buzz': 'campus-buzz',
  'campus-life': 'campus-buzz',
  'govt-exam-updates': 'govt-exam-updates',
  'government-exam-updates': 'govt-exam-updates',
  'exam-updates': 'govt-exam-updates',
  'govt-exams': 'govt-exam-updates',
  'government-exams': 'govt-exam-updates',
  'career-boosters': 'career-boosters',
  'career-booster': 'career-boosters',
  career: 'career-boosters',
  careers: 'career-boosters',
  'young-achievers': 'young-achievers',
  achievers: 'young-achievers',
  'young-achiever': 'young-achievers',
  'student-voices': 'student-voices',
  'student-voice': 'student-voices',
  students: 'student-voices',
  student: 'student-voices',
  voices: 'student-voices',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeYouthPulseTrack(value: string | undefined | null): YouthPulseTrack | '' {
  const key = slugify(String(value || '').trim());
  return TRACK_ALIASES[key] || '';
}

export function isYouthPulseTrack(value: string | undefined | null): value is YouthPulseTrack {
  return !!normalizeYouthPulseTrack(value);
}