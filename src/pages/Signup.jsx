import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell, { AuthCard } from '../components/AuthShell'
import { Field, IconInput, inputBase } from '../components/FormField'
import Icon from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { homePathFor } from '../lib/paths'
import { formatDateTimeIST, istInputToISO, istInputToMs, todayIST } from '../lib/time'

const STEPS = ['Account', 'Flight', 'Connection', 'Constraints', 'Review']
const STEP_TITLES = [
  'Create your account',
  'Your current flight',
  'Connecting transport',
  'Your recovery constraints',
  'Review and confirm',
]
const STEP_ICONS = ['user', 'plane', 'bus', 'wallet', 'check']

// Typing an airport code auto-fills the city (you can still edit it).
const CITY_BY_CODE = {
  DEL: 'Delhi',
  BOM: 'Mumbai',
  BLR: 'Bengaluru',
  HYD: 'Hyderabad',
  MAA: 'Chennai',
  PNQ: 'Pune',
  GOI: 'Goa',
  JAI: 'Jaipur',
}
const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Goa', 'Jaipur']
const AIRLINES = ['IndiGo', 'Air India', 'Air India Express', 'Akasa Air', 'SpiceJet']

const MODE_OPTIONS = [
  ['flight', 'Flight', 'plane'],
  ['train', 'Train', 'train'],
  ['bus', 'Bus', 'bus'],
]

const initialForm = {
  // Step 1: account
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  // Step 2: current flight
  flightNumber: '',
  airline: '',
  originCode: '',
  originCity: '',
  destinationCode: '',
  destinationCity: '',
  depTime: '',
  arrTime: '',
  seat: '',
  pnr: '',
  // Step 3: connecting transport
  connType: 'bus',
  connName: '',
  connFrom: '',
  connTime: '',
  connDest: '',
  connTicket: '',
  // Step 4: constraints
  maxBudget: '',
  latestArrival: '',
  modes: ['flight', 'train', 'bus'],
  finalDestination: '',
}

// Returns an error message for the given step, or '' if everything is fine.
function validateStep(step, f) {
  if (step === 0) {
    if (f.fullName.trim().length < 2) return 'Please enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Please enter a valid email address.'
    const digits = f.phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) return 'Please enter a valid phone number (10 to 13 digits).'
    if (f.password.length < 8) return 'Password must be at least 8 characters.'
    if (f.password !== f.confirmPassword) return 'The two passwords do not match.'
  }

  if (step === 1) {
    if (!f.flightNumber.trim()) return 'Please enter the flight number.'
    if (!f.airline.trim()) return 'Please enter the airline.'
    if (!/^[A-Za-z]{3}$/.test(f.originCode.trim())) return 'Origin airport code must be 3 letters (e.g. DEL).'
    if (!f.originCity.trim()) return 'Please enter the origin city.'
    if (!/^[A-Za-z]{3}$/.test(f.destinationCode.trim())) return 'Destination airport code must be 3 letters (e.g. BOM).'
    if (!f.destinationCity.trim()) return 'Please enter the destination city.'
    if (f.originCode.trim().toUpperCase() === f.destinationCode.trim().toUpperCase())
      return 'Origin and destination airports must be different.'
    if (!f.depTime || !f.arrTime) return 'Please enter the scheduled departure and arrival times.'
    if (istInputToMs(f.arrTime) <= istInputToMs(f.depTime)) return 'Arrival must be after departure.'
    if (f.pnr.trim().length < 4) return 'Please enter your PNR (at least 4 characters).'
  }

  if (step === 2) {
    if (!f.connName.trim()) return 'Please enter the name or number of your connecting transport.'
    if (!f.connFrom.trim()) return 'Please enter where the connecting transport departs from.'
    if (!f.connTime) return 'Please enter the departure time of the connecting transport.'
    if (istInputToMs(f.connTime) <= istInputToMs(f.arrTime))
      return 'Your connecting transport must depart after your flight is scheduled to arrive.'
    if (!f.connDest.trim()) return 'Please enter the destination of the connecting transport.'
    if (!f.connTicket.trim()) return 'Please enter your ticket reference.'
  }

  if (step === 3) {
    const budget = Number(f.maxBudget)
    if (!f.maxBudget || !Number.isInteger(budget) || budget <= 0) return 'Please enter a max budget in whole rupees.'
    if (!f.latestArrival) return 'Please enter your latest acceptable arrival time.'
    if (istInputToMs(f.latestArrival) <= istInputToMs(f.connTime))
      return 'Latest acceptable arrival must be after your connecting transport departs.'
    if (f.modes.length === 0) return 'Pick at least one preferred mode of transport.'
    if (!f.finalDestination.trim()) return 'Please enter your final destination city.'
  }

  return ''
}

