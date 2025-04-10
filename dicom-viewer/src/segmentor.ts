import { run } from './init';
import { setupSegmentorUI } from './ui/segmentorUI';
import { Enums, Types } from '@cornerstonejs/core';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const resultElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  const { dicomViewport, pngViewport } = await run<Types.IVolumeViewport>(
    dicomElement, 
    resultElement, 
    Enums.ViewportType.ORTHOGRAPHIC
  );
  setupSegmentorUI(dicomViewport, pngViewport);
})();
