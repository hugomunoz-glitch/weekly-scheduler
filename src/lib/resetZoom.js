// iOS WKWebView zooms in when a focused input has font-size < 16px and
// doesn't always zoom back out automatically. Setting initial-scale=1.0
// together with minimum/maximum-scale=1.0 forces the zoom level back to
// exactly 1.0, then restores the original meta so the user can still
// pinch-zoom the rest of the app if permitted.
export function resetViewportZoom() {
  if (typeof document === 'undefined') return
  const viewport = document.querySelector('meta[name="viewport"]')
  if (!viewport) return
  const original = viewport.getAttribute('content')
  if (!original) return
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0'
  )
  setTimeout(() => {
    viewport.setAttribute('content', original)
  }, 100)
}
