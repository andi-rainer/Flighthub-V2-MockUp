import type { ReactNode } from 'react'
import { fillText, lab, txt, type Application, type FormField, type FormVersion, type Lang } from './data'
import { ui } from './i18n'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import LetterHead, { LetterFoot } from './LetterHead'

/** The content of a version split into pages at every page break. */
const pagesOf = (fields: FormField[]) => fields.reduce<FormField[][]>((pages, f) => (f.type === 'Seitenumbruch' ? [...pages, []] : [...pages.slice(0, -1), [...pages[pages.length - 1], f]]), [[]])

/**
 * The paper form. ONE layout for everything: the blank form to print and fill by hand, the preview in the form
 * editor and the signed PDF that is stored with the member. It is generated from the content of the form version
 * (fields and texts in order), so nobody designs a PDF by hand.
 */
export default function PdfSheet({ title, version, answers, signedAt, channel, note, no, verified, prefilled, lang = 'de', lead }: {
  title: string; version: FormVersion
  /** Without answers the sheet is blank (lines to write on). */
  answers?: Application['answers']
  signedAt?: string; channel?: Application['channel']; note?: string; no?: string; verified?: string
  /** Known data is printed already, the rest is blank. Not signed yet. */
  prefilled?: boolean
  /** Language of the printed form. `title` is expected in the same language. */
  lang?: Lang
  /** Shown left of the download button. */
  lead?: ReactNode
}) {
  const t = ui(lang)
  const blank = !answers
  const pages = pagesOf(version.fields)
  const d = version.design
  const item = (f: FormField) => {
    if (f.type === 'Überschrift') return <h3 key={f.id} className="pt-2 text-[12px] font-semibold">{lab(f, lang)}</h3>
    if (f.type === 'Absatz') return <p key={f.id} className={f.highlight ? 'whitespace-pre-line rounded-sm border-l-4 bg-slate-50 p-2 text-[10.5px] text-slate-900' : 'whitespace-pre-line text-[10.5px] text-slate-700'} style={f.highlight ? { borderColor: d.accent } : undefined}>{fillText(txt(f, lang), d)}</p>
    const v = answers?.[f.label]
    if (f.type === 'Zustimmung') return <div key={f.id} className="flex items-start gap-2 text-[10.5px]"><span className="mt-0.5 inline-block h-3 w-3 shrink-0 border border-slate-500 text-center text-[9px] leading-3">{v === 'Ja' ? '✕' : ''}</span><span>{lab(f, lang)}{f.required ? ' *' : ''}</span></div>
    return (
      <div key={f.id} className="flex items-end gap-2">
        <span className="w-40 shrink-0 text-slate-600">{lab(f, lang)}{f.required ? ' *' : ''}</span>
        <span className="min-h-[18px] flex-1 border-b border-slate-400 px-1 font-medium">{v ?? ''}</span>
      </div>
    )
  }
  return (
    <PrintFrame name={title} lead={lead}>
    <div className="space-y-4">
      {pages.map((page, i) => {
        const last = i === pages.length - 1
        return (
          <div key={i} {...PRINT_PAGE} className="mx-auto flex w-full max-w-[560px] flex-col rounded-sm border border-line bg-white p-8 text-[12px] leading-relaxed text-slate-900 shadow-md" style={{ aspectRatio: '1 / 1.414' }}>
            {i === 0 ? (
              <>
                <LetterHead design={d} />
                <div className="mt-1 text-right text-[10px] text-slate-500">{blank ? t.blank : prefilled ? t.prefilledForm : no ?? t.application} · {t.version} {version.v}</div>
                <h2 className="mt-3 text-base font-semibold">{title}</h2>
              </>
            ) : <div className="flex justify-between border-b border-slate-200 pb-1 text-[10px] text-slate-500"><span>{title}</span><span>{t.page(i + 1, pages.length)}</span></div>}
            <div className="mt-3 flex-1 space-y-2">{page.map(item)}</div>
            {last && (
              <>
                <div className="mt-6 grid grid-cols-2 gap-6 text-[10px] text-slate-500">
                  <div><div className="min-h-[28px] border-b border-slate-400 text-[12px] text-slate-900">{signedAt?.split(' ')[0] ?? ''}</div>{t.placeDate}</div>
                  <div>
                    <div className="relative min-h-[28px] border-b border-slate-400">
                      {answers && channel !== 'Vorstand' && signedAt && <svg viewBox="0 0 120 28" className="absolute bottom-0 h-7 w-28 text-slate-800"><path d="M2 20 C 12 4, 20 4, 22 18 S 34 24, 40 10 S 52 2, 56 16 S 70 24, 78 12 S 92 6, 100 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
                      {channel === 'Vorstand' && <span className="text-[11px] text-slate-700">{t.noSignature}</span>}
                    </div>
                    {t.signature}
                  </div>
                </div>
                {note && <p className="mt-3 text-[10px] text-slate-600">{note}</p>}
              </>
            )}
            <div className="mt-4 space-y-1 border-t border-slate-200 pt-2 text-[9px] text-slate-400">
              <LetterFoot design={d} />
              {last && <div>{blank || prefilled ? t.printHint : `${t.created} ${signedAt ?? ''}${channel ? ` · ${t.channel}: ${channel}` : ''}${verified ? ` · ${t.verified}: ${verified}` : ''} · ${t.formVersion} ${version.v}`}</div>}
            </div>
          </div>
        )
      })}
    </div>
    </PrintFrame>
  )
}
