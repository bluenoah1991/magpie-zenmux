import { fetchMetadata } from './api-client.mjs';
import { getInferenceKey, validateApiKey } from './authentication.mjs';
import { MANAGEMENT_KEY_PREFIX } from './constants.mjs';
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
    return {
      ...status,
      error:
        `Add a management API key to view ${plan.usageLabel}. This key is not required for inference.`,
    };
  }
  if (validateApiKey(managementKey, MANAGEMENT_KEY_PREFIX)) {
    return { ...status, error: 'Invalid management API key format' };
  }
  try {
    const response = await fetchMetadata(plan.usageEndpoint, managementKey);
    return plan.id === 'zenmux-builder'
      ? mapSubscriptionUsage(response.data)
      : mapPaygUsage(response.data);
  } catch (error) {
    return { ...status, error: error.message };
  }
}
