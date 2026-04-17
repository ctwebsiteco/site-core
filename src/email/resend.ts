import { Resend } from 'resend'

// Thin Resend wrapper for transactional email outside the forms plugin
// (e.g., future auth / notification flows). Form submissions are handled
// by @payloadcms/plugin-form-builder via the Payload email adapter —
// do NOT call this from there.

let client: Resend | undefined

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    client = new Resend(apiKey)
  }
  return client
}

type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  from?: string
}

export async function sendEmail({ to, subject, html, replyTo, from }: SendArgs) {
  const defaultFrom = process.env.RESEND_FROM
  if (!from && !defaultFrom) {
    throw new Error('No from address provided and RESEND_FROM is not set')
  }
  return getClient().emails.send({
    from: from ?? defaultFrom!,
    to,
    subject,
    html,
    replyTo,
  })
}
