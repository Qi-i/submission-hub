import type { ReactNode as ImportedReactNode } from 'react'

declare global {
  namespace React {
    type ReactNode = ImportedReactNode
  }
}

export {}
