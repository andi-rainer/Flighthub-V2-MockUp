import { Link } from 'react-router-dom'
import { AREA_NAME, areaOn, type Area } from '../../modules'
import { useApp } from '../../state'
import { Button, Card } from '../../ui'

/** Shows the page only while its operation is switched on; otherwise it says so (a link from a mail or a bookmark can still lead here). */
export default function ModuleGate({ area, children }: { area: Area; children: React.ReactNode }) {
  const { modules, can } = useApp()
  if (areaOn(modules, area)) return <>{children}</>
  return (
    <Card className="mx-auto mt-10 max-w-md space-y-3 p-8 text-center">
      <div className="font-semibold">{AREA_NAME[area]} ist für diesen Verein ausgeschaltet</div>
      <div className="flex justify-center gap-2">
        <Link to="/dashboard"><Button>Zur Übersicht</Button></Link>
        {can('settings.edit.system') && <Link to="/verein?tab=module"><Button variant="primary">Zu den Modulen</Button></Link>}
      </div>
    </Card>
  )
}
