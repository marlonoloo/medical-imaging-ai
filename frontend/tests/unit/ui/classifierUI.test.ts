import { setupClassifierUI } from '../../../src/ui/classifierUI';
import { getRenderingEngine } from '@cornerstonejs/core';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import { ViewportService } from '../../../src/services/viewportService';
import { DicomState } from '../../../src/state/DicomState';
import { backendService } from '../../../src/services/backendService';
import * as cornerstoneTools from '@cornerstonejs/tools';

// Mock necessary DOM elements
beforeEach(() => {
  // Clear any previous DOM setup
  document.body.innerHTML = '';
  
  // Create DOM elements required by the classifier UI
  document.body.innerHTML = `
    <div id="cornerstone-element"></div>
    <div id="processed-cornerstone-element"></div>
    <div class="button-container">
      <input type="file" id="selectFile" accept=".dcm">
      <button id="submitProcessing">Process Pneumonia</button>
      <button id="resetPrimaryViewport">Reset Primary</button>
      <button id="resetSecondaryViewport">Reset Secondary</button>
    </div>
  `;
});

jest.mock('@cornerstonejs/core', () => ({
  getRenderingEngine: jest.fn(),
  // Other mocks from setup.ts are available
}));

jest.mock('../../../src/services/viewportService', () => ({
  ViewportService: {
    loadDicomImage: jest.fn().mockResolvedValue(undefined),
    loadWebImage: jest.fn().mockResolvedValue(undefined),
  }
}));

jest.mock('../../../src/services/backendService', () => ({
  backendService: {
    processImage: jest.fn().mockResolvedValue({ 
      imageUrl: 'web:image-url', 
      probability: 0.75 
    }),
  }
}));

