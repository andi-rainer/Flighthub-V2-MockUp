import { useRef } from 'react'
import { type Lang } from './data'
import { ui } from './i18n'

/** Plain canvas signature pad (mouse, touch, pen). Used on the public form, at the club and on the tablet. */
export default function SignaturePad({ onInk, onImage, lang = 'de' }: { onInk: (b: boolean) => void; /** The finished drawing as an image (empty after clearing), e.g. for a PDF. */ onImage?: (dataUrl: string) => void; lang?: Lang }) {
  const t = ui(lang)
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height } }
  const start = (e: React.PointerEvent) => { drawing.current = true; const c = ref.current!.getContext('2d')!; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); ref.current!.setPointerCapture(e.pointerId) }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const c = ref.current!.getContext('2d')!; const p = pos(e); c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#0f172a'; c.lineTo(p.x, p.y); c.stroke(); onInk(true) }
  const clear = () => { const cv = ref.current!; cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height); onInk(false); onImage?.('') }
  const stop = () => { if (drawing.current) { drawing.current = false; onImage?.(ref.current!.toDataURL('image/png')) } }
  return (
    <div>
      <canvas ref={ref} width={600} height={180} onPointerDown={start} onPointerMove={move} onPointerUp={stop} className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white" />
      <div className="mt-1 flex justify-between text-xs text-muted"><span>{t.signHint}</span><button className="text-brand" onClick={clear}>{t.clear}</button></div>
    </div>
  )
}
