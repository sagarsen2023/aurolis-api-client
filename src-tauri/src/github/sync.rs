use std::collections::{BTreeMap, HashMap};
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::github::api::GithubApi;
use crate::github::auth::GithubAuth;
use crate::outcome::{AppResult, Failure};

static OWNER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$").unwrap());
static REPO: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[A-Za-z0-9._-]{1,100}$").unwrap());

pub fn is_owner(value: &str) -> bool {
    OWNER.is_match(value)
}

pub fn is_repo_name(value: &str) -> bool {
    REPO.is_match(value) && !value.chars().all(|ch| ch == '.')
}

fn invalid(message: &str) -> Failure {
    Failure::new("invalid_input", message)
}

fn encode(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes())
        .collect::<String>()
        .replace('+', "%20")
}

#[derive(Debug, Clone, Deserialize)]
pub struct RepositoryName {
    pub owner: String,
    pub name: String,
    #[serde(default)]
    pub private: Option<bool>,
}

impl RepositoryName {
    fn validate(self) -> AppResult<Self> {
        if !is_owner(&self.owner) {
            return Err(invalid("Invalid owner"));
        }
        if !is_repo_name(&self.name) {
            return Err(invalid("Invalid repository name"));
        }
        Ok(self)
    }

    fn base(&self) -> String {
        format!("/repos/{}/{}", encode(&self.owner), encode(&self.name))
    }
}

