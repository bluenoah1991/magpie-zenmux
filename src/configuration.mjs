import { BILLING_PLANS } from './constants.mjs';
import { isModelId, isRecord } from './validation.mjs';

export function resolveConfiguration(planKind, options = {}) {
  if (!isRecord(options)) throw new Error('Plugin options must be an object');
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(BILLING_PLANS, key)) {
      throw new Error('Unknown plugin option; expected builder or payg');
    }
  }
  for (const settings of Object.values(options)) {
    if (!isRecord(settings)) throw new Error('Plan options must be an object');
    if (Object.keys(settings).some((key) => key !== 'models')) {
      throw new Error('Unknown plan option; expected models');
    }
    if (
      settings.models !== undefined
      && (!Array.isArray(settings.models) || !settings.models.every(isModelId))
    ) {
      throw new Error('models must be an array of vendor/model IDs');
    }
  }
  const settings = options[planKind] ?? {};
  return {
    plan: BILLING_PLANS[planKind],
    modelAllowlist: settings.models,
  };
}
