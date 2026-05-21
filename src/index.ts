import * as core from "@actions/core";
import { auditRepository } from "./audit";
import { parseActionConfig } from "./config";
import {
  formatJsonReport,
  formatMarkdownReport,
  formatTextReport,
  toJsonReport,
  writeMarkdownSummary
} from "./report";

export async function run(): Promise<void> {
  try {
    const config = parseActionConfig({
      minScore: core.getInput("min-score"),
      strictMode: core.getInput("strict-mode"),
      failOnMissing: core.getInput("fail-on-missing"),
      format: core.getInput("format"),
      excludeChecks: core.getInput("exclude-checks"),
      readmeLanguage: core.getInput("readme-language"),
      customWeights: core.getInput("custom-weights"),
      jobSummary: core.getInput("job-summary")
    });
    const repositoryPath = process.env.GITHUB_WORKSPACE || process.cwd();
    const result = await auditRepository(repositoryPath, config);
    const jsonReport = JSON.stringify(toJsonReport(result));

    core.info(formatActionLog(result));
    result.warnings.forEach((warning) => core.warning(warning));

    core.setOutput("score", String(result.score));
    core.setOutput("passed", String(result.passed));
    core.setOutput("warnings", result.warnings.join("\n"));
    core.setOutput("json", jsonReport);
    core.setOutput("report-json", jsonReport);

    if (config.jobSummary) {
      const summaryWritten = await writeMarkdownSummary(process.env.GITHUB_STEP_SUMMARY, result);
      if (!summaryWritten && process.env.GITHUB_STEP_SUMMARY) {
        core.warning("RepoPulse could not write the GitHub Step Summary.");
      }
    }

    if (shouldFailWorkflow(result)) {
      core.setFailed(`RepoPulse score ${result.score} is below min-score ${config.minScore}.`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

export function shouldFailWorkflow(result: Awaited<ReturnType<typeof auditRepository>>): boolean {
  return !result.passed && result.config.failOnMissing;
}

function formatActionLog(result: Awaited<ReturnType<typeof auditRepository>>): string {
  switch (result.config.format) {
    case "markdown":
      return formatMarkdownReport(result);
    case "json":
      return formatJsonReport(result, true);
    case "text":
      return formatTextReport(result, { colors: true });
  }
}

if (require.main === module) {
  void run();
}
