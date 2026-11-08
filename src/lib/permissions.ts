/**
 * Permission catalog for Fraud Defense Hub (Single Source of Truth).
 * All permissions defined here correspond to UI capabilities and server-side
 * Firestore Security Rules.
 */

export type PermissionKey =
  | "analysis.view"
  | "analysis.save"
  | "analysis.delete"
  | "analysis.export"
  | "publishers.view"
  | "publishers.manage"
  | "profiles.view"
  | "profiles.manage"
  | "members.manage"
  | "roles.manage";

export interface PermissionDefinition {
  key: PermissionKey;
  group: "Analyses" | "Publishers" | "Campaign profiles" | "Administration";
  label: string;
  description: string;
  adminOnly?: boolean;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: "analysis.view",
    group: "Analyses",
    label: "View Analyses",
    description: "Browse saved analyses, your apps, and view reports.",
  },
  {
    key: "analysis.save",
    group: "Analyses",
    label: "Save Analyses",
    description: "Save new analysis runs to Firestore.",
  },
  {
    key: "analysis.delete",
    group: "Analyses",
    label: "Delete Analyses",
    description: "Delete saved analysis runs and chunks.",
  },
  {
    // Note: analysis.export is client-side only (XLSX is built in the browser),
    // so this is documented and enforced at the UI-level.
    key: "analysis.export",
    group: "Analyses",
    label: "Export XLSX",
    description: "Download detailed analysis data as Excel workbooks (UI-level).",
  },
  {
    key: "publishers.view",
    group: "Publishers",
    label: "View Publishers",
    description: "View publisher to PID mappings and groupings.",
  },
  {
    key: "publishers.manage",
    group: "Publishers",
    label: "Manage Publishers",
    description: "Create, update, and remove publisher to PID mappings.",
  },
  {
    key: "profiles.view",
    group: "Campaign profiles",
    label: "View Campaign Profiles",
    description: "View campaign profile configurations.",
  },
  {
    key: "profiles.manage",
    group: "Campaign profiles",
    label: "Manage Campaign Profiles",
    description: "Create, edit, and delete campaign profiles.",
  },
  {
    key: "members.manage",
    group: "Administration",
    label: "Manage Members",
    description: "Invite users, change member roles, and approve access requests.",
    adminOnly: true,
  },
  {
    key: "roles.manage",
    group: "Administration",
    label: "Manage Roles",
    description: "Create, update, and delete roles and role permissions.",
    adminOnly: true,
  },
];

export interface RoleDefinition {
  name: string;
  description: string;
  system: boolean;
  permissions: Record<PermissionKey, boolean>;
}

export const DEFAULT_ROLES: {
  analyst: RoleDefinition;
} = {
  analyst: {
    name: "Analyst",
    description:
      "Standard analyst access to run, view, and save analyses and view publishers and profiles.",
    system: true,
    permissions: {
      "analysis.view": true,
      "analysis.save": true,
      "analysis.delete": false,
      "analysis.export": true, // UI-level check for XLSX generation in browser
      "publishers.view": true,
      "publishers.manage": false,
      "profiles.view": true,
      "profiles.manage": false,
      "members.manage": false,
      "roles.manage": false,
    },
  },
};