#[derive(Debug, Clone, Deserialize)]
struct ApiAccount {
    login: String,
    #[serde(rename = "type")]
    kind: String,
    avatar_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiInstallation {
    id: u64,
    repository_selection: String,
    #[serde(default)]
    permissions: BTreeMap<String, String>,
    account: Option<ApiAccount>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installation {
    id: u64,
    account: String,
    account_type: String,
    avatar_url: String,
    repository_selection: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
struct ApiPermissions {
    #[serde(default)]
    admin: bool,
    #[serde(default)]
    maintain: bool,
    #[serde(default)]
    push: bool,
    #[serde(default)]
    triage: bool,
    #[serde(default)]
    pull: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiOwner {
    login: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ApiRepository {
    id: u64,
    name: String,
    full_name: String,
    private: bool,
    default_branch: String,
    description: Option<String>,
    pushed_at: Option<String>,
    clone_url: String,
    owner: ApiOwner,
    #[serde(default)]
    permissions: Option<ApiPermissions>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Permissions {
    admin: bool,
    maintain: bool,
    push: bool,
    triage: bool,
    pull: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Repository {
    id: u64,
    owner: String,
    name: String,
    full_name: String,
    private: bool,
    default_branch: String,
    description: Option<String>,
    pushed_at: Option<String>,
    clone_url: String,
    permissions: Permissions,
}

impl From<ApiRepository> for Repository {
    fn from(repo: ApiRepository) -> Self {
        let permissions = repo.permissions.unwrap_or_default();
        Self {
            id: repo.id,
            owner: repo.owner.login,
            name: repo.name,
            full_name: repo.full_name,
            private: repo.private,
            default_branch: repo.default_branch,
            description: repo.description,
            pushed_at: repo.pushed_at,
            clone_url: repo.clone_url,
            permissions: Permissions {
                admin: permissions.admin,
                maintain: permissions.maintain,
                push: permissions.push,
                triage: permissions.triage,
                pull: permissions.pull,
            },
        }
    }
}

fn same_login(login: Option<&str>, owner: &str) -> bool {
    login.is_some_and(|login| login.eq_ignore_ascii_case(owner))
}

async fn fetch_installations(api: &GithubApi) -> AppResult<Vec<ApiInstallation>> {
    api.get_all("/user/installations?per_page=100", "installations")
        .await
}

pub async fn installations(api: &GithubApi) -> AppResult<Vec<Installation>> {
    Ok(fetch_installations(api)
        .await?
        .into_iter()
        .map(|installation| {
            let account = installation.account;
            Installation {
                id: installation.id,
                account: account
                    .as_ref()
                    .map(|a| a.login.clone())
                    .unwrap_or_default(),
                account_type: account.as_ref().map(|a| a.kind.clone()).unwrap_or_default(),
                avatar_url: account.map(|a| a.avatar_url).unwrap_or_default(),
                repository_selection: installation.repository_selection,
            }
        })
        .collect())
}

pub fn install_page_url() -> String {
    let slug = crate::github::app_slug();
    if slug.is_empty() {
        "https://github.com/settings/installations".to_string()
    } else {
        format!("https://github.com/apps/{}/installations/new", encode(slug))
    }
}

pub async fn repositories(api: &GithubApi) -> AppResult<Vec<Repository>> {
    let mut by_id: HashMap<u64, Repository> = HashMap::new();
    for installation in installations(api).await? {
        let repos: Vec<ApiRepository> = api
            .get_all(
                &format!(
                    "/user/installations/{}/repositories?per_page=100",
                    installation.id
                ),
                "repositories",
            )
            .await?;
        for repo in repos {
            by_id.insert(repo.id, repo.into());
        }
    }
    let mut list: Vec<Repository> = by_id.into_values().collect();
    list.sort_by(|a, b| a.full_name.cmp(&b.full_name));
    Ok(list)
}

async fn find_repository(
    api: &GithubApi,
    reference: &RepositoryName,
) -> AppResult<Option<Repository>> {
    match api.get::<ApiRepository>(&reference.base()).await {
        Ok(repo) => Ok(Some(repo.into())),
        Err(error) if error.is("not_found") => Ok(None),
        Err(error) => Err(error),
    }
}

async fn is_empty_repository(api: &GithubApi, reference: &RepositoryName) -> AppResult<bool> {
    match api
        .get::<Vec<Value>>(&format!("{}/commits?per_page=1", reference.base()))
        .await
    {
        Ok(commits) => Ok(commits.is_empty()),
        Err(error) if error.is("empty_repository") => Ok(true),
        Err(error) => Err(error),
    }
}

fn describe_permissions(permissions: &BTreeMap<String, String>) -> String {
    if permissions.is_empty() {
        return "nothing".to_string();
    }
    permissions
        .iter()
        .map(|(name, level)| format!("{name}: {level}"))
        .collect::<Vec<_>>()
        .join(", ")
}

async fn explain_create_refusal(
    api: &GithubApi,
    owner: &str,
    github_message: Option<&str>,
) -> String {
    let fallback = github_message
        .unwrap_or("GitHub refused to create the repository.")
        .to_string();
    let Ok(list) = fetch_installations(api).await else {
        return fallback;
    };
    let Some(installation) = list
        .iter()
        .find(|candidate| same_login(candidate.account.as_ref().map(|a| a.login.as_str()), owner))
    else {
        return format!(
            "Aurolis isn't installed on {owner}. Install the Aurolis GitHub App on {owner}, then try again."
        );
    };
    let administration = installation
        .permissions
        .get("administration")
        .map(String::as_str)
        .unwrap_or("none");
    let granted = describe_permissions(&installation.permissions);
    if administration != "write" {
        return format!(
            "The Aurolis installation on {owner} has Administration \"{administration}\", not \"write\". Open its settings on GitHub and accept the updated permissions. It currently has: {granted}."
        );
    }
    if installation.repository_selection != "all" {
        return format!(
            "The Aurolis installation on {owner} only has access to selected repositories. Switch it to \"All repositories\" on GitHub, then try again."
        );
    }
    format!(
        "{fallback} The installation on {owner} has: {granted}; repository access: {}.",
        installation.repository_selection
    )
}

pub async fn create_repository(
    api: &GithubApi,
    auth: &GithubAuth,
    input: RepositoryName,
) -> AppResult<Repository> {
    let reference = input.validate()?;
    let private = reference.private != Some(false);
    let Some(user) = auth.status().await.user else {
        return Err(Failure::code("signed_out"));
    };
    let endpoint = if same_login(Some(&user.login), &reference.owner) {
        "/user/repos".to_string()
    } else {
        format!("/orgs/{}/repos", encode(&reference.owner))
    };
    let body = json!({ "name": reference.name, "private": private, "auto_init": false });
    match api.post::<ApiRepository>(&endpoint, body).await {
        Ok(created) => Ok(created.into()),
        Err(error) if error.is("validation") => match find_repository(api, &reference).await? {
            Some(_) => Err(Failure::new(
                "already_exists",
                format!("{}/{} already exists.", reference.owner, reference.name),
            )
            .with_status(error.status.unwrap_or(422))),
            None => Err(error),
        },
        Err(error) if error.is("not_found") || error.is("forbidden") => {
            let explanation =
                explain_create_refusal(api, &reference.owner, error.message.as_deref()).await;
            let mut failure = Failure::new("forbidden", explanation);
            failure.status = error.status;
            Err(failure)
        }
        Err(error) => Err(error),
    }
}

pub async fn empty_repository(api: &GithubApi, input: RepositoryName) -> AppResult<Repository> {
    let reference = input.validate()?;
    let Some(repository) = find_repository(api, &reference).await? else {
        return Err(Failure::new(
            "not_found",
            format!("Aurolis can't see {}/{}.", reference.owner, reference.name),
        )
        .with_status(404));
    };
    if !repository.permissions.push {
        return Err(Failure::new(
            "forbidden",
            format!("You can't push to {}.", repository.full_name),
        ));
    }
    if !is_empty_repository(api, &reference).await? {
        return Err(Failure::new(
            "not_empty",
            format!("{} already has commits.", repository.full_name),
        ));
    }
    Ok(repository)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names() {
        assert!(is_owner("acme-inc"));
        assert!(!is_owner("-acme"));
        assert!(is_repo_name("payments.api"));
        assert!(!is_repo_name(".."));
        assert!(!is_repo_name("a/b"));
        assert_eq!(encode("a b"), "a%20b");
    }
}
