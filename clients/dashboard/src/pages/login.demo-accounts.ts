// Mirrors src/Host/FSH.Starter.DbMigrator/DemoSeed/DemoSeeder.cs (keep in sync).
// Static — no API call — because the login page is unauthenticated and the
// API can't safely advertise demo credentials anyway. The shape is hand-
// curated; if you add a demo account on the backend, add it here too.

export type DemoTier = "tenant-admin" | "manager" | "support" | "basic";

/** Persona keys — translated under `authFlow.demo.persona.*`. */
export type DemoPersona = "tenantAdmin" | "manager" | "support" | "member";

export type DemoAccount = {
  email: string;
  password: string;
  tenant: string;
  tenantLabel: string;
  firstName: string;
  lastName: string;
  /** Pre-baked role for the chip in the row. */
  tier: DemoTier;
  /** One-line persona explainer shown under the name (i18n key). */
  persona: DemoPersona;
};

// Seed:DemoPassword in the DbMigrator's seed-demo run (see AppHost.cs).
export const DEMO_PASSWORD = "Password123!";

const account =
  (tenant: string, tenantLabel: string) =>
  (email: string, firstName: string, lastName: string, tier: DemoTier, persona: DemoPersona): DemoAccount => ({
    email,
    password: DEMO_PASSWORD,
    tenant,
    tenantLabel,
    firstName,
    lastName,
    tier,
    persona,
  });

const acme = account("acme", "Acme Corp");
const globex = account("globex", "Globex");

/**
 * Group accounts by tenant for the panel renderer. Acme leads — it's the
 * populated demo where most flows make sense.
 *
 * Root is deliberately absent: every root account is a SuperAdmin, and the
 * API rejects SuperAdmin sign-ins from the dashboard ("App boundary" 403 —
 * they must use the admin app), so listing them here only produced a
 * failing button.
 */
export const DEMO_ACCOUNT_GROUPS: Array<{
  tenant: string;
  tenantLabel: string;
  blurb: "populated" | "sparse";
  accounts: DemoAccount[];
}> = [
  {
    tenant: "acme",
    tenantLabel: "Acme Corp",
    blurb: "populated",
    accounts: [
      acme("admin@acme.com", "Acme", "Admin", "tenant-admin", "tenantAdmin"),
      acme("manager@acme.com", "Maya", "Lin", "manager", "manager"),
      acme("support@acme.com", "Sam", "Rivera", "support", "support"),
      acme("alice@acme.com", "Alice", "Nguyen", "basic", "member"),
      acme("bob@acme.com", "Bob", "Patel", "basic", "member"),
    ],
  },
  {
    tenant: "globex",
    tenantLabel: "Globex",
    blurb: "sparse",
    accounts: [
      globex("admin@globex.com", "Globex", "Admin", "tenant-admin", "tenantAdmin"),
      globex("dave@globex.com", "Dave", "Hartwell", "basic", "member"),
    ],
  },
];

/** Tier → i18n key under `authFlow.demo.tier.*`. */
export const TIER_KEY: Record<DemoTier, "tenantAdmin" | "manager" | "support" | "basic"> = {
  "tenant-admin": "tenantAdmin",
  manager: "manager",
  support: "support",
  basic: "basic",
};
