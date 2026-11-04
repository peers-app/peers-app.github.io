---
sidebar_position: 11
---

# System HTTP

System HTTP (`system.http`) performs outbound HTTPS for a sandboxed package, which has no
`fetch`. Declare `pkg.consumes(SystemHttp)` with `SystemHttp` from
`@peers-app/peers-sdk/define`, then call `SystemHttp(ctx).tools.request(...)` from a handler.
It is available on desktop, headless and the PWA. On the PWA the browser's own rules apply
too; see [In a browser](#in-a-browser).

System HTTP, System Scheduler, System Files, System Group Members, System Contract Catalog,
System Tool Catalog, System Host Tools, and System Desktop Tools are local-only contracts.
Calls arriving from another device are denied, including calls from a Self-trusted device.
Device Operations `runTool` also excludes Host/Desktop aliases; local callers use
their contracts or the local CLI catalog instead.

## Allowlist

A package opts in with `pkg.network` inside `definePackage`:

```ts
pkg.network = {
  allowedHosts: ["api.openai.com"],
  credentials: [
    {
      ref: "openai",
      secretVar: "openaiApiKey",
      header: "Authorization",
      format: "Bearer {secret}",
    },
  ],
};
```

`allowedHosts` entries are exact lowercase DNS hostnames; IP address literals are rejected. URLs must be `https`, must not embed credentials, and redirects are rejected. Omitting `pkg.network` denies every request. Installing the package accepts this declaration; there is no separate approval step. The Packages info tab shows the allowlist and credential refs. It never shows secret values.

## Credentials

Pass a declared `credentialRef` with the request. `secretVar` names the package's secret
persistent variable, and the credential's `scope` is `user` (the default) or `device`.
Peers injects its value into the declared header, replacing any request header of the same
name. Injection happens outside the isolated package worker. On the PWA, the trusted Peers
page can access the credential to make the request.

## Requests

`request` takes `requestId`, `method`, `url`, optional `headers`, one of `body`, `bodyBase64`, or `multipart`, optional `credentialRef`, `responseType` (`json`, `text`, or `base64`), and `timeoutMs`. A multipart part is either a `text` form field or `bodyBase64` bytes with an optional filename. The default timeout is 30 seconds and the maximum is 120 seconds.

Request and response bodies are capped at 8 MB. The host rejects an oversized
`Content-Length` before reading and stops a response stream as soon as it crosses the
cap, rather than buffering an unbounded response. Each package may have at most 16
simultaneous requests in flight.

A non-2xx response is returned with `ok: false`. It is not thrown. `cancel` aborts an in-flight request owned by the same package.

`describePolicy` returns the allowlist and credential refs. An isolated caller can read only its own policy. The Packages screen, which has no package caller, can read any package in the data context.

## In a browser

On the PWA, requests run in the browser while Peers is open. Everything above still applies,
and the browser adds its own rules:

- **The site must accept requests from a browser (CORS).** It must allow the Peers origin,
  the request method and its headers, including `Authorization` when used. Open-Meteo and
  the OpenAI endpoints used by Voice Hub allow these requests; many RSS feeds don't.
- **A browser failure may have several causes.** If the browser cannot return the reply,
  the error says "The browser could not read the reply from *host*" and lists possible causes:
  CORS, a rejected request, a redirect that System HTTP refuses, or an unreachable site.
  If your browser reports that the device is offline, the error says so.
  Check your connection, the site's CORS support, and that you are using its final URL.
- **Some sites leave CORS off their error replies.** Some OpenAI replies to invalid API keys
  do this, so a bad key can appear as a browser read failure instead of a 401 with `ok: false`.
  Check the key in Voice Hub's settings if OpenAI requests fail this way.
- **The browser controls some headers.** Package request headers cannot set `Origin`, `Host`
  or `Cookie`.
- **Requests send no cookies** and skip the browser's cache, including requests to Peers' own site.

## Tool time

The default package tool timeout is 30 seconds. If an HTTP call may run longer, set
`timeoutMs` in that tool's `defineTool` declaration, up to 120 seconds. The HTTP request's
timeout is a separate timer inside that budget.
