const params = new URLSearchParams(window.location.search)

if (params.get('view') === 'editor') {
  const root = document.documentElement

  const openEditor = (attempt = 0) => {
    if (root.dataset.visualReady !== 'true') {
      if (attempt < 100) window.setTimeout(() => openEditor(attempt + 1), 50)
      return
    }

    const card = document.querySelector<HTMLElement>('.paper-card-v3')
    if (!card) {
      if (attempt < 100) window.setTimeout(() => openEditor(attempt + 1), 50)
      return
    }

    card.click()

    const verifyScroll = (modalAttempt = 0) => {
      const body = document.querySelector<HTMLElement>('.compact-form-body')
      const footer = document.querySelector<HTMLElement>('.compact-form-footer')
      if (!body || !footer) {
        if (modalAttempt < 100) window.setTimeout(() => verifyScroll(modalAttempt + 1), 50)
        return
      }

      root.dataset.modalRendered = 'true'
      const canScroll = body.scrollHeight > body.clientHeight + 4
      if (!canScroll) {
        root.dataset.modalScrollDiagnostics = `${body.scrollHeight}:${body.clientHeight}:${body.scrollTop}`
        if (modalAttempt < 100) window.setTimeout(() => verifyScroll(modalAttempt + 1), 50)
        return
      }

      body.scrollTop = body.scrollHeight
      window.requestAnimationFrame(() => {
        root.dataset.modalScrollDiagnostics = `${body.scrollHeight}:${body.clientHeight}:${body.scrollTop}`
        if (body.scrollTop > 0) {
          root.dataset.modalScrollReady = 'true'
        } else if (modalAttempt < 100) {
          window.setTimeout(() => verifyScroll(modalAttempt + 1), 50)
        }
      })
    }

    window.setTimeout(() => verifyScroll(), 120)
  }

  window.setTimeout(() => openEditor(), 0)
}
