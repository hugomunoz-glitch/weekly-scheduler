// iOS Safari zooms in when a focused input has font-size under 16px, and
// sometimes doesn't zoom back out on its own once that input is removed
// (e.g. a popup closing). This forces it to recompute by briefly toggling
// the viewport's maximum-scale, then restoring the original meta content.
export function resetViewportZoom() {
  if (typeof document === 'undefined') return
  const viewport = document.querySelector('meta[name="viewport"]')
  if (!viewport) return
  const original = viewport.getAttribute('content')
  if (!original) return
  viewport.setAttribute('content', original + ', maximum-scale=1.0')
  setTimeout(() => {
    viewport.setAttribute('content', original)
  }, 60)
}
