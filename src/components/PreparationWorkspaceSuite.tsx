import type { ComponentProps } from 'react'
import PreparationWorkspace from './PreparationWorkspace'

type Props = ComponentProps<typeof PreparationWorkspace>

export default function PreparationWorkspaceSuite(props: Props) {
  return <div className="preparation-suite" data-preparation-suite="unified-v4">
    <PreparationWorkspace {...props} />
  </div>
}
