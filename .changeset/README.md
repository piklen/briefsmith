# Changesets

This repository uses Changesets to manage versioning and npm releases.

## For contributors

When a pull request changes package behavior or packaging, add a changeset:

```bash
npm run changeset
```

Choose the release type and summarize the user-visible change.

## Release flow

- Changes merged to `main` with pending changesets will trigger a version PR.
- Merging that version PR will publish the package to npm, create git tags, and update changelog files.

The GitHub Actions release workflow requires:

- `GITHUB_TOKEN`
- `NPM_TOKEN`
