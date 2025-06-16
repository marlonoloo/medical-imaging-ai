// src/dicomHelper.ts
import { metaData } from '@cornerstonejs/core';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

export async function prefetchMetadataInformation(imageIdsToPrefetch: string[]) {
  for (let i = 0; i < imageIdsToPrefetch.length; i++) {
    await cornerstoneDICOMImageLoader.wadouri.loadImage(imageIdsToPrefetch[i]).promise;
  }
}

export function getFrameInformation(imageId: string) {
  if (imageId.includes('wadors:')) {
    const frameIndex = imageId.indexOf('/frames/');
    const imageIdFrameless = frameIndex > 0 ? imageId.slice(0, frameIndex + 8) : imageId;
    return { frameIndex, imageIdFrameless };
  } else {
    const frameIndex = imageId.indexOf('&frame=');
    let imageIdFrameless = frameIndex > 0 ? imageId.slice(0, frameIndex + 7) : imageId;
    if (!imageIdFrameless.includes('&frame=')) {
      imageIdFrameless = imageIdFrameless + '&frame=';
    }
    return { frameIndex, imageIdFrameless };
  }
}

export function convertMultiframeImageIds(imageIds: string[]): string[] {
  const newImageIds: string[] = [];
  imageIds.forEach((imageId) => {
    const { imageIdFrameless } = getFrameInformation(imageId);
    const instanceMetaData = metaData.get('multiframeModule', imageId);
    if (instanceMetaData && instanceMetaData.NumberOfFrames && instanceMetaData.NumberOfFrames > 1) {
      const NumberOfFrames = instanceMetaData.NumberOfFrames;
      for (let i = 0; i < NumberOfFrames; i++) {
        const newImageId = imageIdFrameless + (i + 1);
        newImageIds.push(newImageId);
      }
    } else {
      newImageIds.push(imageId);
    }
  });
  return newImageIds;
}

export async function loadAndViewImage(imageId: string, viewport: any) {
  await prefetchMetadataInformation([imageId]);
  const stack = convertMultiframeImageIds([imageId]);
  viewport.setStack(stack).then(() => {
    viewport.render();
  });
}
