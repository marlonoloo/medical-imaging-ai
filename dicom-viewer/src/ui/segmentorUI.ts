import type { Types } from '@cornerstonejs/core';
import {
  Enums,
  volumeLoader,
  setVolumesForViewports,
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
// Store a reference to the currently loaded volume and its ID
let currentVolumeData: { volumeId: string; volume: any } | null = null;

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
      // Disable the button during processing
      if (segmentButton instanceof HTMLButtonElement) {
        segmentButton.disabled = true;
        segmentButton.textContent = 'Processing...';
      }

      const imageUrl = await backendService.processSegmentation(currentNiftiFile);
      
      // Load the segmentation results (ZIP file with slices) into the result viewport
      await loadSegmentationResult(imageUrl, resultViewport);
      
      // After loading the segmentation, synchronize the initial view
      // Use a proper sync method instead of simulating an event
      if (currentVolumeData) {
        // Get current camera state to determine current slice position
        const camera = volumeViewport.getCamera();
        const volume = currentVolumeData.volume;
        
        if (volume && volume.imageData) {
          // Get image data properties
          const imageData = volume.imageData;
          const dimensions = imageData.getDimensions();
          const totalVolumeSlices = dimensions[2];
          const origin = imageData.getOrigin();
          const spacing = imageData.getSpacing();
          const ipp = imageData.getDirection();
          const viewPlaneNormal: Types.Point3 = [ipp[2], ipp[5], ipp[8]];
          
          // Calculate current slice position
          const vectorFromOrigin = [
            camera.focalPoint[0] - origin[0],
            camera.focalPoint[1] - origin[1],
            camera.focalPoint[2] - origin[2],
          ];
          
          // Project onto view plane normal
          const distanceAlongNormal = 
            vectorFromOrigin[0] * viewPlaneNormal[0] +
            vectorFromOrigin[1] * viewPlaneNormal[1] +
            vectorFromOrigin[2] * viewPlaneNormal[2];
          
          // Calculate slice index and relative position
          const currentVolumeSliceIndex = Math.round(distanceAlongNormal / spacing[2]);
          const relativePosition = currentVolumeSliceIndex / (totalVolumeSlices - 1);
          
          // Map to stack viewport
          const imageIds = resultViewport.getImageIds();
          if (imageIds && imageIds.length > 0) {
            const totalStackSlices = imageIds.length;
            const targetStackIndex = Math.round(relativePosition * (totalStackSlices - 1));
            const clampedStackIndex = Math.max(0, Math.min(totalStackSlices - 1, targetStackIndex));
            
            // Set stack viewport to the corresponding slice
            resultViewport.setImageIdIndex(clampedStackIndex);
            resultViewport.render();
          }
        }
      }
    } catch (error) {
      console.error('Error processing segmentation:', error);
      alert('Failed to process segmentation');
    } finally {
      // Re-enable the button when processing is done (whether successful or not)
      if (segmentButton instanceof HTMLButtonElement) {
        segmentButton.disabled = false;
        segmentButton.textContent = 'Process Segmentation';
      }
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
      // 1. Get current camera state (includes slice position)
      const currentCamera = volumeViewport.getCamera();

      // 2. Reset camera to get default centering, zoom, and orientation 
      //    (Note: This temporarily moves to the middle slice)
      volumeViewport.resetCamera();
      const resetCameraState = volumeViewport.getCamera();

      // 3. Calculate the vector along the view direction (view plane normal)
      //    This assumes the view hasn't been rotated significantly from default axial.
      //    A more robust method might use camera direction vectors if needed.
      const viewPlaneNormal = resetCameraState.viewPlaneNormal;
      if (!viewPlaneNormal) { 
          console.warn('View plane normal not available on reset camera state, cannot preserve slice accurately.');
          // Fallback: Just use the fully reset state + default VOI
          if (defaultNiftiVoiRange) {
            volumeViewport.setProperties({ voiRange: defaultNiftiVoiRange });
          }
          volumeViewport.render();
          return; 
      }
      
      // 4. Calculate the 'depth' difference between the current slice's focal point
      //    and the reset (middle slice) focal point along the view normal.
      const vectorFromResetToCurrentFocal = [
          currentCamera.focalPoint[0] - resetCameraState.focalPoint[0],
          currentCamera.focalPoint[1] - resetCameraState.focalPoint[1],
          currentCamera.focalPoint[2] - resetCameraState.focalPoint[2],
      ];
      // Project this vector onto the viewPlaneNormal to get the signed distance along the normal
      const depthDifference = 
          vectorFromResetToCurrentFocal[0] * viewPlaneNormal[0] +
          vectorFromResetToCurrentFocal[1] * viewPlaneNormal[1] +
          vectorFromResetToCurrentFocal[2] * viewPlaneNormal[2];

      // 5. Calculate the target camera state: Start from the fully reset state 
      //    and shift the position and focal point along the view normal by the depthDifference
      //    to return to the original slice depth, while keeping default pan/zoom.
      const targetFocalPoint: Types.Point3 = [
          resetCameraState.focalPoint[0] + depthDifference * viewPlaneNormal[0],
          resetCameraState.focalPoint[1] + depthDifference * viewPlaneNormal[1],
          resetCameraState.focalPoint[2] + depthDifference * viewPlaneNormal[2],
      ];
      const targetPosition: Types.Point3 = [
          resetCameraState.position[0] + depthDifference * viewPlaneNormal[0],
          resetCameraState.position[1] + depthDifference * viewPlaneNormal[1],
          resetCameraState.position[2] + depthDifference * viewPlaneNormal[2],
      ];

      // 6. Set the calculated camera state (restored slice depth, default pan/zoom/orientation)
      volumeViewport.setCamera({
        position: targetPosition,
        focalPoint: targetFocalPoint,
        viewUp: resetCameraState.viewUp,             // Use default orientation
        parallelScale: resetCameraState.parallelScale, // Use default zoom
      });
      
      // 7. Reset VOI using stored default range
      if (defaultNiftiVoiRange) {
        volumeViewport.setProperties({ voiRange: defaultNiftiVoiRange });
      }
      
      // 8. Render the final state
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

    // Store the volume reference for later use in sync functions
    currentVolumeData = { volumeId, volume };

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
  
  // --- Add synchronized scrolling between viewports ---
  setupSynchronizedScrolling(volumeViewport, resultViewport);
}

