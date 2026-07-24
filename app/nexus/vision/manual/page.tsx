import { redirect } from 'next/navigation'

/** El botón Manual lleva a la guía de uso; el explicativo queda en /manual vía nav. */
export default function NetVisionManualPage() {
  redirect('/nexus/vision/manual/usuario')
}
