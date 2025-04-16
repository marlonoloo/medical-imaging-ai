import { run } from './init';
import { setupSegmentorUI } from './ui/segmentorUI';
import { Enums, Types, RenderingEngine, volumeLoader, setVolumesForViewports, eventTarget, imageLoader, metaData } from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { cornerstoneNiftiImageLoader, createNiftiImageIdsAndCacheMetadata } from '@cornerstonejs/nifti-volume-loader';
import { inflate } from 'pako';
import { backendService } from './services/backendService';
import JSZip from 'jszip';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element') as HTMLDivElement;
  const resultElement = document.getElementById('processed-cornerstone-element') as HTMLDivElement;

  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  await run(dicomElement, resultElement);

  const renderingEngine = new RenderingEngine('myRenderingEngine');

  // Create viewports for original and processed images
  const viewportInput = {
    viewportId: 'original-viewport',
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: dicomElement,
    defaultOptions: {
      orientation: Enums.OrientationAxis.AXIAL,
      background: [0.2, 0, 0.2] as Types.Point3,
    },
  };

  const viewportOutput = {
    viewportId: 'processed-viewport',
    type: Enums.ViewportType.STACK,
    element: resultElement,
    defaultOptions: {
      background: [0.2, 0, 0.2] as Types.Point3,
    },
  };

  renderingEngine.enableElement(viewportInput);
  renderingEngine.enableElement(viewportOutput);

  const volumeViewport = renderingEngine.getViewport(
    'original-viewport'
  ) as Types.IVolumeViewport;

  const resultViewport = renderingEngine.getViewport(
    'processed-viewport'
  ) as Types.IStackViewport;

  setupSegmentorUI(volumeViewport, resultViewport);
})();

// Function to load the segmentation result into the viewport
async function loadSegmentationResult(imageUrl: string, viewport: Types.IStackViewport) {
  try {
    // Get the raw URL without the 'web:' prefix
    const rawUrl = imageUrl.replace('web:', '');
    
    // Fetch the zip file
    const response = await fetch(rawUrl);
    const zipBlob = await response.blob();
    
    // Load the ZIP file using JSZip
    const zip = new JSZip();
    await zip.loadAsync(zipBlob);
    
    // Get all PNG files from the ZIP
    const pngFiles = Object.keys(zip.files).filter(filename => filename.endsWith('.png'));
    pngFiles.sort(); // Ensure slices are in order
    
    // Create image IDs for each slice
    const imageIds = await Promise.all(
      pngFiles.map(async (filename) => {
        const file = zip.files[filename];
        const blob = await file.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        return `web:${objectUrl}`;
      })
    );
    
    // Load the first image to get its dimensions
    const firstImage = await imageLoader.loadAndCacheImage(imageIds[0]);
    const { rows, columns } = firstImage;
    
    // Create metadata for the stack
    const imageMetadata = {
      BitsAllocated: 8,
      BitsStored: 8,
      HighBit: 7,
      PhotometricInterpretation: 'RGB',
      PixelRepresentation: 0,
      SamplesPerPixel: 3,
      PixelSpacing: [1, 1],
      ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
      ImagePositionPatient: [0, 0, 0],
      FrameOfReferenceUID: '1.2.3',
      Rows: rows,
      Columns: columns,
    };
    
    // Add metadata for each image
    imageIds.forEach((imageId) => {
      metaData.addProvider((type: string) => {
        if (type === 'imagePixelModule') {
          return imageMetadata;
        }
        return undefined;
      });
    });
    
    // Set the images in the viewport
    await viewport.setStack(imageIds);
    viewport.render();
  } catch (error) {
    console.error('Error loading segmentation result:', error);
    throw new Error('Failed to load segmentation result');
  }
}

