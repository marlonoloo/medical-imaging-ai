import { run } from './init';
import { setupClassifierUI } from './ui/classifierUI';
import { Types } from '@cornerstonejs/core';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const resultElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  const { dicomViewport, pngViewport } = await run<Types.IStackViewport>(dicomElement, resultElement);
  setupClassifierUI(dicomViewport, pngViewport);
})();
