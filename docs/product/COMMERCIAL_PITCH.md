# Commercial Pitch — Coder by DevAscend

## Product Name & Tagline

**Coder by DevAscend**
_AI change control for software teams — every agent action, risk-checked, gated, and audited before it ships._

---

## Value Proposition

Coder by DevAscend gives software teams a governance layer that sits between their AI coding agents and production. Every task an AI agent performs is automatically risk-scored against configurable policy gates, flagged for human review when needed, and logged in a tamper-evident audit trail — so teams can ship faster with AI without losing control over what actually changes in their codebase.

Unlike raw AI tools that produce output with no oversight, Coder by DevAscend turns every AI interaction into a recorded, reviewable, auditable decision — making it safe for teams to delegate meaningful development work to AI agents even in regulated or high-risk environments.

---

## Target Customers

**Primary:** Software engineering teams (5–200 engineers) that actively use AI coding tools (Claude, Codex, Cursor, GitHub Copilot) and are hitting governance, compliance, or trust problems as they scale AI usage.

**Secondary:** Engineering leaders, CTOs, and VPs of Engineering at growth-stage and enterprise companies who need to answer the question: "How do we know what the AI actually changed, and who approved it?"

**Verticals with strongest fit:**
- FinTech and payments (SOC 2, PCI-DSS, audit requirements)
- Healthcare software (HIPAA, change control obligations)
- SaaS companies with enterprise customers demanding security reviews
- Any team with a production environment they can't afford to break

---

## 5 Key Differentiators

1. **Policy gates, not just logging.** Coder actively blocks or holds risky AI actions before they ship — not just records them after the fact. Every task goes through a risk evaluation pipeline that can approve, flag for senior review, or block based on environment, risk level, and configurable rules.

2. **Full audit trail by default.** Every AI prompt, every agent response, every human approval decision, and every PR merge is recorded in a chronological, immutable governance timeline. Nothing falls through the cracks.

3. **Works with any AI tool.** Coder is AI-tool agnostic — teams paste prompts into Claude, Codex, Cursor, or any other agent and paste responses back. No vendor lock-in, no deep integrations required.

4. **GitHub PR intelligence built in.** Import your entire PR history to immediately understand change patterns, CI failure rates, and risk distribution across your repositories — without instrumenting your CI pipeline.

5. **Built for teams, not just individuals.** Role-based access, approval workflows, team scoreboards, and client-facing report generation make Coder suitable for teams that need to demonstrate governance to external stakeholders, not just internal tracking.

---

## Pricing Model

**SaaS, per-seat subscription.**

- **Starter** (free tier): 1 user, 1 project, 25 tasks/month — for individual developers evaluating the platform.
- **Team** (~$X/seat/month): Unlimited projects and tasks, full audit log, policy gates, GitHub PR import, team approval workflows.
- **Enterprise** (custom): SSO, custom policy rules, dedicated support, SLA, compliance report generation, on-premise deployment option.

_Note: Exact pricing not yet validated against market. Recommend pricing discovery interviews with 10 target customers before setting final numbers._

---

## Current Limitations (Honest Assessment)

- **No direct agent integration yet.** Users must manually copy-paste prompts and responses. Direct API integration with Claude, Codex, or GitHub Copilot would dramatically improve the workflow.
- **Single-org, single-tenant.** The current data model does not support multi-tenancy out of the box. Each deployment is for one organization.
- **LLM calls are optional / stubbed in demo mode.** Full AI-powered risk analysis requires a real LLM API key; teams on free hosting may use stub evaluations.
- **GitHub is the only VCS integration.** GitLab, Bitbucket, and Azure DevOps are not supported.
- **No mobile experience.** The UI is desktop-optimized; mobile workflows are not tested or supported.
- **Policy rules are not yet user-configurable via UI.** Risk rules are configured in code; a policy rule editor UI is planned but not built.
- **No SSO / SAML yet.** Authentication is username/password or disabled. Enterprise teams typically require SSO.

---

## What's Needed Before Commercial Launch

### Must-Have
- [ ] Direct agent API integration (at minimum a webhook/API endpoint to receive agent output programmatically, eliminating manual copy-paste)
- [ ] Multi-tenant architecture or tenant-scoped deployment automation
- [ ] SSO / SAML support (Okta, Google Workspace, Azure AD)
- [ ] User-configurable policy gate rules (UI editor, not code-only)
- [ ] Pricing page and self-serve signup flow
- [ ] Privacy policy and terms of service
- [ ] Data export / data deletion (GDPR compliance)
- [ ] Production hardening: rate limiting, input sanitisation audit, pen test

### Should-Have Before GA
- [ ] GitLab PR import support
- [ ] Slack / Teams notifications for policy gate decisions
- [ ] Customer-facing onboarding email sequence
- [ ] In-app guided onboarding tour (beyond static Getting Started page)
- [ ] Usage-based billing instrumentation
- [ ] SOC 2 Type I readiness assessment

### Nice-to-Have
- [ ] Mobile-responsive UI
- [ ] GitHub Actions / CI integration for automatic PR import
- [ ] Custom LLM provider configuration per workspace
- [ ] White-label / custom domain support for enterprise
