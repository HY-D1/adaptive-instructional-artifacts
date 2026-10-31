import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("post-survey link contrast", () => {
  it("uses a high-contrast button treatment in both themes", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/web/src/app/components/features/surveys/SurveyInvitationLinks.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("bg-red-700");
    expect(source).toContain("text-white");
    expect(source).toContain("hover:bg-red-800");
    expect(source).toContain("focus-visible:ring-2");
    expect(source).toContain("dark:focus-visible:ring-red-300");
  });
});
