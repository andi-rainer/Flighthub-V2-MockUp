/**
 * The two operations a club can run. Everything that belongs to only one of them (menu items, pages, operation kinds, dashboard cards)
 * follows these switches; aircraft, members, finance, forms and the logbook belong to both. At least one stays on, otherwise the app has no purpose.
 * Switching off hides, it never deletes: all data stays and comes back when the module is switched on again.
 */
export type Area = 'skydive' | 'charter'
export type ModulesConfig = Record<Area, boolean>
export const DEFAULT_MODULES: ModulesConfig = { skydive: true, charter: true }

export const AREA_NAME: Record<Area, string> = { skydive: 'Skydive', charter: 'Charterbetrieb' }
/** What disappears when the area is switched off, shown in the confirmation. */
export const AREA_HIDES: Record<Area, string[]> = {
  skydive: ['Manifest und Tandem-Check-in', 'Tickets und Voucher', 'Shop und Mails', 'Betriebsart Sprungbetrieb', 'Springergewicht in den Flugzeug-Details', 'Sprungtage in den Reservierungen', 'Sportspringer-Check-in und Sprungflüge auf der Übersicht'],
  charter: ['Reservierungen', 'Flug beginnen (frei fliegende Flüge)', 'Betriebsarten Charter, Schulung und Privat', 'Reservierungen auf der Übersicht'],
}

/** True when the thing is not tied to an area or its area is on. */
export const areaOn = (m: ModulesConfig, area?: Area) => !area || m[area]
/** The last area that is on cannot be switched off. */
export const lastOn = (m: ModulesConfig, area: Area) => m[area] && Object.values(m).filter(Boolean).length === 1
