import Script from 'next/script'

type Strategy = 'afterInteractive' | 'lazyOnload' | 'beforeInteractive' | 'worker'

type Props = {
  /** CT Website Co RUM token. Injected by CI from deployments.rum_token. */
  rumToken?: string
  /** Override RUM script URL (rarely needed). */
  rumSrc?: string
  /** Load strategy for both RUM and GA4 scripts. */
  strategy?: Strategy
  /** Override GA4 ID. Defaults to process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID. */
  gaId?: string
}

// Ships GA4 (env-gated) + CT Website Co RUM (always on when token is present).
// The RUM script covers real-user monitoring AND client-side error tracking,
// so there is no Sentry integration (see ADR-008).

export function CmsAnalytics({
  rumToken = process.env.RUM_TOKEN,
  rumSrc = 'https://crm.ctwebsiteco.com/rum.js',
  strategy = 'afterInteractive',
  gaId,
}: Props) {
  const resolvedGaId = gaId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return (
    <>
      {resolvedGaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${resolvedGaId}`}
            strategy={strategy}
          />
          <Script id="cms-ga-config" strategy={strategy}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${resolvedGaId}');`}
          </Script>
        </>
      )}
      {rumToken && (
        <Script
          src={rumSrc}
          data-rum-token={rumToken}
          strategy={strategy}
        />
      )}
    </>
  )
}
