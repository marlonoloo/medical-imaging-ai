// Mock for @cornerstonejs/dicom-image-loader
module.exports = {
  init: jest.fn().mockResolvedValue(undefined),
  wadouri: {
    fileManager: {
      add: jest.fn().mockReturnValue('dicom://mock-path'),
    },
    loadImage: jest.fn().mockReturnValue({
      promise: Promise.resolve({}),
    }),
  },
};