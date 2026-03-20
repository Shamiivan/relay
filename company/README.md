# Company Context

`company/` holds company-specific operating context that should not live in root `workflows/`.

Use this directory for:

- company discovery docs
- positioning, ICP, and offer notes
- workflow prerequisites that depend on company context
- company-specific workflows under `company/workflows/`

Rules:

- keep reusable workflows in root `workflows/`
- keep company-specific workflows in `company/workflows/`
- give each company a home under `company/<name>/`
- start company-dependent workflows with a discovery phase that reads the relevant company docs before acting

Recommended shape:

- `company/<name>/README.md` for the company brief
- `company/<name>/discovery/` for deeper research if needed
- `company/workflows/<workflow>/README.md` for workflow-specific operating rules
