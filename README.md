# RepoPulse

RepoPulse is a GitHub Action that audits the open source health of a repository with local, deterministic checks. It validates community files, scans README.md for essential sections, calculates a score from 0 to 100, writes a readable report, and can fail a workflow when the score is below `min-score`.

RepoPulse does not call external APIs, does not use paid services, and is designed to be cheap enough to run on every pull request.

## Quick Start

```yaml
name: RepoPulse

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Audit repository health
        uses: Milborne/RepoPulse@v1
        with:
          min-score: 80
```

Use the moving major tag `Milborne/RepoPulse@v1` for normal workflows. Pin to an immutable tag such as `Milborne/RepoPulse@v1.1.0` when you need fully reproducible behavior.

## Checks

RepoPulse validates more than path existence:

- `README.md`: file type, non-empty content, and README sections.
- `LICENSE`: file type, content length, and common license detection for MIT, Apache-2.0, GPL, BSD, ISC, and MPL.
- `CONTRIBUTING.md`: setup, tests, build, PR, or development flow guidance.
- `CODE_OF_CONDUCT.md`: expected or unacceptable behavior plus enforcement guidance.
- `SECURITY.md`: private reporting instructions through email or GitHub Private Vulnerability Reporting.
- `.github/FUNDING.yml`: real sponsorship configuration without placeholders, using supported GitHub funding keys such as `github`, `patreon`, `open_collective`, `ko_fi`, `liberapay`, or `custom`.
- `.github/ISSUE_TEMPLATE`: directory with useful `.yml`, `.yaml`, or `.md` templates.
- `.github/PULL_REQUEST_TEMPLATE.md`: checklist or sections for summary, tests, docs, or risk.

README section checks support English and Spanish headings, ignore headings inside fenced code blocks, and can run in strict mode. Heading detection allows practical prefixes such as `Installation guide`, `Usage examples`, `Guia de instalacion`, and `Como usar RepoPulse`.

## Inputs

| Input             | Required | Default | Description                                                                            |
| ----------------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| `min-score`       | No       | `70`    | Minimum acceptable score from 0 to 100. Accepts normal decimal values only.            |
| `strict-mode`     | No       | `false` | Requires stricter validation. README sections must be real Markdown headings.          |
| `fail-on-missing` | No       | `true`  | If `false`, RepoPulse reports failures but does not fail the workflow for a low score. |
| `format`          | No       | `text`  | Main log format: `text`, `markdown`, or `json`.                                        |
| `exclude-checks`  | No       | empty   | Comma-separated check IDs to exclude, for example `funding,code-of-conduct`.           |
| `readme-language` | No       | `auto`  | README heading language: `auto`, `en`, or `es`.                                        |
| `custom-weights`  | No       | empty   | JSON object that overrides weights by check ID, for example `{"funding":0}`.           |
| `job-summary`     | No       | `true`  | Writes a Markdown report to the GitHub Actions job summary when available.             |

## Outputs

| Output        | Description                                           |
| ------------- | ----------------------------------------------------- |
| `score`       | Calculated health score from 0 to 100.                |
| `passed`      | `true` when `score >= min-score`.                     |
| `warnings`    | Newline-separated warnings with check IDs.            |
| `json`        | Structured JSON report for downstream workflow steps. |
| `report-json` | Alias for `json`.                                     |

Example downstream usage:

```yaml
- name: Audit repository health
  id: repopulse
  uses: Milborne/RepoPulse@v1

- name: Use JSON output
  run: echo '${{ fromJson(steps.repopulse.outputs.json).score }}'
```

## Example Output

