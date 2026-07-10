const params = new URLSearchParams(window.location.search)

if (params.get('view') === 'editor') {
  const openEditor = (attempt = 0) => {
    if (document.documentElement.dataset.visualReady !== 'true') {
      if (attempt < 80) window.setTimeout(() => openEditor(attempt + 1), 50)
      return
    }

    const card = document.querySelector<HTMLElement>('.paper-card-v3')
    if (!card) {
      if (attempt < 80) window.setTimeout(() => openEditor(attempt + 1), 50)
      return
    }

    card.click()

    const verifyScroll = (modalAttempt = 0) => {
      const body = document.querySelector<HTMLElement>('.compact-form-body')
      const footer = document.querySelector<HTMLElement>('.compact-form-footer')
      if (!body || !footer) {
        if (modalAttempt < 80) window.setTimeout(() => verifyScroll(modalAttempt + 1), 50)
        return
      }

      const canScroll = body.scrollHeight > body.clientHeight + 4
      body.scrollTop = body.scrollHeight
      window.requestAnimationFrame(() => {
        if (canScroll && body.scrollTop > 0) {
          document.documentElement.dataset.modalScrollReady = 'true'
        } else {
          document.documentElement.dataset.modalScrollError = `${body.scrollHeight}:${body.clientHeight}:${body.scrollTop}`
        }
      })
    }

    window.setTimeout(() => verifyScroll(), 80)
  }

  window.setTimeout(() => openEditor(), 0)
}
