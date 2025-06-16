// Mock for @cornerstonejs/core
module.exports = {
  init: jest.fn().mockResolvedValue(undefined),
  imageLoader: {
    registerImageLoader: jest.fn(),
    loadAndCacheImage: jest.fn().mockResolvedValue({
      rows: 256,
      columns: 256,
    }),
  },
  metaData: {
    addProvider: jest.fn(),
    get: jest.fn(),
  },
  RenderingEngine: jest.fn().mockImplementation(() => ({
    setViewports: jest.fn(),
    getViewport: jest.fn().mockReturnValue({
      setStack: jest.fn().mockResolvedValue(undefined),
      render: jest.fn(),
      resetCamera: jest.fn(),
      resetProperties: jest.fn(),
      getCamera: jest.fn().mockReturnValue({
        position: [0, 0, 0],
        focalPoint: [0, 0, 0],
        viewUp: [0, 0, 1],
        parallelScale: 1,
      }),
      setCamera: jest.fn(),
      getImageIds: jest.fn().mockReturnValue(['image1', 'image2']),
      getCurrentImageIdIndex: jest.fn().mockReturnValue(0),
      setImageIdIndex: jest.fn(),
      getProperties: jest.fn().mockReturnValue({
        voiRange: { lower: 0, upper: 255 },
      }),
      setProperties: jest.fn(),
      setOptions: jest.fn(),
    }),
    enableElement: jest.fn(),
  })),
  volumeLoader: {
    createAndCacheVolume: jest.fn().mockResolvedValue({
      load: jest.fn().mockResolvedValue(undefined),
      imageData: {
        getDimensions: jest.fn().mockReturnValue([64, 64, 10]),
        getOrigin: jest.fn().mockReturnValue([0, 0, 0]),
        getSpacing: jest.fn().mockReturnValue([1, 1, 1]),
        getDirection: jest.fn().mockReturnValue([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      },
    }),
  },
  setVolumesForViewports: jest.fn().mockResolvedValue(undefined),
  getRenderingEngine: jest.fn().mockReturnValue({
    getViewport: jest.fn().mockReturnValue({
      setStack: jest.fn().mockResolvedValue(undefined),
      render: jest.fn(),
      resetCamera: jest.fn(),
      resetProperties: jest.fn(),
    }),
  }),
  Enums: {
    ViewportType: {
      STACK: 'STACK',
      ORTHOGRAPHIC: 'ORTHOGRAPHIC',
    },
    Events: {
      CAMERA_MODIFIED: 'CAMERA_MODIFIED',
      STACK_NEW_IMAGE: 'STACK_NEW_IMAGE',
    },
    OrientationAxis: {
      AXIAL: 'AXIAL',
    },
  },
  Types: {},
};