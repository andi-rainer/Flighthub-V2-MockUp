import { FileDown } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../state'
import { Button, Card, Segmented } from '../../ui'
import { nameOf, SAMPLE, textOf, type FormTemplate, type FormVersion, type Lang } from '../members/data'
import { ui } from '../members/i18n'
import { InvoiceSheet } from '../members/FeeDoc'
import FormFields from '../members/FormFields'
import { ClubMark } from '../members/LetterHead'
import PdfSheet from '../members/PdfSheet'

type Mode = 'pdf' | 'online'
/** Sample value of a field in the preview: what the system fills in for known fields, empty for the rest. */
const sampleValues = (v: FormVersion) => Object.fromEntries(v.fields.filter((f) => f.source).map((f) => [f.label, SAMPLE[f.source!.split(': ')[1]] ?? '–']))

/** What the finished form looks like: as PDF (paper) and as online form (what the person sees on the phone). Always the version being edited. */
export default function FormPreview({ form, version, lang = 'de' }: { form: FormTemplate; version: FormVersion; lang?: Lang }) {
  const t = ui(lang)
  const title = nameOf(form, lang)
  const { fees } = useApp()
  const [mode, setMode] = useState<Mode>('pdf')
  const document = form.kind === 'Dokument'
  const values = sampleValues(version)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {document ? <h3 className="text-sm font-semibold">Vorschau</h3> : <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: 'pdf', label: 'PDF' }, { value: 'online', label: 'Online-Formular' }]} />}
        {!document && mode === 'pdf' && <Button><FileDown size={14} /> Blanko-PDF</Button>}
      </div>
      {document ? <InvoiceSheet fee={fees[0]} kind="Rechnung" no="RE-2026-0150" design={version.design} legal={textOf(version, lang)} lang={lang} />
        : mode === 'pdf' ? <PdfSheet title={title} version={version} lang={lang} />
        : (
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-3"><ClubMark b={version.design} size={32} /><div className="font-semibold">{version.design.name}</div></div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <FormFields version={version} values={values} onChange={() => {}} currentType="Ordentlich" lang={lang} />
            <div className="grid h-20 place-items-center rounded-xl border-2 border-dashed border-line text-xs text-muted">{t.signature}</div>
            <Button variant="primary" size="lg" className="w-full" disabled>{t.send}</Button>
          </Card>
        )}
    </div>
  )
}
