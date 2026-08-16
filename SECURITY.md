# Security Policy

## Supported version

Security fixes are applied to the current `main` branch and to validated releases built from it.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities, exposed credentials, unsafe parser input handling, local-file access issues, or privacy-sensitive findings.

Use GitHub's private vulnerability reporting feature when available. If private reporting is unavailable, contact the repository owner privately through the contact information on the GitHub profile.

Do not include real credentials, personal data, or destructive proof-of-concept material in reports.

## Repository security baseline

Maintained releases are expected to pass:

- pnpm lockfile-backed installation and an audit with no accepted known vulnerabilities;
- CodeQL analysis for JavaScript and TypeScript;
- parser regression, syntax, browser reliability, engine-parity, and .NET test suites;
- Node 24 LTS and a pinned pnpm 11 toolchain;
- least-privilege GitHub Actions permissions and immutable third-party Action pins;
- secret-free source control and environment-specific credentials stored outside the repository.

Combat logs and local files should be treated as untrusted input. A passing automated scan reduces known risk but cannot prove that software is risk-free. New findings are treated as defects and remediated through the normal branch, pull-request, validation, and controlled-release process.
