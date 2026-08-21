import fs from 'node:fs'

function replaceExact(file, before, after) {
  const source = fs.readFileSync(file, 'utf8')
  if (!source.includes(before)) throw new Error(`Missing expected block in ${file}: ${before.slice(0, 120)}`)
  fs.writeFileSync(file, source.replace(before, after))
}

const file = 'src/components/figure-composer/FigureComposer.tsx'

replaceExact(file,
`  createEmptyFigureProject,\n  figureDisplayName,\n  type AlignMode,`,
`  createEmptyFigureProject,\n  type AlignMode,`)

replaceExact(file,
`  const firstDraftId = initialDraftId || drafts[0]?.id || null\n  const [project, dispatch] = useReducer(reducer, createEmptyFigureProject(firstDraftId))`,
`  const [project, dispatch] = useReducer(reducer, createEmptyFigureProject(initialDraftId))`)

replaceExact(file,
`  const newProject = () => {\n    clearRuntimeAssets()\n    const draftId = project.draftId || firstDraftId\n    const sameDraft = projects.filter(item => item.draftId === draftId && item.role === project.role)\n    replace(createEmptyFigureProject(draftId, Math.max(0, ...sameDraft.map(item => item.sequence)) + 1, project.role))\n    setGuides([])\n    setStatus('已建立新的本地组图工程。')\n  }`,
`  const newProject = () => {\n    clearRuntimeAssets()\n    const nextSequence = Math.max(0, ...projects.map(item => item.sequence)) + 1\n    replace(createEmptyFigureProject(null, nextSequence, project.role))\n    setGuides([])\n    setStatus('已建立新的未命名组图；需要时可主动关联草稿或设置出版编号。')\n  }`)

replaceExact(file,
`      const next = createEmptyFigureProject(oldDraftId || firstDraftId)`,
`      const next = createEmptyFigureProject(null)`)

replaceExact(file,
`  const patchProjectIdentity = (patch: Partial<Pick<FigureProject, 'draftId' | 'role' | 'sequence' | 'name' | 'title' | 'caption'>>) => {\n    let next = { ...project, ...patch }\n    if ((patch.role || patch.sequence) && (/^Figure \\d+$/i.test(project.name) || /^Supplementary Figure S\\d+$/i.test(project.name))) {\n      next = { ...next, name: figureDisplayName(next.role, next.sequence) }\n    }\n    replace(next)\n  }`,
`  const patchProjectIdentity = (patch: Partial<Pick<FigureProject, 'draftId' | 'role' | 'sequence' | 'name' | 'publicationLabel' | 'title' | 'caption'>>) => {\n    replace({ ...project, ...patch })\n  }`)

const headerBefore = `        <div><small>FIGURE COMPOSER</small><h2>{project.name}</h2><p>{project.draftId ? drafts.find(draft => draft.id === project.draftId)?.title || '已关联草稿' : '未关联 Manuscript Draft'}</p></div>`
const headerAfter = "        <div className=\"figure-composer__identity\"><small><span>投稿准备</span><i>/</i><span>科研组图</span></small><h2>{project.name}</h2><p>{project.publicationLabel ? `出版编号：${project.publicationLabel}` : '通用科研组图工作台 · 默认不关联任何论文'}</p></div>"
replaceExact(file, headerBefore, headerAfter)

console.log('Applied Figure Composer neutral identity refactor.')
