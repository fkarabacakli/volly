/**
 * Turkish is the dashboard's default UI language. The behavioural specs for
 * the starter-kit pages (identity, settings, system, files, billing, auth
 * flow) assert the original English copy, so they opt into English via this
 * storage state — which doubles as a check that the English catalog matches
 * that copy. Turkish rendering is covered by tests/i18n/*.spec.ts.
 *
 * Usage (top level of a spec file): test.use({ storageState: ENGLISH_UI });
 */
export const ENGLISH_UI = {
  cookies: [],
  origins: [
    {
      origin: "http://localhost:5174",
      localStorage: [{ name: "fsh.dashboard.lang", value: "en" }],
    },
  ],
};
