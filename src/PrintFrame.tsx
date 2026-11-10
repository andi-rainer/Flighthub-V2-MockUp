import { FileDown } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { SplitButton } from './ui'

/** Marks one page of a document: the print view puts every page on its own sheet, without the screen frame. */
export const PRINT_PAGE = { 'data-print-page': '' } as const

const PRINT_CSS = '@page{size:A4;margin:12mm}html,body{margin:0;background:#fff}[data-print-page]{break-after:page;box-shadow:none!important;border:0!important;margin:0 auto!important;max-width:none!important;width:100%!important;aspect-ratio:auto!important;padding:0!important;min-height:0!important}[data-print-page]:last-child{break-after:auto}'

/**
 * EVERY document shown as a PDF sits in this frame: a split button, main action "PDF herunterladen", alternative "Drucken". The dummy has no
 * server, so both open the print dialog of the device (it offers "Als PDF sichern", named like the document). The sheet is copied into a hidden frame with the styles of the page, so the print view is the sheet alone.
 * The real project makes the PDF on the server; the layout stays this one.
 */
export default function PrintFrame({ name, lead, children }: { name: string; /** Shown left of the button (e.g. a switch of the view). */ lead?: ReactNode; children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null)
  const print = () => {
    if (!sheet.current) return
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(frame)
    const doc = frame.contentDocument!
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('')
    const title = name.replace(/[<>&"]/g, '')
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styles}<style>${PRINT_CSS}</style></head><body>${sheet.current.innerHTML}</body></html>`)
    doc.close()
    const win = frame.contentWindow!
    win.addEventListener('afterprint', () => frame.remove())
    // The styles need a moment to load before the dialog opens.
    setTimeout(() => { win.focus(); win.print() }, 400)
  }
  return (
    <div>
      <div className={lead ? 'mb-2 flex items-center justify-between gap-2' : 'mx-auto mb-2 flex w-full max-w-[600px] justify-end'}>
        {lead}
        <SplitButton onClick={print} actions={[{ label: 'Drucken', onSelect: print }]}><FileDown size={14} /> PDF herunterladen</SplitButton>
      </div>
      <div ref={sheet}>{children}</div>
    </div>
  )
}
