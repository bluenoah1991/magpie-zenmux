export const API_BASE_URL = 'https://zenmux.ai/api/v1';
export const ANTHROPIC_BASE_URL = 'https://zenmux.ai/api/anthropic/v1';
export const GEMINI_BASE_URL = 'https://zenmux.ai/api/vertex-ai/v1';
export const MODEL_DETAILS_URL = 'https://zenmux.ai/api/frontend/model/available/list';
export const MODEL_CAPABILITIES_URL = 'https://models.dev/api.json';
export const MANAGEMENT_KEY_PREFIX = 'sk-mgmt-';
export const METADATA_TIMEOUT_MS = 15_000;
export const MODEL_CATALOG_TTL_MS = 300_000;

export const PROTOCOL_APIS = Object.freeze({
  chat: { npm: '@ai-sdk/openai-compatible', url: API_BASE_URL },
  responses: { npm: '@ai-sdk/openai', url: API_BASE_URL },
  messages: { npm: '@ai-sdk/anthropic', url: ANTHROPIC_BASE_URL },
  gemini: { npm: '@ai-sdk/google', url: GEMINI_BASE_URL },
});

export const BILLING_PLANS = Object.freeze({
  builder: Object.freeze({
    id: 'zenmux-builder',
    name: 'ZenMux Builder Plan',
    keyPrefixes: Object.freeze(['sk-ss-v1-']),
    usageEndpoint: 'management/subscription/detail',
    usageLabel: 'quota',
    maxConcurrency: 2,
  }),
  payg: Object.freeze({
    id: 'zenmux-payg',
    name: 'ZenMux Pay As You Go',
    keyPrefixes: Object.freeze(['sk-payg-', 'sk-ai-v1-']),
    usageEndpoint: 'management/payg/balance',
    usageLabel: 'balance',
  }),
});
