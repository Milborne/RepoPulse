import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditRepository } from "../src/audit";
import { parseActionConfig } from "../src/config";

const createdDirectories: string[] = [];

describe("auditRepository", () => {
  afterEach(async () => {
    await Promise.all(
      createdDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it("returns a perfect score when all files and README sections are useful", async () => {
    const repositoryPath = await createHealthyRepository();

    const result = await auditRepository(repositoryPath);

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("reports missing community files and README sections", async () => {
    const repositoryPath = await createRepository({
      files: {
        "README.md": "# Minimal Project\n\nNo sections yet."
      }
    });

    const result = await auditRepository(repositoryPath);

    expect(result.score).toBe(12);
    expect(result.warnings).toContain("[license] Missing");
    expect(result.warnings).toContain("[readme-usage] Section missing");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("scores zero when README.md and community files are absent", async () => {
    const repositoryPath = await createRepository();

    const result = await auditRepository(repositoryPath);

    expect(result.score).toBe(0);
    expect(result.warnings).toContain("[readme] Missing");
    expect(result.warnings).toContain("[readme-installation] README.md missing");
  });

  it("detects a file check path that is actually a directory", async () => {
    const repositoryPath = await createRepository({
      directories: ["README.md"]
    });

    const result = await auditRepository(repositoryPath);
    const readme = result.checks.find((check) => check.id === "readme");

    expect(readme?.passed).toBe(false);
    expect(readme?.detail).toBe("Invalid type: expected file, found directory");
  });

  it("detects a directory check path that is actually a file", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        ".github/ISSUE_TEMPLATE": "not a directory"
      },
      directories: [],
      omit: [".github/ISSUE_TEMPLATE/bug_report.yml"]
    });

    const result = await auditRepository(repositoryPath);
    const issueTemplate = result.checks.find((check) => check.id === "issue-template");

    expect(issueTemplate?.passed).toBe(false);
    expect(issueTemplate?.detail).toBe("Invalid type: expected directory, found file");
  });

  it("fails empty files", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        "CONTRIBUTING.md": ""
      }
    });

    const result = await auditRepository(repositoryPath);
    const contributing = result.checks.find((check) => check.id === "contributing");

    expect(contributing?.passed).toBe(false);
    expect(contributing?.detail).toBe("Empty CONTRIBUTING.md");
  });

  it("rejects placeholder funding configuration", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        ".github/FUNDING.yml": "github: [TU_USUARIO_GITHUB]"
      }
    });

    const result = await auditRepository(repositoryPath);
    const funding = result.checks.find((check) => check.id === "funding");

    expect(funding?.passed).toBe(false);
    expect(funding?.detail).toBe("Placeholder detected in FUNDING.yml");
  });

  it("rejects SECURITY.md without a private reporting channel", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        "SECURITY.md": "# Security\n\nOpen a public issue for security problems."
      }
    });

    const result = await auditRepository(repositoryPath);
    const security = result.checks.find((check) => check.id === "security");

    expect(security?.passed).toBe(false);
    expect(security?.detail).toBe("SECURITY.md lacks a private reporting channel");
  });

  it("recognizes MIT license text", async () => {
    const repositoryPath = await createHealthyRepository();

    const result = await auditRepository(repositoryPath);
    const license = result.checks.find((check) => check.id === "license");

    expect(license?.status).toBe("pass");
    expect(license?.detail).toBe("Recognized MIT license");
  });

  it("treats unknown non-empty licenses as warnings without removing points", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        LICENSE: "Custom community license text with enough content to be reviewed by maintainers."
      }
    });

    const result = await auditRepository(repositoryPath);
    const license = result.checks.find((check) => check.id === "license");

    expect(license?.status).toBe("warning");
    expect(license?.earned).toBe(10);
    expect(result.warnings).toContain("[license] LICENSE is present but no common license was recognized");
  });

  it("detects README sections in Spanish", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        "README.md": [
          "# Proyecto Saludable",
          "",
          "## Instalación",
          "npm install",
          "",
          "## Uso",
          "Usa esta acción en un workflow.",
          "",
          "## Contribuir",
          "Lee CONTRIBUTING.md.",
          "",
          "## Licencia",
          "MIT",
          "",
          "## Patrocinadores",
          "Apoya el proyecto."
        ].join("\n")
      }
    });

    const result = await auditRepository(repositoryPath, parseActionConfig({ readmeLanguage: "es" }));

    expect(result.readmeSections.every((check) => check.passed)).toBe(true);
  });

  it("ignores README headings inside fenced code blocks in strict mode", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        "README.md": [
          "# Project",
          "",
          "```md",
          "## Usage",
          "```",
          "",
          "## Installation",
          "## Contributing",
          "## License",
          "## Funding"
        ].join("\n")
      }
    });

    const result = await auditRepository(repositoryPath, parseActionConfig({ strictMode: "true" }));
    const usage = result.readmeSections.find((check) => check.id === "readme-usage");

    expect(usage?.passed).toBe(false);
    expect(usage?.detail).toBe("Section missing");
  });

  it("uses install commands as loose README installation signals outside strict mode", async () => {
    const repositoryPath = await createHealthyRepository({
      files: {
        "README.md": [
          "# Project",
          "",
          "pnpm install",
          "",
          "## Usage",
          "## Contributing",
          "## License",
          "## Funding"
        ].join("\n")
      }
    });

    const result = await auditRepository(repositoryPath);
    const installation = result.readmeSections.find((check) => check.id === "readme-installation");

    expect(installation?.passed).toBe(true);
    expect(installation?.detail).toBe("Section signal detected");
  });

  it("excludes checks and recalculates the score over the remaining maximum", async () => {
    const repositoryPath = await createHealthyRepository({
      omit: [".github/FUNDING.yml"]
    });

    const withoutExclusion = await auditRepository(repositoryPath);
    const withExclusion = await auditRepository(
      repositoryPath,
      parseActionConfig({ excludeChecks: "funding,readme-funding" })
    );

    expect(withoutExclusion.score).toBeLessThan(100);
    expect(withExclusion.score).toBe(100);
    expect(withExclusion.checks.find((check) => check.id === "funding")?.status).toBe("excluded");
  });

  it("applies custom weights dynamically", async () => {
    const repositoryPath = await createHealthyRepository({
      omit: [".github/FUNDING.yml"]
    });

    const result = await auditRepository(
      repositoryPath,
      parseActionConfig({ customWeights: '{"funding":0}' })
    );

    expect(result.maxPoints).toBe(95);
    expect(result.score).toBe(100);
  });

  it("defaults to 100 with a configuration warning when all checks are excluded", async () => {
    const repositoryPath = await createRepository();
    const result = await auditRepository(
      repositoryPath,
      parseActionConfig({
        excludeChecks: [
          "readme",
          "license",
          "contributing",
          "code-of-conduct",
          "security",
          "funding",
          "issue-template",
          "pull-request-template",
          "readme-installation",
          "readme-usage",
          "readme-contributing",
          "readme-license",
          "readme-funding"
        ].join(",")
      })
    );

    expect(result.score).toBe(100);
    expect(result.maxPoints).toBe(0);
    expect(result.warnings).toContain("[config] All checks were excluded; score defaults to 100.");
  });
});

