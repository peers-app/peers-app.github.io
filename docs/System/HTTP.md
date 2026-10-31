---
sidebar_position: 11
---

# System HTTP

System HTTP (`system.http`) performs outbound HTTPS for a sandboxed package, which has no
`fetch`. Declare `pkg.consumes(SystemHttp)` with `SystemHttp` from
`@peers-app/peers-sdk/define`, then call `SystemHttp(ctx).tools.request(...)` from a handler.
It is available on desktop and headless hosts.

System HTTP, System Scheduler, System Contract Catalog, System Tool Catalog,
System Host Tools, and System Desktop Tools are local-only contracts.
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

Pass a declared `credentialRef` with the request. Peers reads the package's secret persistent
variable (`${packageId}_${secretVar}`) and injects its value into the declared header, replacing
any request header of the same name. The credential's `scope` is `user` (the default) or
`device`. The secret value is not returned to package code or the renderer.

## Requests

`request` takes `requestId`, `method`, `url`, optional `headers`, one of `body`, `bodyBase64`, or `multipart`, optional `credentialRef`, `responseType` (`json`, `text`, or `base64`), and `timeoutMs`. A multipart part is either a `text` form field or `bodyBase64` bytes with an optional filename. The default timeout is 30 seconds and the maximum is 120 seconds.

Request and response bodies are capped at 8 MB. The host rejects an oversized
`Content-Length` before reading and stops a response stream as soon as it crosses the
cap, rather than buffering an unbounded response. Each package may have at most 16
simultaneous requests in flight.

A non-2xx response is returned with `ok: false`. It is not thrown. `cancel` aborts an in-flight request owned by the same package.

`describePolicy` returns the allowlist and credential refs. An isolated caller can read only its own policy. The Packages screen, which has no package caller, can read any package in the data context.

## Tool time

The default package tool timeout is 30 seconds. If an HTTP call may run longer, set
`timeoutMs` in that tool's `defineTool` declaration, up to 120 seconds. The HTTP request's
timeout is a separate timer inside that budget.
