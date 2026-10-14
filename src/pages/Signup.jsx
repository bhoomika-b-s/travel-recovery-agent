import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { homePathFor } from '../lib/paths'
import { formatDateTimeIST, istInputToISO, istInputToMs, todayIST } from '../lib/time'

const STEPS = ['Account', 'Flight', 'Connection', 'Constraints', 'Review']

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
  ['flight', '✈️ Flight'],
  ['train', '🚆 Train'],
  ['bus', '🚌 Bus'],
]

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'

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

// A label + input wrapper used throughout the form.
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

function ReviewCard({ title, rows }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{title}</h3>
      <dl className="mt-2 space-y-1 text-sm">
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
    window.scrollTo({ top: 0 })
  }

  function goBack() {
    setError('')
    setStep((s) => s - 1)
    window.scrollTo({ top: 0 })
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
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-12 text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">You are already signed in</h1>
            <p className="mt-2 text-sm text-slate-600">
              Signed in as {profile?.full_name || user?.email}. Sign out first if you want to create a new account.
            </p>
            <Link
              to={homePathFor(profile)}
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Go to my dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Progress indicator */}
        <ol className="mb-6 flex items-center justify-between">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  i < step
                    ? 'bg-indigo-600 text-white'
                    : i === step
                      ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span className={`hidden text-xs sm:block ${i === step ? 'font-semibold text-indigo-700' : 'text-slate-500'}`}>
                {label}
              </span>
            </li>
          ))}
        </ol>

        <form onSubmit={handleFormSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {['Create your account', 'Your current flight', 'Connecting transport', 'Your recovery constraints', 'Review and confirm'][step]}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Step {step + 1} of {STEPS.length}
                {step > 0 && step < 4 && ' · All times are in IST'}
              </p>
            </div>
            <button
              type="button"
              onClick={fillSample}
              className="shrink-0 rounded-lg border border-dashed border-indigo-400 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
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

          <div className="mt-6 space-y-4">
            {/* ---------- Step 1: Account ---------- */}
            {step === 0 && (
              <>
                <Field label="Full name">
                  <input name="fullName" value={form.fullName} onChange={update} autoComplete="name" className={inputClass} placeholder="Aarav Sharma" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email">
                    <input type="email" name="email" value={form.email} onChange={update} autoComplete="email" className={inputClass} placeholder="you@example.com" />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" name="phone" value={form.phone} onChange={update} autoComplete="tel" className={inputClass} placeholder="+91 98765 43210" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" hint="At least 8 characters.">
                    <input type="password" name="password" value={form.password} onChange={update} autoComplete="new-password" className={inputClass} />
                  </Field>
                  <Field label="Confirm password">
                    <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} autoComplete="new-password" className={inputClass} />
                  </Field>
                </div>
              </>
            )}

            {/* ---------- Step 2: Flight ---------- */}
            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Flight number">
                    <input name="flightNumber" value={form.flightNumber} onChange={update} className={inputClass} placeholder="6E-2041" />
                  </Field>
                  <Field label="Airline">
                    <input name="airline" value={form.airline} onChange={update} list="airlines" className={inputClass} placeholder="IndiGo" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="From (airport code)" hint="e.g. DEL, BOM, BLR, HYD, MAA, PNQ, GOI, JAI">
                    <input value={form.originCode} onChange={(e) => updateCode('originCode', 'originCity', e)} list="airports" className={inputClass} placeholder="DEL" />
                  </Field>
                  <Field label="From (city)">
                    <input name="originCity" value={form.originCity} onChange={update} list="cities" className={inputClass} placeholder="Delhi" />
                  </Field>
                  <Field label="To (airport code)">
                    <input value={form.destinationCode} onChange={(e) => updateCode('destinationCode', 'destinationCity', e)} list="airports" className={inputClass} placeholder="BOM" />
                  </Field>
                  <Field label="To (city)">
                    <input name="destinationCity" value={form.destinationCity} onChange={update} list="cities" className={inputClass} placeholder="Mumbai" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Scheduled departure">
                    <input type="datetime-local" name="depTime" value={form.depTime} onChange={update} className={inputClass} />
                  </Field>
                  <Field label="Scheduled arrival">
                    <input type="datetime-local" name="arrTime" value={form.arrTime} onChange={update} className={inputClass} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="PNR">
                    <input name="pnr" value={form.pnr} onChange={update} className={inputClass} placeholder="AB12CD" />
                  </Field>
                  <Field label="Seat (optional)">
                    <input name="seat" value={form.seat} onChange={update} className={inputClass} placeholder="14A" />
                  </Field>
                </div>
              </>
            )}

            {/* ---------- Step 3: Connecting transport ---------- */}
            {step === 2 && (
              <>
                <Field label="Type of connecting transport">
                  <div className="grid grid-cols-3 gap-2">
                    {MODE_OPTIONS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, connType: value }))}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                          form.connType === value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Number or name" hint="e.g. 12028 Shatabdi Express, MSRTC Shivneri 1245, 6E-6341">
                  <input name="connName" value={form.connName} onChange={update} className={inputClass} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Departs from">
                    <input name="connFrom" value={form.connFrom} onChange={update} className={inputClass} placeholder="Mumbai Airport T2 Bus Bay" />
                  </Field>
                  <Field label="Departure time">
                    <input type="datetime-local" name="connTime" value={form.connTime} onChange={update} className={inputClass} />
                  </Field>
                  <Field label="Destination">
                    <input name="connDest" value={form.connDest} onChange={update} list="cities" className={inputClass} placeholder="Pune" />
                  </Field>
                  <Field label="Ticket reference">
                    <input name="connTicket" value={form.connTicket} onChange={update} className={inputClass} />
                  </Field>
                </div>
              </>
            )}

            {/* ---------- Step 4: Constraints ---------- */}
            {step === 3 && (
              <>
                <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
                  The agent only suggests options that fit these limits.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Max budget (INR)" hint="Most you can spend on an alternative.">
                    <input type="number" min="1" step="1" name="maxBudget" value={form.maxBudget} onChange={update} className={inputClass} placeholder="7000" />
                  </Field>
                  <Field label="Latest acceptable arrival">
                    <input type="datetime-local" name="latestArrival" value={form.latestArrival} onChange={update} className={inputClass} />
                  </Field>
                </div>
                <Field label="Final destination (city)" hint="Where you ultimately need to reach.">
                  <input name="finalDestination" value={form.finalDestination} onChange={update} list="cities" className={inputClass} placeholder="Pune" />
                </Field>
                <Field label="Preferred modes of transport">
                  <div className="grid grid-cols-3 gap-2">
                    {MODE_OPTIONS.map(([value, label]) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                          form.modes.includes(value)
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.modes.includes(value)}
                          onChange={() => toggleMode(value)}
                          className="sr-only"
                        />
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
                  rows={[
                    ['Name', form.fullName],
                    ['Email', form.email],
                    ['Phone', form.phone],
                  ]}
                />
                <ReviewCard
                  title="Current flight"
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
                  rows={[
                    ['Max budget', `₹${Number(form.maxBudget).toLocaleString('en-IN')}`],
                    ['Latest arrival', `${formatDateTimeIST(istInputToISO(form.latestArrival))} IST`],
                    ['Preferred modes', form.modes.join(', ')],
                    ['Final destination', form.finalDestination],
                  ]}
                />
                {user && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    Your account ({user.email}) is already created. If saving your trip failed, fix the problem and
                    press the button again. A second account will not be created.
                  </p>
                )}
              </>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Back
              </button>
            ) : (
              <Link to="/login" className="text-sm text-indigo-600 hover:underline">
                Already have an account? Log in
              </Link>
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isLast ? (busy ? 'Creating account...' : 'Create account') : 'Next'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}