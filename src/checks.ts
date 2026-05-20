export type CheckCategory = "file" | "readme-section";

export interface AuditCheck {
  id: string;
  label: string;
  points: number;
  recommendation: string;
}

export interface FileAuditCheck extends AuditCheck {
  path: string;
}

export interface ReadmeSectionCheck extends AuditCheck {
  patterns: RegExp[];
}

export const FILE_CHECKS: FileAuditCheck[] = [
  {
    id: "readme",
    label: "README.md",
    path: "README.md",
    points: 12,
    recommendation: "Add a README.md that explains the project, setup, usage, contribution flow, license, and funding options."
  },
  {
    id: "license",
    label: "LICENSE",
    path: "LICENSE",
    points: 10,
    recommendation: "Add a LICENSE file so users know how they can use and distribute the project."
  },
  {
    id: "contributing",
    label: "CONTRIBUTING.md",
    path: "CONTRIBUTING.md",
    points: 7,
    recommendation: "Add CONTRIBUTING.md with local setup, test commands, and pull request expectations."
  },
  {
    id: "code-of-conduct",
    label: "CODE_OF_CONDUCT.md",
    path: "CODE_OF_CONDUCT.md",
    points: 7,
    recommendation: "Add CODE_OF_CONDUCT.md to set clear community behavior expectations."
  },
  {
    id: "security",
    label: "SECURITY.md",
    path: "SECURITY.md",
    points: 7,
    recommendation: "Add SECURITY.md with supported versions and vulnerability reporting instructions."
  },
  {
    id: "funding",
    label: ".github/FUNDING.yml",
    path: ".github/FUNDING.yml",
    points: 5,
    recommendation: "Add .github/FUNDING.yml so contributors can find sponsorship options."
  },
  {
    id: "issue-template",
    label: ".github/ISSUE_TEMPLATE",
    path: ".github/ISSUE_TEMPLATE",
    points: 6,
    recommendation: "Add issue templates to collect consistent bug reports and feature requests."
  },
  {
    id: "pull-request-template",
    label: ".github/PULL_REQUEST_TEMPLATE.md",
    path: ".github/PULL_REQUEST_TEMPLATE.md",
    points: 6,
    recommendation: "Add a pull request template with checklist items for tests, docs, and risk."
  }
];

export const README_SECTION_CHECKS: ReadmeSectionCheck[] = [
  {
    id: "readme-installation",
    label: "Installation",
    points: 8,
    patterns: [
      headingPattern(["installation", "install", "setup", "getting started"]),
      /(?:npm|pnpm|yarn)\s+(?:install|add|ci)\b/i
    ],
    recommendation: "Add an Installation section that shows how to install or prepare the project."
  },
  {
    id: "readme-usage",
    label: "Usage",
    points: 8,
    patterns: [
      headingPattern(["usage", "use", "quickstart", "examples?", "how to use"])
    ],
    recommendation: "Add a Usage section with a realistic example."
  },
  {
    id: "readme-contributing",
    label: "Contributing",
    points: 8,
    patterns: [
      headingPattern(["contributing", "contribute", "development", "contributors?"])
    ],
    recommendation: "Add a Contributing section that links to CONTRIBUTING.md or explains the process."
  },
  {
    id: "readme-license",
    label: "License",
    points: 8,
    patterns: [
      headingPattern(["license", "licensing"])
    ],
    recommendation: "Add a License section that names the project license."
  },
  {
    id: "readme-funding",
    label: "Sponsors or Funding",
    points: 8,
    patterns: [
      headingPattern(["sponsors?", "funding", "support", "donate", "sponsoring"])
    ],
    recommendation: "Add a Sponsors or Funding section that explains how users can support the project."
  }
];

function headingPattern(names: string[]): RegExp {
  return new RegExp(String.raw`(^|\n)\s{0,3}#{1,6}\s*(?:${names.join("|")})(?:\s|$|[#:` + "`" + String.raw`])`, "i");
}

