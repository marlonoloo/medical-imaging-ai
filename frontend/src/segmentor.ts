import { initCornerstoneServices } from './init';
import { setupSegmentorUI } from './ui/segmentorUI';
import { Enums, Types, RenderingEngine, imageLoader, metaData } from '@cornerstonejs/core';
import JSZip from 'jszip';
import { registerWebImageLoader, addWebImageMetadataProvider } from './webImageLoader';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const resultElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  // 1. Initialize Services
  await initCornerstoneServices(); 
  // 1b. Register Web Image Loader **BEFORE** it might be used
  registerWebImageLoader(); 
  addWebImageMetadataProvider();

  // 2. Create Rendering Engine
  const renderingEngineId = 'segmentorRenderingEngine';
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // 3. Define Viewport Inputs with Specific Types
  const viewportInputArray = [
    {
      viewportId: 'NIFTI_VOLUME_VIEWPORT',
      type: Enums.ViewportType.ORTHOGRAPHIC, // For NIFTI Input
      element: dicomElement as HTMLDivElement,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
        background: <Types.Point3>[0.2, 0, 0.2],
      },
    },
    {
      viewportId: 'SEGMENTATION_RESULT_STACK_VIEWPORT',
      type: Enums.ViewportType.STACK, // For PNG Slice Output
      element: resultElement as HTMLDivElement,
      defaultOptions: {
        background: <Types.Point3>[0.2, 0, 0.2],
      },
    },
  ];

  // 4. Enable Elements
  renderingEngine.setViewports(viewportInputArray);

  // 5. Get Correctly Typed Viewport Instances
  const volumeViewport = renderingEngine.getViewport('NIFTI_VOLUME_VIEWPORT') as Types.IVolumeViewport;
  const resultViewport = renderingEngine.getViewport('SEGMENTATION_RESULT_STACK_VIEWPORT') as Types.IStackViewport;

  // 6. Call UI Setup with Correct Viewports
  setupSegmentorUI(volumeViewport, resultViewport);
  
  // Note: ToolGroup setup is handled within setupSegmentorUI/setupTools now
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

