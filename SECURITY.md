# Security policy

## Supported version

Security fixes currently target the latest published release.

## Reporting a vulnerability

Please do not publish exploit details in a normal issue. Use GitHub's private
vulnerability reporting for this repository when available, or contact the
repository owner privately through their GitHub profile. Include affected
versions, reproduction steps, and impact. Do not include real media paths,
Osmolog exports, or other personal data.

## Trust boundary

The companion binds only to `127.0.0.1` and validates the Chrome extension
Origin against the locally paired ID. Origin checking prevents ordinary web
pages from connecting, but it is not a defense against a determined malicious
process already running as the same Windows user.
