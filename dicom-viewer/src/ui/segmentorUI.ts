import type { Types } from '@cornerstonejs/core';
import {
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  eventTarget,
  imageLoader,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneNiftiImageLoader,
  createNiftiImageIdsAndCacheMetadata,
} from '@cornerstonejs/nifti-volume-loader';
import { inflate } from 'pako';
import { ViewportService } from '../services/viewportService';
import { backendService } from '../services/backendService';

// Simple state to track the current NIFTI file
class NiftiState {
  private static currentFile: File | null = null;

  static setCurrentFile(file: File | null): void {
    this.currentFile = file;
  }

  static getCurrentFile(): File | null {
    return this.currentFile;
  }
}

const {
  WindowLevelTool,
  PanTool,
  ZoomTool,
  ToolGroupManager,
  StackScrollTool,
} = cornerstoneTools;

const { MouseBindings } = cornerstoneTools.Enums;
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
const toolGroupId = 'NIFTI_TOOL_GROUP'; // Changed to avoid conflicts

export function setupSegmentorUI(dicomViewport: Types.IVolumeViewport, pngViewport: Types.IStackViewport) {
  const dicomElement = document.getElementById('cornerstone-element');
  const resultElement = document.getElementById('processed-cornerstone-element');
  
  if (!dicomElement || !resultElement) {
    throw new Error("Required viewport elements not found");
  }

  // Prevent context menu
  dicomElement.addEventListener('contextmenu', (e) => e.preventDefault());
  resultElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Setup file input handler
  const fileInput = document.getElementById('selectFile');
  fileInput?.addEventListener('change', async function (e: any) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      NiftiState.setCurrentFile(file);
      await loadAndViewNiftiFile(file, dicomViewport);
    } catch (error) {
      console.error('Error loading NIFTI file:', error);
      alert('Failed to load NIFTI file');
    }
  });

  // Setup process segmentation button
  const submitButton = document.getElementById('submitSegmentation');
  submitButton?.addEventListener('click', async () => {
    try {
      // Get the current NIFTI file 
      const currentFile = NiftiState.getCurrentFile();
      if (!currentFile) {
        alert('Please load a NIFTI file first');
        return;
      }
      
      // Send to backend for processing
      const imageUrl = await backendService.processSegmentation(currentFile);
      
      // Load the resulting PNG into the second viewport
      await ViewportService.loadWebImage(imageUrl, pngViewport);
    } catch (error) {
      console.error('Error processing segmentation:', error);
      alert('Failed to process segmentation');
    }
  });

  // Initialize tools
  setupTools(dicomViewport);
}

async function loadAndViewNiftiFile(file: File, viewport: Types.IVolumeViewport) {
  // Register NIFTI loader if not already registered
  imageLoader.registerImageLoader('nifti', cornerstoneNiftiImageLoader as unknown as Types.ImageLoaderFn);

  const compressedData = await loadFileInChunks(file);
  const decompressedData = await decompressGzip(compressedData);
  const blob = new Blob([decompressedData], { type: 'application/octet-stream' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const volumeId = `cornerstoneStreamingImageVolume:${file.name}`;
    const imageIds = await createNiftiImageIdsAndCacheMetadata({ url: objectUrl });

    const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
    await volume.load();

    await setVolumesForViewports(
      viewport.getRenderingEngine(),
      [{ volumeId }],
      [viewport.id]
    );

    viewport.render();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadFileInChunks(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const chunks: ArrayBuffer[] = [];
    const reader = new FileReader();
    let offset = 0;

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const chunk = e.target?.result as ArrayBuffer;
      if (chunk) {
        chunks.push(chunk);
      }

      if (offset < file.size) {
        readNextChunk();
      } else {
        const totalLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
        const result = new ArrayBuffer(totalLength);
        const view = new Uint8Array(result);
        let position = 0;

        for (const chunk of chunks) {
          view.set(new Uint8Array(chunk), position);
          position += chunk.byteLength;
        }

        resolve(result);
      }
    };

    reader.onerror = reject;

    function readNextChunk() {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
      offset += slice.size;
    }

    readNextChunk();
  });
}

async function decompressGzip(compressedData: ArrayBuffer): Promise<ArrayBuffer> {
  const compressed = new Uint8Array(compressedData);
  return inflate(compressed).buffer;
}

function setupTools(viewport: Types.IVolumeViewport) {
  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

  // Clear any existing tool groups for this viewport
  const existingGroup = ToolGroupManager.getToolGroupForViewport(
    viewport.id,
    viewport.getRenderingEngine().id
  );
  if (existingGroup) {
    ToolGroupManager.destroyToolGroup(existingGroup.id);
  }

  // Add tools
  cornerstoneTools.addTool(WindowLevelTool);
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(StackScrollTool);

  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);

  // Set tool modes
  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Auxiliary }],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Secondary }],
  });
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Wheel }],
  });

  toolGroup.addViewport(viewport.id, viewport.getRenderingEngine().id);
}
