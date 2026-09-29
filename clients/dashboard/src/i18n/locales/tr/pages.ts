// Namespaces for the starter-kit pages kept in Volly (auth flow, identity,
// settings, system, files, billing). The industrial + shell namespaces live
// inline in ../tr.ts.
import { misc } from "./misc";
import { ui } from "./ui";
import { account } from "./account";
import { security } from "./security";
import { appearance } from "./appearance";
import { branding } from "./branding";
import { users } from "./users";
import { roles } from "./roles";
import { groups } from "./groups";
import { health } from "./health";
import { sessions } from "./sessions";
import { activityLog } from "./activityLog";
import { audits } from "./audits";
import { trash } from "./trash";
import { files } from "./files";
import { billing } from "./billing";
import { authFlow } from "./authFlow";

export const trPages = {
  billing,
  files,
  trash,
  audits,
  activityLog,
  sessions,
  health,
  groups,
  roles,
  users,
  branding,
  appearance,
  security,
  account,
  ui,
  misc,
  authFlow,
};
