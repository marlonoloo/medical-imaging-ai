// src/init.ts
import type { Types } from '@cornerstonejs/core';
import { RenderingEngine, Enums, init as csInit } from '@cornerstonejs/core';
import cornerstoneDICOMImageLoader, { init as csImageLoaderInit } from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { init as csToolsInit } from '@cornerstonejs/tools';
import { registerWebImageLoader, addWebImageMetadataProvider } from './webImageLoader';

const {
  PanTool,
  WindowLevelTool,
  StackScrollTool,
  ZoomTool,
  ToolGroupManager,
  Enums: csToolsEnums,
} = cornerstoneTools;
const { MouseBindings } = csToolsEnums;
const { ViewportType } = Enums;

export async function initCornerstoneServices() {
  await csInit();
  await csToolsInit();
  await csImageLoaderInit();

  // Set the WADO image loader's cornerstone instance
  const { preferSizeOverAccuracy, useNorm16Texture } = {
    preferSizeOverAccuracy: false,
    useNorm16Texture: false,
  };

  const config = {
    targetFrameRate: 24,
    useVolumeLoader: false,
    renderingEngineSettings: {
      preferSizeOverAccuracy,
      useNorm16Texture,
    },
    gpuTier: { tier: 1, type: 'WEBGL' },
    isMobile: false,
    rendering: {
      useCPURendering: false,
      preferSizeOverAccuracy: false,
      strictZSpacingForVolumeViewport: false,
    },
  };

  return csInit(config);
}

export async function run(dicomElement: HTMLElement, pngElement: HTMLElement): Promise<{ dicomViewport: Types.IStackViewport, pngViewport: Types.IStackViewport }> {
  // Initialize services
  await initCornerstoneServices();
  registerWebImageLoader();
  addWebImageMetadataProvider();

  // Register DICOM tools
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(WindowLevelTool);
  cornerstoneTools.addTool(StackScrollTool);
  cornerstoneTools.addTool(ZoomTool);

  // Create and configure a tool group
  const toolGroupId = 'myToolGroup';
  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);

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

  // Instantiate a rendering engine and create a stack viewport for DICOM images
  const renderingEngineId = 'myRenderingEngine';
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // Configure both viewports
  const viewportInputArray = [
    {
      viewportId: 'CT_STACK',
      type: ViewportType.STACK,
      element: dicomElement as HTMLDivElement,
      defaultOptions: {
        background: <Types.Point3>[0.2, 0, 0.2],
      },
    },
    {
      viewportId: 'PNG_STACK',
      type: ViewportType.STACK,
      element: pngElement as HTMLDivElement,
      defaultOptions: {
        background: <Types.Point3>[0.2, 0, 0.2],
      },
    },
  ];

  renderingEngine.setViewports(viewportInputArray);

  const dicomViewport = renderingEngine.getViewport('CT_STACK') as Types.IStackViewport;
  const pngViewport = renderingEngine.getViewport('PNG_STACK') as Types.IStackViewport;

  // Add tools to both viewports
  toolGroup.addViewport('CT_STACK', renderingEngineId);
  toolGroup.addViewport('PNG_STACK', renderingEngineId);

  return { dicomViewport, pngViewport };
}
