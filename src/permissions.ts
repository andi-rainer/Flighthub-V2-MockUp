// Permission logic adopted from FlightHub V1 (lib/permissions/catalog.ts): functions are the only grant.
// The catalog below is a copy of V1, plus a few permissions that only exist in V2 (marked in NEW_IN_V2).
// Labels are taken from V1 messages/de.json.

export type PermissionCategory =
  | 'flightlog' | 'manifest' | 'members' | 'functions' | 'permissions' | 'billing'
  | 'vouchers' | 'reservations' | 'aircraft' | 'documents' | 'settings' | 'store' | 'email' | 'afp'

export const F = {
  PILOT: 'pilot', FLIGHT_INSTRUCTOR: 'flight_instructor', CHIEF_PILOT: 'chief_pilot',
  SKYDIVE_PILOT: 'skydive_pilot', TANDEM_MASTER: 'tandem_master', SKYDIVE_INSTRUCTOR: 'skydive_instructor', SPORT_JUMPER: 'sport_jumper',
  MANIFEST_COORDINATOR: 'manifest_coordinator', TREASURER: 'treasurer', CHAIRMAN: 'chairman', SECRETARY: 'secretary',
} as const

export const FUNCTION_GROUPS = ['Fliegen', 'Skydive', 'Betrieb', 'Verwaltung'] as const
export type FunctionGroup = (typeof FUNCTION_GROUPS)[number]
export interface FunctionDef { code: string; name: string; group: FunctionGroup }
/** Only the PRE-FILLED list. Every function can be renamed or deleted and new ones can be added; the live list is in the app state (`functions`). */
export const FUNCTIONS: FunctionDef[] = [
  { code: F.PILOT, name: 'Pilot', group: 'Fliegen' }, { code: F.FLIGHT_INSTRUCTOR, name: 'Fluglehrer', group: 'Fliegen' }, { code: F.CHIEF_PILOT, name: 'Chefpilot', group: 'Fliegen' },
  { code: F.SKYDIVE_PILOT, name: 'Skydive-Pilot', group: 'Skydive' }, { code: F.TANDEM_MASTER, name: 'Tandem-Master', group: 'Skydive' },
  { code: F.SKYDIVE_INSTRUCTOR, name: 'Skydive-Instruktor', group: 'Skydive' }, { code: F.SPORT_JUMPER, name: 'Sportspringer', group: 'Skydive' },
  { code: F.MANIFEST_COORDINATOR, name: 'Manifest-Koordinator', group: 'Betrieb' },
  { code: F.TREASURER, name: 'Kassier', group: 'Verwaltung' }, { code: F.CHAIRMAN, name: 'Obmann', group: 'Verwaltung' }, { code: F.SECRETARY, name: 'Schriftführer', group: 'Verwaltung' },
]

export interface PermissionDefinition {
  code: string
  category: PermissionCategory
  sensitive: boolean
  /** Held by every user without any grant. */
  grantedToAll: boolean
  /** Initial assignment only. The live grants are editable (Mitglieder > Funktionen und Rechte). */
  defaultFunctions: readonly string[]
}

/** Chairman, Secretary and Treasurer are seeded with every permission. */
export const ADMIN_FUNCTIONS = [F.CHAIRMAN, F.SECRETARY, F.TREASURER] as const

function def<C extends string>(code: C, category: PermissionCategory, options: { sensitive?: boolean; extra?: readonly string[] } = {}) {
  return { code, category, sensitive: options.sensitive ?? false, grantedToAll: false as boolean, defaultFunctions: [...new Set<string>([...ADMIN_FUNCTIONS, ...(options.extra ?? [])])] } as const
}
function everyone<C extends string>(code: C, category: PermissionCategory) {
  return { code, category, sensitive: false, grantedToAll: true as boolean, defaultFunctions: [] as string[] } as const
}

