import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72  // px pulled before release triggers refresh
const MAX_PULL  = 96  // px max visual stretch

export function usePullToRefresh(onRefresh, scrollRef) {
  const [pullY, setPullY]       = useState(0)  // 0–MAX_PULL, drives the indicator
  const [refreshing, setRefreshing] = useState(false)
  const startY  = useRef(null)
  const pulling = useRef(false)

  useEffect(() => {
    const el = scrollRef?.current ?? window

    function getScrollTop() {
      return scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY
    }

    function onTouchStart(e) {
      if (getScrollTop() > 0) return  // only pull from the very top
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    function onTouchMove(e) {
      if (!pulling.current || startY.current === null) return
      if (getScrollTop() > 0) { pulling.current = false; startY.current = null; setPullY(0); return }
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { setPullY(0); return }
      // Rubber-band: diminishing returns past THRESHOLD
      const clamped = Math.min(dy * 0.5, MAX_PULL)
      setPullY(clamped)
    }

    async function onTouchEnd() {
      if (!pulling.current) return
      pulling.current = false
      const triggered = pullY >= THRESHOLD * 0.5
      startY.current = null
      setPullY(0)
      if (triggered && !refreshing) {
        setRefreshing(true)
        try { await onRefresh() } finally { setRefreshing(false) }
      }
    }

    const target = scrollRef?.current ?? window
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove',  onTouchMove,  { passive: true })
    target.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove',  onTouchMove)
      target.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onRefresh, pullY, refreshing, scrollRef])

  return { pullY, refreshing, threshold: THRESHOLD * 0.5 }
}
