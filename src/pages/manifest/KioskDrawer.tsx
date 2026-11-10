import { Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrPicture } from '../../session/QrChallenge'
import { Button, Drawer } from '../../ui'

export const checkinLink = (dayId: string) => `${window.location.origin}${window.location.pathname}#/checkin/${dayId}`

/** Opens the tandem check-in on another device: the tablet at the entrance scans the code or opens the link. */
export default function KioskDrawer({ open, dayId, onClose }: { open: boolean; dayId: string; onClose: () => void }) {
  const nav = useNavigate()
  const [copied, setCopied] = useState(false)
  const link = checkinLink(dayId)
  return (
    <Drawer open={open} title="Tandem-Check-in auf einem anderen Gerät" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 text-center">
        <QrPicture seed={Number(dayId.replace(/\D/g, '').slice(-4))} />
        <div className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">{link}</div>
        <div className="flex gap-2">
          <Button onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true) }}><Copy size={16} /> {copied ? 'Kopiert' : 'Link kopieren'}</Button>
          <Button variant="primary" onClick={() => nav(`/checkin/${dayId}`)}><ExternalLink size={16} /> Hier öffnen</Button>
        </div>
      </div>
    </Drawer>
  )
}
