'use strict';

var Script = require('next/script');
var jsxRuntime = require('react/jsx-runtime');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Script__default = /*#__PURE__*/_interopDefault(Script);

// src/analytics/CmsAnalytics.tsx
function CmsAnalytics({
  rumToken = process.env.RUM_TOKEN,
  rumSrc = "https://crm.ctwebsiteco.com/rum.js",
  strategy = "afterInteractive",
  gaId
}) {
  const resolvedGaId = gaId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    resolvedGaId && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        Script__default.default,
        {
          src: `https://www.googletagmanager.com/gtag/js?id=${resolvedGaId}`,
          strategy
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(Script__default.default, { id: "cms-ga-config", strategy, children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${resolvedGaId}');` })
    ] }),
    rumToken && /* @__PURE__ */ jsxRuntime.jsx(
      Script__default.default,
      {
        src: rumSrc,
        "data-rum-token": rumToken,
        strategy
      }
    )
  ] });
}

exports.CmsAnalytics = CmsAnalytics;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map