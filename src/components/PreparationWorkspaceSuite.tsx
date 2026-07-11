import type { ComponentProps } from 'react'
import PreparationProductivityPanel from './PreparationProductivityPanel'
import PreparationWorkspace from './PreparationWorkspace'

type Props = ComponentProps<typeof PreparationWorkspace>

export default function PreparationWorkspaceSuite(props: Props) {
  return <div className="preparation-suite" data-preparation-suite="productivity-v1">
    <PreparationProductivityPanel snapshot={props.snapshot} loading={props.loading} onSaveDraft={props.onSaveDraft} />
    <PreparationWorkspace {...props} />
  </div>
}
