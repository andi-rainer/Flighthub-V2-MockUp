import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../state'
import { Plus } from 'lucide-react'
import { Button, PageHeader, RowMenu } from '../ui'
import Applications from './members/Applications'
import { type AppKind } from './members/data'
import Fees from './members/Fees'
import Functions from './members/Functions'
import List from './members/List'
import ManualCreate from './members/ManualCreate'
import Setup from './members/Setup'

type Tab = 'liste' | 'antraege' | 'beitraege' | 'funktionen' | 'einstellungen'

export default function Members() {
  const [params, setParams] = useSearchParams()
  // The tab lives in the address, so the back button of the browser returns to the same tab.
  const tab = (params.get('tab') as Tab) ?? 'liste'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })
  const { apps, can } = useApp()
  const open = apps.filter((a) => a.status === 'Unterzeichnet').length
  // ?new=aenderung&member=m1 opens the new application for that member (from the member file)
  // It is read once and then removed from the address, so coming back to the tab never opens a new application by itself.
  const [preset, setPreset] = useState(() => {
    const kind = { neu: 'Neu', aenderung: 'Änderung', ende: 'Beendigung' }[params.get('new') ?? ''] as AppKind | undefined
    return kind ? { kind, memberId: params.get('member') ?? undefined } : null
  })
  const [manual, setManual] = useState(false)
  /** Remounts the Anträge tab so "Mitglied aufnehmen" opens a fresh admission even when the tab is already shown. */
  const [appsKey, setAppsKey] = useState(0)
  const admit = () => { setPreset({ kind: 'Neu', memberId: undefined }); setAppsKey((k) => k + 1); setTab('antraege') }
  const [openApp, setOpenApp] = useState(() => params.get('open'))
  useEffect(() => { if (params.get('new') || params.get('open')) setParams({ tab: params.get('tab') ?? 'antraege' }, { replace: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'liste', label: 'Mitglieder' },
    { id: 'antraege', label: 'Anträge', badge: open },
    { id: 'beitraege', label: 'Beiträge' },
    ...(can('functions.view') ? [{ id: 'funktionen' as Tab, label: 'Funktionen und Rechte' }] : []),
    ...(can('settings.membership.manage') ? [{ id: 'einstellungen' as Tab, label: 'Mitgliedschaft einrichten' }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Mitglieder"
        actions={<><Button>Importieren</Button><Button variant="primary" onClick={admit}><Plus size={16} /> Mitglied aufnehmen</Button>{can('members.create') && <RowMenu actions={[{ label: 'Ohne Formular anlegen (Ausnahme)', onSelect: () => setManual(true) }]} />}</>}
      />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={clsx('flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}{!!t.badge && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'liste' && <List />}
      {tab === 'antraege' && <Applications key={appsKey} preset={preset} initialOpen={openApp} onConsumed={() => { setPreset(null); setOpenApp(null) }} />}
      {tab === 'beitraege' && <Fees />}
      {tab === 'funktionen' && <Functions />}
      {tab === 'einstellungen' && <Setup />}
      <ManualCreate open={manual} onClose={() => setManual(false)} onAdmission={admit} />
    </>
  )
}
