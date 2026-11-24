import { atom } from "jotai";
import type { GithubUser } from "@/types/auth/auth-response.type";

export const githubUserAtom = atom<GithubUser | null>(null);
