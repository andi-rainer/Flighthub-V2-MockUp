import { cloneDesign, outdatedParts, syncDesign, type ClubData, type FormTemplate, type FormVersion } from '../members/data'

export const TODAY = '07.11.2026'

/** The version of a form that is current: the draft if there is one, otherwise the active version. */
export const currentVersion = (t: FormTemplate): FormVersion => t.versions.find((v) => v.status === 'entwurf') ?? t.versions.find((v) => v.status === 'aktiv') ?? t.versions[0]

export interface Outdated { form: FormTemplate; version: FormVersion; parts: string[]; draft: boolean }
/** Forms whose current version still shows older club data than the club data now. */
export const outdatedForms = (forms: FormTemplate[], club: ClubData): Outdated[] =>
  forms.map((form) => { const version = currentVersion(form); return { form, version, parts: outdatedParts(version.design, club), draft: version.status === 'entwurf' } }).filter((o) => o.parts.length > 0)

/**
 * Brings the forms up to date with the club data. A form with a draft gets its draft updated. For the others a new version is made
 * (frozen copy with the new data) and, if `publish`, activated at once while the old version is archived.
 */
export function updateForms(forms: FormTemplate[], club: ClubData, publish: boolean): FormTemplate[] {
  const todo = new Set(outdatedForms(forms, club).map((o) => o.form.id))
  return forms.map((t) => {
    if (!todo.has(t.id)) return t
    const draft = t.versions.find((v) => v.status === 'entwurf')
    if (draft) return { ...t, versions: t.versions.map((v) => (v === draft ? { ...v, design: syncDesign(v.design, club) } : v)) }
    const active = t.versions.find((v) => v.status === 'aktiv')!
    const next = Math.max(...t.versions.map((v) => v.v)) + 1
    const made: FormVersion = { v: next, status: publish ? 'aktiv' : 'entwurf', since: publish ? TODAY : undefined, fields: active.fields.map((x) => ({ ...x })), design: syncDesign(cloneDesign(active.design), club) }
    return { ...t, versions: [made, ...t.versions.map((v) => (publish && v === active ? { ...v, status: 'archiviert' as const } : v))] }
  })
}
