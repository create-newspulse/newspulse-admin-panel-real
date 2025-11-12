// Simple PTI compliance evaluator
const banned = ['clickbait','plagiarized','untested'];

exports.evaluatePTI = function({ title = '', content = '' }) {
  const reasons = [];
  const lower = (title + ' ' + content).toLowerCase();
  banned.forEach(w => { if (lower.includes(w)) reasons.push(`Contains banned term: ${w}`); });
  if (!/https?:\/\//i.test(content)) reasons.push('No source link detected');
  const status = reasons.length === 0 ? 'compliant' : 'needs_review';
  return { status, reasons };
};
