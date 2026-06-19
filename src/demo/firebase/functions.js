import {
  callDemoFunction,
  getDemoFunctions,
} from './backend';

export const getFunctions = (app, region) => getDemoFunctions(app, region);

export const httpsCallable = (_functions, name) => async (data) => ({
  data: await callDemoFunction(name, data),
});
