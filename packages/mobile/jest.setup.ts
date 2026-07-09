(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
