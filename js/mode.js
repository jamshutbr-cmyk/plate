// Explicit local showcase; never grants authentication or contacts the live backend.
export const DEMO = globalThis.PLATE_DEMO === true || new URLSearchParams(globalThis.location?.search || '').get('demo') === '1';
