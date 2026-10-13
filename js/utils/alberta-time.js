// Alberta remains at UTC-6 when the former fall transition would occur on
// 1 November 2026. Explicitly handle it for browsers with older IANA tzdata.
// Sources: docs/backend-setup.md, Alberta reporting time note.
const PERMANENT_TIME = Date.UTC(2026,10,1,8);
export function albertaTimeZone(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid reporting date.');
  return date.getTime() >= PERMANENT_TIME ? 'Etc/GMT+6' : 'America/Edmonton';
}
export function reportingMonth(value = new Date()) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: albertaTimeZone(date), year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}
