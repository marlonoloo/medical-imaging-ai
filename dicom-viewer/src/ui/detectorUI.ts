import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import type { Types } from '@cornerstonejs/core';
import { ViewportService } from '../services/viewportService';
import { backendService } from '../services/backendService';
import { DicomState } from '../state/DicomState';

export function setupDetectorUI(dicomViewport: Types.IStackViewport, pngViewport: Types.IStackViewport) {
  const dicomElement = document.getElementById('cornerstone-element');
  const pngElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !pngElement) {
    throw new Error("Required viewport elements not found");
  }

  // Prevent context menu on right click
  dicomElement.addEventListener('contextmenu', (e) => e.preventDefault());
  pngElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Drag and drop handlers
  dicomElement.addEventListener('dragover', handleDragOver, false);
  dicomElement.addEventListener('drop', handleFileSelect.bind(null, dicomViewport), false);

  // File input handler
  const fileInput = document.getElementById('selectFile');
  fileInput?.addEventListener('change', function (e: any) {
    const file = e.target.files[0];
    DicomState.setCurrentFile(file);
    const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
    ViewportService.loadDicomImage(imageId, dicomViewport);
  });

  // Cardiac process button
  const cardiacButton = document.getElementById('submitCardiac');
  cardiacButton?.addEventListener('click', async () => {
    const currentFile = DicomState.getCurrentFile();
    if (!currentFile) {
      alert('Please load a DICOM file first');
      return;
    }

    try {
      const imageUrl = await backendService.processCardiacImage(currentFile);
      await ViewportService.loadWebImage(imageUrl, pngViewport);
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
