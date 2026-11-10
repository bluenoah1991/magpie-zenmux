import { fetchMetadata } from './api-client.mjs';
import { getInferenceKey, validateApiKey } from './authentication.mjs';
import { BILLING_PLANS, MANAGEMENT_KEY_PREFIX, MANAGEMENT_PROVIDER_NAME } from './constants.mjs';
import { isRecord } from './validation.mjs';

const QUOTA_WINDOWS = [
  { field: 'quota_5_hour', name: '5 hours', span: 18_000 },
  { field: 'quota_7_day', name: '7 days', span: 604_800 },
];

function isNonnegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function validTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function mapQuotaWindow(quota, definition) {
  if (
    !isRecord(quota) || !isNonnegativeNumber(quota.used_flows)
    || !isNonnegativeNumber(quota.max_flows)
    || (quota.usage_percentage !== undefined && !isNonnegativeNumber(quota.usage_percentage))
  ) {
    throw new Error('ZenMux quota values are invalid');
  }
  const used = Number.isFinite(quota.usage_percentage)
    ? quota.usage_percentage * 100
    : quota.max_flows > 0
    ? quota.used_flows / quota.max_flows * 100
    : 100;
  return {
    name: definition.name,
    span: definition.span,
    used,
    amount: quota.used_flows,
    limit: quota.max_flows,
    unit: 'Flows',
    display: `${quota.used_flows} / ${quota.max_flows} Flows`,
    ...(validTimestamp(quota.resets_at) ? { resetsAt: quota.resets_at } : {}),
  };
}

function mapSubscriptionUsage(data) {
  if (
    !isRecord(data) || !isRecord(data.plan) || typeof data.plan.tier !== 'string'
    || !data.plan.tier.trim()
  ) {
    throw new Error('ZenMux subscription response is incomplete');
  }
  const tier = data.plan.tier.trim();
  const result = {
    plan: `Builder ${tier[0].toUpperCase()}${tier.slice(1)}`,
    windows: QUOTA_WINDOWS.map((definition) => mapQuotaWindow(data[definition.field], definition)),
    signIn: 'kept',
    ...(validTimestamp(data.plan.expires_at) ? { until: data.plan.expires_at } : {}),
  };
  const resets = data.quota_5_hour.remaining_resets;
  if (Number.isSafeInteger(resets) && resets >= 0) {
    result.resets = { count: resets, ...(result.until ? { until: result.until } : {}) };
  }
  if (isNonnegativeNumber(data.quota_monthly?.max_flows)) {
    result.balance = `${data.quota_monthly.max_flows} Flows`;
  }
  if (typeof data.account_status === 'string' && data.account_status !== 'healthy') {
    result.error = 'ZenMux account is not healthy; check its status in the ZenMux console';
  }
  return result;
}

function mapPaygUsage(data) {
  if (!isRecord(data) || data.currency !== 'usd' || !Number.isFinite(data.total_credits)) {
    throw new Error('ZenMux balance response is incomplete');
  }
  return {
    plan: 'Pay As You Go',
    balance: `$${data.total_credits.toFixed(4)}`,
    windows: [],
    signIn: 'kept',
  };
}

export async function getAccountUsage(plan, getAuth) {
  const auth = await getAuth();
  const status = { plan: plan.name, signIn: 'kept' };
  try {
    getInferenceKey(auth, plan);
  } catch (error) {
    return { ...status, error: error.message, signIn: error.signIn };
  }
  const managementKey = auth.metadata?.managementKey;
  if (
    managementKey === undefined || managementKey === null
    || (typeof managementKey === 'string' && managementKey.trim() === '')
  ) {
    return status;
  }
  if (validateApiKey(managementKey, MANAGEMENT_KEY_PREFIX)) {
    return { ...status, error: 'Invalid management API key format' };
  }
  try {
    return await getPlanUsage(plan, managementKey);
  } catch (error) {
    return { ...status, error: error.message };
  }
}

async function getPlanUsage(plan, managementKey) {
  const response = await fetchMetadata(plan.usageEndpoint, managementKey);
  return plan.id === BILLING_PLANS.builder.id
    ? mapSubscriptionUsage(response.data)
    : mapPaygUsage(response.data);
}

export async function getManagementUsage(getAuth) {
  const auth = await getAuth();
  const status = { plan: MANAGEMENT_PROVIDER_NAME, signIn: 'kept' };
  if (auth?.type !== 'api' || validateApiKey(auth.key, MANAGEMENT_KEY_PREFIX)) {
    return {
      ...status,
      error: `Expected a Management API key starting with ${MANAGEMENT_KEY_PREFIX}`,
    };
  }
  const plans = Object.values(BILLING_PLANS);
  const results = await Promise.allSettled(plans.map((plan) => getPlanUsage(plan, auth.key)));
  if (results.every((result) => result.status === 'rejected')) {
    return {
      ...status,
      error: results.map((result, index) => `${plans[index].name}: ${result.reason.message}`).join(
        '; ',
      ),
    };
  }
  const usage = { ...status, windows: [] };
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      usage.windows.push({ name: plans[index].name, display: result.reason.message, aside: true });
      continue;
    }
    const data = result.value;
    if (plans[index].id === BILLING_PLANS.builder.id) {
      Object.assign(usage, data);
      if (data.balance) {
        usage.windows.push({
          name: 'Builder monthly allowance',
          display: data.balance,
          aside: true,
        });
      }
      delete usage.balance;
    } else {
      usage.balance = `PAYG ${data.balance}`;
    }
  }
  return usage;
}
