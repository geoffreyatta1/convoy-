/**
 * setup-branch-protection.ts
 *
 * Applies GitHub branch protection rules to the `main` branch of this repo.
 *
 * Usage:
 *   GITHUB_TOKEN=<pat> pnpm --filter @workspace/scripts run setup-branch-protection
 *
 * The token needs `repo` scope (or `public_repo` for public repos).
 *
 * To verify the current protection state afterwards:
 *   GITHUB_TOKEN=<pat> pnpm --filter @workspace/scripts run verify-branch-protection
 */

const OWNER = "geoffreyatta1";
const REPO = "convoy-";
const BRANCH = "main";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("Error: GITHUB_TOKEN environment variable is required.");
  process.exit(1);
}

const baseUrl = `https://api.github.com/repos/${OWNER}/${REPO}`;

async function githubRequest(
  path: string,
  method: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function applyBranchProtection(): Promise<void> {
  console.log(`Applying branch protection to ${OWNER}/${REPO}:${BRANCH} …`);

  const protectionRules = {
    required_status_checks: {
      strict: true,
      checks: [
        { context: "Type Check", app_id: null },
      ],
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true,
      required_approving_review_count: 1,
    },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    required_conversation_resolution: false,
  };

  const { status, data } = await githubRequest(
    `/branches/${BRANCH}/protection`,
    "PUT",
    protectionRules
  );

  if (status === 200) {
    console.log("Branch protection applied successfully.\n");
    console.log("Active rules:");
    const d = data as Record<string, unknown>;
    const checks = (d.required_status_checks as Record<string, unknown>)?.checks as Array<{ context: string }>;
    const reviews = d.required_pull_request_reviews as Record<string, unknown>;
    const admins = d.enforce_admins as Record<string, unknown>;
    const forcePush = d.allow_force_pushes as Record<string, unknown>;
    console.log(`  Required status checks  : ${checks?.map((c) => c.context).join(", ") ?? "none"}`);
    console.log(`  Strict (up-to-date)     : ${((d.required_status_checks as Record<string, unknown>)?.strict as boolean) ? "yes" : "no"}`);
    console.log(`  Required PR approvals   : ${reviews?.required_approving_review_count ?? 0}`);
    console.log(`  Dismiss stale reviews   : ${reviews?.dismiss_stale_reviews ? "yes" : "no"}`);
    console.log(`  Code-owner review       : ${reviews?.require_code_owner_reviews ? "yes" : "no"}`);
    console.log(`  Enforce for admins      : ${(admins?.enabled as boolean) ? "yes" : "no"}`);
    console.log(`  Allow force pushes      : ${(forcePush?.enabled as boolean) ? "yes" : "no"}`);
  } else {
    console.error(`Failed to apply branch protection (HTTP ${status}):`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

async function verifyBranchProtection(): Promise<void> {
  console.log(`Verifying branch protection for ${OWNER}/${REPO}:${BRANCH} …\n`);

  const { status, data } = await githubRequest(
    `/branches/${BRANCH}/protection`,
    "GET"
  );

  if (status === 200) {
    const d = data as Record<string, unknown>;
    const checks = (d.required_status_checks as Record<string, unknown>)?.checks as Array<{ context: string }>;
    const reviews = d.required_pull_request_reviews as Record<string, unknown>;
    const admins = d.enforce_admins as Record<string, unknown>;
    const forcePush = d.allow_force_pushes as Record<string, unknown>;
    const deletions = d.allow_deletions as Record<string, unknown>;

    const pass = (label: string, ok: boolean) =>
      console.log(`  ${ok ? "✓" : "✗"} ${label}`);

    pass(
      `Required status check "Type Check" present`,
      checks?.some((c) => c.context === "Type Check") ?? false
    );
    pass(
      `Strict mode (branch must be up to date)`,
      !!((d.required_status_checks as Record<string, unknown>)?.strict)
    );
    pass(
      `At least 1 required approving review`,
      ((reviews?.required_approving_review_count as number) ?? 0) >= 1
    );
    pass(`Stale reviews dismissed`, !!reviews?.dismiss_stale_reviews);
    pass(`Code-owner review required`, !!reviews?.require_code_owner_reviews);
    pass(`Enforced for admins`, !!(admins?.enabled));
    pass(`Force pushes blocked`, !(forcePush?.enabled));
    pass(`Branch deletion blocked`, !(deletions?.enabled));
  } else if (status === 404) {
    console.error("No branch protection found. Run the setup script first.");
    process.exit(1);
  } else {
    console.error(`Unexpected response (HTTP ${status}):`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
}

export {};

const command = process.argv[2];

if (command === "verify") {
  await verifyBranchProtection();
} else {
  await applyBranchProtection();
}
