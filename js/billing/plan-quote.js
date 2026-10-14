// Provider-independent planning arithmetic. This is not an authorization boundary.
export const EXAMPLE_PLAN = Object.freeze({ monthly_cents: 3900, included_segments: 500, overage_cents: 5 });
function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative safe integer.`);
  return value;
}
export function quotePlan({ plan, used = 0, reserved = 0, requested = 0, overage_enabled = false, cap_cents = 0 }) {
  for (const key of ['monthly_cents', 'included_segments', 'overage_cents']) integer(plan?.[key], key);
  for (const [key, value] of Object.entries({ used, reserved, requested, cap_cents })) integer(value, key);
  if (typeof overage_enabled !== 'boolean') throw new Error('Overage setting must be a boolean.');
  const committed = integer(used + reserved, 'Committed segments');
  const projected = integer(committed + requested, 'Projected segments');
  const excess = Math.max(0, projected - plan.included_segments);
  const overage = integer(excess * plan.overage_cents, 'Projected overage');
  const priorOverage = integer(Math.max(0, committed - plan.included_segments) * plan.overage_cents, 'Prior overage');
  const reason = excess && !overage_enabled ? 'overage_disabled' : overage > cap_cents ? 'cap_exceeded' : null;
  return {
    projected_segments: projected, remaining_segments: Math.max(0, plan.included_segments - committed),
    excess_segments: excess, overage_cents: overage,
    incremental_cents: overage - priorOverage,
    total_cents: integer(plan.monthly_cents + overage, 'Projected total'),
    allowed: reason === null, reason
  };
}

// Parse form values without silently converting empty input to zero or rounding money.
export function parseScenario(values) {
  const count = value => /^\d+$/.test(String(value)) ? Number(value) : NaN;
  const cap = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(values.cap));
  return {
    used: count(values.used), reserved: count(values.reserved), requested: count(values.requested),
    cap_cents: cap ? Number(cap[1]) * 100 + Number((cap[2] || '').padEnd(2, '0')) : NaN,
    overage_enabled: values.overage_enabled
  };
}
