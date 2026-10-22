import { getModelCapabilities, getReasoningVariants } from './model-capabilities.mjs';
import { getModelApi } from './request-routing.mjs';
import { isModelId, isRecord } from './validation.mjs';

const INPUT_MODALITIES = ['text', 'image', 'audio', 'video', 'file'];

function getUniformTokenPrice(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const valid = rows.every((row) =>
    isRecord(row) && row.currency === 'USD'
    && row.unit === 'perMTokens' && Number.isFinite(row.value) && row.value >= 0
    && (row.conditions === undefined
      || (isRecord(row.conditions) && Object.keys(row.conditions).length === 0))
  );
  if (!valid || !rows.every((row) => row.value === rows[0].value)) return undefined;
  return rows[0].value;
}

function mapModelCost(pricing) {
  if (!isRecord(pricing)) return undefined;
  const input = getUniformTokenPrice(pricing.prompt);
  const output = getUniformTokenPrice(pricing.completion);
  if (input === undefined || output === undefined) return undefined;
  const cache = {};
  const read = getUniformTokenPrice(pricing.input_cache_read);
  const writePrices = [
    pricing.input_cache_write,
    pricing.input_cache_write_5_min,
    pricing.input_cache_write_1_h,
  ].filter((rows) => rows !== undefined);
  const write = writePrices.every((rows) => Array.isArray(rows) && rows.length > 0)
    ? getUniformTokenPrice(writePrices.flat())
    : undefined;
  if (read !== undefined) cache.read = read;
  if (write !== undefined) cache.write = write;
  return { input, output, cache };
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function mapModel(model, api, planKind, capabilities) {
  const known = getModelCapabilities(model.id, capabilities);
  const reasoning = model.capabilities?.reasoning === true;
  const imageOutput = model.output_modalities.includes('image');
  const modalities = Array.isArray(model.input_modalities) ? model.input_modalities : ['text'];
  const input = Object.fromEntries(
    INPUT_MODALITIES.map((name) => [name, modalities.includes(name)]),
  );
  const context = positiveInteger(model.context_length, 32768);
  const output = Math.min(positiveInteger(model.max_tokens, 4096), context);
  const result = {
    id: model.id,
    name: typeof model.display_name === 'string' && model.display_name.trim()
      ? model.display_name
      : model.id,
    api,
    capabilities: {
      reasoning,
      toolcall: imageOutput ? false : (model.capabilities?.tool_call ?? known?.tool_call) !== false,
      attachment: Boolean(input.image || input.file),
      input,
      output: {
        text: model.output_modalities.includes('text'),
        image: imageOutput,
      },
    },
    limit: { context, output },
    variants: reasoning ? getReasoningVariants(known) : {},
  };
  if (planKind === 'payg') {
    const cost = mapModelCost(model.pricings);
    if (cost) result.cost = cost;
  }
  return result;
}

export function mapModelCatalog(data, planKind, allowlist, capabilities) {
  const allowedModels = allowlist === undefined ? null : new Set(allowlist);
  const models = {};
  let validModelCount = 0;
  for (const model of data) {
    if (
      !isRecord(model) || !isModelId(model.id)
      || !Array.isArray(model.output_modalities)
    ) continue;
    validModelCount++;
    if (!model.output_modalities.some((kind) => kind === 'text' || kind === 'image')) continue;
    if (allowedModels && !allowedModels.has(model.id)) continue;
    const api = getModelApi(model);
    if (api) models[model.id] = mapModel(model, api, planKind, capabilities);
  }
  if (data.length > 0 && validModelCount === 0) {
    throw new Error('ZenMux model directory contains no valid model records');
  }
  return models;
}
