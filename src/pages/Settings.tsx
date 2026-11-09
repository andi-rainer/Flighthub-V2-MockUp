import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../state'
import { PageHeader } from '../ui'
import ClubPanel from './settings/ClubPanel'
import DevicesPanel from './settings/DevicesPanel'
import ProfilePanel from './settings/ProfilePanel'
import SecurityPanel from './settings/SecurityPanel'

const personal = [{ id: 'profil', label: 'Mein Profil' }, { id: 'sicherheit', label: 'Passwort und Sicherheit' }, { id: 'geraete', label: 'Meine Geräte' }, { id: 'verein', label: 'Vereinsdaten' }] as const

/** Everything a member does about herself, for everybody. Reached from the user menu top right. */
export default function Settings() {
  const [params, setParams] = useSearchParams()
  const { can } = useApp()
  const tabs = personal.filter((t) => t.id !== 'verein' || can('settings.edit.system'))
  const tab = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'profil'
  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => <button key={t.id} onClick={() => setParams({ tab: t.id })} className={clsx('shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{t.label}</button>)}
      </div>
      {tab === 'profil' && <ProfilePanel />}
      {tab === 'sicherheit' && <SecurityPanel />}
      {tab === 'geraete' && <DevicesPanel />}
      {tab === 'verein' && <ClubPanel />}
    </>
  )
}
