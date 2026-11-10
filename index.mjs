import { createManagementPlugin, createZenMuxPlugin } from './src/plugin.mjs';

export const ZenMuxManagementPlugin = async () => createManagementPlugin();

export const ZenMuxBuilderPlugin = async (_input, options) =>
  createZenMuxPlugin('builder', options);
export const ZenMuxPaygPlugin = async (_input, options) => createZenMuxPlugin('payg', options);