// Function to set up synchronized scrolling between viewports
function setupSynchronizedScrolling(volumeViewport: Types.IVolumeViewport, resultViewport: Types.IStackViewport) {
  // Track if we're currently handling an event to prevent endless loops
  let isHandlingScrollEvent = false;
  
  // Function to synchronize from volume to stack
  const syncVolumeToStack = () => {
    if (isHandlingScrollEvent || !resultViewport || !currentVolumeData) return;
    isHandlingScrollEvent = true;
    
    try {
      // Get volume dimensions and current slice position
      const camera = volumeViewport.getCamera();
      const volume = currentVolumeData.volume;
      
      const imageData = volume.imageData;
      const dimensions = imageData.getDimensions();
      const totalVolumeSlices = dimensions[2];
      
      // Calculate relative slice position (0-1) in the volume
      const imageIds = resultViewport.getImageIds();
      if (!imageIds || imageIds.length === 0) {
        isHandlingScrollEvent = false;
        return;
      }
      
      // Get the view direction and calculate slice position in volume
      const ipp = imageData.getDirection();
      const viewPlaneNormal: Types.Point3 = [ipp[2], ipp[5], ipp[8]];
      
      const origin = imageData.getOrigin();
      const spacing = imageData.getSpacing();
      
      // Calculate vector from origin to camera focal point along view normal
      const vectorFromOrigin = [
        camera.focalPoint[0] - origin[0],
        camera.focalPoint[1] - origin[1],
        camera.focalPoint[2] - origin[2],
      ];
      
      // Project this vector onto the viewPlaneNormal to get distance along normal
      const distanceAlongNormal = 
        vectorFromOrigin[0] * viewPlaneNormal[0] +
        vectorFromOrigin[1] * viewPlaneNormal[1] +
        vectorFromOrigin[2] * viewPlaneNormal[2];
      
      // Calculate slice index based on distance and spacing
      const currentVolumeSliceIndex = Math.round(distanceAlongNormal / spacing[2]);
      
      // Ensure we're in valid range and reset camera if necessary
      if (currentVolumeSliceIndex < 0 || currentVolumeSliceIndex >= totalVolumeSlices) {
        // We're out of bounds, so adjust to the nearest valid slice
        const validSliceIndex = Math.max(0, Math.min(totalVolumeSlices - 1, currentVolumeSliceIndex));
        
        // Calculate adjustment needed to get to valid slice
        const adjustment = (validSliceIndex - currentVolumeSliceIndex) * spacing[2];
        
        // Adjust camera to valid slice
        volumeViewport.setCamera({
          focalPoint: [
            camera.focalPoint[0] + adjustment * viewPlaneNormal[0],
            camera.focalPoint[1] + adjustment * viewPlaneNormal[1], 
            camera.focalPoint[2] + adjustment * viewPlaneNormal[2]
          ],
          position: [
            camera.position[0] + adjustment * viewPlaneNormal[0],
            camera.position[1] + adjustment * viewPlaneNormal[1],
            camera.position[2] + adjustment * viewPlaneNormal[2]
          ],
          viewUp: camera.viewUp,
          parallelScale: camera.parallelScale
        });
        
        volumeViewport.render();
        
        // Use adjusted slice index
        const relativePosition = validSliceIndex / (totalVolumeSlices - 1);
        const totalStackSlices = imageIds.length;
        const targetStackIndex = Math.round(relativePosition * (totalStackSlices - 1));
        const clampedStackIndex = Math.max(0, Math.min(totalStackSlices - 1, targetStackIndex));
        
        resultViewport.setImageIdIndex(clampedStackIndex);
        resultViewport.render();
      } else {
        // We're in a valid range, proceed normally
        const clampedVolumeIndex = Math.max(0, Math.min(totalVolumeSlices - 1, currentVolumeSliceIndex));
        
        // Determine relative position (0-1) within volume
        const relativePosition = clampedVolumeIndex / (totalVolumeSlices - 1);
        
        // Map this relative position to the stack viewport
        const totalStackSlices = imageIds.length;
        const targetStackIndex = Math.round(relativePosition * (totalStackSlices - 1));
        
        // Clamp to valid range
        const clampedStackIndex = Math.max(0, Math.min(totalStackSlices - 1, targetStackIndex));
        
        // Get current stack index
        const currentStackIndex = resultViewport.getCurrentImageIdIndex();
        
        // Only update if the index changed
        if (clampedStackIndex !== currentStackIndex) {
          resultViewport.setImageIdIndex(clampedStackIndex);
          resultViewport.render();
        }
      }
    } catch (error) {
      console.error('Error synchronizing scroll from volume to stack:', error);
    } finally {
      isHandlingScrollEvent = false;
    }
  };
  
  // Function to synchronize from stack to volume
  const syncStackToVolume = () => {
    if (isHandlingScrollEvent || !volumeViewport || !currentVolumeData) return;
    isHandlingScrollEvent = true;
    
    try {
      // Get current stack position
      const currentStackIndex = resultViewport.getCurrentImageIdIndex();
      const imageIds = resultViewport.getImageIds();
      
      if (imageIds.length === 0) {
        isHandlingScrollEvent = false;
        return;
      }
      
      // Calculate relative position (0-1) in the stack
      const relativePosition = currentStackIndex / (imageIds.length - 1);
      
      // Get volume dimensions
      const volume = currentVolumeData.volume;
      const imageData = volume.imageData;
      const dimensions = imageData.getDimensions();
      const totalVolumeSlices = dimensions[2];
      
      // Map relative position to volume slice
      const targetVolumeSliceIndex = Math.round(relativePosition * (totalVolumeSlices - 1));
      
      // Ensure the target slice is within valid range
      const clampedTargetSliceIndex = Math.max(0, Math.min(totalVolumeSlices - 1, targetVolumeSliceIndex));
      
      // Get current camera state to preserve orientation, zoom, etc.
      const camera = volumeViewport.getCamera();
      
      // Get direction cosines for view plane
      const ipp = imageData.getDirection();
      const viewPlaneNormal: Types.Point3 = [ipp[2], ipp[5], ipp[8]];
      
      // Get spacing and origin
      const spacing = imageData.getSpacing();
      const origin = imageData.getOrigin();
      
      // Calculate current slice position first
      const vectorFromOrigin = [
        camera.focalPoint[0] - origin[0],
        camera.focalPoint[1] - origin[1],
        camera.focalPoint[2] - origin[2],
      ];
      
      // Project this vector onto the viewPlaneNormal to get distance along normal
      const distanceAlongNormal = 
        vectorFromOrigin[0] * viewPlaneNormal[0] +
        vectorFromOrigin[1] * viewPlaneNormal[1] +
        vectorFromOrigin[2] * viewPlaneNormal[2];
      
      // Calculate current slice index
      const currentVolumeSliceIndex = Math.round(distanceAlongNormal / spacing[2]);
      
      // Only proceed if there's a valid change in slice position
      if (currentVolumeSliceIndex === clampedTargetSliceIndex) {
        isHandlingScrollEvent = false;
        return;
      }
      
      // Calculate the delta in slices (how many slices to move)
      const sliceDelta = clampedTargetSliceIndex - currentVolumeSliceIndex;
      
      // Calculate the position delta along the normal
      const positionDelta = sliceDelta * spacing[2];
      
      // Calculate the new focal point and position by shifting along the normal
      const newFocalPoint: Types.Point3 = [
        camera.focalPoint[0] + positionDelta * viewPlaneNormal[0],
        camera.focalPoint[1] + positionDelta * viewPlaneNormal[1],
        camera.focalPoint[2] + positionDelta * viewPlaneNormal[2],
      ];
      
      const newPosition: Types.Point3 = [
        camera.position[0] + positionDelta * viewPlaneNormal[0],
        camera.position[1] + positionDelta * viewPlaneNormal[1],
        camera.position[2] + positionDelta * viewPlaneNormal[2],
      ];
      
      // Set camera with adjusted position (preserving current orientation, zoom, pan)
      volumeViewport.setCamera({
        focalPoint: newFocalPoint,
        position: newPosition,
        viewUp: camera.viewUp,
        parallelScale: camera.parallelScale
      });
      
      volumeViewport.render();
    } catch (error) {
      console.error('Error synchronizing scroll from stack to volume:', error);
    } finally {
      isHandlingScrollEvent = false;
    }
  };
  
  // Enhanced wheel event handler to manage scrolling directly
  const handleWheel = (event: WheelEvent, isVolumeViewport: boolean) => {
    event.preventDefault(); // Prevent default scrolling
    event.stopPropagation(); // Stop event bubbling
    
    if (isHandlingScrollEvent || !currentVolumeData) return;
    isHandlingScrollEvent = true;
    
    try {
      // Get the direction of scroll (positive = down/backward, negative = up/forward)
      const delta = Math.sign(event.deltaY);
      
      if (isVolumeViewport) {
        // Handle scrolling on volume viewport
        const camera = volumeViewport.getCamera();
        const volume = currentVolumeData.volume;
        const imageData = volume.imageData;
        const dimensions = imageData.getDimensions();
        const totalVolumeSlices = dimensions[2];
        const spacing = imageData.getSpacing();
        const ipp = imageData.getDirection();
        const viewPlaneNormal: Types.Point3 = [ipp[2], ipp[5], ipp[8]];
        const origin = imageData.getOrigin();
        
        // Calculate current slice position first
        const vectorFromOrigin = [
          camera.focalPoint[0] - origin[0],
          camera.focalPoint[1] - origin[1],
          camera.focalPoint[2] - origin[2],
        ];
        
        // Project this vector onto the viewPlaneNormal to get distance along normal
        const distanceAlongNormal = 
          vectorFromOrigin[0] * viewPlaneNormal[0] +
          vectorFromOrigin[1] * viewPlaneNormal[1] +
          vectorFromOrigin[2] * viewPlaneNormal[2];
        
        // Calculate current slice index
        const currentVolumeSliceIndex = Math.round(distanceAlongNormal / spacing[2]);
        
        // Calculate target slice index with boundary check
        const targetSliceIndex = currentVolumeSliceIndex + delta;
        
        // Check if we're at a boundary and prevent scrolling beyond it
        if (targetSliceIndex < 0 || targetSliceIndex >= totalVolumeSlices) {
          isHandlingScrollEvent = false;
          return; // Don't scroll beyond boundaries
        }
        
        // Move one slice in the direction of scrolling
        const positionDelta = delta * spacing[2];
        
        // Calculate new camera position
        const newFocalPoint: Types.Point3 = [
          camera.focalPoint[0] + positionDelta * viewPlaneNormal[0],
          camera.focalPoint[1] + positionDelta * viewPlaneNormal[1],
          camera.focalPoint[2] + positionDelta * viewPlaneNormal[2],
        ];
        
        const newPosition: Types.Point3 = [
          camera.position[0] + positionDelta * viewPlaneNormal[0],
          camera.position[1] + positionDelta * viewPlaneNormal[1],
          camera.position[2] + positionDelta * viewPlaneNormal[2],
        ];
        
        // Set new camera position
        volumeViewport.setCamera({
          focalPoint: newFocalPoint,
          position: newPosition,
          viewUp: camera.viewUp,
          parallelScale: camera.parallelScale
        });
        
        volumeViewport.render();
        
        // Then sync to stack viewport
        requestAnimationFrame(syncVolumeToStack);
      } else {
        // Handle scrolling on stack viewport
        const imageIds = resultViewport.getImageIds();
        if (!imageIds || imageIds.length === 0) {
          isHandlingScrollEvent = false;
          return;
        }
        
        // Get current index and calculate new index
        const currentIndex = resultViewport.getCurrentImageIdIndex();
        const newIndex = currentIndex + delta;
        
        // Check if we're at a boundary and prevent scrolling beyond it
        if (newIndex < 0 || newIndex >= imageIds.length) {
          isHandlingScrollEvent = false;
          return; // Don't scroll beyond boundaries
        }
        
        // Clamp to valid range (additional safety)
        const clampedIndex = Math.max(0, Math.min(imageIds.length - 1, newIndex));
        
        // Only update if the index changed
        if (clampedIndex !== currentIndex) {
          resultViewport.setImageIdIndex(clampedIndex);
          resultViewport.render();
          
          // Sync to volume viewport
          requestAnimationFrame(syncStackToVolume);
        }
      }
    } catch (error) {
      console.error('Error handling wheel event:', error);
    } finally {
      isHandlingScrollEvent = false;
    }
  };
  
  // Remove default cornerstone wheel bindings to avoid conflicts
  const volumeToolGroup = ToolGroupManager.getToolGroup('VOLUME_TOOL_GROUP');
  const stackToolGroup = ToolGroupManager.getToolGroup('STACK_TOOL_GROUP');
  
  if (volumeToolGroup) {
    volumeToolGroup.setToolDisabled(StackScrollTool.toolName);
  }
  if (stackToolGroup) {
    stackToolGroup.setToolDisabled(StackScrollTool.toolName);
  }
  
  // Add our custom wheel event handlers
  volumeViewport.element.addEventListener('wheel', (e) => handleWheel(e, true), { passive: false });
  resultViewport.element.addEventListener('wheel', (e) => handleWheel(e, false), { passive: false });
  
  // Also listen for CAMERA_MODIFIED for other tools that might change the camera
  volumeViewport.element.addEventListener(Enums.Events.CAMERA_MODIFIED, () => {
    // Only sync if the event wasn't caused by our wheel handler
    if (!isHandlingScrollEvent) {
      requestAnimationFrame(syncVolumeToStack);
    }
  });
  
  // Listen for STACK_NEW_IMAGE for other ways that might change the stack
  resultViewport.element.addEventListener(Enums.Events.STACK_NEW_IMAGE, () => {
    // Only sync if the event wasn't caused by our wheel handler
    if (!isHandlingScrollEvent) {
      requestAnimationFrame(syncStackToVolume);
    }
  });
  
  // Initial synchronization if data is available
  if (currentVolumeData) {
    syncVolumeToStack();
  }
}
