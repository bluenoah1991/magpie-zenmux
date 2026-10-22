import { getInferenceKey } from './authentication.mjs';
import { imageGenerationResponse } from './images.mjs';
import { routeRequest, validateInferenceUrl } from './request-routing.mjs';

const STRIPPED_HEADERS = [
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-goog-api-key',
  'cookie',
  'content-length',
];

export async function createInferenceLoader(plan, getAuth) {
  getInferenceKey(await getAuth(), plan);
  return {
    apiKey: '',
    async fetch(input, init) {
      const url = validateInferenceUrl(input);
      let request = new Request(input instanceof Request ? input : url, init);
      request.signal.throwIfAborted();
      const key = getInferenceKey(await getAuth(), plan);
      const route = await routeRequest(request, url);
      request = route.request;
      request.signal.throwIfAborted();
      const headers = new Headers(request.headers);
      for (const name of STRIPPED_HEADERS) headers.delete(name);
      headers.set('authorization', `Bearer ${key}`);
      const response = await fetch(new Request(request, { headers, redirect: 'error' }));
      return ['imagen', 'images'].includes(route.imageProtocol)
        ? imageGenerationResponse(response, route.stream, route.imageProtocol)
        : response;
    },
  };
}
