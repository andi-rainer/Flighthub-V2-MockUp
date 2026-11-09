import { useState } from 'react'
import { PageHeader } from '../ui'
import clsx from 'clsx'
import Journey from './store/Journey'
import Mails, { type MailState } from './store/Mails'
import Products from './store/Products'
import Settings from './store/Settings'
import Texts from './store/Texts'

type Tab = 'weg' | 'texte' | 'mails' | 'produkte' | 'einstellungen'
const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: 'weg', label: 'Kundenweg', hint: 'Überblick' },
  { id: 'texte', label: 'Texte im Shop', hint: 'Was steht wo' },
  { id: 'mails', label: 'Mails', hint: 'Wann kommt was' },
  { id: 'produkte', label: 'Produkte und Vorlagen', hint: 'Preise, PDFs' },
  { id: 'einstellungen', label: 'Einstellungen', hint: 'Zahlung, Pflichtangaben' },
]

export default function Shop() {
  const [tab, setTab] = useState<Tab>('weg')
  const [page, setPage] = useState('home')
  const [mailId, setMailId] = useState('ticket')
  const [mailState, setMailState] = useState<MailState>({ master: true, on: {} })

  return (
    <>
      <PageHeader title="Shop und Mails" />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={clsx('shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{t.label}</button>
        ))}
      </div>

      {tab === 'weg' && (
        <Journey state={mailState} nav={{
          text: (p) => { setPage(p); setTab('texte') },
          mail: (id) => { setMailId(id); setTab('mails') },
          tab: (t) => setTab(t),
        }} />
      )}
      {tab === 'texte' && <Texts key={page} pageId={page} onPage={setPage} />}
      {tab === 'mails' && <Mails mailId={mailId} onMail={setMailId} state={mailState} setState={setMailState} />}
      {tab === 'produkte' && <Products onText={(p) => { setPage(p); setTab('texte') }} />}
      {tab === 'einstellungen' && <Settings />}
    </>
  )
}
