# Security Policy

## Scope

stablecoin.io is a static read-only dashboard. It has no user accounts, no authentication, no database, and stores no personal data. The attack surface is limited to the Cloudflare Worker routing and proxy layer.

## Reporting a vulnerability

If you find a security issue, please report it privately before disclosing publicly.

**How to report:** Open a GitHub issue marked `[SECURITY]` in the title, or email the repo owner via the contact on their GitHub profile.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

We aim to respond within 72 hours and ship a fix within 7 days for confirmed issues.

## What's in scope

- The Cloudflare Worker proxy routes (`/llama/*`, `/cg/*`)
- Client-side JavaScript in `index.html`
- The build pipeline (`build.js`)

## What's out of scope

- DeFi Llama or CoinGecko API vulnerabilities (report those upstream)
- Cloudflare infrastructure (report to Cloudflare)

## Known limitations

- No Content Security Policy is currently enforced — inline scripts are used throughout. A future refactor could enable a proper CSP.
