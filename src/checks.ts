export type CheckCategory = "file" | "readme-section";

export type ExpectedPathType = "file" | "directory" | "file-or-directory";

export interface AuditCheckDefinition {
  id: string;
  category: CheckCategory;
  label: string;
  points: number;
  recommendation: string;
  path?: string;
  expectedType?: ExpectedPathType;
}

export interface ReadmeSectionCheckDefinition extends AuditCheckDefinition {
  category: "readme-section";
  headings: {
    en: string[];
    es: string[];
  };
  loosePatterns?: RegExp[];
}

export const FILE_CHECKS: AuditCheckDefinition[] = [
  {
    id: "readme",
    category: "file",
    label: "README.md",
    path: "README.md",
    expectedType: "file",
    points: 12,
    recommendation:
      "Add a non-empty README.md that explains setup, usage, contribution flow, license, and funding or sponsorship options."
  },
  {
    id: "license",
    category: "file",
    label: "LICENSE",
    path: "LICENSE",
    expectedType: "file",
    points: 10,
    recommendation:
      "Add a non-empty LICENSE file with a recognizable open source license such as MIT, Apache-2.0, GPL, BSD, ISC, or MPL."
  },
  {
    id: "contributing",
    category: "file",
    label: "CONTRIBUTING.md",
    path: "CONTRIBUTING.md",
    expectedType: "file",
    points: 7,
    recommendation:
      "Add CONTRIBUTING.md with setup, test/build commands, development flow, and pull request expectations."
  },
  {
    id: "code-of-conduct",
    category: "file",
    label: "CODE_OF_CONDUCT.md",
    path: "CODE_OF_CONDUCT.md",
    expectedType: "file",
    points: 7,
    recommendation:
      "Add CODE_OF_CONDUCT.md with expected behavior, unacceptable behavior, and enforcement guidance."
  },
  {
    id: "security",
    category: "file",
    label: "SECURITY.md",
    path: "SECURITY.md",
    expectedType: "file",
    points: 7,
    recommendation:
      "Add SECURITY.md with private vulnerability reporting instructions, such as an email address or GitHub Private Vulnerability Reporting."
  },
  {
    id: "funding",
    category: "file",
    label: ".github/FUNDING.yml",
    path: ".github/FUNDING.yml",
    expectedType: "file",
    points: 5,
    recommendation:
      "Add .github/FUNDING.yml with real sponsorship handles, or exclude the funding check when sponsorship does not apply."
  },
  {
    id: "issue-template",
    category: "file",
    label: ".github/ISSUE_TEMPLATE",
    path: ".github/ISSUE_TEMPLATE",
    expectedType: "directory",
    points: 6,
    recommendation:
      "Add at least one useful issue template in .github/ISSUE_TEMPLATE using .yml, .yaml, or .md."
  },
  {
    id: "pull-request-template",
    category: "file",
    label: ".github/PULL_REQUEST_TEMPLATE.md",
    path: ".github/PULL_REQUEST_TEMPLATE.md",
    expectedType: "file",
    points: 6,
    recommendation:
      "Add a pull request template with summary, tests, documentation, checklist, or risk sections."
  }
];

export const README_SECTION_CHECKS: ReadmeSectionCheckDefinition[] = [
  {
    id: "readme-installation",
    category: "readme-section",
    label: "Installation",
    points: 8,
    headings: {
      en: ["installation", "install", "setup", "getting started"],
      es: ["instalacion", "instalación", "configuracion", "configuración", "primeros pasos"]
    },
    loosePatterns: [/\b(?:npm|pnpm|yarn)\s+(?:install|add|ci)\b/i],
    recommendation: "Add an Installation section with setup or install commands."
  },
  {
    id: "readme-usage",
    category: "readme-section",
    label: "Usage",
    points: 8,
    headings: {
      en: ["usage", "use", "quickstart", "quick start", "examples?", "how to use"],
      es: [
        "uso",
        "uso rapido",
        "uso rápido",
        "inicio rapido",
        "inicio rápido",
        "ejemplos?",
        "como usar",
        "cómo usar"
      ]
    },
    recommendation: "Add a Usage section with a realistic workflow or command example."
  },
  {
    id: "readme-contributing",
    category: "readme-section",
    label: "Contributing",
    points: 8,
    headings: {
      en: ["contributing", "contribute", "development", "contributors?"],
      es: ["contribuir", "contribucion", "contribución", "desarrollo", "colaboradores?"]
    },
    recommendation: "Add a Contributing section that links to CONTRIBUTING.md or explains the process."
  },
  {
    id: "readme-license",
    category: "readme-section",
    label: "License",
    points: 8,
    headings: {
      en: ["license", "licensing"],
      es: ["licencia", "licenciamiento"]
    },
    recommendation: "Add a License section that names the project license."
  },
  {
    id: "readme-funding",
    category: "readme-section",
    label: "Sponsors or Funding",
    points: 8,
    headings: {
      en: ["sponsors?", "funding", "sponsors or funding", "sponsorship", "support", "donate", "sponsoring"],
      es: ["patrocinadores?", "financiacion", "financiación", "apoyo", "donar", "patrocinar"]
    },
    recommendation:
      "Add a Sponsors or Funding section, or exclude this check when sponsorship does not apply."
  }
];

export const ALL_CHECKS: AuditCheckDefinition[] = [...FILE_CHECKS, ...README_SECTION_CHECKS];

export const ALL_CHECK_IDS = ALL_CHECKS.map((check) => check.id);
