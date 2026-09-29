import "i18next";
import type { Messages } from "./locales/tr";

// Typed keys: `t("overview:title")` / `t("title", { ns: "overview" })`
// autocomplete and fail tsc when a key is missing from the Turkish catalog.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: Messages;
    returnNull: false;
  }
}
