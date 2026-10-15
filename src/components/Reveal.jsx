import { useInView } from '../hooks/useInView'

// Wrap anything to make it fade and slide up when scrolled into view.
//   <Reveal delay={150}>...</Reveal>
export default function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const [ref, inView] = useInView()

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
      className={`transition-all duration-700 ease-out ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      } ${className}`}
    >
      {children}
    </Tag>
  )
}
