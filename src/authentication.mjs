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
