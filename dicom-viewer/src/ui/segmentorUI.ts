import type { Types } from '@cornerstonejs/core';
import {
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
  eventTarget,
  imageLoader,
  metaData,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneNiftiImageLoader,
  createNiftiImageIdsAndCacheMetadata,
} from '@cornerstonejs/nifti-volume-loader';
import { inflate } from 'pako';
import { backendService } from '../services/backendService';
import JSZip from 'jszip';

const {
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
  ToolGroupManager,
  Enums: csToolsEnums,
} = cornerstoneTools;

const { MouseBindings } = csToolsEnums;
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks

// Store the current file for processing
let currentNiftiFile: File | null = null;
let defaultNiftiVoiRange: Types.VOIRange | undefined;

export function setupSegmentorUI(
  volumeViewport: Types.IVolumeViewport,
  resultViewport: Types.IStackViewport
) {
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
      currentNiftiFile = file;
      await loadAndViewNiftiFile(file, volumeViewport);
    } catch (error) {
      console.error('Error loading NIFTI file:', error);
      alert('Failed to load NIFTI file');
    }
  });

  // Setup segmentation button
  const segmentButton = document.getElementById('submitSegmentation');
  segmentButton?.addEventListener('click', async () => {
    if (!currentNiftiFile) {
      alert('Please upload a NIFTI file first');
      return;
    }

    try {
      const imageUrl = await backendService.processSegmentation(currentNiftiFile);
      
      // Load the segmentation results (ZIP file with slices) into the result viewport
      await loadSegmentationResult(imageUrl, resultViewport);
    } catch (error) {
      console.error('Error processing segmentation:', error);
      alert('Failed to process segmentation');
    }
  });

  // Initialize tools for both viewports
  setupTools(volumeViewport, resultViewport);

  defaultNiftiVoiRange = undefined;

  // --- Modify Reset Button Logic --- 
  const resetPrimaryButton = document.getElementById('resetPrimaryViewport');
  const resetSecondaryButton = document.getElementById('resetSecondaryViewport');

  resetPrimaryButton?.addEventListener('click', () => {
    if (volumeViewport) {
      // 1. Store current camera position/focal point (determines slice)
      const currentCamera = volumeViewport.getCamera();

      // 2. Reset camera (resets zoom/pan AND slice position)
      volumeViewport.resetCamera();

      // 3. Get the zoom level (parallelScale) from the reset state
      const resetCameraState = volumeViewport.getCamera();

      // 4. Restore original slice position but keep reset zoom
      volumeViewport.setCamera({
        position: currentCamera.position,
        focalPoint: currentCamera.focalPoint,
        viewUp: resetCameraState.viewUp, // Use reset viewUp
        parallelScale: resetCameraState.parallelScale, // Use reset zoom
      });
      
      // 5. Reset VOI using stored default range
      if (defaultNiftiVoiRange) {
        volumeViewport.setProperties({ voiRange: defaultNiftiVoiRange });
      }
      
      // 6. Render
      volumeViewport.render();
    }
  });

  resetSecondaryButton?.addEventListener('click', () => {
    if (resultViewport) {
      resultViewport.resetCamera();
      resultViewport.resetProperties(); 
      resultViewport.render();
    }
  });
  // --- End Reset Button Logic --- 
}

