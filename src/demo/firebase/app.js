import {
  getDemoApp,
  getDemoApps,
  initializeDemoApp,
} from './backend';

export const initializeApp = (config, appName) => initializeDemoApp(config, appName);

export const getApps = () => getDemoApps();

export const getApp = (appName) => getDemoApp(appName);
