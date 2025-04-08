// src/ui.ts
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import type { Types } from '@cornerstonejs/core';
import { ViewportService } from './services/viewportService';
import { backendService } from './services/backendService';
import { DicomState } from './state/DicomState';

// Add new helper function for loading web images
async function loadAndViewWebImage(imageId: string, viewport: Types.IStackViewport) {
  await viewport.setStack([imageId]);
  viewport.render();
}

export function setupUI(dicomViewport: Types.IStackViewport, pngViewport: Types.IStackViewport) {
  const dicomElement = document.getElementById('cornerstone-element');
  const pngElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !pngElement) {
    throw new Error("Required viewport elements not found");
  }

  // Prevent context menu on right click for both viewports
  dicomElement.addEventListener('contextmenu', (e) => e.preventDefault());
  pngElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Drag and drop event handlers
  dicomElement.addEventListener('dragover', handleDragOver, false);
  dicomElement.addEventListener('drop', handleFileSelect.bind(null, dicomViewport), false);

  // Update file input listener
  const fileInput = document.getElementById('selectFile');
  fileInput?.addEventListener('change', function (e: any) {
    const file = e.target.files[0];
    DicomState.setCurrentFile(file);
    const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
    ViewportService.loadDicomImage(imageId, dicomViewport);
  });

  // Update process buttons click handlers
  const processButton = document.getElementById('submitProcessing');
  const cardiacButton = document.getElementById('submitCardiac');
  
  const probabilityElement = document.createElement('div');
  probabilityElement.id = 'probability-display';
  probabilityElement.style.textAlign = 'center';
  probabilityElement.style.margin = '20px 0';
  probabilityElement.style.fontSize = '16px';
  processButton?.parentElement?.insertBefore(probabilityElement, processButton.nextSibling);

  processButton?.addEventListener('click', async () => {
    const currentFile = DicomState.getCurrentFile();
    if (!currentFile) {
      alert('Please load a DICOM file first');
      return;
    }

    try {
      const { imageUrl, probability } = await backendService.processImage(currentFile);
      await ViewportService.loadWebImage(imageUrl, pngViewport);
      const formattedProbability = (probability * 100).toFixed(2);
      probabilityElement.textContent = `Probability of pneumonia: ${formattedProbability}%`;
    } catch (error) {
      alert('Failed to process image');
    }
  });

  cardiacButton?.addEventListener('click', async () => {
    const currentFile = DicomState.getCurrentFile();
    if (!currentFile) {
      alert('Please load a DICOM file first');
      return;
    }

    try {
      const imageUrl = await backendService.processCardiacImage(currentFile);
      await ViewportService.loadWebImage(imageUrl, pngViewport);
      probabilityElement.textContent = ''; // Clear probability text for cardiac view
    } catch (error) {
      alert('Failed to process cardiac image');
    }
  });
}

function handleFileSelect(viewport: Types.IStackViewport, evt: DragEvent) {
  evt.stopPropagation();
  evt.preventDefault();
  const files = evt.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  DicomState.setCurrentFile(file);
  const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
  ViewportService.loadDicomImage(imageId, viewport);
}

function handleDragOver(evt: DragEvent) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer!.dropEffect = 'copy';
}
