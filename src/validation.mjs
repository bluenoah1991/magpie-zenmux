export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isModelId(value) {
  return typeof value === 'string' && /^[^\s/]+\/[^\s]+$/u.test(value);
}
