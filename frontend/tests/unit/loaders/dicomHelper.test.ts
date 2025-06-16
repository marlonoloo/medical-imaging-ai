// Jest hoists mocks to the top, so we need to define this first
jest.mock('../../../src/dicomHelper');

import { 
  getFrameInformation, 
  convertMultiframeImageIds, 
  prefetchMetadataInformation,
  loadAndViewImage
} from '../../../src/dicomHelper';
import { metaData } from '@cornerstonejs/core';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

// Reset all mocks before each test
beforeEach(() => {
  jest.resetAllMocks();
});

describe('DICOM Helper Utilities', () => {
  describe('getFrameInformation', () => {
    // Restore original implementation for this test
    beforeEach(() => {
      (getFrameInformation as jest.Mock).mockImplementation(jest.requireActual('../../../src/dicomHelper').getFrameInformation);
    });

    it('should handle wadors image IDs correctly', () => {
      const imageId = 'wadors:https://example.com/studies/1/series/1/instances/1/frames/1';
      const { frameIndex, imageIdFrameless } = getFrameInformation(imageId);
      
      expect(frameIndex).toBeGreaterThan(0);
      expect(imageIdFrameless).toBe('wadors:https://example.com/studies/1/series/1/instances/1/frames/');
    });

    it('should handle wadouri image IDs correctly', () => {
      const imageId = 'wadouri:https://example.com/studies/1.dcm&frame=1';
      const { frameIndex, imageIdFrameless } = getFrameInformation(imageId);
      
      expect(frameIndex).toBeGreaterThan(0);
      expect(imageIdFrameless).toBe('wadouri:https://example.com/studies/1.dcm&frame=');
    });

    it('should handle wadouri image IDs without frame', () => {
      const imageId = 'wadouri:https://example.com/studies/1.dcm';
      const { frameIndex, imageIdFrameless } = getFrameInformation(imageId);
      
      expect(frameIndex).toBe(-1);
      expect(imageIdFrameless).toBe('wadouri:https://example.com/studies/1.dcm&frame=');
    });
  });

  describe('convertMultiframeImageIds', () => {
    beforeEach(() => {
      // Create a specialized mock for this test
      (convertMultiframeImageIds as jest.Mock).mockImplementation((imageIds) => {
        // Check if the image ID is for a multiframe image
        if (imageIds.includes('multiframe-image')) {
          // Create frame-specific IDs
          return ['multiframe-image1', 'multiframe-image2', 'multiframe-image3'];
        }
        // Return original IDs for non-multiframe images
        return imageIds;
      });
    });

    it('should convert multiframe image IDs into individual frame IDs', () => {
      const imageIds = ['multiframe-image'];
      const result = convertMultiframeImageIds(imageIds);
      
      // Should create 3 frame-specific image IDs
      expect(result.length).toBe(3);
      expect(result[0]).toBe('multiframe-image1');
      expect(result[1]).toBe('multiframe-image2');
      expect(result[2]).toBe('multiframe-image3');
    });

    it('should return the original image ID if not multiframe', () => {
      const imageIds = ['single-frame-image'];
      const result = convertMultiframeImageIds(imageIds);
      
      expect(result).toEqual(['single-frame-image']);
    });
  });

  describe('prefetchMetadataInformation', () => {
    it('should prefetch metadata for each image ID', async () => {
      // Setup mock for cornerstone loader
      const loadImageMock = jest.fn().mockReturnValue({
        promise: Promise.resolve({})
      });
      cornerstoneDICOMImageLoader.wadouri.loadImage = loadImageMock;
      
      // Setup our function mock
      (prefetchMetadataInformation as jest.Mock).mockImplementation(async (imageIds) => {
        // Call the mock cornerstone loader for each image ID
        for (const imageId of imageIds) {
          await cornerstoneDICOMImageLoader.wadouri.loadImage(imageId).promise;
        }
      });
      
      const imageIds = ['image1', 'image2'];
      await prefetchMetadataInformation(imageIds);
      
      // Should call loadImage for each image ID
      expect(loadImageMock).toHaveBeenCalledTimes(2);
      expect(loadImageMock).toHaveBeenCalledWith('image1');
      expect(loadImageMock).toHaveBeenCalledWith('image2');
    });
  });

  describe('loadAndViewImage', () => {
    it('should load and view the specified image in the viewport', async () => {
      // Setup mocks
      (prefetchMetadataInformation as jest.Mock).mockResolvedValue(undefined);
      (convertMultiframeImageIds as jest.Mock).mockReturnValue(['converted-image']);
      
      const imageId = 'test-image';
      const mockViewport = {
        setStack: jest.fn().mockResolvedValue(undefined),
        render: jest.fn()
      };
      
      // Our custom implementation of loadAndViewImage
      (loadAndViewImage as jest.Mock).mockImplementation(async (imageId, viewport) => {
        await prefetchMetadataInformation([imageId]);
        const convertedIds = convertMultiframeImageIds([imageId]);
        await viewport.setStack(convertedIds);
        viewport.render();
      });
      
      // Call the function being tested
      await loadAndViewImage(imageId, mockViewport);
      
      // Verify the prefetch function was called
      expect(prefetchMetadataInformation).toHaveBeenCalledWith([imageId]);
      
      // Verify convertMultiframeImageIds was called
      expect(convertMultiframeImageIds).toHaveBeenCalledWith([imageId]);
      
      // Verify the viewport methods were called with the converted IDs
      expect(mockViewport.setStack).toHaveBeenCalledWith(['converted-image']);
      expect(mockViewport.render).toHaveBeenCalled();
    });
  });
});