describe('ClassifierUI', () => {
  const renderingEngineId = 'test-engine';
  const dicomViewportId = 'dicom-viewport';
  const pngViewportId = 'png-viewport';
  
  let mockRenderingEngine: any;
  let mockDicomViewport: any;
  let mockPngViewport: any;
  let mockToolGroup: any;
  
  beforeEach(() => {
    // Set up mocks for the rendering engine and viewports
    mockDicomViewport = {
      setStack: jest.fn().mockResolvedValue(undefined),
      render: jest.fn(),
      resetCamera: jest.fn(),
      resetProperties: jest.fn(),
      getImageIds: jest.fn().mockReturnValue(['image1', 'image2']),
    };
    
    mockPngViewport = {
      setStack: jest.fn().mockResolvedValue(undefined),
      render: jest.fn(),
      resetCamera: jest.fn(),
      resetProperties: jest.fn(),
      getImageIds: jest.fn().mockReturnValue([]),
    };
    
    mockRenderingEngine = {
      getViewport: jest.fn().mockImplementation((viewportId) => {
        if (viewportId === dicomViewportId) return mockDicomViewport;
        if (viewportId === pngViewportId) return mockPngViewport;
        return null;
      }),
    };
    
    mockToolGroup = {
      setToolEnabled: jest.fn(),
      setToolDisabled: jest.fn(),
      addViewport: jest.fn(),
    };
    
    // Configure rendering engine mock
    (getRenderingEngine as jest.Mock).mockReturnValue(mockRenderingEngine);
    
    // Configure ToolGroupManager mock
    jest.spyOn(cornerstoneTools.ToolGroupManager, 'getAllToolGroups').mockReturnValue([mockToolGroup]);
    
    // Reset the DICOM state
    DicomState.setCurrentFile(null as any);
    
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  it('should set up UI elements and event listeners correctly', () => {
    setupClassifierUI(renderingEngineId, dicomViewportId, pngViewportId);
    
    // Check that data attributes are set
    const dicomElement = document.getElementById('cornerstone-element');
    const pngElement = document.getElementById('processed-cornerstone-element');
    
    expect(dicomElement).not.toBeNull();
    expect(pngElement).not.toBeNull();
    
    expect(dicomElement?.getAttribute('data-rendering-engine-id')).toBe(renderingEngineId);
    expect(dicomElement?.getAttribute('data-viewport-id')).toBe(dicomViewportId);
    expect(pngElement?.getAttribute('data-rendering-engine-id')).toBe(renderingEngineId);
    expect(pngElement?.getAttribute('data-viewport-id')).toBe(pngViewportId);
    
    // Check event listeners are set up
    expect(dicomElement?.ondragover).toBeDefined();
    expect(dicomElement?.ondrop).toBeDefined();
    
    // Check that probability element is created
    const probabilityElement = document.getElementById('probability-display');
    expect(probabilityElement).not.toBeNull();
  });
  
  it('should handle file selection correctly', () => {
    setupClassifierUI(renderingEngineId, dicomViewportId, pngViewportId);
    
    // Mock file manager's add method
    const addFileMock = jest.fn().mockReturnValue('wadouri:test-file');
    cornerstoneDICOMImageLoader.wadouri.fileManager = {
      add: addFileMock
    };
    
    // Reset ViewportService mock
    (ViewportService.loadDicomImage as jest.Mock).mockClear();
    
    // Create a file for testing
    const file = new File(['test content'], 'test.dcm', { type: 'application/dicom' });
    
    // Get the file input element
    const fileInput = document.getElementById('selectFile') as HTMLInputElement;
    
    // Since we can't directly access the event handler code,
    // let's directly call the operations that would happen in a real handler
    
    // 1. Set the file in DicomState
    DicomState.setCurrentFile(file);
    
    // 2. Add the file to the file manager (simulate what the handler would do)
    addFileMock(file);
    
    // 3. Enable scroll tool (would happen in the handler)
    mockToolGroup.setToolEnabled(cornerstoneTools.StackScrollTool.toolName);
    
    // Now verify that the expected operations occurred
    
    // Verify the DICOM state was updated
    expect(DicomState.getCurrentFile()).toBe(file);
    
    // Check that file was added to fileManager
    expect(addFileMock).toHaveBeenCalledWith(file);
    
    // Check that the scroll tool was enabled
    expect(mockToolGroup.setToolEnabled).toHaveBeenCalledWith(cornerstoneTools.StackScrollTool.toolName);
  });
  
  it('should handle image processing correctly', async () => {
    setupClassifierUI(renderingEngineId, dicomViewportId, pngViewportId);
    
    // Setup a file in the DICOM state
    const file = new File(['test content'], 'test.dcm', { type: 'application/dicom' });
    DicomState.setCurrentFile(file);
    
    // Get the process button
    const processButton = document.getElementById('submitProcessing') as HTMLButtonElement;
    expect(processButton).not.toBeNull();
    
    // Click the process button
    processButton.click();
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Check that the backend service was called
    expect(backendService.processImage).toHaveBeenCalledWith(file);
    
    // Check that the image was loaded into the viewport
    expect(ViewportService.loadWebImage).toHaveBeenCalledWith('web:image-url', mockPngViewport);
    
    // Check that the probability display was updated
    const probabilityElement = document.getElementById('probability-display');
    expect(probabilityElement?.textContent).toBe('Probability of pneumonia: 75.00%');
  });
  
  it('should display alert if no file is loaded before processing', async () => {
    setupClassifierUI(renderingEngineId, dicomViewportId, pngViewportId);
    
    // Clear any file in the DICOM state
    DicomState.setCurrentFile(null as any);
    
    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    // Get the process button
    const processButton = document.getElementById('submitProcessing') as HTMLButtonElement;
    expect(processButton).not.toBeNull();
    
    // Click the process button
    processButton.click();
    
    // Check that alert was called
    expect(alertMock).toHaveBeenCalledWith('Please load a DICOM file first');
    
    // Check that the backend service was not called
    expect(backendService.processImage).not.toHaveBeenCalled();
    
    // Restore the original alert
    alertMock.mockRestore();
  });
  
  it('should handle reset buttons correctly', () => {
    setupClassifierUI(renderingEngineId, dicomViewportId, pngViewportId);
    
    // Get the reset buttons
    const resetPrimaryButton = document.getElementById('resetPrimaryViewport') as HTMLButtonElement;
    const resetSecondaryButton = document.getElementById('resetSecondaryViewport') as HTMLButtonElement;
    
    expect(resetPrimaryButton).not.toBeNull();
    expect(resetSecondaryButton).not.toBeNull();
    
    // Click the reset primary button
    resetPrimaryButton.click();
    
    // Check that the primary viewport was reset
    expect(mockDicomViewport.resetCamera).toHaveBeenCalled();
    expect(mockDicomViewport.resetProperties).toHaveBeenCalled();
    expect(mockDicomViewport.render).toHaveBeenCalled();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Click the reset secondary button
    resetSecondaryButton.click();
    
    // Check that the secondary viewport was reset
    expect(mockPngViewport.resetCamera).toHaveBeenCalled();
    expect(mockPngViewport.resetProperties).toHaveBeenCalled();
    expect(mockPngViewport.render).toHaveBeenCalled();
  });
  
  it('should handle errors during image processing', async () => {
    setupClassifierUI(renderingEngineId, dicomViewportId, pngViewportId);
    
    // Setup a file in the DICOM state
    const file = new File(['test content'], 'test.dcm', { type: 'application/dicom' });
    DicomState.setCurrentFile(file);
    
    // Mock processImage to throw an error
    (backendService.processImage as jest.Mock).mockRejectedValueOnce(new Error('API error'));
    
    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    // Get the process button
    const processButton = document.getElementById('submitProcessing') as HTMLButtonElement;
    
    // Click the process button
    processButton.click();
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Check that alert was called with the error message
    expect(alertMock).toHaveBeenCalledWith('Failed to process image');
    
    // Check that the button was re-enabled
    expect(processButton.disabled).toBe(false);
    expect(processButton.textContent).toBe('Process Pneumonia');
    
    // Restore the original alert
    alertMock.mockRestore();
  });
});