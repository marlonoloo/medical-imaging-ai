import { imageLoader, metaData, type Types } from '@cornerstonejs/core';

export function registerWebImageLoader() {
  imageLoader.registerImageLoader('web', (imageId) => {
    const promise = (async () => {
      const uri = imageId.replace('web:', '');
      const response = await fetch(uri);
      const blob = await response.blob();
      const image = await createImageBitmap(blob);

      return {
        imageId,
        minPixelValue: 0,
        maxPixelValue: 255,
        slope: 1,
        intercept: 0,
        windowCenter: 128,
        windowWidth: 255,
        getPixelData: () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const imageData = context.getImageData(0, 0, image.width, image.height);
          const rgbaData = imageData.data;
          const rgbData = new Uint8Array((rgbaData.length / 4) * 3);

          for (let i = 0, j = 0; i < rgbaData.length; i += 4, j += 3) {
            rgbData[j] = rgbaData[i];     // R
            rgbData[j + 1] = rgbaData[i + 1]; // G
            rgbData[j + 2] = rgbaData[i + 2]; // B
          }

          return rgbData;
        },
        rows: image.height,
        columns: image.width,
        height: image.height,
        width: image.width,
        color: true,
        rgba: false,
        columnPixelSpacing: 1,
        rowPixelSpacing: 1,
        invert: false,
        sizeInBytes: image.width * image.height * 3,
        numberOfComponents: 3,
      };
    })();

    return {
      promise,
      cancelFn: undefined,
      decache: undefined,
    };
  });
}

export function addWebImageMetadataProvider() {
  metaData.addProvider((type: string, imageId: string) => {
    if (!imageId.includes('web:')) return;

    if (type === 'imagePixelModule') {
      return {
        pixelRepresentation: 0,
        bitsAllocated: 24,
        bitsStored: 24,
        highBit: 24,
        photometricInterpretation: 'RGB',
        samplesPerPixel: 3,
      };
    }

    if (type === 'imagePlaneModule') {
      return {
        imageOrientationPatient: [1, 0, 0, 0, 1, 0],
        imagePositionPatient: [0, 0, 0],
        pixelSpacing: [1, 1],
        rows: 0, // This will be updated when image loads
        columns: 0, // This will be updated when image loads
      };
    }

    if (type === 'generalSeriesModule') {
      return {
        modality: 'SC',
        seriesNumber: 1,
        seriesDescription: 'Web Image',
      };
    }

    return undefined;
  }, 10000);
}
