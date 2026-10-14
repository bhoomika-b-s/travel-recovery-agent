import { supabase } from './supabaseClient'

// Calls one of our Edge Functions and returns its JSON.
// supabase.functions.invoke automatically sends the logged-in user's token.
// Errors are turned into a plain Error with a readable message.
export async function callAgent(functionName, body) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })

  if (error) {
    let message = error.message
    // For HTTP errors the real message is inside the response body.
    try {
      const response = error.context
      if (response && typeof response.json === 'function') {
        const payload = await response.json()
        if (payload?.error) message = payload.error
      }
    } catch {
      // keep the default message
    }
    if (message.includes('Failed to send a request')) {
      message += ' Check that the Edge Functions are deployed (npx supabase functions list).'
    }
    throw new Error(message)
  }

  if (data?.error) throw new Error(data.error)
  return data
}