// Function to load the segmentation result into the viewport
async function loadSegmentationResult(imageUrl: string, viewport: Types.IStackViewport) {
  try {
    // Get the raw URL without the 'web:' prefix
    const rawUrl = imageUrl.replace('web:', '');
    
    // Fetch the zip file
    const response = await fetch(rawUrl);
    const zipBlob = await response.blob();
    
    // Load the ZIP file using JSZip
    const zip = new JSZip();
    await zip.loadAsync(zipBlob);
    
    // Get all PNG files from the ZIP, excluding those in debug folder
    const pngFiles = Object.keys(zip.files).filter(
        filename => filename.endsWith('.png') && !filename.startsWith('debug/')
    );

    pngFiles.sort(); // Ensure slices are in order

    if (pngFiles.length === 0) {
      throw new Error('No valid PNG slices found in the zip file.');
    }
    
    // Create image IDs for each slice
    const imageIds = await Promise.all(
      pngFiles.map(async (filename) => {
        const file = zip.files[filename];
        const blob = await file.async('blob');
        const objectUrl = URL.createObjectURL(blob);
        return `web:${objectUrl}`;
      })
    );
    
    // Comment out or remove the reversal
    // imageIds.reverse(); 
    
    // Load the first image (which is now the first slice numerically) to get its dimensions
    const firstImage = await imageLoader.loadAndCacheImage(imageIds[0]);
    const { rows, columns } = firstImage;
    
    // Create metadata for the stack
    const imageMetadata = {
      BitsAllocated: 8,
      BitsStored: 8,
      HighBit: 7,
      PhotometricInterpretation: 'RGB',
      PixelRepresentation: 0,
      SamplesPerPixel: 3,
      PixelSpacing: [1, 1],
      ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
      ImagePositionPatient: [0, 0, 0],
      FrameOfReferenceUID: '1.2.3',
      Rows: rows,
      Columns: columns,
    };
    
    // Add metadata for each image
    imageIds.forEach((imageId) => {
      metaData.addProvider((type: string) => {
        if (type === 'imagePixelModule') {
          return imageMetadata;
        }
        return undefined;
      });
    });

    // Pre-load all images in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < imageIds.length; i += batchSize) {
      const batch = imageIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (imageId) => {
          await imageLoader.loadAndCacheImage(imageId);
        })
      );
    }
    
    // Set the images in the viewport
    await viewport.setStack(imageIds);
    
    // Configure viewport for optimal performance
    viewport.setOptions({
      background: [0, 0, 0],
      suppressEvents: true,
    });
    
    viewport.render();
  } catch (error) {
    console.error('Error loading segmentation result:', error);
    throw new Error('Failed to load segmentation result');
  }
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
    
    // --- Store default VOI range --- 
    try {
        const properties = viewport.getProperties();
        defaultNiftiVoiRange = properties.voiRange ? { ...properties.voiRange } : undefined;
        console.log('Stored default VOI range:', defaultNiftiVoiRange);
    } catch (e) {
        console.error('Could not get default VOI range after load', e);
        defaultNiftiVoiRange = undefined; 
    }
    // --- End storing default VOI range ---

    // --- Set initial slice to index 0 --- 
    const imageData = volume.imageData; 
    if (imageData) {
        const initialCamera = viewport.getCamera(); // Get camera state AFTER volume load
        const dimensions = imageData.getDimensions();
        const spacing = imageData.getSpacing();
        const origin = imageData.getOrigin();
        const ipp = imageData.getDirection(); // Direction Cosines
        const viewPlaneNormal: Types.Point3 = [ipp[2], ipp[5], ipp[8]];

        // Calculate distance from origin to center slice along normal
        const centerSliceIndex = Math.floor(dimensions[2] / 2);
        const distanceToCenter = centerSliceIndex * spacing[2];
        
        // Distance from origin to slice 0 along normal is 0
        const distanceToSlice0 = 0;

        // How much to move the camera along the normal from the center position
        // delta < 0 means move towards origin (lower slice indices)
        const deltaDistance = distanceToSlice0 - distanceToCenter;

        // Calculate the new focal point and position by shifting along the normal
        const newFocalPoint: Types.Point3 = [
          initialCamera.focalPoint[0] + deltaDistance * viewPlaneNormal[0],
          initialCamera.focalPoint[1] + deltaDistance * viewPlaneNormal[1],
          initialCamera.focalPoint[2] + deltaDistance * viewPlaneNormal[2],
        ];
        const newPosition: Types.Point3 = [
            initialCamera.position[0] + deltaDistance * viewPlaneNormal[0],
            initialCamera.position[1] + deltaDistance * viewPlaneNormal[1],
            initialCamera.position[2] + deltaDistance * viewPlaneNormal[2],
        ];

        viewport.setCamera({ 
            focalPoint: newFocalPoint,
            position: newPosition,
            // Keep other properties from the state after volume load
            viewUp: initialCamera.viewUp, 
            parallelScale: initialCamera.parallelScale
        });
        console.log('Set initial camera for slice 0');
    }
    // --- End setting initial slice ---

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

function setupTools(volumeViewport: Types.IVolumeViewport, resultViewport: Types.IStackViewport) {
  // Define separate IDs
  const volumeToolGroupId = 'VOLUME_TOOL_GROUP';
  const stackToolGroupId = 'STACK_TOOL_GROUP';

  // --- Destroy existing groups if they exist (important for HMR/re-runs) ---
  const volumeExistingGroup = ToolGroupManager.getToolGroupForViewport(volumeViewport.id, volumeViewport.getRenderingEngine().id);
  if (volumeExistingGroup) ToolGroupManager.destroyToolGroup(volumeExistingGroup.id);
  const stackExistingGroup = ToolGroupManager.getToolGroupForViewport(resultViewport.id, resultViewport.getRenderingEngine().id);
  if (stackExistingGroup) ToolGroupManager.destroyToolGroup(stackExistingGroup.id);
  // Safety check: destroy groups by ID directly if somehow detached from viewport
  if (ToolGroupManager.getToolGroup(volumeToolGroupId)) ToolGroupManager.destroyToolGroup(volumeToolGroupId);
  if (ToolGroupManager.getToolGroup(stackToolGroupId)) ToolGroupManager.destroyToolGroup(stackToolGroupId);
  // --- End Destroy --- 

  // Create separate tool groups
  const volumeToolGroup = ToolGroupManager.createToolGroup(volumeToolGroupId);
  const stackToolGroup = ToolGroupManager.createToolGroup(stackToolGroupId);

  // --- Setup Volume Tool Group --- 
  [volumeToolGroup, stackToolGroup].forEach(toolGroup => {
    // Add tools (same tools for both for now)
    cornerstoneTools.addTool(WindowLevelTool); // Ensure tools are added globally once
    cornerstoneTools.addTool(PanTool);
    cornerstoneTools.addTool(ZoomTool);
    cornerstoneTools.addTool(StackScrollTool);

    toolGroup.addTool(WindowLevelTool.toolName);
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(StackScrollTool.toolName);
    
    // Set basic bindings (same for both)
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
  });

  // Configure StackScrollTool *differently* for each group
  volumeToolGroup.setToolConfiguration(StackScrollTool.toolName, { 
    invert: true // Keep inverted for Volume viewport
  });
  stackToolGroup.setToolConfiguration(StackScrollTool.toolName, { 
    invert: false // Use default (non-inverted) for Stack viewport
  });
  // --- End Group Setups ---

  // Add viewports to their respective tool groups
  volumeToolGroup.addViewport(volumeViewport.id, volumeViewport.getRenderingEngine().id);
  stackToolGroup.addViewport(resultViewport.id, resultViewport.getRenderingEngine().id);
}
