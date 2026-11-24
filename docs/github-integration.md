# Aurolis — GitHub Sync & Source Control

Aurolis is local-first. Your collections and environments live on your machine, and GitHub is an optional way to share them, keep history and review changes. You need nothing beyond the GitHub account you already have: no backend and no hosting.

---

## Source control tab

Open **Source control** from the left rail, just below Environments. It works like VS Code's Source Control panel, but it shows **API requests instead of file diffs**.

### Side panel

| Section | What it shows |
|---|---|
| **Message box** | Commit message. Press `Ctrl/⌘ Enter` to commit and push. Left empty, Aurolis writes one for you (e.g. `Update Create user`). |
| **Commit & push / Sync changes** | Commits your saved changes, or pulls incoming commits when you have nothing to commit. |
| **Unsaved** | Drafts that aren't saved yet. Only saved work is committed, so press `Ctrl/⌘ S` first. |
| **Changes** | Requests, environments, collections and folders that changed since the last commit, marked `A` (added), `M` (modified) or `D` (deleted). Hover a row to open it or discard it. |
| **Commits** | Commit graph with author, time and short SHA. Incoming commits are tagged `incoming`, and the current branch head is tagged with the branch name. |

### Main pane: API diff

Click a change to see what actually changed in the request:

- **Request:** name, method, URL, location (collection › folder), auth
- **Params / Headers:** a key-by-key table with added (+), removed (−) and changed (~) rows
- **Body:** a line diff of the pretty-printed JSON, text or form data
- **Examples:** saved examples that were added, removed or changed
- **Environments:** variable-by-variable diff, with secret values always masked

Switch between **Changes only** and **Full request** at the top right.

Click a commit in the graph to see every API change it contains, each with its before/after diff.

### Shortcuts

| Keys | Action |
|---|---|
| `Ctrl/⌘ S` | Save the current request or environment |
| `Ctrl/⌘ Shift S` | Save all |
| `Ctrl/⌘ Enter` (in the message box) | Commit & push |

> Push on save is **off** by default. Turn it on under Settings → GitHub sync to commit and push on every save.

---

## Repository structure

One repo is one workspace. Every request is its own file, so teammates editing different requests never conflict.

```
acme-api-workspace/
├── aurolis.json                      # marker: format version, workspace id/name, default env
├── README.md                         # generated, human-readable index
├── .gitignore                        # *.local.json, .aurolis/
├── .github/
│   └── CODEOWNERS                    # who must review which collection/env
├── collections/
│   └── payments-service/
│       ├── _collection.json          # id, name, description, auth, collection variables, seq
│       ├── create-payment.req.json   # one request per file
│       ├── create-payment.examples/
│       │   ├── 201-created-x7k2.json # one saved example per file
│       │   └── 402-declined-p9qa.json
│       └── refunds/
│           ├── _folder.json          # id, name, seq, folder-level auth
│           └── refund-payment.req.json
└── environments/
    ├── _globals.env.json
    ├── local.env.json
    ├── staging.env.json
    └── production.env.json           # secret keys listed, values always empty
```

### `aurolis.json`

```json
{
  "format": 1,
  "workspace": { "id": "ws_3k9d…", "name": "Acme API" },
  "defaultEnvironment": "local"
}
```

### Request file (`*.req.json`)

```json
{
  "id": "r_8f2c…",
  "name": "Create payment",
  "seq": 2000,
  "method": "POST",
  "url": "{{baseUrl}}/payments",
  "params": [],
  "headers": [{ "key": "Idempotency-Key", "value": "{{$uuid}}" }],
  "body": { "mode": "json", "raw": "{ \"amount\": 4200, \"currency\": \"INR\" }" },
  "auth": { "type": "inherit" }
}
```

### Environment file (`*.env.json`)

```json
{
  "id": "env_prod",
  "name": "Production",
  "variables": [
    { "key": "baseUrl", "value": "https://api.acme.com" },
    { "key": "apiKey",  "value": "", "secret": true }
  ]
}
```

---

## 1. Workspaces

- **Each workspace is one repository.** `aurolis.json` marks a repo as an Aurolis workspace, so the app can list your repos and show which ones are workspaces.
- **Personal workspace:** a private repo under your own GitHub account.
- **Team workspace:** a repo in your GitHub organization.
- **Branches work like normal git.** Switch branches in the app, commit, and open pull requests.
- **Monorepos:** a workspace can live under a subpath (`repo + branch + path`).
- **Never committed:** per-user state such as open tabs, theme, selected environment, history and load-test runs. It stays in `.aurolis/` or local storage.

## 2. Collections

- Each **collection** is a folder with a `_collection.json`.
- Each **folder** is a subfolder with a `_folder.json`.
- Each **request** is one `*.req.json` file.
- Each **example** is one file in `<request>.examples/`.
- Every item has a **stable `id`** that survives renames and moves, so history and diffs follow the request rather than the filename.
- Ordering uses a fractional **`seq`**, so reordering touches only the moved file.
- **Conflicts:**
  - Different requests never conflict.
  - When two people edit the same request, Aurolis runs a 3-way merge per field and asks only about the fields that really clash (*keep mine* / *take theirs*).

## 3. Environments (`env`)

| What | Where it lives |
|---|---|
| Shared, non-secret values (base URLs, tenant ids) | Committed in `environments/*.env.json` |
| Secret keys | Committed with **key only, empty value**, marked `"secret": true` |
| Your real secret values | `environments/*.local.json` (gitignored) or the OS keychain, merged in at runtime |
| Team-shared secrets (optional) | Encrypted with **sops/age** (keys per member), or a vault reference such as `{{vault:payments/stripe_key}}` |

- A plain-text secret never goes into git.
- Protect `production.env.json` with CODEOWNERS so changes need approval.

## 4. RBAC through GitHub

Aurolis stores **no roles of its own**. It reads the repo `permissions` from the GitHub API and maps them:

| GitHub role | In Aurolis |
|---|---|
| **Read** | Browse, send requests, run load tests locally. Cannot commit. |
| **Triage** | Same as Read (can manage PRs/issues on GitHub). |
| **Write** | Commit & push, create branches, open pull requests. |
| **Maintain / Admin** | Everything above, plus editing protected environments and repo settings. |

Use these GitHub features for access control:

- **Org teams:** grant access in bulk (e.g. `@acme/payments-team` gets Write on the payments workspace).
- **Branch protection:** when a direct push to `main` is blocked, Aurolis commits to a new branch and opens a PR automatically.
- **CODEOWNERS:** review rules per collection or environment:
  ```
  /collections/payments-service/        @acme/payments-team
  /environments/production.env.json     @acme/platform-leads
  ```
- **GitHub App:** Aurolis signs in through a GitHub App with fine-grained permissions (Contents, Pull requests, Metadata) instead of an OAuth token with the broad `repo` scope. Users choose exactly which repos Aurolis can access.

### Limitations

- GitHub can't hide part of a repo from someone with read access. A collection that must stay private to a smaller group needs its **own repo**, which means its own workspace.
- **Secrets sit outside GitHub's RBAC.** Keep them local, encrypted, or in a vault (see section 3).

---

## Sync flow at a glance

```
edit request ──Ctrl/⌘ S──▶ saved locally ──Commit & push──▶ GitHub
                                 ▲                              │
                                 └──── Sync (pull + 3-way merge) ┘
```

1. **Edit:** changes stay as a draft (shown in *Unsaved*).
2. **Save:** the draft becomes your local saved state and appears under *Changes*.
3. **Commit & push:** only saved state is committed, with secrets blanked.
4. **Sync:** pulls teammates' commits and merges them request by request.