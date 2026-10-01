/** Recognize office reviews without reclassifying ordinary technical checks. */
export function isOfficeReviewProcess(
  type: number,
  process?: { after?: object; target?: object; sourceKey?: string },
): boolean {
  if (Number(type) === 23) return true;
  if (Number(type) !== 10) return false;
  const after = (process?.after || {}) as Record<string, unknown>;
  const target = (process?.target || {}) as Record<string, unknown>;
  return after['origin'] === 'office_management'
    || after['processType'] === 'office_review'
    || target['review_origin'] === 'office_management'
    || String(process?.sourceKey || '').startsWith('office-review:');
}
