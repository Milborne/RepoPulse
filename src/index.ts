import * as core from "@actions/core";
import { auditRepository } from "./audit";
import { parseMinScore } from "./config";
import { formatReport } from "./report";

export async function run(): Promise<void> {
  try {
    const minScore = parseMinScore(core.getInput("min-score"));
    const repositoryPath = process.env.GITHUB_WORKSPACE || process.cwd();
    const result = await auditRepository(repositoryPath);
    const passed = result.score >= minScore;

    core.info(formatReport(result, minScore, { colors: true }));
    result.warnings.forEach((warning) => core.warning(warning));

    core.setOutput("score", String(result.score));
    core.setOutput("passed", String(passed));
    core.setOutput("warnings", result.warnings.join("\n"));

    if (!passed) {
      core.setFailed(`RepoPulse score ${result.score} is below min-score ${minScore}.`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void run();

