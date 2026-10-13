export function reportingMonth(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid reporting date.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}
export class UsageService {
  constructor(store) { this.store = store; }
  summary(organizationId, month = reportingMonth()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid reporting month.');
    const all = this.store.list('announcements', organizationId).filter(a => a.status === 'simulated_sent');
    const rows = all.filter(a => reportingMonth(a.created_at) === month).sort((a,b) => b.created_at.localeCompare(a.created_at));
    return {
      month, months: [...new Set([reportingMonth(), month, ...all.map(a => reportingMonth(a.created_at))])].sort().reverse(),
      rows, announcement_count: rows.length,
      simulated_segments: rows.reduce((sum, a) => sum + a.total_sms_segments, 0),
      recipient_count: rows.reduce((sum, a) => sum + a.recipient_count, 0),
      // Simulation is never a source of billable usage.
      billable_segments: 0, charged_cents: 0
    };
  }
}
