function getImageInput(body) {
  const parts = [
    ...(body.systemInstruction?.parts ?? []),
    ...(body.contents ?? []).flatMap((content) => content.parts ?? []),
  ].filter((part) => !part.thought);
  const prompt = parts.filter((part) => typeof part.text === 'string').map((part) => part.text)
    .join('\n');
  if (!prompt.trim()) throw new Error('Image generation requires a text prompt');
  if (parts.some((part) => part.fileData)) {
    throw new Error('Image editing requires inline image data');
  }
  return {
    prompt,
    images: parts.filter((part) => part.inlineData).map((part) => part.inlineData),
    config: body.generationConfig ?? {},
  };
}

export function createImagePrediction(body) {
  const { prompt, images, config } = getImageInput(body);
  const referenceImages = images.map((image, index) => ({
    referenceId: index + 1,
    referenceType: 'REFERENCE_TYPE_RAW',
    referenceImage: {
      bytesBase64Encoded: image.data,
      mimeType: image.mimeType,
    },
  }));
  return {
    instances: [{ prompt, ...(referenceImages.length ? { referenceImages } : {}) }],
    ...(config.imageConfig?.imageSize ? { sampleImageSize: config.imageConfig.imageSize } : {}),
    parameters: {
      sampleCount: config.candidateCount ?? 1,
      ...(config.imageConfig?.aspectRatio ? { aspectRatio: config.imageConfig.aspectRatio } : {}),
      ...(config.seed !== undefined ? { seed: config.seed } : {}),
    },
  };
}

export function createImageGeneration(body, model) {
  const { prompt, images, config } = getImageInput(body);
  return {
    model,
    prompt,
    n: config.candidateCount ?? 1,
    ...(!model.startsWith('openai/gpt-image-') ? { response_format: 'b64_json' } : {}),
    ...(images.length
      ? {
        images: images.map((image) => ({
          image_url: `data:${image.mimeType};base64,${image.data}`,
        })),
      }
      : {}),
  };
}

function getImageMimeType(data, format) {
  if (format) return `image/${format}`;
  if (data.startsWith('/9j/')) return 'image/jpeg';
  if (data.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

export async function imageGenerationResponse(response, stream, protocol) {
  if (!response.ok) return response;
  const result = await response.json();
  const images = protocol === 'images' ? result.data : result.predictions;
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('ZenMux returned no images');
  }
  const parts = images.map((image) => {
    const data = protocol === 'images' ? image.b64_json : image.bytesBase64Encoded;
    if (!data) {
      throw new Error(
        image.raiFilteredReason || 'ZenMux returned no inline image data',
      );
    }
    const mimeType = image.mimeType ?? getImageMimeType(data, result.output_format);
    return { inlineData: { data, mimeType } };
  });
  const body = JSON.stringify({
    candidates: [{ index: 0, content: { role: 'model', parts }, finishReason: 'STOP' }],
    ...(result.usage
      ? {
        usageMetadata: {
          promptTokenCount: result.usage.input_tokens,
          candidatesTokenCount: result.usage.output_tokens,
          totalTokenCount: result.usage.total_tokens,
        },
      }
      : {}),
  });
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', stream ? 'text/event-stream' : 'application/json');
  return new Response(stream ? `data: ${body}\n\n` : body, { status: response.status, headers });
}
