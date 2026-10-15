import { useEffect, useState } from 'react'
import { useInView } from '../hooks/useInView'

// A number that counts up from 0 when it scrolls into view.
//   <CountUp end={88} suffix="%" />
export default function CountUp({ end, duration = 1400, prefix = '', suffix = '', className = '' }) {
  const [ref, inView] = useInView({ threshold: 0.4 })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setValue(end)
      return
    }

    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out
      setValue(Math.round(end * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, end, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString('en-IN')}
      {suffix}
    </span>
  )
}