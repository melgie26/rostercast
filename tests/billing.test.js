import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_PLAN as plan, quotePlan, parseScenario } from '../js/billing/plan-quote.js';
import { UsageService, reportingMonth } from '../js/services/usage-service.js';
import { TenantDataStore } from '../js/data/data-store.js';
import { createDemoData } from '../js/data/seed/demo-data.js';
import { SimulationService } from '../js/services/simulation-service.js';
import { billingView, quoteView } from '../js/views/billing-view.js';
import { currentRoute } from '../js/router.js';
const org = 'org_airdrie_demo';
const quote = inputs => quotePlan({ plan, ...inputs });

test('included allowance boundary and overage off by default', () => {
  assert.equal(quote({ used: 499, requested: 1 }).allowed, true);
  assert.equal(quote({ used: 500, requested: 1 }).reason, 'overage_disabled');
  assert.equal(quote({ used: 450, requested: 50 }).overage_cents, 0);
});
test('cap includes existing overage and reservations; exact cap is allowed', () => {
  const result = quote({ used: 600, reserved: 50, requested: 50, overage_enabled: true, cap_cents: 1000 });
  assert.equal(result.allowed, true); assert.equal(result.total_cents, 4900);
  assert.equal(result.incremental_cents, 250); assert.equal(result.remaining_segments, 0);
  assert.equal(quote({ used: 600, reserved: 50, requested: 51, overage_enabled: true, cap_cents: 1000 }).reason, 'cap_exceeded');
  assert.equal(quote({ used: 490, reserved: 10, requested: 1 }).reason, 'overage_disabled');
});
test('invalid quantities, monetary precision and unsafe arithmetic are rejected', () => {
  for (const used of [-1, 0.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => quote({ used }));
  assert.throws(() => quote({ used: Number.MAX_SAFE_INTEGER, requested: 1 }));
  assert.throws(() => quote({ used: Number.MAX_SAFE_INTEGER }));
  assert.throws(() => quote({ overage_enabled: 'true' }));
  for (const cap of ['', '-1', '0.001', '1e2']) assert.throws(() => quote(parseScenario({ used: '0', reserved: '0', requested: '1', cap, overage_enabled: true })));
  assert.equal(parseScenario({ used: '0', reserved: '0', requested: '1', cap: '1.05', overage_enabled: true }).cap_cents, 105);
  assert.throws(() => quote(parseScenario({ used: '', reserved: '0', requested: '0', cap: '0', overage_enabled: false })));
});
test('reporting month uses Mountain time at rollover including winter', () => {
  assert.equal(reportingMonth('2026-09-01T05:59:59Z'), '2026-08');
  assert.equal(reportingMonth('2026-09-01T06:00:00Z'), '2026-09');
  assert.equal(reportingMonth('2027-01-01T06:59:59Z'), '2026-12');
  assert.equal(reportingMonth('2027-01-01T07:00:00Z'), '2027-01');
  assert.throws(() => reportingMonth('not a date'));
});
test('usage is scoped to organization/month and simulations never become billable', () => {
  const store = new TenantDataStore(createDemoData()); const service = new UsageService(store);
  const before = store.export(); const august = service.summary(org, '2026-08');
  assert.equal(august.simulated_segments, 99); assert.equal(august.announcement_count, 2);
  assert.equal(service.summary('other-org', '2026-08').simulated_segments, 0);
  assert.deepEqual(store.export(), before);
  const simulation = new SimulationService(store);
  const review = simulation.preview(org, { title: 'Test', body: 'Test message', selection: { all: true } });
  const result = simulation.send(review, { createdBy: 'user_demo_admin', requestId: 'billing-test' });
  simulation.send(review, { createdBy: 'user_demo_admin', requestId: 'billing-test' });
  const current = service.summary(org, reportingMonth(result.announcement.created_at));
  assert.equal(current.rows.filter(a => a.id === result.announcement.id).length, 1);
  assert.equal(current.billable_segments, 0); assert.equal(current.charged_cents, 0);
  assert.throws(() => service.summary(org, '2026-13'));
});
test('billing route and view label examples and escape announcement titles', () => {
  const store = new TenantDataStore(createDemoData()); const usage = new UsageService(store).summary(org, '2026-08');
  usage.rows[0].title = '<script>alert(1)</script>';
  const html = billingView({ usage, scenario: { used: '0', reserved: '0', requested: '0', cap: '0', overage_enabled: false } });
  assert.match(html, /Illustration only/); assert.match(html, /no subscription/);
  assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/);
  assert.match(quoteView({ used: NaN }), /role="alert"/);
  assert.equal(currentRoute('#/billing'), 'billing');
});
