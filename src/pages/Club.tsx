import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../ui'
import ClubPanel from './settings/ClubPanel'
import Kinds from './club/Kinds'
import Modules from './club/Modules'

const tabs = [{ id: 'daten', label: 'Vereinsdaten' }, { id: 'betriebsarten', label: 'Betriebsarten' }, { id: 'module', label: 'Module' }] as const

/** Everything that concerns the whole club, not one person: the club data and the modules that can be switched on or off. */
export default function Club() {
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'daten'
  return (
    <>
      <PageHeader title="Vereinseinstellungen" />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => <button key={t.id} onClick={() => setParams({ tab: t.id }, { replace: true })} className={clsx('shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{t.label}</button>)}
      </div>
      {tab === 'daten' ? <ClubPanel /> : tab === 'betriebsarten' ? <Kinds /> : <Modules />}
    </>
  )
}
