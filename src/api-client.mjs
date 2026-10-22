import { API_BASE_URL, METADATA_TIMEOUT_MS } from './constants.mjs';
import { isRecord } from './validation.mjs';

export function fetchMetadata(endpoint, managementKey) {
  return fetchJson(`${API_BASE_URL}/${endpoint}`, managementKey);
}

export async function fetchJson(url, managementKey) {
  const endpoint = new URL(url);
  let response;
  const signal = AbortSignal.timeout(METADATA_TIMEOUT_MS);
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...(managementKey ? { authorization: `Bearer ${managementKey.trim()}` } : {}),
      },
      signal,
      redirect: 'error',
    });
  } catch {
    if (signal.aborted) {
      throw new Error(`${endpoint.hostname} metadata request timed out; retry later`);
    }
    throw new Error(
      `${endpoint.hostname} could not be reached; check the provider proxy or try again`,
    );
  }
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {}
    const retryHint = [422, 429].includes(response.status) ? '; retry later' : '';
    throw new Error(
      `Metadata request to ${endpoint.hostname}${endpoint.pathname} returned HTTP ${response.status}${retryHint}`,
    );
  }
  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (signal.aborted) {
      throw new Error(`${endpoint.hostname} metadata request timed out; retry later`);
    }
    if (error instanceof SyntaxError) throw new Error(`${endpoint.hostname} returned invalid JSON`);
    throw new Error(
      `${endpoint.hostname} response could not be read; check the provider proxy or try again`,
    );
  }
  if (!isRecord(result)) {
    throw new Error(`${endpoint.hostname} returned an invalid response envelope`);
  }
  if (result.success === false) throw new Error('Metadata query failed');
  return result;
}
