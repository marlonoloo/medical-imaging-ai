// src/index.ts
import { run } from './init';
import { setupUI } from './ui';
import { Types } from '@cornerstonejs/core';

(async function main() {
  const dicomElement = document.getElementById('cornerstone-element');
  const pngElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !pngElement) {
    throw new Error("Required viewport elements not found");
  }

  const { dicomViewport, pngViewport } = await run<Types.IStackViewport>(dicomElement, pngElement);
  setupUI(dicomViewport, pngViewport);
})();
