# Contributing

Thanks for helping improve RepoPulse.

## Local Setup

```bash
npm ci
npm run lint
npm run format:check
npm test
npm run build
```

Use `npm run check` before opening a pull request. It runs linting, formatting checks, tests, and the build.

## Project Structure

- `src/checks.ts` defines check metadata, IDs, default weights, and README section aliases.
- `src/audit.ts` validates repository content and calculates scores.
- `src/config.ts` parses action inputs.
- `src/report.ts` renders text, Markdown, and JSON reports.
- `src/index.ts` connects the audit engine to `@actions/core`.
- `tests/` contains fast unit tests with temporary repositories.

## Changing Checks

When adding or changing a check:

1. Add or update the check definition in `src/checks.ts`.
2. Implement validation in `src/audit.ts`.
3. Add focused tests for pass, fail, and edge cases.
4. Update README inputs, scoring, and check ID documentation when behavior changes.
5. Run `npm run build` and commit the updated `dist/index.js`.

Keep checks local and deterministic. Do not add paid APIs or network-dependent behavior.

## Pull Requests

Pull requests should include:

- a short summary of the user-facing change;
- tests for scoring, parsing, validation, or reporting changes;
- documentation updates for changed inputs, outputs, checks, or release behavior;
- notes about compatibility or scoring changes.

## Dependabot Updates

Dependabot updates should pass CI before merging. For runtime dependency updates, rebuild `dist/index.js` and verify that generated output is committed.

## Release Checklist

1. Update `CHANGELOG.md`.
2. Confirm `package.json` and `package-lock.json` match the intended version.
3. Run `npm ci`.
4. Run `npm run check`.
5. Run `npm audit --audit-level=moderate`.
6. Commit `dist/index.js` if it changed.
7. Create an immutable tag such as `v1.0.2`.
8. Move the major tag, such as `v1`, to the new release.
9. Publish the GitHub release.

GitHub Marketplace may reject releases from a repository that contains workflow files. If that happens, publish from a release branch or mirror that omits `.github/workflows` while preserving `action.yml` and `dist/index.js`.