// 0 to 4. Advice only: the real rule is just "at least 8 characters".
function passwordStrength(pw) {
  if (pw.length === 0) return 0
  if (pw.length < 8) return 0
  let score = 1
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++
  return score
}
const STRENGTH_LABELS = ['Too short', 'Weak', 'Okay', 'Good', 'Strong']
const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500']

function StrengthMeter({ password }) {
  if (!password) return null
  const score = passwordStrength(password)
  const filled = Math.max(score, 1)
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < filled ? STRENGTH_COLORS[score] : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Password strength: <span className="font-semibold text-slate-700">{STRENGTH_LABELS[score]}</span>
      </p>
    </div>
  )
}

function ReviewCard({ title, icon, rows }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo-700">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h3>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium text-slate-800">{value || '-'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function randomText(len) {
  return (Math.random().toString(36) + '000000').slice(2, 2 + len).toUpperCase()
}

export default function Signup() {
  const { user, profile, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Remember whether the person was ALREADY logged in when they opened this page.
  // (After we create their account mid-form, they become logged in too, which is fine.)
  const [startedLoggedIn, setStartedLoggedIn] = useState(null)
  useEffect(() => {
    if (!loading && startedLoggedIn === null) setStartedLoggedIn(Boolean(user))
  }, [loading, user, startedLoggedIn])

  // Generic text input handler: <input name="fullName" ... />
  function update(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  // Airport code inputs also auto-fill the matching city.
  function updateCode(codeField, cityField, e) {
    const value = e.target.value.toUpperCase().slice(0, 3)
    setForm((f) => ({
      ...f,
      [codeField]: value,
      [cityField]: CITY_BY_CODE[value] ?? f[cityField],
    }))
  }

  function toggleMode(mode) {
    setForm((f) => ({
      ...f,
      modes: f.modes.includes(mode) ? f.modes.filter((m) => m !== mode) : [...f.modes, mode],
    }))
  }

  // Demo helper: fills the whole form with a realistic trip for today (IST).
  function fillSample() {
    const day = todayIST()
    setForm({
      fullName: 'Demo Traveller',
      email: `demo${Math.floor(1000 + Math.random() * 9000)}@example.com`,
      phone: '+91 98765 43210',
      password: 'Demo@1234',
      confirmPassword: 'Demo@1234',
      flightNumber: '6E-2041',
      airline: 'IndiGo',
      originCode: 'DEL',
      originCity: 'Delhi',
      destinationCode: 'BOM',
      destinationCity: 'Mumbai',
      depTime: `${day}T09:00`,
      arrTime: `${day}T11:10`,
      seat: '15C',
      pnr: randomText(6),
      connType: 'bus',
      connName: 'MSRTC Shivneri 1245',
      connFrom: 'Mumbai Airport T2 Bus Bay',
      connTime: `${day}T12:45`,
      connDest: 'Pune',
      connTicket: `MSRTC-${Math.floor(10000 + Math.random() * 89999)}`,
      maxBudget: '7000',
      latestArrival: `${day}T18:00`,
      modes: ['flight', 'train', 'bus'],
      finalDestination: 'Pune',
    })
    setError('')
  }

  function goNext() {
    const message = validateStep(step, form)
    if (message) {
      setError(message)
      return
    }
    setError('')
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setError('')
    setStep((s) => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    // Validate every step again before sending anything.
    for (let i = 0; i < STEPS.length - 1; i++) {
      const message = validateStep(i, form)
      if (message) {
        setStep(i)
        setError(message)
        return
      }
    }

    setError('')
    setBusy(true)
    try {
      // 1) Create the account (skipped if a previous attempt already created it).
      if (!user) {
        await signUp({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
        })
      }

      // 2) Save flight, connecting transport and constraints in one database call.
      const { error: rpcError } = await supabase.rpc('create_passenger_trip', {
        p_flight: {
          flight_number: form.flightNumber.trim(),
          airline: form.airline.trim(),
          origin_code: form.originCode.trim(),
          origin_city: form.originCity.trim(),
          destination_code: form.destinationCode.trim(),
          destination_city: form.destinationCity.trim(),
          scheduled_departure: istInputToISO(form.depTime),
          scheduled_arrival: istInputToISO(form.arrTime),
          seat: form.seat.trim() || null,
          pnr: form.pnr.trim(),
        },
        p_connection: {
          type: form.connType,
          name: form.connName.trim(),
          departure_location: form.connFrom.trim(),
          departure_time: istInputToISO(form.connTime),
          destination: form.connDest.trim(),
          ticket_reference: form.connTicket.trim(),
        },
        p_constraints: {
          max_budget_inr: Number(form.maxBudget),
          latest_arrival: istInputToISO(form.latestArrival),
          preferred_modes: form.modes,
          final_destination: form.finalDestination.trim(),
        },
      })
      if (rpcError) throw rpcError

      navigate('/passenger', { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault() // stop the browser from reloading the page
    if (step < STEPS.length - 1) goNext()
    else handleSubmit()
  }

  // ---------- Render ----------

  if (loading || startedLoggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    )
  }

  // Someone who is already logged in does not need to sign up again.
  if (startedLoggedIn) {
    return (
      <AuthShell>
        <AuthCard className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">You are already signed in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as {profile?.full_name || user?.email}. Sign out first if you want to create a new account.
          </p>
          <Link to={homePathFor(profile)} className="btn-primary mt-5">
            Go to my dashboard <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </AuthCard>
      </AuthShell>
    )
  }

  const isLast = step === STEPS.length - 1

  return (
    <AuthShell wide>
      {/* ---------- Stepper ---------- */}
      <ol className="mb-6 flex items-start">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex items-start ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                  i < step
                    ? 'bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-300'
                    : i === step
                      ? 'bg-white text-indigo-700 ring-4 ring-indigo-100 shadow'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < step ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`hidden text-xs sm:block ${
                  i === step ? 'font-semibold text-indigo-700' : 'text-slate-500'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-2 mt-4.25 h-0.5 flex-1 overflow-hidden rounded bg-slate-200">
                <div
                  className="h-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: i < step ? '100%' : '0%' }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>

      <AuthCard>
        <form onSubmit={handleFormSubmit}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-300/50">
                <Icon name={STEP_ICONS[step]} className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{STEP_TITLES[step]}</h1>
                <p className="text-sm text-slate-500">
                  Step {step + 1} of {STEPS.length}
                  {step > 0 && step < 4 && ' · All times are in IST'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fillSample}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              Fill sample data
            </button>
          </div>

          {/* Suggestions for the text boxes below */}
          <datalist id="airlines">
            {AIRLINES.map((a) => <option key={a} value={a} />)}
          </datalist>
          <datalist id="cities">
            {CITIES.map((c) => <option key={c} value={c} />)}
          </datalist>
          <datalist id="airports">
            {Object.keys(CITY_BY_CODE).map((c) => <option key={c} value={c} />)}
          </datalist>

          {/* key={step} makes each step slide in again */}
          <div key={step} className="mt-6 animate-slide-in space-y-4">
            {/* ---------- Step 1: Account ---------- */}
            {step === 0 && (
              <>
                <Field label="Full name">
                  <IconInput icon="user" name="fullName" value={form.fullName} onChange={update} autoComplete="name" placeholder="Aarav Sharma" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email">
                    <IconInput icon="mail" type="email" name="email" value={form.email} onChange={update} autoComplete="email" placeholder="you@example.com" />
                  </Field>
                  <Field label="Phone">
                    <IconInput icon="phone" type="tel" name="phone" value={form.phone} onChange={update} autoComplete="tel" placeholder="+91 98765 43210" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Field label="Password" hint="At least 8 characters.">
                      <IconInput
                        icon="lock"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={form.password}
                        onChange={update}
                        autoComplete="new-password"
                        right={
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Icon name={showPassword ? 'eyeOff' : 'eye'} className="size-4.5" />
                          </button>
                        }
                      />
                    </Field>
                    <StrengthMeter password={form.password} />
                  </div>
                  <Field label="Confirm password">
                    <IconInput
                      icon="lock"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={form.confirmPassword}
                      onChange={update}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
              </>
            )}

            {/* ---------- Step 2: Flight ---------- */}
            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Flight number">
                    <IconInput icon="plane" name="flightNumber" value={form.flightNumber} onChange={update} placeholder="6E-2041" />
                  </Field>
                  <Field label="Airline">
                    <input name="airline" value={form.airline} onChange={update} list="airlines" className={inputBase} placeholder="IndiGo" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="From (airport code)" hint="e.g. DEL, BOM, BLR, HYD, MAA, PNQ, GOI, JAI">
                    <IconInput icon="mapPin" value={form.originCode} onChange={(e) => updateCode('originCode', 'originCity', e)} list="airports" placeholder="DEL" />
                  </Field>
                  <Field label="From (city)">
                    <input name="originCity" value={form.originCity} onChange={update} list="cities" className={inputBase} placeholder="Delhi" />
                  </Field>
                  <Field label="To (airport code)">
                    <IconInput icon="mapPin" value={form.destinationCode} onChange={(e) => updateCode('destinationCode', 'destinationCity', e)} list="airports" placeholder="BOM" />
                  </Field>
                  <Field label="To (city)">
                    <input name="destinationCity" value={form.destinationCity} onChange={update} list="cities" className={inputBase} placeholder="Mumbai" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Scheduled departure">
                    <input type="datetime-local" name="depTime" value={form.depTime} onChange={update} className={inputBase} />
                  </Field>
                  <Field label="Scheduled arrival">
                    <input type="datetime-local" name="arrTime" value={form.arrTime} onChange={update} className={inputBase} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="PNR">
                    <IconInput icon="ticket" name="pnr" value={form.pnr} onChange={update} placeholder="AB12CD" />
                  </Field>
                  <Field label="Seat (optional)">
                    <input name="seat" value={form.seat} onChange={update} className={inputBase} placeholder="14A" />
                  </Field>
                </div>
              </>
            )}

            {/* ---------- Step 3: Connecting transport ---------- */}
            {step === 2 && (
              <>
                <Field label="Type of connecting transport">
                  <div className="grid grid-cols-3 gap-2">
                    {MODE_OPTIONS.map(([value, label, icon]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, connType: value }))}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                          form.connType === value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-100'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon name={icon} className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Number or name" hint="e.g. 12028 Shatabdi Express, MSRTC Shivneri 1245, 6E-6341">
                  <input name="connName" value={form.connName} onChange={update} className={inputBase} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Departs from">
                    <IconInput icon="mapPin" name="connFrom" value={form.connFrom} onChange={update} placeholder="Mumbai Airport T2 Bus Bay" />
                  </Field>
                  <Field label="Departure time">
                    <input type="datetime-local" name="connTime" value={form.connTime} onChange={update} className={inputBase} />
                  </Field>
                  <Field label="Destination">
                    <input name="connDest" value={form.connDest} onChange={update} list="cities" className={inputBase} placeholder="Pune" />
                  </Field>
                  <Field label="Ticket reference">
                    <IconInput icon="ticket" name="connTicket" value={form.connTicket} onChange={update} />
                  </Field>
                </div>
              </>
            )}

            {/* ---------- Step 4: Constraints ---------- */}
            {step === 3 && (
              <>
                <p className="flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
                  <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                  The agent only suggests options that fit these limits.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Max budget (INR)" hint="Most you can spend on an alternative.">
                    <IconInput icon="wallet" type="number" min="1" step="1" name="maxBudget" value={form.maxBudget} onChange={update} placeholder="7000" />
                  </Field>
                  <Field label="Latest acceptable arrival">
                    <input type="datetime-local" name="latestArrival" value={form.latestArrival} onChange={update} className={inputBase} />
                  </Field>
                </div>
                <Field label="Final destination (city)" hint="Where you ultimately need to reach.">
                  <input name="finalDestination" value={form.finalDestination} onChange={update} list="cities" className={inputBase} placeholder="Pune" />
                </Field>
                <Field label="Preferred modes of transport">
                  <div className="grid grid-cols-3 gap-2">
                    {MODE_OPTIONS.map(([value, label, icon]) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                          form.modes.includes(value)
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-4 ring-indigo-100'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.modes.includes(value)}
                          onChange={() => toggleMode(value)}
                          className="sr-only"
                        />
                        <Icon name={icon} className="h-4 w-4" />
                        {label}
                      </label>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {/* ---------- Step 5: Review ---------- */}
            {step === 4 && (
              <>
                <ReviewCard
                  title="Account"
                  icon="user"
                  rows={[
                    ['Name', form.fullName],
                    ['Email', form.email],
                    ['Phone', form.phone],
                  ]}
                />
                <ReviewCard
                  title="Current flight"
                  icon="plane"
                  rows={[
                    ['Flight', `${form.flightNumber.toUpperCase()} · ${form.airline}`],
                    ['Route', `${form.originCode} ${form.originCity} → ${form.destinationCode} ${form.destinationCity}`],
                    ['Departs', `${formatDateTimeIST(istInputToISO(form.depTime))} IST`],
                    ['Arrives', `${formatDateTimeIST(istInputToISO(form.arrTime))} IST`],
                    ['PNR / Seat', `${form.pnr.toUpperCase()}${form.seat ? ` / ${form.seat}` : ''}`],
                  ]}
                />
                <ReviewCard
                  title="Connecting transport"
                  icon="bus"
                  rows={[
                    ['Type', form.connType],
                    ['Service', form.connName],
                    ['From', form.connFrom],
                    ['Departs', `${formatDateTimeIST(istInputToISO(form.connTime))} IST`],
                    ['To', form.connDest],
                    ['Ticket', form.connTicket],
                  ]}
                />
                <ReviewCard
                  title="Constraints"
                  icon="wallet"
                  rows={[
                    ['Max budget', `₹${Number(form.maxBudget).toLocaleString('en-IN')}`],
                    ['Latest arrival', `${formatDateTimeIST(istInputToISO(form.latestArrival))} IST`],
                    ['Preferred modes', form.modes.join(', ')],
                    ['Final destination', form.finalDestination],
                  ]}
                />
                {user && (
                  <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                    Your account ({user.email}) is already created. If saving your trip failed, fix the problem and
                    press the button again. A second account will not be created.
                  </p>
                )}
              </>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 flex animate-pop items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="btn-secondary px-5! py-2.5! disabled:opacity-60"
              >
                <Icon name="arrowLeft" className="h-4 w-4" /> Back
              </button>
            ) : (
              <Link to="/login" className="text-sm font-medium text-indigo-600 hover:underline">
                Already have an account? Log in
              </Link>
            )}

            <button type="submit" disabled={busy} className="btn-primary px-6! py-2.5! disabled:opacity-70">
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Creating account...
                </>
              ) : isLast ? (
                <>
                  Create account <Icon name="check" className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next <Icon name="arrowRight" className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  )
}