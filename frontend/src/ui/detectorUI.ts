import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import type { Types } from '@cornerstonejs/core';
import { getRenderingEngine, Enums } from '@cornerstonejs/core';
import { ViewportService } from '../services/viewportService';
import { backendService } from '../services/backendService';
import { DicomState } from '../state/DicomState';
import * as cornerstoneTools from '@cornerstonejs/tools';

const { ToolGroupManager, StackScrollTool } = cornerstoneTools;

export function setupDetectorUI(renderingEngineId: string, dicomViewportId: string, pngViewportId: string) {
  const dicomElement = document.getElementById('cornerstone-element');
  const pngElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !pngElement) {
    throw new Error("Required viewport elements not found");
  }

  const renderingEngine = getRenderingEngine(renderingEngineId);
  if (!renderingEngine) {
    throw new Error(`Rendering engine ${renderingEngineId} not found`);
  }

  // Set data attributes for custom event handling
  dicomElement.setAttribute('data-rendering-engine-id', renderingEngineId);
  dicomElement.setAttribute('data-viewport-id', dicomViewportId);
  pngElement.setAttribute('data-rendering-engine-id', renderingEngineId);
  pngElement.setAttribute('data-viewport-id', pngViewportId);

  // Get the toolGroup for this rendering engine
  const toolGroups = ToolGroupManager.getAllToolGroups();
  const toolGroup = toolGroups[0]; // Assuming there's only one tool group

  // Initially disable scroll tools since there are no images
  if (toolGroup) {
    toolGroup.setToolDisabled(StackScrollTool.toolName);
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
      ViewportService.loadDicomImage(imageId, dicomViewport).then(() => {
        // Enable scroll tool once images are loaded
        if (toolGroup) {
          toolGroup.setToolEnabled(StackScrollTool.toolName);
        }
      });
    }
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
      // Disable the button during processing
      if (cardiacButton instanceof HTMLButtonElement) {
        cardiacButton.disabled = true;
        cardiacButton.textContent = 'Processing...';
      }

      const imageUrl = await backendService.processCardiacImage(currentFile);
      const pngViewport = renderingEngine.getViewport(pngViewportId) as Types.IStackViewport;
      if (pngViewport) {
        await ViewportService.loadWebImage(imageUrl, pngViewport);
        // Enable scroll tool for the processed image viewport
        if (toolGroup) {
          toolGroup.setToolEnabled(StackScrollTool.toolName);
        }
      }
      // Clear any previous probability text (if switching views)
      const probabilityElement = document.getElementById('probability-display');
      if (probabilityElement) probabilityElement.textContent = '';
    } catch (error) {
      alert('Failed to process cardiac image');
    } finally {
      // Re-enable the button when processing is done (whether successful or not)
      if (cardiacButton instanceof HTMLButtonElement) {
        cardiacButton.disabled = false;
        cardiacButton.textContent = 'Process Cardiac';
      }
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

  // Add MutationObserver to detect when a viewport is emptied
  setupViewportObservers(renderingEngine, dicomViewportId, pngViewportId, toolGroup);
}

// Function to monitor viewport state changes
function setupViewportObservers(
  renderingEngine: any, 
  dicomViewportId: string, 
  pngViewportId: string, 
  toolGroup: any
) {
  // Function to check if a viewport has images
  const checkViewportImages = (viewportId: string) => {
    const viewport = renderingEngine.getViewport(viewportId) as Types.IStackViewport;
    if (viewport) {
      const imageIds = viewport.getImageIds();
      return imageIds && imageIds.length > 0;
    }
    return false;
  };

  // Set up a periodic check for empty viewports
  setInterval(() => {
    const dicomHasImages = checkViewportImages(dicomViewportId);
    const pngHasImages = checkViewportImages(pngViewportId);

    if (dicomHasImages || pngHasImages) {
      // At least one viewport has images, enable the scroll tool
      if (toolGroup) {
        toolGroup.setToolEnabled(StackScrollTool.toolName);
      }
    } else {
      // Both viewports are empty, disable the scroll tool
      if (toolGroup) {
        toolGroup.setToolDisabled(StackScrollTool.toolName);
      }
    }
  }, 500); // Check every 500ms
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
