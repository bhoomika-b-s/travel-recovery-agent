import Icon from './Icon'

// Shared look for every text box in the app.
export const inputBase =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100'

// A label + hint wrapper around any input.
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

// A text box with a small icon on the left and an optional button on the right.
//   <IconInput icon="mail" type="email" value={...} onChange={...} right={<button>...</button>} />
export function IconInput({ icon, right, className = '', ...props }) {
  return (
    <div className="relative">
      <Icon
        name={icon}
        className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400"
      />
      <input {...props} className={`${inputBase} pl-10 ${right ? 'pr-14' : ''} ${className}`} />
      {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}