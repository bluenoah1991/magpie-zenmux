import { MANAGEMENT_KEY_PREFIX } from './constants.mjs';

export function validateApiKey(value, prefix) {
  if (typeof value === 'string') {
    const key = value.trim();
    const suffix = key.slice(prefix.length);
    if (key.startsWith(prefix) && /^[A-Za-z0-9_-]+$/u.test(suffix)) return undefined;
  }
  return `Expected an API key starting with ${prefix}`;
}

export function getInferenceKey(auth, plan) {
  if (
    auth?.type !== 'api' || !plan.keyPrefixes.some((prefix) => !validateApiKey(auth.key, prefix))
  ) {
    throw Object.assign(
      new Error(`Expected a ${plan.name} API key starting with ${plan.keyPrefixes.join(' or ')}`),
      { signIn: 'expired' },
    );
  }
  return auth.key.trim();
}

export function createApiKeyMethod(plan) {
  return {
    type: 'api',
    label: `${plan.name} API key`,
    placeholder: `${plan.keyPrefixes[0]}...`,
    prompts: [{
      type: 'password',
      key: 'managementKey',
      message: `Management API key (optional, for ${plan.usageLabel} reporting)`,
      placeholder: `${MANAGEMENT_KEY_PREFIX}...`,
      validate(value) {
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
          return undefined;
        }
        return validateApiKey(value, MANAGEMENT_KEY_PREFIX);
      },
    }],
  };
}