```text
RepoPulse Open Source Health Audit
Score: 84/100 (minimum: 80) PASS
Mode: standard | Format: text | Fail on missing: true

Repository files
  [PASS] readme - README.md (12/12) - Found non-empty README.md
  [PASS] license - LICENSE (10/10) - Recognized MIT license
  [MISS] security - SECURITY.md (0/7) - SECURITY.md lacks a private reporting channel

README sections
  [PASS] readme-installation - Installation (8/8) - Section heading detected
  [MISS] readme-funding - Sponsors or Funding (0/8) - Section missing

Recommendations
  - Add SECURITY.md with private vulnerability reporting instructions, such as an email address or GitHub Private Vulnerability Reporting.
  - Add a Sponsors or Funding section, or exclude this check when sponsorship does not apply.
```

## Job Summary

When `job-summary` is enabled and `$GITHUB_STEP_SUMMARY` exists, RepoPulse writes a Markdown summary with:

- score and pass/fail status;
- configuration used;
- a table of checks;
- warnings;
- recommendations.

Local execution does not require `$GITHUB_STEP_SUMMARY` and will not fail if the variable is absent.

## Scoring

RepoPulse keeps a 0 to 100 scale. The default weights are:

- repository files: 60 points;
- README sections: 40 points.

Excluded checks are removed from both earned points and maximum points, so exclusions do not unfairly lower the score. Custom weights also recalculate the maximum dynamically.

Check status semantics:

- `PASS`: the check passed and earns its points.
- `MISS`: the check failed and earns no points.
- `WARN`: the check needs maintainer review but keeps its points. This is used for non-blocking signals, such as an unknown custom license.
- `SKIP`: the check was excluded and is removed from the maximum possible score.

A repository can therefore have a score of 100 with warnings when all warnings are non-blocking review items.

Available check IDs:

```text
readme
license
contributing
code-of-conduct
security
funding
issue-template
pull-request-template
readme-installation
readme-usage
readme-contributing
readme-license
readme-funding
```

If sponsorship does not apply to a project, exclude the funding checks:

```yaml
with:
  exclude-checks: funding,readme-funding
```

## Strict Mode

Default mode allows useful signals such as `npm install` to satisfy the installation section check. Strict mode requires README sections to be real Markdown headings:

```yaml
with:
  strict-mode: true
```

## Local Development

```bash
npm ci
npm run lint
npm run format:check
npm test
npm run build
```

The build command type-checks the TypeScript source and bundles the action into `dist/index.js`. Commit `dist/index.js` whenever `src` changes.

## Release Process

1. Update source, tests, docs, and `CHANGELOG.md`.
2. Run `npm ci`, `npm run check`, and `npm audit --audit-level=moderate`.
3. Run `npm run build`.
4. Confirm `git diff --exit-code dist/index.js`.
5. Commit the release changes.
6. Create an immutable tag such as `v1.0.2`.
7. Move the major tag, for example `v1`, to the latest compatible release.
8. Publish a GitHub release from the immutable tag.

Marketplace note: GitHub Marketplace requires the action repository used for publication to not contain workflow files. This repository keeps CI in `.github/workflows` for maintainability. To publish in Marketplace, create the Marketplace release from a release branch or mirror that omits `.github/workflows` while preserving `action.yml`, `dist/index.js`, docs, and required project files.

## Troubleshooting

- `Invalid type`: the path exists but is a file when RepoPulse expected a directory, or the reverse.
- `Placeholder detected`: replace sample values such as `your-username`, `TODO`, or `example`.
- Low score after exclusions: check that IDs in `exclude-checks` match the documented check IDs.
- JSON parsing errors: ensure `custom-weights` is valid JSON, for example `{"funding":0}`.

## Limitations

RepoPulse is a heuristic open source health check. It does not guarantee legal compliance, does not replace a real security review, and may produce false positives or false negatives. It intentionally avoids network calls and paid services, so it only evaluates local repository content.

## Contributing

Contributions are welcome. Read CONTRIBUTING.md for local setup, testing expectations, and release guidance.

## Sponsors or Funding

RepoPulse uses GitHub Sponsors metadata in `.github/FUNDING.yml`. Projects that do not accept sponsorship can exclude funding checks.

## Security

Please read SECURITY.md before reporting vulnerabilities.

## License

RepoPulse is released under the MIT License. See LICENSE for details.
