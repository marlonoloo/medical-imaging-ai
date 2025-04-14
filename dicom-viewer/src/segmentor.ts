import { run } from './init';
import { setupSegmentorUI } from './ui/segmentorUI';
import { Enums, Types, RenderingEngine } from '@cornerstonejs/core';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const resultElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  // We need to initialize both viewports together, but with different viewport types
  // Since the run function applies the same viewportType to both viewports,
  // we'll need to create a custom solution
  
  // First, initialize both viewports as STACK type (this is safe and won't cause errors)
  const { dicomViewport, pngViewport } = await run(
    dicomElement, 
    resultElement,
    Enums.ViewportType.STACK // Start with STACK type for both
  );
  
  // Get the rendering engine that was created
  const renderingEngine = dicomViewport.getRenderingEngine();
  const renderingEngineId = renderingEngine.id;
  
  // Destroy the dicomViewport
  renderingEngine.disableElement(dicomViewport.id);
  
  // Create a new volumeViewport for the dicomElement
  const volumeViewportInput = {
    viewportId: 'VOLUME_STACK',
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: dicomElement as HTMLDivElement,
    defaultOptions: {
      orientation: Enums.OrientationAxis.AXIAL,
      background: [0.2, 0, 0.2] as Types.Point3,
    },
  };
  
  // Add the volume viewport
  renderingEngine.enableElement(volumeViewportInput);
  
  // Get the newly created viewport
  const volumeViewport = renderingEngine.getViewport('VOLUME_STACK') as Types.IVolumeViewport;
  
  // Now we have a volumeViewport for NIFTI and a stackViewport for PNG
  setupSegmentorUI(volumeViewport, pngViewport as Types.IStackViewport);
})();

