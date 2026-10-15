import { useEffect, useRef, useState } from 'react'

// Tells you when an element has scrolled into view (once).
//   const [ref, inView] = useInView()
//   <div ref={ref} className={inView ? 'opacity-100' : 'opacity-0'}>
export function useInView({ threshold = 0.15, rootMargin = '0px 0px -40px 0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Very old browser without IntersectionObserver: just show everything.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect() // animate only the first time
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return [ref, inView]
}