async function createHealthyRepository(
  overrides: {
    files?: Record<string, string>;
    directories?: string[];
    omit?: string[];
  } = {}
): Promise<string> {
  const files: Record<string, string> = {
    "README.md": [
      "# Healthy Project",
      "",
      "## Installation",
      "npm install",
      "",
      "## Usage",
      "Use this action in a workflow.",
      "",
      "## Contributing",
      "See CONTRIBUTING.md.",
      "",
      "## License",
      "MIT",
      "",
      "## Funding",
      "Sponsor the project."
    ].join("\n"),
    LICENSE: [
      "MIT License",
      "",
      "Permission is hereby granted, free of charge, to any person obtaining a copy",
      "of this software and associated documentation files to deal in the Software without restriction."
    ].join("\n"),
    "CONTRIBUTING.md": [
      "# Contributing",
      "",
      "## Local setup",
      "npm install",
      "",
      "## Tests",
      "npm test",
      "",
      "## Build",
      "npm run build",
      "",
      "## Pull requests",
      "Open a PR with a clear development flow summary."
    ].join("\n"),
    "CODE_OF_CONDUCT.md": [
      "# Code of Conduct",
      "",
      "## Expected Behavior",
      "Be respectful.",
      "",
      "## Unacceptable Behavior",
      "No harassment.",
      "",
      "## Enforcement",
      "Maintainers enforce this policy."
    ].join("\n"),
    "SECURITY.md": [
      "# Security",
      "",
      "Please use GitHub Private Vulnerability Reporting to report vulnerabilities privately.",
      "Maintainers acknowledge reports within 7 days."
    ].join("\n"),
    ".github/FUNDING.yml": "github: [Milborne]",
    ".github/PULL_REQUEST_TEMPLATE.md": [
      "## Summary",
      "",
      "## Tests",
      "",
      "## Documentation",
      "",
      "## Risk",
      "",
      "- [ ] Tests were run."
    ].join("\n"),
    ".github/ISSUE_TEMPLATE/bug_report.yml": [
      "name: Bug report",
      "description: Report a reproducible problem.",
      "body:",
      "  - type: textarea",
      "    id: description"
    ].join("\n")
  };
  const directories = overrides.directories ?? [".github/ISSUE_TEMPLATE"];

  for (const filePath of overrides.omit ?? []) {
    delete files[filePath];
  }

  return createRepository({
    files: { ...files, ...(overrides.files ?? {}) },
    directories
  });
}

async function createRepository(
  options: { files?: Record<string, string>; directories?: string[] } = {}
): Promise<string> {
  const repositoryPath = await mkdtemp(path.join(tmpdir(), "repopulse-"));
  createdDirectories.push(repositoryPath);

  for (const directory of options.directories ?? []) {
    await mkdir(path.join(repositoryPath, directory), { recursive: true });
  }

  for (const [filePath, content] of Object.entries(options.files ?? {})) {
    const absoluteFilePath = path.join(repositoryPath, filePath);
    await mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await writeFile(absoluteFilePath, content, "utf8");
  }

  return repositoryPath;
}
