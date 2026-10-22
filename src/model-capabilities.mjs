export function getModelCapabilities(id, catalog) {
  const own = catalog.zenmux?.models?.[id];
  if (own) return own;
  const separator = id.indexOf('/');
  const provider = id.slice(0, separator);
  const name = id.slice(separator + 1);
  return catalog[provider === 'x-ai' ? 'xai' : provider]?.models?.[name];
}

export function getReasoningVariants(model) {
  const efforts = model?.reasoning_options?.find((option) => option.type === 'effort')?.values;
  return Array.isArray(efforts)
    ? Object.fromEntries(
      efforts.filter((value) => typeof value === 'string').map((value) => [value, {}]),
    )
    : {};
}
