import { getInferenceKey } from './authentication.mjs';
import { getModelCatalog } from './catalog.mjs';
import { resolveConfiguration } from './configuration.mjs';
import {
  MANAGEMENT_KEY_PREFIX,
  MANAGEMENT_PROVIDER_ID,
  MANAGEMENT_PROVIDER_NAME,
  PROTOCOL_APIS,
} from './constants.mjs';
import { mapModelCatalog } from './models.mjs';
import { createInferenceLoader } from './transport.mjs';
import { getAccountUsage, getManagementUsage } from './usage.mjs';

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
      methods: [{
        type: 'api',
        label: planKind === 'builder' ? 'Builder Plan API key' : 'PAYG API key',
        placeholder: `${plan.keyPrefixes[0]}...`,
      }],
      loader: (getAuth) => createInferenceLoader(plan, getAuth),
      usage: (getAuth) => getAccountUsage(plan, getAuth),
    },
  };
}

export function createManagementPlugin() {
  return {
    async config(config) {
      config.provider ??= {};
      const provider = config.provider[MANAGEMENT_PROVIDER_ID] ??= {};
      provider.name ??= MANAGEMENT_PROVIDER_NAME;
      provider.models = {};
    },
    provider: {
      id: MANAGEMENT_PROVIDER_ID,
      async models() {
        return {};
      },
    },
    auth: {
      provider: MANAGEMENT_PROVIDER_ID,
      methods: [{
        type: 'api',
        label: 'Management API key (quota and balance only)',
        placeholder: `${MANAGEMENT_KEY_PREFIX}...`,
      }],
      async loader() {
        throw new Error(
          'Management API keys only report quota and balance. Add a Builder Plan or PAYG API key to use models.',
        );
      },
      usage: getManagementUsage,
    },
  };
}
