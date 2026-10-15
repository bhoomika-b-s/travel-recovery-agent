import { useEffect, useRef, useState } from 'react'
import { useInView } from '../hooks/useInView'

// A number that counts up when it scrolls into view.
// If the number changes later (a live update), it animates from the old value
// to the new one instead of restarting from 0.
//   <CountUp end={88} suffix="%" />
export default function CountUp({ end, duration = 1400, prefix = '', suffix = '', className = '' }) {
  const [ref, inView] = useInView({ threshold: 0.4 })
  const [value, setValue] = useState(0)
  const fromRef = useRef(0) // the value currently on screen

  useEffect(() => {
    if (!inView) return

    const from = fromRef.current
    const start = performance.now()
    let frame

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out
      const current = Math.round(from + (end - from) * eased)
      fromRef.current = current
      setValue(current)
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