export const PERMISSION_CATALOG = [
  everyone('flight.log.view', 'flightlog'),
  def('flight.log.create', 'flightlog', { extra: [F.PILOT, F.FLIGHT_INSTRUCTOR] }),
  def('flight.log.edit.own', 'flightlog', { extra: [F.PILOT, F.FLIGHT_INSTRUCTOR] }),
  def('flight.log.edit.any', 'flightlog', { sensitive: true }),
  def('flight.log.delete', 'flightlog', { sensitive: true }),
  def('flight.log.review', 'flightlog', { sensitive: true }),
  def('flight.log.approve', 'flightlog', { sensitive: true, extra: [F.CHIEF_PILOT] }),
  def('flight.log.lock', 'flightlog', { sensitive: true, extra: [F.CHIEF_PILOT] }),
  def('flight.log.import', 'flightlog', { sensitive: true, extra: [F.CHIEF_PILOT] }),
  everyone('manifest.view', 'manifest'),
  def('manifest.operation_days.view', 'manifest', { extra: [F.SPORT_JUMPER, F.MANIFEST_COORDINATOR] }),
  def('manifest.operation_days.create', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.operation_days.edit', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.operation_days.delete', 'manifest'),
  def('manifest.flights.create', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.flights.edit', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.flights.delete', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.jumpers.assign', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.jumpers.remove', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.payments.update', 'manifest', { sensitive: true, extra: [F.MANIFEST_COORDINATOR, F.TREASURER] }),
  def('manifest.reports.view', 'manifest', { extra: [F.TREASURER] }),
  def('manifest.settings.edit', 'manifest', { sensitive: true, extra: [F.MANIFEST_COORDINATOR] }),
  def('manifest.bookings.manage', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('audit.view', 'manifest', { extra: [F.MANIFEST_COORDINATOR, F.TREASURER] }),
  def('members.view.all', 'members'),
  everyone('members.view.basic', 'members'),
  def('members.edit', 'members', { sensitive: true }),
  def('members.create', 'members', { sensitive: true }),
  def('members.delete', 'members', { sensitive: true }),
  def('members.memberships.manage', 'members', { sensitive: true }),
  def('functions.view', 'functions'),
  def('functions.create', 'functions', { sensitive: true }),
  def('functions.edit', 'functions', { sensitive: true }),
  def('functions.delete.custom', 'functions', { sensitive: true }),
  def('permissions.manage', 'permissions', { sensitive: true }),
  everyone('billing.view.own', 'billing'),
  def('billing.view.all', 'billing', { extra: [F.TREASURER] }),
  def('billing.manage', 'billing', { sensitive: true, extra: [F.TREASURER] }),
  def('billing.transactions.create', 'billing', { sensitive: true, extra: [F.TREASURER] }),
  def('billing.transactions.reverse', 'billing', { sensitive: true, extra: [F.TREASURER] }),
  def('billing.flights.charge', 'billing', { sensitive: true }),
  def('billing.accounts.view', 'billing'),
  def('billing.accounts.manage', 'billing', { sensitive: true }),
  def('billing.cost_centers.view', 'billing'),
  def('billing.cost_centers.manage', 'billing', { sensitive: true }),
  def('billing.aircraft_rates.manage', 'billing', { sensitive: true }),
  def('vouchers.view', 'vouchers', { extra: [F.MANIFEST_COORDINATOR] }),
  def('vouchers.create', 'vouchers', { sensitive: true }),
  def('vouchers.manage', 'vouchers', { sensitive: true, extra: [F.MANIFEST_COORDINATOR] }),
  def('vouchers.catalog.manage', 'vouchers', { sensitive: true }),
  def('vouchers.export', 'vouchers', { sensitive: true }),
  def('vouchers.redeem', 'vouchers', { extra: [F.TANDEM_MASTER, F.MANIFEST_COORDINATOR] }),
  def('reservations.manage.any', 'reservations'),
  def('reservations.priority.set', 'reservations', { extra: [F.CHIEF_PILOT] }),
  everyone('aircraft.view', 'aircraft'),
  def('aircraft.edit', 'aircraft', { extra: [F.CHIEF_PILOT] }),
  def('aircraft.create', 'aircraft', { extra: [F.CHIEF_PILOT] }),
  def('aircraft.delete', 'aircraft', { sensitive: true }),
  def('aircraft.documents.upload', 'aircraft', { extra: [F.CHIEF_PILOT] }),
  def('aircraft.documents.manage', 'aircraft'),
  def('aircraft.components.manage', 'aircraft'),
  def('aircraft.maintenance.manage', 'aircraft'),
  everyone('documents.view.own', 'documents'),
  everyone('documents.upload.own', 'documents'),
  def('documents.view.all', 'documents'),
  def('documents.approve', 'documents', { sensitive: true }),
  def('documents.definitions.manage', 'documents', { sensitive: true }),
  def('documents.library.manage', 'documents', { sensitive: true }),
  def('documents.delete', 'documents', { sensitive: true }),
  everyone('settings.view', 'settings'),
  everyone('settings.edit.own', 'settings'),
  def('settings.edit.system', 'settings', { sensitive: true }),
  def('settings.membership.manage', 'settings', { sensitive: true }),
  def('settings.tandem.manage', 'settings', { extra: [F.MANIFEST_COORDINATOR] }),
  def('settings.airport_fees.manage', 'settings', { sensitive: true, extra: [F.TREASURER] }),
  def('pdf_templates.manage', 'settings', { sensitive: true }),
  def('operation_types.manage', 'settings', { sensitive: true }),
  def('store.content.manage', 'store', { sensitive: true }),
  def('store.requirements.manage', 'store', { sensitive: true }),
  def('email.log.view', 'email'),
  // ---- New in V2 (not in V1) ----
  everyone('afp.view', 'afp'),
  def('afp.create', 'afp', { extra: [F.PILOT, F.SKYDIVE_PILOT, F.CHIEF_PILOT] }),
  everyone('manifest.checkin.self', 'manifest'),
  def('manifest.checkin.others', 'manifest', { extra: [F.MANIFEST_COORDINATOR] }),
  def('billing.bank.manage', 'billing', { sensitive: true }),
  def('billing.statements.approve', 'billing', { sensitive: true }),
  def('members.applications.decide', 'members', { sensitive: true }),
  def('members.fees.manage', 'members', { sensitive: true }),
] as const satisfies readonly PermissionDefinition[]

export type Permission = (typeof PERMISSION_CATALOG)[number]['code']

export const NEW_IN_V2: ReadonlySet<string> = new Set(['afp.view', 'afp.create', 'manifest.checkin.self', 'manifest.checkin.others', 'billing.bank.manage', 'billing.statements.approve', 'members.applications.decide', 'members.fees.manage'])

/** Permissions that only work together with another one (the editor enables them together). */
export const PERMISSION_REQUIREMENTS: Partial<Record<Permission, readonly Permission[]>> = {
  'members.edit': ['members.view.all'],
  'members.create': ['members.view.all'],
  'members.delete': ['members.view.all'],
  'members.memberships.manage': ['members.view.all'],
  'settings.membership.manage': ['members.view.all'],
  'functions.view': ['members.view.all'],
  'functions.create': ['functions.view'],
  'functions.edit': ['functions.view'],
  'functions.delete.custom': ['functions.view'],
  'permissions.manage': ['functions.view'],
  'billing.manage': ['billing.view.all'],
  'billing.transactions.create': ['billing.view.all'],
  'billing.transactions.reverse': ['billing.view.all'],
  'billing.flights.charge': ['billing.view.all'],
  'billing.accounts.view': ['billing.view.all'],
  'billing.accounts.manage': ['billing.accounts.view'],
  'billing.cost_centers.view': ['billing.view.all'],
  'billing.cost_centers.manage': ['billing.cost_centers.view'],
  'billing.aircraft_rates.manage': ['billing.view.all'],
  'vouchers.create': ['vouchers.view'],
  'vouchers.manage': ['vouchers.view'],
  'vouchers.catalog.manage': ['vouchers.view'],
  'vouchers.export': ['vouchers.view'],
  'billing.bank.manage': ['billing.view.all'],
  'billing.statements.approve': ['billing.view.all'],
  'members.applications.decide': ['members.view.all'],
  'members.fees.manage': ['members.view.all'],
}

export function permissionRequirements(code: Permission): Permission[] {
  const found = new Set<Permission>()
  const visit = (current: Permission) => {
    for (const required of PERMISSION_REQUIREMENTS[current] ?? []) {
      if (!found.has(required)) { found.add(required); visit(required) }
    }
  }
  visit(code)
  return [...found]
}

const KNOWN: ReadonlySet<string> = new Set(PERMISSION_CATALOG.map((p) => p.code))
export const isPermission = (code: string): code is Permission => KNOWN.has(code)

export const withRequirements = (codes: readonly string[]): string[] => {
  const all = new Set<string>(codes)
  for (const c of codes) if (isPermission(c)) permissionRequirements(c).forEach((r) => all.add(r))
  return [...all]
}
export const missingRequirements = (codes: readonly string[]) => {
  const held = new Set(codes)
  return codes.filter(isPermission).map((permission) => ({ permission, missing: permissionRequirements(permission).filter((r) => !held.has(r)) })).filter((e) => e.missing.length > 0)
}
/** The permissions in `codes` that need `code`: while any is held, `code` has to stay. */
export const permissionsNeeding = (code: Permission, codes: readonly string[]): Permission[] =>
  codes.filter(isPermission).filter((o) => o !== code && permissionRequirements(o).includes(code))

export type Grants = Record<string, string[]> // function code -> permission codes (live grants, editable)

/** Initial grants as seeded by the catalog. */
export const seedGrants = (): Grants => {
  const g: Grants = Object.fromEntries(FUNCTIONS.map((f) => [f.code, [] as string[]]))
  for (const p of PERMISSION_CATALOG) for (const fn of p.defaultFunctions) (g[fn] ??= []).push(p.code)
  return g
}

/** Function assignment with validity, like `user_functions` (valid_from / valid_until, ISO dates). */
export interface Assignment { fn: string; from?: string; until?: string }
export const isCurrent = (a: Assignment, today: string) => (!a.from || a.from <= today) && (!a.until || a.until >= today)

/** What a person holds right now: public permissions plus the grants of all currently valid functions. */
export function permissionsFor(assignments: readonly Assignment[], grants: Grants, today: string): Set<string> {
  const held = new Set<string>(PERMISSION_CATALOG.filter((p) => p.grantedToAll).map((p) => p.code))
  for (const a of assignments) if (isCurrent(a, today)) for (const c of grants[a.fn] ?? []) held.add(c)
  return held
}

export const CATEGORY_LABELS: Record<string, string> = {"flightlog": "Flugbuch", "manifest": "Manifest", "members": "Mitglieder", "functions": "Funktionen", "permissions": "Berechtigungen", "billing": "Abrechnung & Buchhaltung", "vouchers": "Gutscheine & Tickets", "reservations": "Reservierungen", "aircraft": "Flugzeuge", "documents": "Dokumente", "settings": "Einstellungen", "store": "Tandem-Shop", "email": "E-Mail", "afp": "AFP (Flugplan)"}
export const PERMISSION_LABELS: Record<string, string> = {
 "flight_log_view": "Flugbucheinträge ansehen",
 "flight_log_create": "Flugbucheinträge anlegen",
 "flight_log_edit_own": "Eigene Flugbucheinträge bearbeiten",
 "flight_log_edit_any": "Alle Flugbucheinträge bearbeiten",
 "flight_log_delete": "Flugbucheinträge löschen",
 "flight_log_review": "Flüge mit Prüfbedarf prüfen",
 "flight_log_approve": "Flugbucheinträge freigeben",
 "flight_log_lock": "Flugbucheinträge sperren",
 "flight_log_import": "Flugbucheinträge importieren",
 "manifest_view": "Manifest ansehen",
 "manifest_operation_days_view": "Flugtage ansehen und Sprünge buchen",
 "manifest_operation_days_create": "Flugtage anlegen",
 "manifest_operation_days_edit": "Flugtage bearbeiten",
 "manifest_operation_days_delete": "Flugtage löschen",
 "manifest_flights_create": "Flüge (Loads) anlegen",
 "manifest_flights_edit": "Flüge (Loads) bearbeiten",
 "manifest_flights_delete": "Flüge (Loads) löschen",
 "manifest_jumpers_assign": "Springer Flügen zuweisen",
 "manifest_jumpers_remove": "Springer aus Flügen entfernen",
 "manifest_payments_update": "Sprungzahlungen aktualisieren",
 "manifest_reports_view": "Manifest-Berichte ansehen",
 "manifest_settings_edit": "Manifest-Einstellungen bearbeiten",
 "manifest_bookings_manage": "Buchungen und Zeitfenster verwalten",
 "audit_view": "Änderungsprotokoll ansehen",
 "members_view_all": "Alle Mitglieder und deren Details ansehen",
 "members_view_basic": "Grundlegende Mitgliederdaten ansehen",
 "members_edit": "Mitglieder bearbeiten",
 "members_create": "Personen ohne Formular anlegen (Ausnahme)",
 "members_delete": "Mitglieder löschen",
 "members_memberships_manage": "Mitgliedschaften verwalten",
 "functions_view": "Funktionen und Zuweisungen ansehen",
 "functions_create": "Funktionen anlegen",
 "functions_edit": "Funktionen umbenennen und bearbeiten",
 "functions_delete_custom": "Funktionen löschen",
 "permissions_manage": "Verwalten, welche Funktion welche Berechtigung hat",
 "billing_view_own": "Eigenes Konto ansehen",
 "billing_view_all": "Alle Konten und unverrechnete Flüge ansehen",
 "billing_manage": "Abrechnung verwalten",
 "billing_transactions_create": "Manuelle Buchungen erstellen",
 "billing_transactions_reverse": "Buchungen stornieren",
 "billing_flights_charge": "Flüge verrechnen",
 "billing_accounts_view": "Benutzerkonten ansehen",
 "billing_accounts_manage": "Benutzerkonten verwalten",
 "billing_cost_centers_view": "Kostenstellen ansehen",
 "billing_cost_centers_manage": "Kostenstellen verwalten",
 "billing_aircraft_rates_manage": "Flugzeug-Tarife verwalten",
 "vouchers_view": "Gutscheine und Tickets ansehen",
 "vouchers_create": "Gutscheine manuell erstellen",
 "vouchers_manage": "Gutscheine und Tickets verwalten",
 "vouchers_catalog_manage": "Gutschein- und Tickettypen verwalten",
 "vouchers_export": "Gutscheine und Tickets exportieren",
 "vouchers_redeem": "Gutscheine einlösen",
 "reservations_manage_any": "Reservierungen anderer Mitglieder verwalten",
 "reservations_priority_set": "Prioritäts-Reservierungen anlegen",
 "aircraft_view": "Flugzeuge ansehen",
 "aircraft_edit": "Flugzeuge bearbeiten",
 "aircraft_create": "Flugzeuge hinzufügen",
 "aircraft_delete": "Flugzeuge löschen",
 "aircraft_documents_upload": "Flugzeugdokumente hochladen",
 "aircraft_documents_manage": "Flugzeugdokumente verwalten",
 "aircraft_components_manage": "Flugzeugkomponenten verwalten",
 "aircraft_maintenance_manage": "Flugzeugwartung verwalten",
 "documents_view_own": "Eigene Dokumente ansehen",
 "documents_upload_own": "Eigene Dokumente hochladen",
 "documents_view_all": "Alle Mitgliederdokumente ansehen",
 "documents_approve": "Mitgliederdokumente freigeben",
 "documents_definitions_manage": "Dokumenttypen und Berechtigungsvermerke verwalten",
 "documents_library_manage": "Vereinsdokumente verwalten",
 "documents_delete": "Dokumente löschen",
 "settings_view": "Einstellungen ansehen",
 "settings_edit_own": "Eigene Einstellungen bearbeiten",
 "settings_edit_system": "Systemeinstellungen bearbeiten",
 "settings_membership_manage": "Mitgliedschaftstypen verwalten",
 "settings_tandem_manage": "Tandem-Registrierung konfigurieren",
 "settings_airport_fees_manage": "Flughafengebühren verwalten",
 "pdf_templates_manage": "PDF-Vorlagen verwalten",
 "operation_types_manage": "Betriebsarten verwalten",
 "store_content_manage": "Shop-Inhalte verwalten",
 "store_requirements_manage": "Checkout-Anforderungen verwalten",
 "email_log_view": "E-Mail-Protokoll ansehen",
 "afp_view": "AFP ansehen",
 "afp_create": "AFP erstellen und freigeben",
 "manifest_checkin_self": "Selbst am Platz einchecken",
 "manifest_checkin_others": "Springer einchecken",
 "billing_bank_manage": "Bank, Belege und Kostenstellen buchen",
 "billing_statements_approve": "Kontoauszüge freigeben",
 "members_applications_decide": "Anträge genehmigen oder ablehnen",
 "members_fees_manage": "Mitgliedsbeiträge und Rechnungen verwalten"
}
export const labelOf = (code: string) => PERMISSION_LABELS[code.replaceAll('.', '_')] ?? code
