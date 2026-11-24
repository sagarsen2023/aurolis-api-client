export const getGithubToken = () => localStorage.getItem("github_token");

export const setGithubToken = (token: string) =>
  localStorage.setItem("github_token", token);

export const deleteGithubToken = () => localStorage.removeItem("github_token");
