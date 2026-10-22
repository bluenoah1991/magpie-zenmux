import { fetchJson, fetchMetadata } from './api-client.mjs';
import { MODEL_CAPABILITIES_URL, MODEL_CATALOG_TTL_MS, MODEL_DETAILS_URL } from './constants.mjs';
import { isModelId, isRecord } from './validation.mjs';

let cachedCatalog;
let expiresAt = 0;
let pending;

export async function getModelCatalog() {
  if (cachedCatalog && Date.now() < expiresAt) return cachedCatalog;
  if (pending) return pending;
  pending = loadCatalog().then((catalog) => {
    cachedCatalog = catalog;
    expiresAt = Date.now() + MODEL_CATALOG_TTL_MS;
    return catalog;
  }).finally(() => {
    pending = undefined;
  });
  return pending;
}

export async function findCatalogModel(id) {
  const catalog = cachedCatalog ?? await getModelCatalog();
  return catalog.models.find((model) => model.id === id);
}

async function loadCatalog() {
  const [catalog, details, capabilities] = await Promise.all([
    fetchMetadata('models'),
    fetchJson(MODEL_DETAILS_URL),
    fetchJson(MODEL_CAPABILITIES_URL).catch(() => ({})),
  ]);
  if (!Array.isArray(catalog.data) || !Array.isArray(details.data)) {
    throw new Error('ZenMux model directory is missing its data array');
  }
  const models = new Map(catalog.data.filter(isRecord).map((model) => [model.id, model]));
  for (const detail of details.data) {
    if (!isRecord(detail) || !isModelId(detail.slug)) continue;
    const model = models.get(detail.slug);
    models.set(detail.slug, {
      id: detail.slug,
      display_name: detail.name,
      input_modalities: detail.input_modalities,
      output_modalities: detail.output_modalities,
      context_length: detail.context_length,
      max_tokens: detail.max_completion_tokens,
      capabilities: { reasoning: detail.supports_reasoning > 0 },
      ...model,
      supported_apis: detail.endpoints?.flatMap((endpoint) =>
        endpoint.suitable_api?.split(',') ?? []
      ),
    });
  }
  return { models: [...models.values()], capabilities };
}
