import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '../../ui'
import { ClubMark } from '../members/LetterHead'

export const exampleLogo = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#0f766e"/><path d="M18 58 C18 28 102 28 102 58 Z" fill="#fff"/><path d="M18 58 L58 96 M60 58 L60 96 M102 58 L62 96" stroke="#fff" stroke-width="3" fill="none"/><circle cx="60" cy="100" r="6" fill="#fff"/></svg>')}`

/** Shows the logo (or the initials) and lets the user upload, take the example or remove it. Used for the club logo and a form's own logo. */
export default function LogoPicker({ name, logo, accent, onChange, disabled }: { name: string; logo: string | null; accent?: string; onChange: (logo: string | null) => void; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => onChange(String(r.result)); r.readAsDataURL(f) }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid h-20 w-48 place-items-center rounded-xl border border-dashed border-line bg-slate-50"><ClubMark b={{ name, logo, accent }} size={56} /></div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled} onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> Logo hochladen</Button>
        <Button disabled={disabled} onClick={() => onChange(exampleLogo)}>Beispiel-Logo</Button>
        {logo && <Button disabled={disabled} onClick={() => onChange(null)}><Trash2 size={14} /> Entfernen</Button>}
      </div>
    </div>
  )
}
