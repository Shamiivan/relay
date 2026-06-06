# Security Policy

## Reporting Issues

Do not open public issues for vulnerabilities, credential leaks, or private company data exposure. Send the report privately to the repository owner with:

- affected files or workflows
- impact
- reproduction steps
- suggested fix, if known

## Secrets

Never commit `.env`, `.env.local`, service account keys, OAuth tokens, API keys, session logs, or production credentials.

This repo intentionally ignores local runtime and credential files such as `.env.local`, `.contexts/`, `.runs/`, `.context/`, `.tmp/`, and `.relay/`.

## Integration Credentials

Many workflows can call external systems such as Google Workspace, Discord, Apollo, Instantly, Brave, and Reddit. Keep credentials scoped to the minimum permissions needed for the workflow being tested.
