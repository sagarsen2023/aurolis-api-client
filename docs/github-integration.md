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
│       │   ├── 201-created.json      # one saved example per file
│       │   └── 402-declined.json
│       └── refunds/
│           ├── _folder.json          # id, name, seq, folder-level auth
│           └── refund-payment.req.json
└── environments/
    ├── _globals.env.json
    ├── local.env.json
    ├── staging.env.json
    └── production.env.json           # secret keys listed, values always empty
```

Files are written by `src/lib/workspace-format.ts` and validated with the schemas in `src/validators/workspace.schema.ts`. Keys are sorted, indentation is 2 spaces and every file ends with a newline, so an unchanged item always produces the same bytes. File names are slugs of the item names (`Create payment` → `create-payment.req.json`); duplicates get `-2`, `-3`, and an item keeps its file name until it's renamed.

### `aurolis.json`

```json
{
  "defaultEnvironment": "env_local",
  "format": 1,
  "workspace": {
    "id": "ws_3k9d",
    "name": "Acme API"
  }
}
```

### Collection (`_collection.json`)

```json
{
  "auth": {
    "token": "{{token}}",
    "type": "bearer"
  },
  "description": "Payments API",
  "id": "col_pay",
  "name": "Payments Service",
  "seq": 1000,
  "variables": []
}
```

### Folder (`_folder.json`)

```json
{
  "auth": {
    "type": "inherit"
  },
  "id": "f_refunds",
  "name": "Refunds",
  "seq": 3000
}
```

### Request file (`*.req.json`)

```json
{
  "auth": {
    "type": "inherit"
  },
  "body": {
    "mode": "json",
    "raw": "{ \"amount\": 4200, \"currency\": \"INR\" }"
  },
  "headers": [
    {
      "enabled": true,
      "key": "Idempotency-Key",
      "value": "{{$uuid}}"
    }
  ],
  "id": "r_8f2c",
  "method": "POST",
  "name": "Create payment",
  "params": [],
  "seq": 2000,
  "url": "{{baseUrl}}/payments"
}
```

- `method`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`.
- `body.mode`: `none`, `json`, `text` or `xml` (with `raw`), or `urlencoded` or `form-data` (with `fields`).
- `auth.type`: `inherit`, `none`, `bearer`, `basic` or `apikey`. Use `{{variables}}` for credentials so real values stay in environments.

### Example (`<request>.examples/*.json`)

```json
{
  "body": "{ \"id\": \"pay_8Hk2xQ\", \"status\": \"succeeded\" }",
  "headers": [
    {
      "enabled": true,
      "key": "Content-Type",
      "value": "application/json"
    }
  ],
  "id": "ex_x7k2",
  "name": "201 Created",
  "seq": 1000,
  "status": 201
}
```

### Environment file (`*.env.json`)

```json
{
  "id": "env_prod",
  "name": "Production",
  "seq": 2000,
  "variables": [
    {
      "enabled": true,
      "key": "baseUrl",
      "secret": false,
      "value": "https://api.acme.com"
    },
    {
      "enabled": true,
      "key": "apiKey",
      "secret": true,
      "value": ""
    }
  ]
}
```

Variables marked `secret` are always written with an empty value. Globals live in `environments/_globals.env.json`.

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
- **GitHub App:** Aurolis signs in through a GitHub App with fine-grained permissions (Contents, Pull requests, Metadata, and Administration to create a repository when publishing a local workspace) instead of an OAuth token with the broad `repo` scope. Users choose exactly which repos Aurolis can access.

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