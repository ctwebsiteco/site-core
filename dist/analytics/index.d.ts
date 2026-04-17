import * as react from 'react';

type Strategy = 'afterInteractive' | 'lazyOnload' | 'beforeInteractive' | 'worker';
type Props = {
    /** CT Website Co RUM token. Injected by CI from deployments.rum_token. */
    rumToken?: string;
    /** Override RUM script URL (rarely needed). */
    rumSrc?: string;
    /** Load strategy for both RUM and GA4 scripts. */
    strategy?: Strategy;
    /** Override GA4 ID. Defaults to process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID. */
    gaId?: string;
};
declare function CmsAnalytics({ rumToken, rumSrc, strategy, gaId, }: Props): react.JSX.Element;

export { CmsAnalytics };
