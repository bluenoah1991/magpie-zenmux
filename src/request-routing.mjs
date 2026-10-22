import { findCatalogModel } from './catalog.mjs';
import { API_BASE_URL, GEMINI_BASE_URL, PROTOCOL_APIS } from './constants.mjs';
import { createImageGeneration, createImagePrediction } from './images.mjs';

const API_ORIGIN = new URL(API_BASE_URL).origin;
const INFERENCE_PATHS = new Set([
  '/api/v1/chat/completions',
  '/api/v1/responses',
  '/api/anthropic/v1/messages',
]);
const GEMINI_PATH =
  /^\/api\/vertex-ai\/v1\/models\/([^/]+)\/([^/]+):(streamGenerateContent|generateContent)$/u;

export function getModelApi(model) {
  if (model.output_modalities.includes('image')) {
    return getImageProtocol(model) ? { id: model.id, ...PROTOCOL_APIS.gemini } : undefined;
  }
  const id = model.id.toLowerCase();
  const minimaxVersion = /^minimax\/minimax-m(\d+)(?:[.-]|$)/u.exec(id);
  let protocol = 'chat';
  if (id.startsWith('google/gemini-')) {
    protocol = 'gemini';
  } else if (
    id.startsWith('anthropic/claude-')
    || (minimaxVersion && Number(minimaxVersion[1]) >= 3)
  ) {
    protocol = 'messages';
  } else if (/^openai\/(?:(?:gpt|chatgpt|codex|chat)-|o\d+(?:[.-]|$))/u.test(id)) {
    protocol = 'responses';
  }
  protocol = [protocol, 'chat', 'responses', 'messages', 'gemini'].find((candidate) =>
    model.supported_apis?.includes(candidate === 'chat' ? 'chat.completions' : candidate)
  );
  if (!protocol) return undefined;
  return { id: model.id, ...PROTOCOL_APIS[protocol] };
}

function getImageProtocol(model) {
  return ['gemini', 'images', 'imagen'].find((api) => model.supported_apis?.includes(api));
}

export function validateInferenceUrl(input) {
  let url;
  try {
    url = new URL(input instanceof Request ? input.url : input);
  } catch {
    throw new Error('Invalid ZenMux inference URL');
  }
  if (
    url.origin !== API_ORIGIN || url.username || url.password
    || (!INFERENCE_PATHS.has(url.pathname) && !GEMINI_PATH.test(url.pathname))
  ) {
    throw new Error('Refusing to send a ZenMux API key to an unexpected endpoint');
  }
  return url;
}

export async function routeRequest(request, url) {
  const match = url.pathname.match(GEMINI_PATH);
  if (!match) return { request };
  const [, provider, name, operation] = match;
  const model = await findCatalogModel(`${provider}/${name}`);
  const image = model?.output_modalities?.includes('image');
  const imageProtocol = image ? getImageProtocol(model) : undefined;
  url = new URL(
    `${GEMINI_BASE_URL}/publishers/${provider}/models/${name}:${
      imageProtocol === 'imagen' ? 'predict' : operation
    }`,
  );
  const stream = operation === 'streamGenerateContent';
  if (stream && (!imageProtocol || imageProtocol === 'gemini')) url.searchParams.set('alt', 'sse');
  if (image) {
    let body = await request.json();
    if (imageProtocol === 'imagen') {
      body = createImagePrediction(body);
    } else if (imageProtocol === 'images') {
      body = createImageGeneration(body, model.id);
      url = new URL(`${API_BASE_URL}/images/${body.images ? 'edits' : 'generations'}`);
    } else {
      body.generationConfig ??= {};
      body.generationConfig.responseModalities ??= ['TEXT', 'IMAGE'];
    }
    request = new Request(request, { body: JSON.stringify(body) });
  }
  return { request: new Request(url, request), imageProtocol, stream };
}
