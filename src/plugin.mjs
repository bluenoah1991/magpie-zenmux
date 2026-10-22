import { createApiKeyMethod, getInferenceKey } from './authentication.mjs';
import { getModelCatalog } from './catalog.mjs';
import { resolveConfiguration } from './configuration.mjs';
import { PROTOCOL_APIS } from './constants.mjs';
import { mapModelCatalog } from './models.mjs';
import { createInferenceLoader } from './transport.mjs';
import { getAccountUsage } from './usage.mjs';

export function createZenMuxPlugin(planKind, options) {
  const { plan, modelAllowlist } = resolveConfiguration(planKind, options);
  return {
    async config(config) {
      config.provider ??= {};
      const provider = config.provider[plan.id] ??= {};
      provider.name ??= plan.name;
      provider.npm ??= PROTOCOL_APIS.chat.npm;
      provider.api ??= PROTOCOL_APIS.chat.url;
      provider.models ??= {};
    },
    provider: {
      id: plan.id,
      async models(provider, { auth } = {}) {
        if (modelAllowlist?.length === 0) return {};
        if (auth?.type !== 'api') return provider.models;
        getInferenceKey(auth, plan);
        const catalog = await getModelCatalog();
        return mapModelCatalog(
          catalog.models,
          planKind,
          modelAllowlist,
          catalog.capabilities,
        );
      },
    },
    auth: {
      provider: plan.id,
      ...(plan.maxConcurrency ? { maxConcurrency: plan.maxConcurrency } : {}),
      methods: [createApiKeyMethod(plan)],
      loader: (getAuth) => createInferenceLoader(plan, getAuth),
      usage: (getAuth) => getAccountUsage(plan, getAuth),
    },
  };
}
