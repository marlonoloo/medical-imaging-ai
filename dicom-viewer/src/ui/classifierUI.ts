import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import type { Types } from '@cornerstonejs/core';
import { getRenderingEngine } from '@cornerstonejs/core';
import { ViewportService } from '../services/viewportService';
import { backendService } from '../services/backendService';
import { DicomState } from '../state/DicomState';

export function setupClassifierUI(renderingEngineId: string, dicomViewportId: string, pngViewportId: string) {
  const dicomElement = document.getElementById('cornerstone-element');
  const pngElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !pngElement) {
    throw new Error("Required viewport elements not found");
  }

  const renderingEngine = getRenderingEngine(renderingEngineId);
  if (!renderingEngine) {
    throw new Error(`Rendering engine ${renderingEngineId} not found`);
  }

  // Prevent context menu on right click
  dicomElement.addEventListener('contextmenu', (e) => e.preventDefault());
  pngElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Drag and drop handlers
  dicomElement.addEventListener('dragover', handleDragOver, false);
  dicomElement.addEventListener('drop', handleFileSelect.bind(null, renderingEngineId, dicomViewportId), false);

  // File input handler
  const fileInput = document.getElementById('selectFile');
  fileInput?.addEventListener('change', function (e: any) {
    const file = e.target.files[0];
    DicomState.setCurrentFile(file);
    const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
    const dicomViewport = renderingEngine.getViewport(dicomViewportId) as Types.IStackViewport;
    if (dicomViewport) {
      ViewportService.loadDicomImage(imageId, dicomViewport);
    }
  });

  // Process button and probability display
  const processButton = document.getElementById('submitProcessing');
  const probabilityElement = createProbabilityElement(processButton);

  processButton?.addEventListener('click', async () => {
    const currentFile = DicomState.getCurrentFile();
    if (!currentFile) {
      alert('Please load a DICOM file first');
      return;
    }

    try {
      const { imageUrl, probability } = await backendService.processImage(currentFile);
      const pngViewport = renderingEngine.getViewport(pngViewportId) as Types.IStackViewport;
      if (pngViewport) {
        await ViewportService.loadWebImage(imageUrl, pngViewport);
        const formattedProbability = (probability * 100).toFixed(2);
        probabilityElement.textContent = `Probability of pneumonia: ${formattedProbability}%`;
      }
    } catch (error) {
      alert('Failed to process image');
    }
  });

  // Reset buttons
  const resetPrimaryButton = document.getElementById('resetPrimaryViewport');
  const resetSecondaryButton = document.getElementById('resetSecondaryViewport');

  resetPrimaryButton?.addEventListener('click', () => {
    const viewport = renderingEngine.getViewport(dicomViewportId) as Types.IStackViewport;
    if (viewport) {
      viewport.resetCamera();
      viewport.resetProperties();
      viewport.render();
    }
  });

  resetSecondaryButton?.addEventListener('click', () => {
    const viewport = renderingEngine.getViewport(pngViewportId) as Types.IStackViewport;
    if (viewport) {
      viewport.resetCamera();
      viewport.resetProperties();
      viewport.render();
    }
  });
}

function createProbabilityElement(processButton: HTMLElement | null): HTMLDivElement {
  const probabilityElement = document.createElement('div');
  probabilityElement.id = 'probability-display';
  probabilityElement.style.textAlign = 'center';
  probabilityElement.style.margin = '20px 0';
  probabilityElement.style.fontSize = '16px';
  processButton?.parentElement?.insertBefore(probabilityElement, processButton.nextSibling);
  return probabilityElement;
}

function handleFileSelect(renderingEngineId: string, viewportId: string, evt: DragEvent) {
  evt.stopPropagation();
  evt.preventDefault();
  const files = evt.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  DicomState.setCurrentFile(file);
  const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);

  const renderingEngine = getRenderingEngine(renderingEngineId);
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
  if (viewport) {
    ViewportService.loadDicomImage(imageId, viewport);
  }
}

function handleDragOver(evt: DragEvent) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer!.dropEffect = 'copy';
}
