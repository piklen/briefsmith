# Security Policy

## Supported Scope

This project processes local prompt history and generates execution-time context for AI coding hosts. Security issues that affect:

- local prompt data exposure
- unsafe host-side installation behavior
- command injection through generated runtime instructions
- unbounded writes into user configuration files

are considered in scope.

## Reporting

Please do not open a public GitHub issue for a suspected security vulnerability.

Instead, report it privately through GitHub Security Advisories for this repository. If that is unavailable, contact the maintainer directly before public disclosure.

When reporting, include:

- affected version or commit
- reproduction steps
- impact assessment
- any proposed mitigation if known

## Disclosure Expectations

- Give the maintainer reasonable time to reproduce and fix the issue before public disclosure.
- Avoid publishing proof-of-concept exploits that expose user prompt history or host credentials.
