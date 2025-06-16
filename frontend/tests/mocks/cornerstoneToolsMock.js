// Mock for @cornerstonejs/tools
module.exports = {
  init: jest.fn().mockResolvedValue(undefined),
  addTool: jest.fn(),
  PanTool: { toolName: 'Pan' },
  WindowLevelTool: { toolName: 'WindowLevel' },
  ZoomTool: { toolName: 'Zoom' },
  StackScrollTool: { toolName: 'StackScroll' },
  ToolGroupManager: {
    createToolGroup: jest.fn().mockReturnValue({
      addTool: jest.fn(),
      setToolActive: jest.fn(),
      setToolDisabled: jest.fn(),
      setToolEnabled: jest.fn(),
      setToolConfiguration: jest.fn(),
      addViewport: jest.fn(),
    }),
    getToolGroup: jest.fn(),
    getToolGroupForViewport: jest.fn(),
    getAllToolGroups: jest.fn().mockReturnValue([{
      addTool: jest.fn(),
      setToolActive: jest.fn(),
      setToolDisabled: jest.fn(),
      setToolEnabled: jest.fn(),
      setToolConfiguration: jest.fn(),
      addViewport: jest.fn(),
    }]),
    destroyToolGroup: jest.fn(),
  },
  Enums: {
    MouseBindings: {
      Primary: 1,
      Secondary: 2,
      Auxiliary: 3,
      Wheel: 4,
    },
  },
};