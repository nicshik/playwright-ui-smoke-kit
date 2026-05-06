# Security Policy

## Supported Versions

Security fixes are provided for the latest published minor version.

## Reporting a Vulnerability

Please report security issues privately by opening a GitHub security advisory or by contacting the maintainer directly.

Do not include secrets, private application URLs, or proprietary source code in public issues.

## Threat Model

This package writes test configuration files and can run package manager install commands. Review generated files before committing them, especially when using third-party templates or skill packs.

Package releases use npm Trusted Publishing from GitHub Actions instead of long-lived npm tokens. Do not commit npm credentials, `.npmrc` auth tokens, or generated package tarballs.
