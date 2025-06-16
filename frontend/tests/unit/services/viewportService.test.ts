import { ViewportService } from '../../../src/services/viewportService';
import { loadAndViewImage } from '../../../src/dicomHelper';
import { loadAndViewWebImage } from '../../../src/loaders/webLoader';
import { Types } from '@cornerstonejs/core';

// Mock the dependent modules
jest.mock('../../../src/dicomHelper', () => ({
  loadAndViewImage: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../src/loaders/webLoader', () => ({
  loadAndViewWebImage: jest.fn().mockResolvedValue(undefined)
}));

describe('ViewportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loadDicomImage should call the loadAndViewImage helper', async () => {
    // Create a mock viewport
    const mockViewport = {} as Types.IStackViewport;
    
    // Call the method
    await ViewportService.loadDicomImage('dicom://test-image', mockViewport);
    
    // Verify the helper was called with the correct parameters
    expect(loadAndViewImage).toHaveBeenCalledWith('dicom://test-image', mockViewport);
  });

  test('loadWebImage should call the loadAndViewWebImage helper', async () => {
    // Create a mock viewport
    const mockViewport = {} as Types.IStackViewport;
    
    // Call the method
    await ViewportService.loadWebImage('web://test-image', mockViewport);
    
    // Verify the helper was called with the correct parameters
    expect(loadAndViewWebImage).toHaveBeenCalledWith('web://test-image', mockViewport);
  });
});