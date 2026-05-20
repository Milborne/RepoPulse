import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditRepository } from "../src/audit";

const createdDirectories: string[] = [];

describe("auditRepository", () => {
  afterEach(async () => {
    await Promise.all(createdDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("returns a perfect score when all files and README sections are present", async () => {
    const repositoryPath = await createRepository({
      files: {
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
        "LICENSE": "MIT",
        "CONTRIBUTING.md": "# Contributing",
        "CODE_OF_CONDUCT.md": "# Code of Conduct",
        "SECURITY.md": "# Security",
        ".github/FUNDING.yml": "github: [TU_USUARIO_GITHUB]",
        ".github/PULL_REQUEST_TEMPLATE.md": "## Checklist"
      },
      directories: [".github/ISSUE_TEMPLATE"]
    });

    const result = await auditRepository(repositoryPath);

    expect(result.score).toBe(100);
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
    expect(result.warnings).toContain("Missing file: LICENSE");
    expect(result.warnings).toContain("README.md missing section: Usage");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("scores zero when README.md and community files are absent", async () => {
    const repositoryPath = await createRepository();

    const result = await auditRepository(repositoryPath);

    expect(result.score).toBe(0);
    expect(result.warnings).toContain("Missing file: README.md");
    expect(result.warnings).toContain("README.md missing section: Installation");
  });
});

async function createRepository(options: { files?: Record<string, string>; directories?: string[] } = {}): Promise<string> {
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

