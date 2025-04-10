import { run } from './init';
import { setupDetectorUI } from './ui/detectorUI';
import { Types } from '@cornerstonejs/core';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const resultElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  const { dicomViewport, pngViewport } = await run<Types.IStackViewport>(dicomElement, resultElement);
  setupDetectorUI(dicomViewport, pngViewport);
})();
