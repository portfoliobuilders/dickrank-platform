export const FINANCIAL_RECORD_RETENTION_YEARS = 7;
export const LOG_RETENTION_AFTER_DELETION_YEARS = 1;
export const ACCOUNT_DELETION_GRACE_DAYS = 30;
export const DMCA_RESTORE_DELAY_DAYS = 10;
export const REPEAT_INFRINGER_STRIKE_LIMIT = 3;
export const DMCA_CLAIM_HOURLY_LIMIT = 10;
export const AUDIT_EXPORT_ROW_CAP = 10_000;

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

export function financialRetainUntil(createdAt: Date): Date {
  return addYears(createdAt, FINANCIAL_RECORD_RETENTION_YEARS);
}

export function logsPurgeAt(anonymizedAt: Date): Date {
  return addYears(anonymizedAt, LOG_RETENTION_AFTER_DELETION_YEARS);
}

export function deletionExecuteAt(requestedAt: Date): Date {
  return addDays(requestedAt, ACCOUNT_DELETION_GRACE_DAYS);
}

export function dmcaRestoreAt(counterFiledAt: Date): Date {
  return addDays(counterFiledAt, DMCA_RESTORE_DELAY_DAYS);
}

export function retentionPolicyText(): string {
  return [
    `Financial records are kept for ${FINANCIAL_RECORD_RETENTION_YEARS} years.`,
    `Audit logs are kept and then deleted ${LOG_RETENTION_AFTER_DELETION_YEARS} year after an account is deleted.`,
    `Account deletion waits ${ACCOUNT_DELETION_GRACE_DAYS} days so it can be cancelled, unless the account was terminated for repeat copyright infringement.`,
    `After a valid counter-notice, hidden content is restored in ${DMCA_RESTORE_DELAY_DAYS} days unless the claimant tells us a lawsuit was filed.`,
    `An account with ${REPEAT_INFRINGER_STRIKE_LIMIT} upheld copyright claims is terminated.`,
  ].join(" ");
}
