# RepoPulse

RepoPulse is a GitHub Action that audits the open source health of a repository. It checks for key community files, reviews README.md for essential sections, calculates a score from 0 to 100, and fails the workflow when the score is below your configured minimum.

It runs locally inside GitHub Actions with Node.js. It does not call paid APIs or external services.

## What RepoPulse Checks

RepoPulse verifies that these files or folders exist:

- README.md
- LICENSE
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md
- .github/FUNDING.yml
- .github/ISSUE_TEMPLATE
- .github/PULL_REQUEST_TEMPLATE.md

RepoPulse also scans README.md for sections similar to:

- Installation
- Usage
- Contributing
- License
- Sponsors or Funding

## Installation

For local development, install dependencies with npm:

```bash
npm install
```

For GitHub Actions usage, reference the action from a workflow after publishing it to GitHub:

```yaml
uses: your-github-user/RepoPulse@v1
```

## Usage

Create `.github/workflows/repopulse.yml` in the repository you want to audit:

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
        uses: actions/checkout@v4

      - name: Audit repository health
        uses: your-github-user/RepoPulse@v1
        with:
          min-score: 80
```

## Example Output

```text
RepoPulse Open Source Health Audit
Score: 84/100 (minimum: 80) PASS

Repository files
  [PASS] README.md (12/12) - Found
  [PASS] LICENSE (10/10) - Found
  [MISS] SECURITY.md (0/7) - Missing

README sections
  [PASS] Installation (8/8) - Section detected
  [PASS] Usage (8/8) - Section detected
  [MISS] Sponsors or Funding (0/8) - Section missing

Recommendations
  - Add SECURITY.md with supported versions and vulnerability reporting instructions.
  - Add a Sponsors or Funding section that explains how users can support the project.
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `min-score` | No | `70` | Minimum acceptable score from 0 to 100. The action fails when the calculated score is lower. |

## Outputs

| Output | Description |
| --- | --- |
| `score` | Calculated repository health score. |
| `passed` | `true` when the score is greater than or equal to `min-score`. |
| `warnings` | Newline-separated warning messages found during the audit. |

## Scoring

RepoPulse uses a 100 point scale:

- Repository files: 60 points.
- README.md sections: 40 points.

Each missing file or section subtracts its weighted value from the final score.

## Local Development

```bash
npm install
npm test
npm run build
```

The build command type-checks the TypeScript source and bundles the action into `dist/index.js`.

## Roadmap

- Add configurable check weights.
- Support optional strict mode for exact README headings.
- Emit a Markdown job summary.
- Add JSON output for downstream workflow steps.
- Add more community health checks while keeping the action offline and deterministic.

## Contributing

Contributions are welcome. Read CONTRIBUTING.md for local setup, testing expectations, and pull request guidance.

## Sponsors or Funding

You can sponsor the project by configuring `.github/FUNDING.yml` with your GitHub Sponsors username:

```yaml
github: [TU_USUARIO_GITHUB]
```

## Security

Please read SECURITY.md before reporting vulnerabilities.

## License

RepoPulse is released under the MIT License. See LICENSE for details.
