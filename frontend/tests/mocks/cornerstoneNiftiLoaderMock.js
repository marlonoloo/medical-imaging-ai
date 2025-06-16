// Mock for @cornerstonejs/nifti-volume-loader
module.exports = {
  createNiftiImageIdsAndCacheMetadata: jest.fn().mockResolvedValue(['nifti://mock-volume']),
  cornerstoneNiftiImageLoader: {},
};