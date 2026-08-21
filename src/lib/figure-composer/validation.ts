import { aspectRatioDeviation, isPanelOutOfBounds, panelsOverlap } from './geometry'
import { effectiveDpi, physicalToLogicalPx } from './units'
import type { FigurePreflightIssue, FigureProject } from './types'

export function validateFigureProject(project: FigureProject): FigurePreflightIssue[] {
  const issues: FigurePreflightIssue[] = []
  const targetDpi = Math.max(1, project.exportSettings.dpi)

  if (!project.title.trim() || !project.caption.trim()) {
    issues.push({
      code: 'caption',
      severity: 'warning',
      message: '缺少完整图题或图注。',
      panelIds: [],
    })
  }

  const expectedLogicalWidth = physicalToLogicalPx(project.exportSettings.physicalWidth, project.exportSettings.unit)
  if (Math.abs(project.canvas.width - expectedLogicalWidth) / Math.max(1, expectedLogicalWidth) > 0.2) {
    issues.push({
      code: 'size',
      severity: 'warning',
      message: '当前画布宽度与所选出版尺寸差异超过 20%。',
      panelIds: [],
    })
  }

  const visibleLabels = project.panels.filter(panel => panel.label.visible)
  const labelFingerprints = new Set(visibleLabels.map(panel => `${panel.label.fontFamily}|${panel.label.fontSize}|${panel.label.fontWeight}|${panel.label.color}`))
  if (labelFingerprints.size > 1) {
    issues.push({
      code: 'label',
      severity: 'warning',
      message: '子图标签的字体、字号、字重或颜色不一致。',
      panelIds: visibleLabels.map(panel => panel.id),
    })
  }

  for (const panel of project.panels) {
    const dpiX = effectiveDpi(panel.naturalWidth, panel.width)
    const dpiY = effectiveDpi(panel.naturalHeight, panel.height)
    if (Math.min(dpiX, dpiY) + 1 < targetDpi) {
      issues.push({
        code: 'resolution',
        severity: 'error',
        message: `${panel.name} 的有效分辨率约 ${Math.round(Math.min(dpiX, dpiY))} DPI，低于目标 ${targetDpi} DPI。`,
        panelIds: [panel.id],
      })
    }

    if (isPanelOutOfBounds(panel, project.canvas.width, project.canvas.height)) {
      issues.push({
        code: 'bounds',
        severity: 'error',
        message: `${panel.name} 超出画布边界。`,
        panelIds: [panel.id],
      })
    }

    if (!panel.lockAspectRatio && aspectRatioDeviation(panel) > 0.02) {
      issues.push({
        code: 'stretch',
        severity: 'warning',
        message: `${panel.name} 相对原始宽高比发生非等比拉伸。`,
        panelIds: [panel.id],
      })
    }
  }

  for (let left = 0; left < project.panels.length; left += 1) {
    for (let right = left + 1; right < project.panels.length; right += 1) {
      const a = project.panels[left]
      const b = project.panels[right]
      if (panelsOverlap(a, b)) {
        issues.push({
          code: 'overlap',
          severity: 'warning',
          message: `${a.name} 与 ${b.name} 存在重叠。`,
          panelIds: [a.id, b.id],
        })
      }
    }
  }

  if (!project.exportSettings.allowedFormats.includes(project.exportSettings.format)) {
    issues.push({
      code: 'format',
      severity: 'error',
      message: `当前目标不接受 ${project.exportSettings.format.toUpperCase()} 导出格式。`,
      panelIds: [],
    })
  }

  return issues
}

export function hasBlockingFigureIssues(project: FigureProject) {
  return validateFigureProject(project).some(issue => issue.severity === 'error')
}
