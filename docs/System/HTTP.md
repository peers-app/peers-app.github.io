---
sidebar_position: 11
---

# System HTTP

System HTTP (`system.http`) is the Runtime contract that performs outbound HTTPS for an isolated package. The guest has no `fetch`. It calls the `request` tool, and the host in `peers-device` runs Node `fetch`.

The desktop app and `peers-headless` provide it by importing `@peers-app/peers-device/http`. That entry is not on the package root, so the PWA bundle does not load it.

System HTTP, System Scheduler, and System Contract Catalog are local-only contracts.
Calls arriving from another device are denied, including calls from a Self-trusted device.

## Allowlist

An isolated artifact opts in with `manifest.network`:

```json
{
  "allowedHosts": ["api.openai.com"],
  "credentials": [
    {
      "ref": "openai",
      "secretVar": "openaiApiKey",
      "header": "Authorization",
      "format": "Bearer {secret}"
    }
  ]
}
```

`allowedHosts` entries are exact lowercase DNS hostnames; IP address literals are rejected. URLs must be `https`, must not embed credentials, and redirects are rejected. Omitting `network` denies every request. The declaration is honored the way `suggestedAccessLevel` is: install-time approval is not part of this contract. The Packages info tab shows the allowlist and credential refs. It never shows secret values.

## Credentials

The guest passes `credentialRef`. The host reads the package-prefixed secret persistent variable (`${packageId}_${secretVar}`), decrypts it in the host process, and sets the declared header. A guest header of the same name is removed before the request is sent. `scope` is `user` (the default) or `device`. The plaintext is not returned to the guest or the renderer.

## Requests

`request` takes `requestId`, `method`, `url`, optional `headers`, one of `body`, `bodyBase64`, or `multipart`, optional `credentialRef`, `responseType` (`json`, `text`, or `base64`), and `timeoutMs`. A multipart part is either a `text` form field or `bodyBase64` bytes with an optional filename. The default timeout is 30 seconds and the maximum is 120 seconds.

Request and response bodies are capped at 8 MB. The host rejects an oversized
`Content-Length` before reading and stops a response stream as soon as it crosses the
cap, rather than buffering an unbounded response. Each package may have at most 16
simultaneous requests in flight.

A non-2xx response is returned with `ok: false`. It is not thrown. `cancel` aborts an in-flight request owned by the same package.

`describePolicy` returns the allowlist and credential refs. An isolated caller can read only its own policy. The Packages screen, which has no package caller, can read any package in the data context.

## Tool time

The host's default isolated tool timeout is 30 seconds. A package whose HTTP call may run longer sets `timeoutMs` on that tool in the manifest, up to 120 seconds. The HTTP `AbortController` is a separate timer inside that budget.
