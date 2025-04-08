// src/index.ts
import { run } from './init';
import { setupUI } from './ui';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const pngElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !pngElement) {
    throw new Error("Required viewport elements not found");
  }

  // Initialize both viewports
  const { dicomViewport, pngViewport } = await run(dicomElement, pngElement);
  
  // Set up UI handlers
  setupUI(dicomViewport, pngViewport);
})();
