import Script from 'next/script';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';

// src/analytics/CmsAnalytics.tsx
function CmsAnalytics({
  rumToken = process.env.RUM_TOKEN,
  rumSrc = "https://crm.ctwebsiteco.com/rum.js",
  strategy = "afterInteractive",
  gaId
}) {
  const resolvedGaId = gaId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    resolvedGaId && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        Script,
        {
          src: `https://www.googletagmanager.com/gtag/js?id=${resolvedGaId}`,
          strategy
        }
      ),
      /* @__PURE__ */ jsx(Script, { id: "cms-ga-config", strategy, children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${resolvedGaId}');` })
    ] }),
    rumToken && /* @__PURE__ */ jsx(
      Script,
      {
        src: rumSrc,
        "data-rum-token": rumToken,
        strategy
      }
    )
  ] });
}

export { CmsAnalytics };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map