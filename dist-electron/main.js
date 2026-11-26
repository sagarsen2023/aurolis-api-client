import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, nativeTheme as i, net as a, protocol as o, safeStorage as s, shell as c } from "electron";
import l from "node:path";
import { pathToFileURL as u } from "node:url";
import { access as d, constants as f, lstat as p, mkdir as m, readFile as h, readdir as ee, rename as te, rm as g, stat as ne, statfs as re, writeFile as ie } from "node:fs/promises";
import { createHash as ae, randomUUID as oe } from "node:crypto";
import { execFile as se } from "node:child_process";
import { existsSync as _, watch as ce } from "node:fs";
import le from "node:os";
// electron/github-auth.ts
var ue = "Iv23liqUIZLZbdaM8Bbm", de = "https://github.com/login/device/code", fe = "https://github.com/login/oauth/access_token", pe = "https://api.github.com/user", me = "urn:ietf:params:oauth:grant-type:device_code", he = "refresh_token", ge = /* @__PURE__ */ new Set([
	"bad_refresh_token",
	"incorrect_client_credentials",
	"unauthorized_client"
]), _e = 6e4, ve = () => l.join(t.getPath("userData"), "github-token.bin"), ye = null, v, be = null, y = null;
async function xe(e, t) {
	return await (await a.fetch(e, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: new URLSearchParams(t).toString()
	})).json();
}
function Se(e, t) {
	return new Promise((n, r) => {
		let i = setTimeout(n, e);
		t.addEventListener("abort", () => {
			clearTimeout(i), r(new DOMException("Aborted", "AbortError"));
		}, { once: !0 });
	});
}
function Ce(e) {
	return typeof e == "number" ? Date.now() + e * 1e3 : null;
}
function we(e, t = null) {
	return e.access_token ? {
		accessToken: e.access_token,
		refreshToken: e.refresh_token || t?.refreshToken || null,
		accessTokenExpiresAt: Ce(e.expires_in),
		refreshTokenExpiresAt: Ce(e.refresh_token_expires_in) ?? t?.refreshTokenExpiresAt ?? null
	} : null;
}
function Te(e) {
	try {
		let t = JSON.parse(e);
		if (typeof t.accessToken == "string" && t.accessToken) return {
			accessToken: t.accessToken,
			refreshToken: typeof t.refreshToken == "string" ? t.refreshToken : null,
			accessTokenExpiresAt: typeof t.accessTokenExpiresAt == "number" ? t.accessTokenExpiresAt : null,
			refreshTokenExpiresAt: typeof t.refreshTokenExpiresAt == "number" ? t.refreshTokenExpiresAt : null
		};
	} catch {
		if (e) return {
			accessToken: e,
			refreshToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null
		};
	}
	return null;
}
function Ee() {
	return s.isEncryptionAvailable() ? process.platform !== "linux" || s.getSelectedStorageBackend() !== "basic_text" : !1;
}
async function De(e) {
	v = e, Ee() && await ie(ve(), s.encryptString(JSON.stringify(e)), { mode: 384 });
}
async function Oe() {
	if (v !== void 0) return v;
	if (!Ee()) return v = null;
	try {
		v = Te(s.decryptString(await h(ve())));
	} catch {
		v = null;
	}
	return v;
}
async function ke() {
	v = null, be = null, await g(ve(), { force: !0 });
}
function Ae(e) {
	return e.accessTokenExpiresAt !== null && Date.now() >= e.accessTokenExpiresAt - _e;
}
function je(e) {
	return e.refreshToken ? e.refreshTokenExpiresAt === null || Date.now() < e.refreshTokenExpiresAt : !1;
}
async function Me(e) {
	if (!je(e) || !e.refreshToken) return { kind: "rejected" };
	let t;
	try {
		t = await xe(fe, {
			client_id: ue,
			grant_type: he,
			refresh_token: e.refreshToken
		});
	} catch {
		return { kind: "offline" };
	}
	let n = we(t, e);
	return n ? (await De(n), {
		kind: "refreshed",
		session: n
	}) : t.error && ge.has(t.error) ? { kind: "rejected" } : { kind: "offline" };
}
function Ne(e) {
	return be ??= Me(e).finally(() => {
		be = null;
	}), be;
}
async function Pe(e) {
	try {
		let t = await a.fetch(pe, { headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${e}`,
			"X-GitHub-Api-Version": "2022-11-28"
		} });
		if (t.status === 401) return { kind: "unauthorized" };
		if (!t.ok) return { kind: "offline" };
		let n = await t.json();
		return {
			kind: "ok",
			user: {
				id: n.id,
				login: n.login,
				name: n.name,
				avatarUrl: n.avatar_url
			}
		};
	} catch {
		return { kind: "offline" };
	}
}
async function Fe() {
	Le();
	let e;
	try {
		e = await xe(de, { client_id: ue });
	} catch {
		return {
			ok: !1,
			error: "network"
		};
	}
	return !e.device_code || !e.user_code || !e.verification_uri || !e.expires_in ? {
		ok: !1,
		error: e.error === "device_flow_disabled" ? "device_flow_disabled" : "unknown"
	} : (ye = {
		deviceCode: e.device_code,
		interval: e.interval ?? 5,
		expiresAt: Date.now() + e.expires_in * 1e3,
		abort: new AbortController()
	}, await c.openExternal(e.verification_uri), {
		ok: !0,
		prompt: {
			userCode: e.user_code,
			verificationUri: e.verification_uri,
			expiresIn: e.expires_in
		}
	});
}
async function Ie() {
	let e = ye;
	if (!e) return {
		ok: !1,
		error: "cancelled"
	};
	try {
		for (; Date.now() < e.expiresAt;) {
			await Se(e.interval * 1e3, e.abort.signal);
			let t;
			try {
				t = await xe(fe, {
					client_id: ue,
					device_code: e.deviceCode,
					grant_type: me
				});
			} catch {
				continue;
			}
			let n = we(t);
			if (n) {
				await De(n);
				let e = await Pe(n.accessToken);
				return y = {
					signedIn: !0,
					user: e.kind === "ok" ? e.user : null
				}, {
					ok: !0,
					user: e.kind === "ok" ? e.user : null
				};
			}
			switch (t.error) {
				case "authorization_pending": continue;
				case "slow_down":
					e.interval = t.interval ?? e.interval + 5;
					continue;
				case "expired_token": return {
					ok: !1,
					error: "expired"
				};
				case "access_denied": return {
					ok: !1,
					error: "access_denied"
				};
				case "device_flow_disabled": return {
					ok: !1,
					error: "device_flow_disabled"
				};
				default: return {
					ok: !1,
					error: "unknown"
				};
			}
		}
		return {
			ok: !1,
			error: "expired"
		};
	} catch (e) {
		return e instanceof DOMException && e.name === "AbortError" ? {
			ok: !1,
			error: "cancelled"
		} : {
			ok: !1,
			error: "unknown"
		};
	} finally {
		ye === e && (ye = null);
	}
}
function Le() {
	ye?.abort.abort(), ye = null;
}
async function Re() {
	let e = await Oe();
	if (!e) return { kind: "signed-out" };
	let t = e;
	if (Ae(t)) {
		let e = await Ne(t);
		if (e.kind === "offline") return {
			kind: "offline",
			user: y?.user ?? null
		};
		if (e.kind === "rejected") return await ke(), y = null, { kind: "signed-out" };
		t = e.session;
	}
	return {
		kind: "ready",
		session: t
	};
}
async function ze() {
	if (y?.signedIn && y.user) {
		let e = await Oe();
		if (e && !Ae(e)) return y;
	}
	let e = await Re();
	if (e.kind === "signed-out") return y = null, {
		signedIn: !1,
		user: null
	};
	if (e.kind === "offline") return {
		signedIn: !0,
		user: e.user
	};
	let t = await Pe(e.session.accessToken);
	if (t.kind === "unauthorized" && je(e.session)) {
		let n = await Ne(e.session);
		if (n.kind === "refreshed") t = await Pe(n.session.accessToken);
		else if (n.kind === "offline") return {
			signedIn: !0,
			user: y?.user ?? null
		};
	}
	return t.kind === "unauthorized" ? (await ke(), y = null, {
		signedIn: !1,
		user: null
	}) : (y = {
		signedIn: !0,
		user: t.kind === "ok" ? t.user : null
	}, y);
}
async function Be() {
	let e = await Re();
	return e.kind === "ready" ? {
		kind: "ready",
		token: e.session.accessToken
	} : e.kind === "offline" ? { kind: "offline" } : { kind: "signed-out" };
}
async function Ve(e) {
	let t = await Oe();
	if (!t) return { kind: "signed-out" };
	if (t.accessToken !== e) return {
		kind: "ready",
		token: t.accessToken
	};
	if (!je(t)) return await ke(), y = null, { kind: "signed-out" };
	let n = await Ne(t);
	return n.kind === "refreshed" ? {
		kind: "ready",
		token: n.session.accessToken
	} : n.kind === "offline" ? { kind: "offline" } : (await ke(), y = null, { kind: "signed-out" });
}
async function He() {
	Le(), y = null, await ke();
}
// electron/github-api.ts
var Ue = "https://api.github.com", We = "2022-11-28", Ge = 20, b = class extends Error {
	info;
	constructor(e) {
		super(e.message ?? e.code), this.name = "GithubApiError", this.info = e;
	}
	get code() {
		return this.info.code;
	}
};
function Ke(e) {
	let t = new URL(e, Ue);
	if (t.origin !== Ue) throw new b({
		code: "invalid_input",
		message: `Refusing to call ${t.origin}`
	});
	return t.toString();
}
async function qe(e) {
	let t = await e.text();
	if (t) try {
		return JSON.parse(t);
	} catch {
		return t;
	}
}
function Je(e) {
	if (e && typeof e == "object" && "message" in e) {
		let t = e.message;
		if (typeof t == "string") return t;
	}
	return typeof e == "string" ? e.slice(0, 300) : void 0;
}
function Ye(e, t) {
	let n = e.status, r = Je(t), i = r?.toLowerCase() ?? "", a = e.headers.get("x-ratelimit-remaining"), o = Number(e.headers.get("x-ratelimit-reset")), s = Number(e.headers.get("retry-after"));
	if ((n === 403 || n === 429) && (a === "0" || s)) return new b({
		code: "rate_limited",
		status: n,
		message: r,
		resetAt: s ? Date.now() + s * 1e3 : o ? o * 1e3 : void 0
	});
	let c = "unknown";
	return n === 401 ? c = "signed_out" : n === 403 ? c = "forbidden" : n === 404 ? c = "not_found" : n === 409 ? c = i.includes("empty") ? "empty_repository" : "conflict" : n === 422 ? c = i.includes("fast forward") ? "conflict" : "validation" : n === 413 ? c = "too_large" : n >= 500 && (c = "server"), new b({
		code: c,
		status: n,
		message: r
	});
}
async function Xe(e, t, n) {
	let r = Ke(t), i = await Be();
	for (let t = 0;; t++) {
		if (i.kind === "offline") throw new b({ code: "offline" });
		if (i.kind === "signed-out") throw new b({ code: "signed_out" });
		let o;
		try {
			o = await a.fetch(r, {
				method: e,
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${i.token}`,
					"X-GitHub-Api-Version": We,
					...n.body === void 0 ? {} : { "Content-Type": "application/json" },
					...n.headers
				},
				body: n.body === void 0 ? void 0 : JSON.stringify(n.body)
			});
		} catch {
			throw new b({ code: "offline" });
		}
		if (o.status === 401 && t === 0) {
			i = await Ve(i.token);
			continue;
		}
		let s = await qe(o);
		if (!o.ok) throw Ye(o, s);
		return {
			data: s,
			headers: o.headers
		};
	}
}
var Ze = async (e, t, n = {}) => (await Xe(e, t, n)).data;
function Qe(e) {
	return e.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
}
var x = {
	get: ({ endpoint: e, options: t }) => Ze("GET", e, t),
	post: ({ endpoint: e, body: t, options: n }) => Ze("POST", e, {
		...n,
		body: t
	}),
	put: ({ endpoint: e, body: t, options: n }) => Ze("PUT", e, {
		...n,
		body: t
	}),
	patch: ({ endpoint: e, body: t, options: n }) => Ze("PATCH", e, {
		...n,
		body: t
	}),
	delete: ({ endpoint: e, options: t }) => Ze("DELETE", e, t),
	getAll: async ({ endpoint: e, pick: t, options: n }) => {
		let r = [], i = e;
		for (let e = 0; i && e < Ge; e++) {
			let { data: e, headers: a } = await Xe("GET", i, n ?? {});
			r.push(...t(e)), i = Qe(a);
		}
		return r;
	}
}, $e = 5242880, et = 1e3, tt = 6, nt = "100644", rt = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, it = /^[A-Za-z0-9._-]{1,100}$/, at = /^[A-Za-z0-9._/-]{1,250}$/, ot = (e) => typeof e == "string" && rt.test(e), st = (e) => typeof e == "string" && it.test(e) && !/^\.+$/.test(e);
function S(e) {
	throw new b({
		code: "invalid_input",
		message: e
	});
}
function ct(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function lt(e) {
	ct(e) || S("Expected an object");
	let { owner: t, name: n } = e;
	return ot(t) || S("Invalid owner"), st(n) || S("Invalid repository name"), {
		owner: t,
		name: n
	};
}
function ut(e) {
	ct(e) || S("Expected an object");
	let { owner: t, repo: n, branch: r } = e;
	return ot(t) || S("Invalid owner"), st(n) || S("Invalid repository name"), (typeof r != "string" || !at.test(r) || r.includes("..") || r.includes("//") || r.startsWith("/") || r.endsWith("/") || r.endsWith(".lock")) && S("Invalid branch name"), {
		owner: t,
		repo: n,
		branch: r
	};
}
function dt(e, t = !1) {
	if (typeof e != "string" && S("Invalid path"), t && e === "") return "";
	let n = e.split("/");
	return (e.length > 400 || e.includes("\\") || e.includes("\0") || n.some((e) => e === "" || e === "." || e === "..")) && S(`Invalid path: ${e}`), e;
}
function ft(e) {
	Array.isArray(e) && e.length !== 0 || S("No changes"), e.length > et && S(`More than ${et} changes`);
	let t = /* @__PURE__ */ new Set();
	return e.map((e) => {
		ct(e) || S("Invalid change");
		let n = dt(e.path);
		t.has(n) && S(`Duplicate path: ${n}`), t.add(n);
		let { content: r } = e;
		if (r !== null && typeof r != "string" && S(`Invalid content for ${n}`), typeof r == "string" && Buffer.byteLength(r) > $e) throw new b({
			code: "too_large",
			message: `${n} is larger than 5 MB`
		});
		return {
			path: n,
			content: r
		};
	});
}
var C = ({ owner: e, repo: t }) => `/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}`, pt = (e) => e.split("/").map(encodeURIComponent).join("/");
function mt(e) {
	let t = Buffer.from(e, "utf8");
	return ae("sha1").update(`blob ${t.length}\0`).update(t).digest("hex");
}
async function ht(e) {
	try {
		return (await x.get({ endpoint: `${C(e)}/git/ref/heads/${pt(e.branch)}` })).object.sha;
	} catch (t) {
		if (!(t instanceof b)) throw t;
		if (t.code === "empty_repository") return null;
		throw t.code === "not_found" ? await gt(e) : t;
	}
}
async function gt(e) {
	try {
		await x.get({ endpoint: C(e) });
	} catch (t) {
		return t instanceof b && t.code === "not_found" ? new b({
			code: "not_installed",
			status: 404,
			message: `Aurolis can't see ${e.owner}/${e.repo}. Install the GitHub App on it, or check that you have access.`
		}) : t;
	}
	return new b({
		code: "not_found",
		status: 404,
		message: `Branch "${e.branch}" doesn't exist in ${e.owner}/${e.repo}.`
	});
}
async function _t(e, t, n) {
	let r = Array(e.length), i = 0, a = Array.from({ length: Math.min(t, e.length) }, async () => {
		for (; i < e.length;) {
			let t = i++;
			r[t] = await n(e[t]);
		}
	});
	return await Promise.all(a), r;
}
async function vt() {
	return (await x.getAll({
		endpoint: "/user/installations?per_page=100",
		pick: (e) => e.installations
	})).map((e) => ({
		id: e.id,
		account: e.account?.login ?? "",
		accountType: e.account?.type ?? "",
		avatarUrl: e.account?.avatar_url ?? "",
		repositorySelection: e.repository_selection
	}));
}
async function yt() {
	await c.openExternal("https://github.com/settings/installations");
}
var bt = (e) => ({
	id: e.id,
	owner: e.owner.login,
	name: e.name,
	fullName: e.full_name,
	private: e.private,
	defaultBranch: e.default_branch,
	description: e.description,
	pushedAt: e.pushed_at,
	cloneUrl: e.clone_url,
	permissions: {
		admin: !!e.permissions?.admin,
		maintain: !!e.permissions?.maintain,
		push: !!e.permissions?.push,
		triage: !!e.permissions?.triage,
		pull: !!e.permissions?.pull
	}
});
async function xt() {
	let e = await vt(), t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = await x.getAll({
			endpoint: `/user/installations/${n.id}/repositories?per_page=100`,
			pick: (e) => e.repositories
		});
		for (let n of e) t.set(n.id, bt(n));
	}
	return [...t.values()].sort((e, t) => e.fullName.localeCompare(t.fullName));
}
var St = ({ owner: e, name: t }) => `/repos/${encodeURIComponent(e)}/${encodeURIComponent(t)}`;
async function Ct(e) {
	try {
		return bt(await x.get({ endpoint: St(e) }));
	} catch (e) {
		if (e instanceof b && e.code === "not_found") return null;
		throw e;
	}
}
async function wt(e) {
	try {
		return (await x.get({ endpoint: `${St(e)}/commits?per_page=1` })).length === 0;
	} catch (e) {
		if (e instanceof b && e.code === "empty_repository") return !0;
		throw e;
	}
}
async function Tt(e) {
	let t = lt(e), n = e.private !== !1, { user: r } = await ze();
	if (!r) throw new b({ code: "signed_out" });
	let i = r.login.toLowerCase() === t.owner.toLowerCase();
	try {
		return bt(await x.post({
			endpoint: i ? "/user/repos" : `/orgs/${encodeURIComponent(t.owner)}/repos`,
			body: {
				name: t.name,
				private: n,
				auto_init: !1
			}
		}));
	} catch (e) {
		throw e instanceof b ? e.code === "validation" && await Ct(t) ? new b({
			code: "already_exists",
			status: e.info.status,
			message: `${t.owner}/${t.name} already exists.`
		}) : e.code === "not_found" ? new b({
			code: "forbidden",
			status: e.info.status,
			message: e.message
		}) : e : e;
	}
}
async function Et(e) {
	let t = lt(e), n = await Ct(t);
	if (!n) throw new b({
		code: "not_found",
		status: 404,
		message: `Aurolis can't see ${t.owner}/${t.name}.`
	});
	if (!n.permissions.push) throw new b({
		code: "forbidden",
		message: `You can't push to ${n.fullName}.`
	});
	if (!await wt(t)) throw new b({
		code: "not_empty",
		message: `${n.fullName} already has commits.`
	});
	return n;
}
async function Dt(e) {
	let t = ut(e), n = e, r = dt(n.path ?? "", !0), i = ct(n.knownFiles) ? Object.fromEntries(Object.entries(n.knownFiles).filter((e) => typeof e[1] == "string")) : {}, a = (e) => r === "" || e === r || e.startsWith(`${r}/`), o = await ht(t);
	if (!o) return {
		headSha: null,
		changed: [],
		deleted: Object.keys(i).filter(a),
		files: {}
	};
	let s = await x.get({ endpoint: `${C(t)}/git/commits/${o}` }), c = await x.get({ endpoint: `${C(t)}/git/trees/${s.tree.sha}?recursive=1` });
	if (c.truncated) throw new b({
		code: "too_large",
		message: "The repository has too many files to read in one listing."
	});
	let l = c.tree.filter((e) => e.type === "blob" && a(e.path)), u = Object.fromEntries(l.map((e) => [e.path, e.sha])), d = l.filter((e) => i[e.path] !== e.sha), f = d.find((e) => (e.size ?? 0) > $e);
	if (f) throw new b({
		code: "too_large",
		message: `${f.path} is larger than 5 MB`
	});
	return {
		headSha: o,
		changed: await _t(d, tt, async (e) => {
			let n = await x.get({ endpoint: `${C(t)}/git/blobs/${e.sha}` }), r = n.encoding === "base64" ? Buffer.from(n.content, "base64").toString("utf8") : n.content;
			return {
				path: e.path,
				sha: e.sha,
				content: r
			};
		}),
		deleted: Object.keys(i).filter((e) => a(e) && !(e in u)),
		files: u
	};
}
function Ot(e, t) {
	throw new b({
		code: "conflict",
		message: t,
		remoteHeadSha: e ?? void 0
	});
}
async function kt(e, t, n) {
	return (await x.put({
		endpoint: `${C(e)}/contents/${n.path.split("/").map(encodeURIComponent).join("/")}`,
		body: {
			message: t,
			content: Buffer.from(n.content, "utf8").toString("base64"),
			branch: e.branch
		}
	})).commit.sha;
}
async function At(e) {
	let t = ut(e), n = e;
	typeof n.message == "string" && n.message.trim() || S("Commit message is required");
	let r = n.message.trim().slice(0, 5e3), i = ft(n.changes), a = n.expectedHeadSha;
	a != null && typeof a != "string" && S("Invalid expectedHeadSha");
	let o = Object.fromEntries(i.map((e) => [e.path, e.content === null ? null : mt(e.content)])), s = await ht(t);
	if (a !== void 0 && s !== a && Ot(s, "The branch changed on GitHub since your last pull."), !s) {
		i = i.filter((e) => e.content !== null);
		let e = i.shift();
		if (e || S("Nothing to write to an empty repository"), s = await kt(t, r, e), i.length === 0) return {
			commitSha: s,
			unchanged: !1,
			files: o
		};
	}
	let c = await x.get({ endpoint: `${C(t)}/git/commits/${s}` }), l = await x.post({
		endpoint: `${C(t)}/git/trees`,
		body: {
			base_tree: c.tree.sha,
			tree: i.map((e) => e.content === null ? {
				path: e.path,
				mode: nt,
				type: "blob",
				sha: null
			} : {
				path: e.path,
				mode: nt,
				type: "blob",
				content: e.content
			})
		}
	});
	if (l.sha === c.tree.sha) return {
		commitSha: s,
		unchanged: !0,
		files: o
	};
	let u = await x.post({
		endpoint: `${C(t)}/git/commits`,
		body: {
			message: r,
			tree: l.sha,
			parents: [s]
		}
	});
	try {
		await x.patch({
			endpoint: `${C(t)}/git/refs/heads/${pt(t.branch)}`,
			body: {
				sha: u.sha,
				force: !1
			}
		});
	} catch (e) {
		throw e instanceof b && e.code === "conflict" && Ot(await ht(t), "Someone pushed to this branch first."), e;
	}
	return {
		commitSha: u.sha,
		unchanged: !1,
		files: o
	};
}
async function jt(e) {
	try {
		return {
			ok: !0,
			data: await e()
		};
	} catch (e) {
		return e instanceof b ? {
			ok: !1,
			error: e.info
		} : {
			ok: !1,
			error: {
				code: "unknown",
				message: e instanceof Error ? e.message : void 0
			}
		};
	}
}
// electron/git.ts
var Mt = [2, 31], Nt = 67108864, Pt = process.platform === "win32", Ft = process.platform === "darwin", It = class extends Error {
	code;
	stderr;
	constructor(e, t) {
		super(t.trim().split("\n").at(-1) || e), this.name = "GitCommandError", this.code = e, this.stderr = t;
	}
};
function Lt(e, t, n = {}) {
	return new Promise((r) => {
		se(e, t, {
			cwd: n.cwd,
			env: n.env,
			signal: n.signal,
			maxBuffer: Nt,
			windowsHide: !0,
			encoding: "utf8"
		}, (e, t, n) => {
			let i = e && typeof e.code == "number" ? e.code : e ? -1 : 0;
			r({
				exitCode: i,
				stdout: t ?? "",
				stderr: n || (e && i === -1 ? e.message : "")
			});
		});
	});
}
function Rt(e) {
	let t = e.match(/git version (\d+)\.(\d+)(?:\.(\d+))?/);
	return t ? t.slice(1, 4).map((e) => Number(e ?? 0)) : null;
}
var zt = (e, t) => e[0] > t[0] || e[0] === t[0] && e[1] >= t[1];
async function Bt(e) {
	try {
		return await d(e, Pt ? f.F_OK : f.X_OK), !0;
	} catch {
		return !1;
	}
}
function Vt() {
	return Pt ? ["git", ...[
		process.env.ProgramFiles,
		process.env["ProgramFiles(x86)"],
		process.env.LOCALAPPDATA && l.join(process.env.LOCALAPPDATA, "Programs")
	].filter((e) => !!e).map((e) => l.join(e, "Git", "cmd", "git.exe"))] : Ft ? [
		"/opt/homebrew/bin/git",
		"/usr/local/bin/git",
		"git"
	] : [
		"git",
		"/usr/bin/git",
		"/usr/local/bin/git"
	];
}
async function Ht() {
	return (await Lt("/usr/bin/xcode-select", ["-p"])).exitCode === 0;
}
async function Ut() {
	for (let e of Vt()) {
		let t = e === "git";
		if (!t && !await Bt(e) || Ft && t && !await Ht()) continue;
		let n = await Lt(e, ["--version"], { env: {
			...process.env,
			GIT_TERMINAL_PROMPT: "0"
		} }), r = Rt(n.stdout);
		if (n.exitCode === 0 && r && zt(r, Mt)) return {
			file: e,
			info: {
				version: r.join("."),
				path: e
			}
		};
	}
	return null;
}
var Wt = null;
function Gt() {
	return Wt ??= Ut().then((e) => {
		if (e) return e;
		throw new It("git_unavailable", `Git ${Mt.join(".")} or newer isn't installed.`);
	}).catch((e) => {
		throw Wt = null, e;
	}), Wt;
}
async function Kt() {
	return (await Gt()).info;
}
var qt = "https://github.com/";
async function Jt() {
	let e = await Be();
	if (e.kind !== "ready") return {};
	let t = Buffer.from(`x-access-token:${e.token}`).toString("base64");
	return {
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: `http.${qt}.extraheader`,
		GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${t}`
	};
}
var Yt = /* @__PURE__ */ new Map();
function Xt(e, t) {
	let n = (Yt.get(e) ?? Promise.resolve()).catch(() => void 0).then(t);
	Yt.set(e, n);
	let r = () => {
		Yt.get(e) === n && Yt.delete(e);
	};
	return n.then(r, r), n;
}
function Zt(e) {
	let t = e.toLowerCase();
	return t.includes("not a git repository") ? "not_a_repository" : t.includes("repository not found") || t.includes("remote:") && t.includes("not found") || t.includes("could not read username for 'https://github.com'") ? "repository_not_found" : t.includes("authentication failed") || t.includes("could not read username") || t.includes("could not read password") || t.includes("terminal prompts disabled") || t.includes("permission denied") || t.includes("the requested url returned error: 403") ? "auth_failed" : t.includes("could not resolve host") || t.includes("failed to connect") || t.includes("connection timed out") || t.includes("network is unreachable") || t.includes("operation timed out") ? "network" : t.includes("already exists and is not an empty directory") ? "folder_exists" : t.includes("index.lock") ? "locked" : "git_failed";
}
async function w(e, t, n = {}) {
	let r = await Gt();
	return Xt(l.resolve(e), async () => {
		let i = {
			...process.env,
			GIT_TERMINAL_PROMPT: "0",
			GIT_OPTIONAL_LOCKS: "0",
			GCM_INTERACTIVE: "never",
			...n.network ? await Jt() : {}
		}, a = await Lt(r.file, t, {
			cwd: e,
			env: i,
			signal: n.signal
		});
		if (n.signal?.aborted) throw new It("cancelled", "Cancelled.");
		if (a.exitCode !== 0 && !n.allowFailure) throw new It(Zt(a.stderr), a.stderr);
		return a;
	});
}
var Qt = [
	/^https:\/\/[^\s/@]+(?::\d+)?\/[^\s]+$/,
	/^ssh:\/\/[^\s]+$/,
	/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$/
], $t = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?(?:[#?].*)?$/i, en = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;
function tn(e) {
	let t = e.trim().replace(/\.git\/?$/, ".git"), n = t.match(en);
	if (n) return `https://github.com/${n[1]}/${n[2].replace(/\.git$/, "")}.git`;
	let r = t.match($t);
	return r ? `https://github.com/${r[1]}/${r[2]}.git` : Qt.some((e) => e.test(t)) ? t : null;
}
function nn(e) {
	let t = e.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i) ?? e.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i) ?? e.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
	return t ? {
		owner: t[1],
		repo: t[2]
	} : null;
}
function rn(e) {
	return (e.replace(/[/\\]+$/, "").split(/[/:]/).at(-1) ?? "").replace(/\.git$/i, "") || "workspace";
}
var an = (e, t) => {
	let n = (e) => {
		let t = nn(e);
		return t ? `github.com/${t.owner}/${t.repo}`.toLowerCase() : e.replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase();
	};
	return n(e) === n(t);
};
async function on(e, t, n) {
	await w(l.dirname(t), [
		"clone",
		"--filter=blob:none",
		"--",
		e,
		t
	], {
		network: !0,
		signal: n
	});
}
async function sn(e) {
	let t = await w(e, ["rev-parse", "--show-toplevel"], { allowFailure: !0 });
	return t.exitCode === 0 ? l.resolve(t.stdout.trim()) : null;
}
async function cn(e) {
	await w(e, ["init", "--initial-branch=main"]);
}
async function ln(e) {
	await w(e, [
		"config",
		"core.autocrlf",
		"false"
	]), Pt && await w(e, [
		"config",
		"core.longpaths",
		"true"
	]);
}
async function un(e) {
	let t = await w(e, [
		"config",
		"--get",
		"remote.origin.url"
	], { allowFailure: !0 });
	return t.exitCode === 0 && t.stdout.trim() || null;
}
async function dn(e) {
	let t = await w(e, [
		"symbolic-ref",
		"--short",
		"-q",
		"HEAD"
	], { allowFailure: !0 });
	return t.exitCode === 0 && t.stdout.trim() || null;
}
async function fn(e, t) {
	let n = await w(e, [
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
		"--",
		t || "."
	], { allowFailure: !0 });
	return n.exitCode === 0 ? n.stdout.split("\0").filter(Boolean).length : 0;
}
async function pn(e) {
	let t = await w(e, [
		"rev-list",
		"--count",
		"@{upstream}..HEAD"
	], { allowFailure: !0 });
	if (t.exitCode === 0) return Number(t.stdout.trim()) || 0;
	let n = await w(e, [
		"rev-list",
		"--count",
		"HEAD"
	], { allowFailure: !0 });
	return n.exitCode === 0 && Number(n.stdout.trim()) || 0;
}
async function mn(e, t) {
	let n = await w(e, [
		"config",
		"--get",
		t
	], { allowFailure: !0 });
	return n.exitCode === 0 && n.stdout.trim() || null;
}
async function hn(e) {
	let [t, n] = await Promise.all([mn(e, "user.name"), mn(e, "user.email")]);
	if (t && n) return [];
	let r = (await ze()).user, i = r ? r.name || r.login : "Aurolis", a = r?.id === void 0 ? "aurolis@users.noreply.localhost" : `${r.id}+${r.login}@users.noreply.github.com`;
	return [
		"-c",
		`user.name=${t ?? i}`,
		"-c",
		`user.email=${n ?? a}`
	];
}
async function gn(e, t, n = "") {
	await w(e, [
		"add",
		"--all",
		"--",
		n || "."
	]), await w(e, [
		...await hn(e),
		"commit",
		"-m",
		t
	]);
}
async function _n(e) {
	return (await w(e, [
		"rev-parse",
		"--verify",
		"-q",
		"HEAD"
	], { allowFailure: !0 })).exitCode === 0;
}
async function vn(e, t) {
	await w(e, [
		"remote",
		"add",
		"origin",
		t
	]);
}
async function yn(e) {
	await w(e, [
		"remote",
		"remove",
		"origin"
	], { allowFailure: !0 });
}
async function bn(e, t) {
	await w(e, [
		"push",
		"--set-upstream",
		"origin",
		`refs/heads/${t}`
	], { network: !0 });
}
// node_modules/zod/v4/core/util.js
function xn(e) {
	let t = Object.values(e).filter((e) => typeof e == "number");
	return Object.entries(e).filter(([e, n]) => t.indexOf(+e) === -1).map(([e, t]) => t);
}
function Sn(e, t = "|") {
	return e.map((e) => Hn(e)).join(t);
}
function Cn(e, t) {
	return typeof t == "bigint" ? t.toString() : t;
}
var wn = class {
	constructor(e) {
		this._getter = e, this._value = void 0;
	}
	get value() {
		let e = this._getter;
		return e !== void 0 && (this._value = e(), this._getter = void 0), this._value;
	}
};
function Tn(e) {
	return new wn(e);
}
function En(e) {
	return e == null;
}
function Dn(e) {
	let t = +!!e.startsWith("^"), n = e.endsWith("$") ? e.length - 1 : e.length;
	return e.slice(t, n);
}
function On(e, t) {
	let n = e / t, r = Math.round(n), i = 4 * 2 ** -52 * Math.max(Math.abs(n), 1);
	return Math.abs(n - r) < i ? 0 : n - r;
}
function T(e, t, n) {
	Object.defineProperty(e, t, {
		value: n,
		writable: !0,
		enumerable: !0,
		configurable: !0
	});
}
function kn(e) {
	let t = Object.getOwnPropertyDescriptor(e, "shape");
	return t?.get ? t.get.raw : t?.value;
}
function E(e) {
	return kn(e._zod.def) ?? e._zod.def.shape;
}
function An(e, t, n) {
	Object.defineProperty(e, t, {
		get() {
			let e = n();
			return T(this, t, e), e;
		},
		enumerable: !0,
		configurable: !0
	});
}
function jn(e, t, n) {
	t in e ? T(e, t, n) : e[t] = n;
}
function D(e, t, n, r) {
	let i = E(t);
	for (let a of n) {
		let n = Object.getOwnPropertyDescriptor(i, a);
		n.enumerable && (n.get ? An(e, a, () => {
			let e = t._zod.def.shape[a];
			return r ? r(e, a) : e;
		}) : jn(e, a, r ? r(n.value, a) : n.value));
	}
}
function Mn(e, t) {
	for (let n of Reflect.ownKeys(t)) {
		let r = Object.getOwnPropertyDescriptor(t, n);
		r.enumerable && (r.get ? An(e, n, () => t[n]) : jn(e, n, r.value));
	}
}
function O(...e) {
	let t = {};
	for (let n of e) {
		let e = Object.getOwnPropertyDescriptors(n);
		Object.assign(t, e);
	}
	return Object.defineProperties({}, t);
}
function Nn(e) {
	return JSON.stringify(e);
}
function Pn(e) {
	return e.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var Fn = "captureStackTrace" in Error ? Error.captureStackTrace : (...e) => {};
function In(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
var Ln = /* @__PURE__*/ Tn(() => {
	if (I.jitless || typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare")) return !1;
	try {
		return Function(""), !0;
	} catch {
		return !1;
	}
});
function Rn(e) {
	if (In(e) === !1) return !1;
	let t = e.constructor;
	if (t === void 0 || typeof t != "function") return !0;
	let n = t.prototype;
	return In(n) !== !1 && Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") !== !1;
}
function zn(e) {
	return Rn(e) ? { ...e } : Array.isArray(e) ? [...e] : e instanceof Map ? new Map(e) : e instanceof Set ? new Set(e) : e;
}
var Bn = /* @__PURE__*/ new Set([
	"string",
	"number",
	"symbol"
]);
function Vn(e) {
	return e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function k(e, t, n) {
	let r = new e._zod.constr(t ?? e._zod.def);
	return (!t || n?.parent) && (r._zod.parent = e), r;
}
function A(e) {
	let t = e;
	if (!t) return {};
	if (typeof t == "string") return { error: () => t };
	if (t?.message !== void 0) {
		if (t?.error !== void 0) throw Error("Cannot specify both `message` and `error` params");
		t.error = t.message;
	}
	return delete t.message, typeof t.error == "string" ? {
		...t,
		error: () => t.error
	} : t;
}
function Hn(e) {
	return typeof e == "bigint" ? e.toString() + "n" : typeof e == "string" ? `"${e}"` : `${e}`;
}
function Un(e) {
	return Object.keys(e).filter((t) => e[t]._zod.optin !== void 0 && e[t]._zod.optout === "optional");
}
var Wn = {
	safeint: [-(2 ** 53 - 1), 2 ** 53 - 1],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}, Gn = {
	int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
	uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
};
function Kn(e, t) {
	let n = e._zod.def, r = n.checks;
	if (r && r.length > 0) throw Error(".pick() cannot be used on object schemas containing refinements");
	let i = {};
	return D(i, e, qn(e, t)), k(e, O(n, {
		shape: i,
		checks: []
	}));
}
function qn(e, t) {
	let n = E(e), r = [];
	for (let e of Reflect.ownKeys(t)) {
		if (!Object.getOwnPropertyDescriptor(n, e)?.enumerable) throw Error(`Unrecognized key: "${String(e)}"`);
		t[e] && r.push(e);
	}
	return r;
}
function Jn(e, t) {
	let n = e._zod.def, r = n.checks;
	if (r && r.length > 0) throw Error(".omit() cannot be used on object schemas containing refinements");
	let i = new Set(qn(e, t)), a = {};
	return D(a, e, Reflect.ownKeys(E(e)).filter((e) => !i.has(e))), k(e, O(n, {
		shape: a,
		checks: []
	}));
}
function Yn(e, t) {
	if (!Rn(t)) throw Error("Invalid input to extend: expected a plain object");
	let n = e._zod.def.checks;
	if (n && n.length > 0) {
		let n = E(e);
		for (let e of Reflect.ownKeys(t)) if (Object.getOwnPropertyDescriptor(n, e) !== void 0) throw Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return k(e, O(e._zod.def, { shape: Xn(e, t) }));
}
function Xn(e, t) {
	let n = {};
	return D(n, e, Reflect.ownKeys(E(e))), Mn(n, t), n;
}
function Zn(e, t) {
	if (!Rn(t)) throw Error("Invalid input to safeExtend: expected a plain object");
	return k(e, O(e._zod.def, { shape: Xn(e, t) }));
}
function Qn(e, t) {
	if (!t?._zod?.def) throw Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
	if (e._zod.def.checks?.length) throw Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	let n = {};
	return D(n, e, Reflect.ownKeys(E(e))), D(n, t, Reflect.ownKeys(E(t))), k(e, O(e._zod.def, {
		shape: n,
		get catchall() {
			return t._zod.def.catchall;
		},
		checks: t._zod.def.checks ?? []
	}));
}
function $n(e, t, n, r = "partial") {
	let i = t._zod.def.checks;
	if (i && i.length > 0) throw Error(`.${r}() cannot be used on object schemas containing refinements`);
	let a = n ? new Set(qn(t, n)) : void 0, o = {};
	return D(o, t, Reflect.ownKeys(E(t)), e && ((t, n) => a && !a.has(n) ? t : new e({
		type: "optional",
		innerType: t
	}))), k(t, O(t._zod.def, {
		shape: o,
		checks: []
	}));
}
function er(e, t, n) {
	let r = n ? new Set(qn(t, n)) : void 0, i = {};
	return D(i, t, Reflect.ownKeys(E(t)), (t, n) => r && !r.has(n) ? t : new e({
		type: "nonoptional",
		innerType: t
	})), k(t, O(t._zod.def, { shape: i }));
}
function j(e, t = 0) {
	if (e.aborted === !0) return !0;
	for (let n = t; n < e.issues.length; n++) if (e.issues[n]?.continue !== !0) return !0;
	return !1;
}
function tr(e, t = 0) {
	if (e.aborted === !0) return !0;
	for (let n = t; n < e.issues.length; n++) if (e.issues[n]?.continue === !1) return !0;
	return !1;
}
function nr(e, t) {
	return t.map((t) => {
		var n;
		return (n = t).path ?? (n.path = []), t.path.unshift(e), t;
	});
}
function rr(e) {
	return typeof e == "string" ? e : e?.message;
}
function ir(e) {
	let t = [];
	for (let n of e ?? []) {
		let e = n._zod.def;
		if (!/_(length|size)$|_equals$/.test(e.check)) break;
		let r = e.maximum ?? e.length ?? e.size;
		r >= 0 && t.push([r, n]);
	}
	return t;
}
function ar(e, t, n) {
	var r;
	for (let i = t; i < e.length; i++) (r = e[i]).schema ?? (r.schema = n);
}
function or(e, t, n) {
	var r;
	let i = e.inst?._zod?.traits;
	i?.has("$ZodType") && (i.has("$ZodCheck") ? (r = e).schema ?? (r.schema = e.inst) : e.schema = e.inst);
	let a = e.schema === e.inst ? void 0 : e.schema?._zod.def?.error, o = e.message ? e.message : rr(e.inst?._zod.def?.error?.(e)) ?? rr(a?.(e)) ?? rr(t?.error?.(e)) ?? rr(n.customError?.(e)) ?? rr(n.localeError?.(e)) ?? "Invalid input", s = {};
	for (let t of Object.keys(e)) t !== "inst" && t !== "schema" && t !== "continue" && t !== "input" && t !== "__proto__" && (s[t] = e[t]);
	return s.path ??= [], s.message = o, t?.reportInput && (s.input = e.input), s;
}
var sr = /[\uD800-\uDBFF]/;
function cr(e) {
	let t = e.length;
	if (!sr.test(e)) return t;
	let n = t;
	for (let r = 0; r < t - 1; r++) (e.charCodeAt(r) & 64512) == 55296 && (e.charCodeAt(r + 1) & 64512) == 56320 && (n--, r++);
	return n;
}
function lr(e) {
	return Array.isArray(e) ? "array" : typeof e == "string" ? "string" : "unknown";
}
function ur(e) {
	let t = typeof e;
	switch (t) {
		case "number": return Number.isNaN(e) ? "nan" : "number";
		case "object": {
			if (e === null) return "null";
			if (Array.isArray(e)) return "array";
			let t = e;
			if (t && Object.getPrototypeOf(t) !== Object.prototype && "constructor" in t && t.constructor) return t.constructor.name;
		}
	}
	return t;
}
function dr(...e) {
	let [t, n, r] = e;
	return typeof t == "string" ? {
		message: t,
		code: "custom",
		input: n,
		inst: r
	} : { ...t };
}
function fr(e, t) {
	for (let n in t) {
		let r = Object.getOwnPropertyDescriptor(t, n);
		r.get ? Object.defineProperty(e, n, {
			...r,
			enumerable: !1
		}) : hr(e, n, r.value);
	}
}
function M(e, t, n, r = !0) {
	return Object.defineProperty(e, t, {
		configurable: !0,
		writable: !0,
		enumerable: r,
		value: n
	}), n;
}
function pr(e, t, n) {
	return M(e, t, n, !1);
}
/* @__NO_SIDE_EFFECTS__ */
function mr(e, t) {
	for (let n in e) {
		let r = e[n];
		Object.defineProperty(t, n, {
			configurable: !0,
			enumerable: !0,
			get() {
				return M(this, n, r(this));
			},
			set(e) {
				M(this, n, e);
			}
		});
	}
	return t;
}
function hr(e, t, n) {
	Object.defineProperty(e, t, {
		configurable: !0,
		get() {
			return this == null ? n : M(this, t, n.bind(this));
		},
		set(e) {
			M(this, t, e);
		}
	});
}
function gr(e, t) {
	let n = Object.getPrototypeOf(e);
	return t in n ? void 0 : n;
}
var _r, vr = !1, yr = {
	configurable: !0,
	get() {
		vr = !0;
	}
};
function N(e, t, n) {
	let r = Object.getPrototypeOf(e._zod);
	t in r && _r !== e._zod ? _r = void 0 : (_r = e._zod, Object.defineProperty(r, t, {
		configurable: !0,
		get() {
			Object.defineProperty(this, t, yr);
			let e = vr;
			vr = !1;
			try {
				let r = n(this);
				return vr ? delete this[t] : Object.defineProperty(this, t, {
					configurable: !0,
					writable: !0,
					value: r
				}), vr ||= e, r;
			} catch (n) {
				throw delete this[t], vr ||= e, n;
			}
		},
		set(e) {
			Object.defineProperty(this, t, {
				configurable: !0,
				writable: !0,
				value: e
			});
		}
	}));
}
function br(e, t, n, r) {
	let i = gr(e, t);
	i && Object.defineProperty(i, t, {
		configurable: !0,
		get() {
			let e = {
				configurable: !0,
				writable: !0,
				enumerable: r,
				value: void 0
			};
			return Object.defineProperty(this, t, e), e.value = n(this), Object.defineProperty(this, t, e), e.value;
		},
		set(e) {
			Object.defineProperty(this, t, {
				configurable: !0,
				writable: !0,
				enumerable: r,
				value: e
			});
		}
	});
}
var xr = "~constantCatch";
function Sr(e) {
	let t = () => e;
	return t[xr] = !0, t;
}
// node_modules/zod/v4/core/core.js
var Cr, wr = {
	value: void 0,
	enumerable: !1
}, Tr = "captureStackTrace" in Error ? Error : null;
function Er(e) {
	let t = Tr;
	if (t) {
		let n = t.stackTraceLimit;
		if (typeof n == "number") {
			try {
				t.stackTraceLimit = 0;
			} catch {
				return Tr = null, new e();
			}
			try {
				return new e();
			} finally {
				t.stackTraceLimit = n;
			}
		}
	}
	return new e();
}
/* @__NO_SIDE_EFFECTS__ */
function P(e, t, n, r) {
	let i = {};
	function a(e) {
		this.def = e, this.constr = d, this.traits = /* @__PURE__ */ new Set();
	}
	a.prototype = i;
	let o = n, s = o && /* @__PURE__ */ new WeakSet();
	function c(n, r) {
		if (!n._zod) {
			wr.value = new a(r);
			try {
				Object.defineProperty(n, "_zod", wr);
			} finally {
				wr.value = void 0;
			}
		} else if (n._zod.traits.has(e)) return;
		if (n._zod.traits.add(e), t(n, r), s) {
			let e = Object.getPrototypeOf(n), t = n._zod.constr.prototype, r = e;
			for (; r && r !== t;) r = Object.getPrototypeOf(r);
			let i = r ?? e;
			s.has(i) || (s.add(i), fr(i, o));
		}
		let i = d.prototype;
		for (let e in i) Object.prototype.hasOwnProperty.call(i, e) && (e in n || (n[e] = i[e].bind(n)));
	}
	let l = r?.Parent ?? Object;
	class u extends l {}
	Object.defineProperty(u, "name", { value: e });
	function d(e) {
		let t = r?.Parent ? Er(u) : this;
		c(t, e);
		let n = t._zod.deferred;
		if (n) {
			for (let e of n) e();
			t._zod.deferred = void 0;
		}
		let i = globalThis.__zod_globalConfig?.postProcessor;
		return i && i(t), t;
	}
	return Object.defineProperty(d, "init", { value: c }), Object.defineProperty(d, Symbol.hasInstance, { value: (t) => r?.Parent && t instanceof r.Parent ? !0 : t?._zod?.traits?.has(e) }), Object.defineProperty(d, "name", { value: e }), d;
}
var F = class extends Error {
	constructor() {
		super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
	}
}, Dr = class extends Error {
	constructor(e) {
		super(`Encountered unidirectional transform during encode: ${e}`), this.name = "ZodEncodeError";
	}
};
(Cr = globalThis).__zod_globalConfig ?? (Cr.__zod_globalConfig = {});
var I = globalThis.__zod_globalConfig;
function L(e) {
	return e && Object.assign(I, e), I;
}
// node_modules/zod/v4/core/errors.js
function Or() {
	let e = this._zod;
	return e.message ??= JSON.stringify(e.def, Cn, 2), e.message;
}
function kr(e) {
	this._zod.message = e;
}
var Ar = {
	get: Or,
	set: kr,
	enumerable: !0,
	configurable: !0
}, jr = {
	value: void 0,
	enumerable: !1
}, Mr = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]), Nr = /* @__PURE__ */ P("$ZodError", (e, t) => {
	e.name = "$ZodError", jr.value = t, Object.defineProperty(e, "issues", jr), jr.value = void 0, Object.defineProperty(e, "message", Ar);
	let n = Object.getPrototypeOf(e);
	Mr.has(n) || (Mr.add(n), Object.defineProperty(n, "toString", {
		configurable: !0,
		enumerable: !1,
		get() {
			let e = () => this.message;
			return Object.defineProperty(this, "toString", {
				value: e,
				configurable: !0,
				writable: !0
			}), e;
		},
		set(e) {
			Object.defineProperty(this, "toString", {
				value: e,
				configurable: !0,
				writable: !0
			});
		}
	}));
});
function Pr(e, t, n) {
	return Object.prototype.hasOwnProperty.call(e, t) || (t === "__proto__" ? Object.defineProperty(e, t, {
		value: n(),
		writable: !0,
		enumerable: !0,
		configurable: !0
	}) : e[t] = n()), e[t];
}
function Fr(e, t = (e) => e.message) {
	let n = {}, r = [];
	for (let i of e.issues) i.path.length > 0 ? Pr(n, i.path[0], () => []).push(t(i)) : r.push(t(i));
	return {
		formErrors: r,
		fieldErrors: n
	};
}
function Ir(e, t = (e) => e.message) {
	let n = { _errors: [] }, r = (e, i = []) => {
		for (let a of e.issues) if (a.code === "invalid_union" && a.errors.length) a.errors.map((e) => r({ issues: e }, [...i, ...a.path]));
		else if (a.code === "invalid_key") r({ issues: a.issues }, [...i, ...a.path]);
		else if (a.code === "invalid_element") r({ issues: a.issues }, [...i, ...a.path]);
		else {
			let e = [...i, ...a.path];
			if (e.length === 0) n._errors.push(t(a));
			else {
				let r = n, i = 0;
				for (; i < e.length;) {
					let n = e[i], o = i === e.length - 1;
					if (n === "_errors") {
						o && r._errors.push(t(a)), i++;
						continue;
					}
					Object.prototype.hasOwnProperty.call(r, n) || Object.defineProperty(r, n, {
						value: { _errors: [] },
						enumerable: !0,
						writable: !0,
						configurable: !0
					});
					let s = r[n];
					o && s._errors.push(t(a)), r = s, i++;
				}
			}
		}
	};
	return r(e), n;
}
function Lr(e) {
	let t = [], n = e.map((e) => typeof e == "object" ? e.key : e);
	for (let e of n) typeof e == "number" ? t.push(`[${e}]`) : typeof e == "symbol" ? t.push(`[${JSON.stringify(String(e))}]`) : /[^\w$]/.test(e) ? t.push(`[${JSON.stringify(e)}]`) : (t.length && t.push("."), t.push(e));
	return t.join("");
}
function Rr(e) {
	let t = [], n = [...e.issues].sort((e, t) => (e.path ?? []).length - (t.path ?? []).length);
	for (let e of n) t.push(`✖ ${e.message}`), e.path?.length && t.push(`  → at ${Lr(e.path)}`);
	return t.join("\n");
}
// node_modules/zod/v4/core/parse.js
function zr(e, t) {
	return {
		callee: t?.callee ?? e,
		Err: t?.Err
	};
}
var Br = (e) => {
	let t = (n, r, i, a) => {
		let o = i ? {
			...i,
			async: !1
		} : { async: !1 }, s = n._zod.run({
			value: r,
			issues: []
		}, o);
		if (s instanceof Promise) throw new F();
		if (s.issues.length) {
			let n = new ((a?.Err) ?? e)(s.issues.map((e) => or(e, o, L())));
			throw Fn(n, a?.callee ?? t), n;
		}
		return s.value;
	};
	return t;
}, Vr = (e) => {
	let t = async (n, r, i, a) => {
		let o = i ? {
			...i,
			async: !0
		} : { async: !0 }, s = n._zod.run({
			value: r,
			issues: []
		}, o);
		if (s instanceof Promise && (s = await s), s.issues.length) {
			let n = new ((a?.Err) ?? e)(s.issues.map((e) => or(e, o, L())));
			throw Fn(n, a?.callee ?? t), n;
		}
		return s.value;
	};
	return t;
}, Hr = (e) => (t, n, r) => {
	let i = r ? {
		...r,
		async: !1
	} : { async: !1 }, a = t._zod.run({
		value: n,
		issues: []
	}, i);
	if (a instanceof Promise) throw new F();
	return a.issues.length ? Ur(e, a.issues, i) : {
		success: !0,
		data: a.value
	};
};
function Ur(e, t, n) {
	let r;
	return {
		success: !1,
		get error() {
			return r || (r = new e(t.map((e) => or(e, n, L()))), t = void 0, n = void 0), r;
		},
		set error(e) {
			r = e, t = void 0, n = void 0;
		}
	};
}
var Wr = (e) => async (t, n, r) => {
	let i = r ? {
		...r,
		async: !0
	} : { async: !0 }, a = t._zod.run({
		value: n,
		issues: []
	}, i);
	return a instanceof Promise && (a = await a), a.issues.length ? Ur(e, a.issues, i) : {
		success: !0,
		data: a.value
	};
}, Gr = /* @__PURE__ */ Symbol.for("zod.compile.invalid"), Kr = /* @__PURE__ */ Symbol.for("zod.compile.fallback"), qr = ((e, t, n) => {
	let r = e._zod.bag.validator;
	if (r !== void 0) {
		if (r(t) !== Gr) return !0;
		if (r.definite === !0 && n === void 0) return !1;
	}
	return Jr(e, t, n);
});
function Jr(e, t, n) {
	let r = n ? {
		...n,
		async: !1,
		abortEarly: !0
	} : {
		async: !1,
		abortEarly: !0
	}, i = e._zod.bag.fallbackRun, a;
	if (i ? (r[Kr] = !0, a = i({
		value: t,
		issues: []
	}, r)) : a = e._zod.run({
		value: t,
		issues: []
	}, r), a instanceof Promise) throw new F();
	return a.issues.length === 0;
}
var Yr = async (e, t, n) => {
	let r = n ? {
		...n,
		async: !0,
		abortEarly: !0
	} : {
		async: !0,
		abortEarly: !0
	}, i = e._zod.run({
		value: t,
		issues: []
	}, r);
	return i instanceof Promise && (i = await i), i.issues.length === 0;
}, Xr = (e) => {
	let t = Br(e), n = (e, r, i, a) => {
		let o = i ? {
			...i,
			direction: "backward"
		} : { direction: "backward" };
		return t(e, r, o, zr(n, a));
	};
	return n;
}, Zr = (e) => {
	let t = Br(e), n = (e, r, i, a) => t(e, r, i, zr(n, a));
	return n;
}, Qr = (e) => {
	let t = Vr(e), n = async (e, r, i, a) => {
		let o = i ? {
			...i,
			direction: "backward"
		} : { direction: "backward" };
		return await t(e, r, o, zr(n, a));
	};
	return n;
}, $r = (e) => {
	let t = Vr(e), n = async (e, r, i, a) => await t(e, r, i, zr(n, a));
	return n;
}, ei = (e) => (t, n, r) => {
	let i = r ? {
		...r,
		direction: "backward"
	} : { direction: "backward" };
	return Hr(e)(t, n, i);
}, ti = (e) => (t, n, r) => Hr(e)(t, n, r), ni = (e) => async (t, n, r) => {
	let i = r ? {
		...r,
		direction: "backward"
	} : { direction: "backward" };
	return Wr(e)(t, n, i);
}, ri = (e) => async (t, n, r) => Wr(e)(t, n, r), ii = /^[cC][0-9a-z]{6,}$/, ai = /^[0-9a-z]+$/, oi = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/, si = /^[0-9a-vA-V]{20}$/, ci = /^[A-Za-z0-9]{27}$/, li = /^[a-zA-Z0-9_-]{21}$/;
function ui(e) {
	return RegExp(`^[a-zA-Z0-9_-]{${e}}$`);
}
var di = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/, fi = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, pi = (e) => e ? RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`) : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/, mi = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/, hi = "^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$";
function gi() {
	return new RegExp(hi, "u");
}
var _i = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, vi = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/, yi = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/, bi = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, xi = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/, Si = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/, Ci = /^https?$/, wi = /^\+[1-9]\d{6,14}$/, Ti = "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
function Ei(e) {
	return RegExp(`^${e}$`);
}
var Di = /*@__PURE__*/ Ei(Ti);
function Oi(e) {
	let t = "(?:[01]\\d|2[0-3]):[0-5]\\d";
	return typeof e.precision == "number" ? e.precision === -1 ? `${t}` : e.precision === 0 ? `${t}:[0-5]\\d` : `${t}:[0-5]\\d\\.\\d{${e.precision}}` : e.seconds ? `${t}:[0-5]\\d(?:\\.\\d+)?` : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function ki(e) {
	return RegExp(`^${Oi(e)}$`);
}
function Ai(e) {
	let t = ["Z"];
	e.offset && t.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
	let n = `${Oi({
		precision: e.precision,
		seconds: !0
	})}(?:${t.join("|")})`, r = e.local ? `${n}|${Oi({ precision: e.precision })}` : n;
	return RegExp(`^${Ti}T(?:${r})$`);
}
var ji = /^[\s\S]{0,}$/, Mi = /^-?\d+(?:\.\d+)?$/, Ni = /^(?:true|false)$/i, Pi = /^[^A-Z]*$/, Fi = /^[^a-z]*$/, R = /*@__PURE__*/ P("$ZodCheck", (e, t) => {
	var n;
	e._zod ??= {}, e._zod.def = t, (n = e._zod).onattach ?? (n.onattach = []);
}), Ii = (e) => {
	let t = e.value;
	return !En(t) && t.length !== void 0;
}, Li = {
	number: "number",
	bigint: "bigint",
	object: "date"
}, Ri = /*@__PURE__*/ P("$ZodCheckLessThan", (e, t) => {
	R.init(e, t);
	let n = Li[typeof t.value];
	e._zod.check = (r) => {
		(t.inclusive ? r.value <= t.value : r.value < t.value) || r.issues.push({
			origin: Li[typeof r.value] ?? n,
			code: "too_big",
			maximum: typeof t.value == "object" ? t.value.getTime() : t.value,
			input: r.value,
			inclusive: t.inclusive,
			inst: e,
			continue: !t.abort
		});
	};
}), zi = /*@__PURE__*/ P("$ZodCheckGreaterThan", (e, t) => {
	R.init(e, t);
	let n = Li[typeof t.value];
	e._zod.check = (r) => {
		(t.inclusive ? r.value >= t.value : r.value > t.value) || r.issues.push({
			origin: Li[typeof r.value] ?? n,
			code: "too_small",
			minimum: typeof t.value == "object" ? t.value.getTime() : t.value,
			input: r.value,
			inclusive: t.inclusive,
			inst: e,
			continue: !t.abort
		});
	};
}), Bi = /*@__PURE__*/ P("$ZodCheckMultipleOf", (e, t) => {
	R.init(e, t), e._zod.check = (n) => {
		if (typeof n.value != typeof t.value) throw Error("Cannot mix number and bigint in multiple_of check.");
		(typeof n.value == "bigint" ? t.value !== BigInt(0) && n.value % t.value === BigInt(0) : On(n.value, t.value) === 0) || n.issues.push({
			origin: typeof n.value,
			code: "not_multiple_of",
			divisor: t.value,
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Vi = /*@__PURE__*/ P("$ZodCheckNumberFormat", (e, t) => {
	R.init(e, t), t.format = t.format || "float64";
	let n = t.format?.includes("int"), r = n ? "int" : "number", [i, a] = Wn[t.format];
	e._zod.check = (o) => {
		let s = o.value;
		if (n) {
			if (!Number.isInteger(s)) {
				o.issues.push({
					expected: r,
					format: t.format,
					code: "invalid_type",
					continue: !1,
					input: s,
					inst: e
				});
				return;
			}
			if (!Number.isSafeInteger(s)) {
				s > 0 ? o.issues.push({
					input: s,
					code: "too_big",
					maximum: 2 ** 53 - 1,
					note: "Integers must be within the safe integer range.",
					inst: e,
					origin: r,
					inclusive: !0,
					continue: !t.abort
				}) : o.issues.push({
					input: s,
					code: "too_small",
					minimum: -(2 ** 53 - 1),
					note: "Integers must be within the safe integer range.",
					inst: e,
					origin: r,
					inclusive: !0,
					continue: !t.abort
				});
				return;
			}
		}
		s < i && o.issues.push({
			origin: "number",
			input: s,
			code: "too_small",
			minimum: i,
			inclusive: !0,
			inst: e,
			continue: !t.abort
		}), s > a && o.issues.push({
			origin: "number",
			input: s,
			code: "too_big",
			maximum: a,
			inclusive: !0,
			inst: e,
			continue: !t.abort
		});
	};
}), Hi = /*@__PURE__*/ P("$ZodCheckMaxLength", (e, t) => {
	var n;
	R.init(e, t), (n = e._zod.def).when ?? (n.when = Ii), e._zod.check = (n) => {
		let r = n.value, i = r.length;
		if ((typeof r == "string" && i > t.maximum ? cr(r) : i) <= t.maximum) return;
		let a = lr(r);
		n.issues.push({
			origin: a,
			code: "too_big",
			maximum: t.maximum,
			inclusive: !0,
			input: r,
			inst: e,
			continue: !t.abort
		});
	};
}), Ui = /*@__PURE__*/ P("$ZodCheckMinLength", (e, t) => {
	var n;
	R.init(e, t), (n = e._zod.def).when ?? (n.when = Ii), e._zod.check = (n) => {
		let r = n.value, i = r.length;
		if ((typeof r == "string" && i >= t.minimum && i < t.minimum * 2 ? cr(r) : i) >= t.minimum) return;
		let a = lr(r);
		n.issues.push({
			origin: a,
			code: "too_small",
			minimum: t.minimum,
			inclusive: !0,
			input: r,
			inst: e,
			continue: !t.abort
		});
	};
}), Wi = /*@__PURE__*/ P("$ZodCheckLengthEquals", (e, t) => {
	var n;
	R.init(e, t), (n = e._zod.def).when ?? (n.when = Ii), e._zod.check = (n) => {
		let r = n.value, i = r.length, a = typeof r == "string" && i >= t.length && i <= t.length * 2 ? cr(r) : i;
		if (a === t.length) return;
		let o = lr(r), s = a > t.length;
		n.issues.push({
			origin: o,
			...s ? {
				code: "too_big",
				maximum: t.length
			} : {
				code: "too_small",
				minimum: t.length
			},
			inclusive: !0,
			exact: !0,
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Gi = /*@__PURE__*/ P("$ZodCheckStringFormat", (e, t) => {
	var n, r;
	R.init(e, t), t.pattern ? (n = e._zod).check ?? (n.check = (n) => {
		t.pattern.lastIndex = 0, t.pattern.test(n.value) || n.issues.push({
			origin: "string",
			code: "invalid_format",
			format: t.format,
			input: n.value,
			...t.pattern ? { pattern: t.pattern.toString() } : {},
			inst: e,
			continue: !t.abort
		});
	}) : (r = e._zod).check ?? (r.check = () => {});
}), Ki = /*@__PURE__*/ P("$ZodCheckRegex", (e, t) => {
	Gi.init(e, t), e._zod.check = (n) => {
		t.pattern.lastIndex = 0, t.pattern.test(n.value) || n.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: n.value,
			pattern: t.pattern.toString(),
			inst: e,
			continue: !t.abort
		});
	};
}), qi = /*@__PURE__*/ P("$ZodCheckLowerCase", (e, t) => {
	t.pattern ??= Pi, Gi.init(e, t);
}), Ji = /*@__PURE__*/ P("$ZodCheckUpperCase", (e, t) => {
	t.pattern ??= Fi, Gi.init(e, t);
}), Yi = /*@__PURE__*/ P("$ZodCheckIncludes", (e, t) => {
	R.init(e, t);
	let n = Vn(t.includes);
	t.pattern = new RegExp(typeof t.position == "number" ? `^.{${t.position},}${n}` : n), e._zod.check = (n) => {
		n.value.includes(t.includes, t.position) || n.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: t.includes,
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Xi = /*@__PURE__*/ P("$ZodCheckStartsWith", (e, t) => {
	R.init(e, t);
	let n = RegExp(`^${Vn(t.prefix)}.*`);
	t.pattern ??= n, e._zod.check = (n) => {
		n.value.startsWith(t.prefix) || n.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: t.prefix,
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Zi = /*@__PURE__*/ P("$ZodCheckEndsWith", (e, t) => {
	R.init(e, t);
	let n = RegExp(`.*${Vn(t.suffix)}$`);
	t.pattern ??= n, e._zod.check = (n) => {
		n.value.endsWith(t.suffix) || n.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: t.suffix,
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Qi = /*@__PURE__*/ P("$ZodCheckOverwrite", (e, t) => {
	R.init(e, t), e._zod.check = (e) => {
		e.value = t.tx(e.value);
	};
}), $i = class {
	constructor(e = [], t = {}) {
		this.content = [], this.indent = 0, this.args = e, this.closed = t;
	}
	indented(e) {
		this.indent += 1;
		try {
			e(this);
		} finally {
			--this.indent;
		}
	}
	write(e) {
		if (typeof e == "function") {
			e(this, { execution: "sync" }), e(this, { execution: "async" });
			return;
		}
		let t = e.split("\n").filter((e) => e), n = Math.min(...t.map((e) => e.length - e.trimStart().length)), r = t.map((e) => e.slice(n)).map((e) => " ".repeat(this.indent * 2) + e);
		for (let e of r) this.content.push(e);
	}
	compile() {
		let e = Function, t = this?.content ?? [""];
		return new e(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${t.join("\n")}\n};`)(...Object.values(this.closed));
	}
}, ea = {
	major: 4,
	minor: 6,
	patch: 7
}, z = /*@__PURE__*/ P("$ZodType", (e, t) => {
	var n;
	e ??= {}, e._zod.def = t, e._zod.bag = e._zod.bag || {}, e._zod.version = ea;
	let r = e._zod.def.checks, i = e._zod.traits.has("$ZodCheck") ? [e, ...r ?? []] : r?.length ? [...r] : [];
	for (let t of i) for (let n of t._zod.onattach) n(e);
	if (i.length === 0) (n = e._zod).deferred ?? (n.deferred = []), e._zod.deferred?.push(() => {
		e._zod.run = e._zod.parse;
	});
	else {
		let t = (t, n, r) => {
			if (t.memo) return t;
			let i = j(t), a;
			for (let o of n) {
				if (o._zod.def.when) {
					if (tr(t) || !o._zod.def.when(t)) continue;
				} else if (i) continue;
				let n = t.issues.length, s = o._zod.check(t);
				if (s instanceof Promise && r?.async === !1) throw new F();
				if (a || s instanceof Promise) a = (a ?? Promise.resolve()).then(async () => {
					await s, t.issues.length !== n && (ar(t.issues, n, e), i ||= j(t, n));
				});
				else {
					if (t.issues.length === n) continue;
					ar(t.issues, n, e), i ||= j(t, n);
				}
			}
			return a ? a.then(() => t) : t;
		}, n = (n, r, a) => {
			if (j(n)) return n.aborted = !0, n;
			let o = t(r, i, a);
			if (o instanceof Promise) {
				if (a.async === !1) throw new F();
				return o.then((t) => e._zod.parse(t, a));
			}
			return e._zod.parse(o, a);
		};
		e._zod.run = (r, a) => {
			if (a.skipChecks) return e._zod.parse(r, a);
			if (a.direction === "backward") {
				let t = e._zod.parse({
					value: r.value,
					issues: []
				}, {
					...a,
					skipChecks: !0
				});
				return t instanceof Promise ? t.then((e) => n(e, r, a)) : n(t, r, a);
			}
			let o = e._zod.parse(r, a);
			if (o instanceof Promise) {
				if (a.async === !1) throw new F();
				return o.then((e) => t(e, i, a));
			}
			return t(o, i, a);
		};
	}
}, {
	get "~standard"() {
		return pr(this, "~standard", ra(this));
	},
	set "~standard"(e) {
		M(this, "~standard", e);
	}
}), ta = (e, t) => e.issues.length ? { issues: e.issues.map((e) => or(e, t, L())) } : { value: e.value };
async function na(e, t) {
	let n = { async: !0 };
	return ta(await e._zod.run({
		value: t,
		issues: []
	}, n), n);
}
function ra(e) {
	return {
		validate: (t) => {
			let n = { async: !1 };
			try {
				let r = e._zod.run({
					value: t,
					issues: []
				}, n);
				if (!(r instanceof Promise)) return ta(r, n);
			} catch {}
			return na(e, t);
		},
		vendor: "zod",
		version: 1
	};
}
var ia = /*@__PURE__*/ P("$ZodString", (e, t) => {
	z.init(e, t), e._zod.pattern = t.pattern ?? ji, e._zod.parse = (n, r) => {
		if (t.coerce) try {
			n.value = String(n.value);
		} catch {}
		return typeof n.value == "string" || n.issues.push({
			expected: "string",
			code: "invalid_type",
			input: n.value,
			inst: e
		}), n;
	};
}), B = /*@__PURE__*/ P("$ZodStringFormat", (e, t) => {
	Gi.init(e, t), ia.init(e, t);
}), aa = /*@__PURE__*/ P("$ZodGUID", (e, t) => {
	t.pattern ??= fi, B.init(e, t);
}), oa = /*@__PURE__*/ P("$ZodUUID", (e, t) => {
	if (t.version) {
		let e = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[t.version];
		if (e === void 0) throw Error(`Invalid UUID version: "${t.version}"`);
		t.pattern ??= pi(e);
	} else t.pattern ??= pi();
	B.init(e, t);
}), sa = /*@__PURE__*/ P("$ZodEmail", (e, t) => {
	t.pattern ??= mi, B.init(e, t);
});
function ca(e) {
	try {
		return typeof URL < "u" && typeof URL.canParse == "function" ? URL.canParse(e) : (new URL(e), !0);
	} catch {
		return !1;
	}
}
function la(e, t) {
	return !("normalize" in t) && !("hostname" in t) && !("protocol" in t) ? ca(e) || 2 : ua(e, t);
}
function ua(e, t) {
	if (!t.normalize && t.protocol?.source === Ci.source && !/^https?:\/\//i.test(e)) return 1;
	try {
		if (typeof URL < "u") {
			let t = URL;
			if (typeof t.parse == "function") return t.parse(e) ?? 2;
		}
		return new URL(e);
	} catch {
		return 2;
	}
}
var da = /[\t\n\r]/g;
function fa(e) {
	return e.replace(da, "");
}
function pa(e, t) {
	return t.lastIndex = 0, t.test(e.hostname);
}
function ma(e, t) {
	return t.lastIndex = 0, t.test(e.protocol.endsWith(":") ? e.protocol.slice(0, -1) : e.protocol);
}
var ha = /*@__PURE__*/ P("$ZodURL", (e, t) => {
	B.init(e, t), e._zod.check = (n) => {
		try {
			let r = n.value.trim(), i = la(r, t);
			if (i === 1) {
				n.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid URL format",
					input: n.value,
					inst: e,
					continue: !t.abort
				});
				return;
			}
			if (i === 2) {
				n.issues.push({
					code: "invalid_format",
					format: "url",
					input: n.value,
					inst: e,
					continue: !t.abort
				});
				return;
			}
			if (i === !0) {
				n.value = fa(r);
				return;
			}
			t.hostname && !pa(i, t.hostname) && n.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid hostname",
				pattern: t.hostname.source,
				input: n.value,
				inst: e,
				continue: !t.abort
			}), t.protocol && !ma(i, t.protocol) && n.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid protocol",
				pattern: t.protocol.source,
				input: n.value,
				inst: e,
				continue: !t.abort
			}), n.value = t.normalize ? i.href : fa(r);
			return;
		} catch {
			n.issues.push({
				code: "invalid_format",
				format: "url",
				input: n.value,
				inst: e,
				continue: !t.abort
			});
		}
	};
}), ga = /*@__PURE__*/ P("$ZodEmoji", (e, t) => {
	t.pattern ??= gi(), B.init(e, t);
}), _a = /*@__PURE__*/ P("$ZodNanoID", (e, t) => {
	if (t.length !== void 0 && (!Number.isInteger(t.length) || t.length < 1)) throw Error(`Invalid nanoid length: ${t.length}`);
	t.pattern ??= t.length === void 0 ? li : ui(t.length), B.init(e, t);
}), va = /*@__PURE__*/ P("$ZodCUID", (e, t) => {
	t.pattern ??= ii, B.init(e, t);
}), ya = /*@__PURE__*/ P("$ZodCUID2", (e, t) => {
	t.pattern ??= ai, B.init(e, t);
}), ba = /*@__PURE__*/ P("$ZodULID", (e, t) => {
	t.pattern ??= oi, B.init(e, t);
}), xa = /*@__PURE__*/ P("$ZodXID", (e, t) => {
	t.pattern ??= si, B.init(e, t);
}), Sa = /*@__PURE__*/ P("$ZodKSUID", (e, t) => {
	t.pattern ??= ci, B.init(e, t);
}), Ca = /*@__PURE__*/ P("$ZodISODateTime", (e, t) => {
	t.pattern ??= Ai(t), B.init(e, t);
}), wa = /*@__PURE__*/ P("$ZodISODate", (e, t) => {
	t.pattern ??= Di, B.init(e, t);
}), Ta = /*@__PURE__*/ P("$ZodISOTime", (e, t) => {
	t.pattern ??= ki(t), B.init(e, t);
}), Ea = /*@__PURE__*/ P("$ZodISODuration", (e, t) => {
	t.pattern ??= di, B.init(e, t);
}), Da = /*@__PURE__*/ P("$ZodIPv4", (e, t) => {
	t.pattern ??= _i, B.init(e, t);
}), Oa = /^[0-9a-fA-F:.]+$/;
function ka(e) {
	return Oa.test(e) ? ca(`http://[${e}]`) : !1;
}
var Aa = /*@__PURE__*/ P("$ZodIPv6", (e, t) => {
	t.pattern ??= vi, B.init(e, t), e._zod.check = (n) => {
		ka(n.value) || n.issues.push({
			code: "invalid_format",
			format: "ipv6",
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), ja = /*@__PURE__*/ P("$ZodCIDRv4", (e, t) => {
	t.pattern ??= yi, B.init(e, t);
});
function Ma(e) {
	let t = e.split("/");
	if (t.length !== 2) return !1;
	let [n, r] = t;
	if (!r) return !1;
	let i = Number(r);
	return `${i}` !== r || i < 0 || i > 128 ? !1 : ka(n);
}
var Na = /*@__PURE__*/ P("$ZodCIDRv6", (e, t) => {
	t.pattern ??= bi, B.init(e, t), e._zod.check = (n) => {
		Ma(n.value) || n.issues.push({
			code: "invalid_format",
			format: "cidrv6",
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
});
function Pa(e) {
	if (e === "") return !0;
	if (/\s/.test(e) || e.length % 4 != 0) return !1;
	try {
		return atob(e), !0;
	} catch {
		return !1;
	}
}
var Fa = /^[0-9a-zA-Z+/]*={0,2}$/, Ia = /*@__PURE__*/ P("$ZodBase64", (e, t) => {
	t.pattern ??= Fa, B.init(e, t), e._zod.check = (n) => {
		Pa(n.value) || n.issues.push({
			code: "invalid_format",
			format: "base64",
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), La = /^[A-Za-z0-9_-]*$/;
function Ra(e) {
	if (!La.test(e)) return !1;
	let t = e.replace(/[-_]/g, (e) => e === "-" ? "+" : "/");
	return Pa(t.padEnd(Math.ceil(t.length / 4) * 4, "="));
}
var za = /*@__PURE__*/ P("$ZodBase64URL", (e, t) => {
	t.pattern ??= La, B.init(e, t), e._zod.check = (n) => {
		Ra(n.value) || n.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Ba = /*@__PURE__*/ P("$ZodE164", (e, t) => {
	t.pattern ??= wi, B.init(e, t);
});
function Va(e, t = null) {
	try {
		let n = e.split(".");
		if (n.length !== 3) return !1;
		let [r] = n;
		if (!r) return !1;
		let i = JSON.parse(atob(r));
		return !("typ" in i && i?.typ !== "JWT" || !i.alg || t && (!("alg" in i) || i.alg !== t));
	} catch {
		return !1;
	}
}
var Ha = /*@__PURE__*/ P("$ZodJWT", (e, t) => {
	B.init(e, t), e._zod.check = (n) => {
		Va(n.value, t.alg) || n.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: n.value,
			inst: e,
			continue: !t.abort
		});
	};
}), Ua = /*@__PURE__*/ P("$ZodNumber", (e, t) => {
	z.init(e, t), e._zod.pattern = Mi, e._zod.parse = (n, r) => {
		if (t.coerce) try {
			n.value = Number(n.value);
		} catch {}
		let i = n.value;
		if (typeof i == "number" && !Number.isNaN(i) && Number.isFinite(i)) return n;
		let a = typeof i == "number" ? Number.isNaN(i) ? "NaN" : Number.isFinite(i) ? void 0 : String(i) : void 0;
		return n.issues.push({
			expected: "number",
			code: "invalid_type",
			input: i,
			inst: e,
			...a ? { received: a } : {}
		}), n;
	};
}), Wa = /*@__PURE__*/ P("$ZodNumberFormat", (e, t) => {
	Vi.init(e, t), Ua.init(e, t);
}), Ga = /*@__PURE__*/ P("$ZodBoolean", (e, t) => {
	z.init(e, t), e._zod.pattern = Ni, e._zod.parse = (n, r) => {
		if (t.coerce) try {
			n.value = !!n.value;
		} catch {}
		let i = n.value;
		return typeof i == "boolean" || n.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input: i,
			inst: e
		}), n;
	};
}), Ka = /*@__PURE__*/ P("$ZodUnknown", (e, t) => {
	z.init(e, t), e._zod.parse = (e) => e;
}), qa = /*@__PURE__*/ P("$ZodNever", (e, t) => {
	z.init(e, t), e._zod.parse = (t, n) => (t.issues.push({
		expected: "never",
		code: "invalid_type",
		input: t.value,
		inst: e
	}), t);
});
function Ja(e, t) {
	let n = ir(e._zod.def.checks);
	if (!n.length) return;
	let r = Math.min(...n.map((e) => e[0])), i = e._zod.parse;
	e._zod.parse = (n, a) => {
		let o = t(n.value);
		if (o > r && !a?.skipChecks && a?.direction !== "backward") {
			for (let [t, r] of ir(e._zod.def.checks)) if (o > t && r._zod.def.when(n)) {
				let t = n.issues.length;
				return r._zod.check(n), n.issues[t].continue = !1, ar(n.issues, t, e), n;
			}
		}
		return i(n, a);
	};
}
var Ya = (e) => Array.isArray(e) ? e.length : -1;
function Xa(e, t, n) {
	e.issues.length && t.issues.push(...nr(n, e.issues)), t.value[n] = e.value;
}
var Za = /*@__PURE__*/ P("$ZodArray", (e, t) => {
	z.init(e, t);
	let n = I.memoizer;
	n?.attach(e), e._zod.parse = (r, i) => {
		let a = r.value;
		if (!Array.isArray(a)) return r.issues.push({
			expected: "array",
			code: "invalid_type",
			input: a,
			inst: e
		}), r;
		r.value = n ? n.alloc(e, r, Array(a.length), i) : Array(a.length);
		let o = [], s = i?.abortEarly;
		for (let e = 0; e < a.length; e++) {
			let n = a[e], c = t.element._zod.run({
				value: n,
				issues: []
			}, i);
			if (c instanceof Promise) o.push(c.then((t) => Xa(t, r, e)));
			else if (Xa(c, r, e), s && c.issues.length !== 0 && j(c)) break;
		}
		return o.length ? Promise.all(o).then(() => r) : r;
	}, Ja(e, Ya);
});
function Qa(e, t, n, r, i, a) {
	let o = n in r, s = a === "optional";
	if (o || !s || i !== "optional") {
		if (e.issues.length) {
			if (i !== void 0 && s && !o) return;
			t.issues.push(...nr(n, e.issues));
		}
		!o && i === void 0 ? e.issues.length || t.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [n]
		}) : e.value === void 0 ? (o || i === "defaulted" && !s) && (t.value[n] = void 0) : t.value[n] = e.value;
	}
}
var $a = [];
function eo(e) {
	let t = Object.keys(e.shape), n = Object.getOwnPropertySymbols(e.shape), r = n.length ? n : $a, i = r.length ? [...t, ...r] : t;
	for (let t of i) if (!e.shape?.[t]?._zod?.traits?.has("$ZodType")) throw Error(`Invalid element at key "${String(t)}": expected a Zod schema`);
	let a = Un(e.shape);
	return {
		...e,
		allKeys: i,
		symbolKeys: r,
		keySet: new Set(t),
		numKeys: t.length,
		optionalKeys: new Set(a)
	};
}
function to(e, t, n, r, i, a, o) {
	let s = [], c = i.keySet, l = i.catchall._zod, u = l.def.type, d = l.optin, f = l.optout, p = 0;
	for (let i in t) {
		if (o && n.issues.length !== p) {
			if (j(n, p)) break;
			p = n.issues.length;
		}
		if (c.has(i)) continue;
		if (i === "__proto__") {
			u === "never" && s.push(i);
			continue;
		}
		if (u === "never") {
			s.push(i);
			continue;
		}
		let a = l.run({
			value: t[i],
			issues: []
		}, r);
		a instanceof Promise ? e.push(a.then((e) => Qa(e, n, i, t, d, f))) : Qa(a, n, i, t, d, f);
	}
	return s.length && n.issues.push({
		code: "unrecognized_keys",
		keys: s,
		input: t,
		inst: a,
		continue: !0
	}), e.length ? Promise.all(e).then(() => n) : n;
}
var no = /*@__PURE__*/ P("$ZodObject", (e, t) => {
	z.init(e, t);
	let n = Object.getOwnPropertyDescriptor(t, "shape"), r = n?.get ? n.get.raw : t.shape ?? {};
	if (r) {
		let e = () => {
			let n = { ...r };
			return Object.defineProperty(t, "shape", { value: n }), e.raw = n, n;
		};
		e.raw = r, Object.defineProperty(t, "shape", { get: e });
	}
	let i = Tn(() => eo(t));
	N(e, "propValues", (e) => {
		let t = e.def.shape, n = {};
		for (let e in t) {
			let r = t[e]._zod;
			if (r.values) {
				Object.prototype.hasOwnProperty.call(n, e) || T(n, e, /* @__PURE__ */ new Set());
				for (let t of r.values) n[e].add(t);
				r.optin !== void 0 && n[e].add(void 0);
			}
		}
		return n;
	});
	let a = In, o = t.catchall, s, c = I.memoizer;
	c?.attach(e), e._zod.parse = (t, n) => {
		s ??= i.value;
		let r = t.value;
		if (!a(r)) return t.issues.push({
			expected: "object",
			code: "invalid_type",
			input: r,
			inst: e
		}), t;
		t.value = c ? c.alloc(e, t, {}, n) : {};
		let l = [], u = s.shape, d = n?.abortEarly, f = t.issues.length;
		for (let e of s.allKeys) {
			if (d && t.issues.length !== f) {
				if (j(t, f)) break;
				f = t.issues.length;
			}
			if (e === "__proto__") continue;
			let i = u[e], a = i._zod.optin, o = i._zod.optout, s = i._zod.run({
				value: r[e],
				issues: []
			}, n);
			s instanceof Promise ? l.push(s.then((n) => Qa(n, t, e, r, a, o))) : Qa(s, t, e, r, a, o);
		}
		return o ? to(l, r, t, n, i.value, e, d === !0) : l.length ? Promise.all(l).then(() => t) : t;
	};
}), ro = /*@__PURE__*/ P("$ZodObjectJIT", (e, t) => {
	no.init(e, t);
	let n = e._zod.parse, r = Tn(() => eo(t)), i = I.memoizer, a = (t) => {
		let n = r.value, a = n.symbolKeys, o = new $i(["payload", "ctx"], {
			shape: t,
			inst: e,
			memo: i,
			syms: a
		}), s = (e) => `shape[${e}]._zod.run({ value: input[${e}], issues: [] }, ctx)`, c = (e, t) => `
          let ${e}_ab = false;
          for (let i = 0; i < ${e}.issues.length; i++) {
            const iss = ${e}.issues[i];
            iss.path = iss.path ? [${t}, ...iss.path] : [${t}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${e}_ab = true;
          }
          if (${e}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
		o.write("const input = payload.value;");
		let l = Object.create(null), u = 0;
		for (let e of n.allKeys) l[e] = `key_${u++}`;
		o.write(i ? "const newResult = memo.alloc(inst, payload, {}, ctx);" : "const newResult = {};");
		for (let e of n.allKeys) {
			if (e === "__proto__") continue;
			let n = l[e], r = typeof e == "symbol" ? `syms[${a.indexOf(e)}]` : Nn(e), i = `${r} in input`, u = t[e], d = u?._zod?.optin, f = d !== void 0, p = u?._zod?.optout === "optional";
			if (o.write(`const ${n} = ${s(r)};`), f && p) {
				let e = d === "optional" ? `${n}_present` : `${n}.value !== undefined || ${n}_present`;
				o.write(`
        const ${n}_present = ${i};
        if (!${n}.issues.length || ${n}_present) {
          if (${n}.issues.length) {${c(n, r)}
          }

          if (${e}) {
            newResult[${r}] = ${n}.value;
          }
        }

      `);
			} else f ? (o.write(`
        if (${n}.issues.length) {${c(n, r)}
        }
      `), d === "defaulted" ? o.write(`newResult[${r}] = ${n}.value;`) : o.write(`
        if (${n}.value !== undefined || ${i}) {
          newResult[${r}] = ${n}.value;
        }
      `)) : o.write(`
        const ${n}_present = ${i};
        if (${n}.issues.length) {${c(n, r)}
        }
        if (!${n}_present && !${n}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${r}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${n}_present) {
          newResult[${r}] = ${n}.value;
        }

      `);
		}
		return o.write("payload.value = newResult;"), o.write("return payload;"), o.compile();
	}, o, s = In, c = !I.jitless, l = c && Ln.value, u = t.catchall, d;
	e._zod.parse = (i, f) => {
		d ??= r.value;
		let p = i.value;
		return s(p) ? c && l && f?.async === !1 && f.jitless !== !0 ? (o ||= a(t.shape), i = o(i, f), u ? to([], p, i, f, d, e, f?.abortEarly === !0) : i) : n(i, f) : (i.issues.push({
			expected: "object",
			code: "invalid_type",
			input: p,
			inst: e
		}), i);
	};
});
function io(e, t, n, r) {
	for (let n of e) if (n.issues.length === 0) return t.value = n.value, t;
	let i = e.filter((e) => !j(e));
	return i.length === 1 ? (t.value = i[0].value, i[0]) : (t.issues.push({
		code: "invalid_union",
		input: t.value,
		inst: n,
		errors: e.map((e) => e.issues.map((e) => or(e, r, L())))
	}), t);
}
var ao = /*@__PURE__*/ P("$ZodUnion", (e, t) => {
	z.init(e, t), N(e, "optin", (e) => e.def.options.some((e) => e._zod.optin === "defaulted") ? "defaulted" : e.def.options.some((e) => e._zod.optin !== void 0) ? "optional" : void 0), N(e, "optout", (e) => e.def.options.some((e) => e._zod.optout === "optional") ? "optional" : void 0), N(e, "values", (e) => {
		if (e.def.options.every((e) => e._zod.values)) return new Set(e.def.options.flatMap((e) => Array.from(e._zod.values)));
	}), N(e, "pattern", (e) => {
		if (e.def.options.every((e) => e._zod.pattern)) {
			let t = e.def.options.map((e) => e._zod.pattern);
			return RegExp(`^(${t.map((e) => Dn(e.source)).join("|")})$`);
		}
	});
	let n = t.options.length === 1 ? t.options[0]._zod.run : null;
	e._zod.parse = (r, i) => {
		if (n) return n(r, i);
		let a = !1, o = [];
		for (let e of t.options) {
			let t = e._zod.run({
				value: r.value,
				issues: []
			}, i);
			if (t instanceof Promise) o.push(t), a = !0;
			else {
				if (t.issues.length === 0) return t;
				o.push(t);
			}
		}
		return a ? Promise.all(o).then((t) => io(t, r, e, i)) : io(o, r, e, i);
	};
});
function oo(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e.options) {
		let r = n._zod.propValues?.[e.discriminator];
		if (!r || r.size === 0) throw Error(`Invalid discriminated union option at index "${e.options.indexOf(n)}"`);
		for (let e of r) if (t.has(e)) {
			if (e !== void 0) throw Error(`Duplicate discriminator value "${String(e)}"`);
			t.set(e, null);
		} else t.set(e, n);
	}
	return t;
}
var so = /*@__PURE__*/ P("$ZodDiscriminatedUnion", (e, t) => {
	t.inclusive = !1, ao.init(e, t);
	let n = e._zod.parse;
	N(e, "propValues", (e) => {
		let t = {}, n = 0;
		for (let r of e.def.options) {
			let i = r._zod.propValues;
			if (!i || Object.keys(i).length === 0) throw Error(`Invalid discriminated union option at index "${e.def.options.indexOf(r)}"`);
			i[e.def.discriminator]?.has(void 0) && n++;
			for (let [e, n] of Object.entries(i)) {
				Object.prototype.hasOwnProperty.call(t, e) || T(t, e, /* @__PURE__ */ new Set());
				for (let r of n) t[e].add(r);
			}
		}
		return !e.def.unionFallback && n > 1 && t[e.def.discriminator]?.delete(void 0), t;
	}), t.options.forEach((e, n) => {
		let r = kn(e._zod.def);
		if (r && !Object.prototype.hasOwnProperty.call(r, t.discriminator)) throw Error(`Invalid discriminated union option at index "${n}"`);
	});
	let r = Tn(() => oo(t));
	e._zod.parse = (i, a) => {
		let o = i.value;
		if (!In(o)) return i.issues.push({
			code: "invalid_type",
			expected: "object",
			input: o,
			inst: e
		}), i;
		let s = o?.[t.discriminator], c = r.value.get(s);
		return c && (s !== void 0 || a.direction !== "backward") ? c._zod.run(i, a) : t.unionFallback || a.direction === "backward" ? n(i, a) : (i.issues.push({
			code: "invalid_union",
			errors: [],
			note: "No matching discriminator",
			discriminator: t.discriminator,
			options: Array.from(r.value.keys()).filter((e) => r.value.get(e) !== null),
			input: o,
			path: [t.discriminator],
			inst: e
		}), i);
	};
}), co = /*@__PURE__*/ P("$ZodIntersection", (e, t) => {
	z.init(e, t), e._zod.parse = (e, n) => {
		let r = e.value, i = t.left._zod.run({
			value: r,
			issues: []
		}, n), a = t.right._zod.run({
			value: r,
			issues: []
		}, n);
		return i instanceof Promise || a instanceof Promise ? Promise.all([i, a]).then(([t, n]) => uo(e, t, n)) : uo(e, i, a);
	};
});
function lo(e, t) {
	if (e === t || e instanceof Date && t instanceof Date && +e == +t) return {
		valid: !0,
		data: e
	};
	if (Rn(e) && Rn(t)) {
		let n = Object.keys(t), r = Object.keys(e).filter((e) => n.indexOf(e) !== -1), i = {
			...e,
			...t
		};
		Object.prototype.hasOwnProperty.call(i, "__proto__") && delete i.__proto__;
		for (let n of r) {
			if (n === "__proto__") continue;
			let r = lo(e[n], t[n]);
			if (!r.valid) return {
				valid: !1,
				mergeErrorPath: [n, ...r.mergeErrorPath]
			};
			i[n] = r.data;
		}
		return {
			valid: !0,
			data: i
		};
	}
	if (Array.isArray(e) && Array.isArray(t)) {
		if (e.length !== t.length) return {
			valid: !1,
			mergeErrorPath: []
		};
		let n = [];
		for (let r = 0; r < e.length; r++) {
			let i = e[r], a = t[r], o = lo(i, a);
			if (!o.valid) return {
				valid: !1,
				mergeErrorPath: [r, ...o.mergeErrorPath]
			};
			n.push(o.data);
		}
		return {
			valid: !0,
			data: n
		};
	}
	return {
		valid: !1,
		mergeErrorPath: []
	};
}
function uo(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i, a = /* @__PURE__ */ new Map(), o = (e, t) => {
		let n;
		if (e.code === "unrecognized_keys" && !e.path?.length) i ??= e, n = e.keys;
		else if (e.code === "invalid_key" && e.origin === "record" && e.path?.length === 1) {
			let t = String(e.path[0]);
			a.has(t) || a.set(t, e), n = [t];
		} else return !1;
		for (let e of n) r.has(e) || r.set(e, {}), r.get(e)[t] = !0;
		return !0;
	};
	for (let n of t.issues) o(n, "l") || e.issues.push(n);
	for (let t of n.issues) o(t, "r") || e.issues.push(t);
	let s = [...r].filter(([, e]) => e.l && e.r).map(([e]) => e);
	if (s.length) {
		let t = i ? s.filter((e) => i.keys.includes(e)) : [];
		t.length && e.issues.push({
			...i,
			keys: t
		});
		for (let n of s) !t.includes(n) && a.has(n) && e.issues.push(a.get(n));
	}
	let c = lo(t.value, n.value);
	if (!c.valid) {
		if (j(e)) return e;
		throw Error(`Unmergable intersection. Error path: ${JSON.stringify(c.mergeErrorPath)}`);
	}
	return e.value = c.data, e;
}
var fo = /*@__PURE__*/ P("$ZodEnum", (e, t) => {
	z.init(e, t);
	let n = xn(t.entries), r = new Set(n);
	e._zod.values = r, N(e, "pattern", (e) => {
		let t = xn(e.def.entries).filter((e) => Bn.has(typeof e));
		return RegExp(t.length ? `^(${t.map((e) => Vn(e.toString())).join("|")})$` : "^[^\\s\\S]$");
	}), e._zod.parse = (t, i) => {
		let a = t.value;
		return r.has(a) || t.issues.push({
			code: "invalid_value",
			values: n,
			input: a,
			inst: e
		}), t;
	};
}), po = /*@__PURE__*/ P("$ZodLiteral", (e, t) => {
	z.init(e, t);
	let n = new Set(t.values);
	e._zod.values = n, N(e, "pattern", (e) => {
		let t = e.def.values;
		return RegExp(t.length ? `^(${t.map((e) => typeof e == "string" ? Vn(e) : e ? Vn(e.toString()) : String(e)).join("|")})$` : "^[^\\s\\S]$");
	}), e._zod.parse = (r, i) => {
		let a = r.value;
		return n.has(a) || r.issues.push({
			code: "invalid_value",
			values: t.values,
			input: a,
			inst: e
		}), r;
	};
}), mo = /*@__PURE__*/ P("$ZodTransform", (e, t) => {
	z.init(e, t), e._zod.optin = "optional", I.memoizer?.guard(e), e._zod.parse = (n, r) => {
		if (r.direction === "backward") throw new Dr(e.constructor.name);
		let i = t.transform(n.value, n);
		if (r.async) return (i instanceof Promise ? i : Promise.resolve(i)).then((e) => (n.value = e, n));
		if (i instanceof Promise) throw new F();
		return n.value = i, n;
	};
});
function ho(e, t) {
	return e.value = t.issues.length ? void 0 : t.value, e;
}
var go = /*@__PURE__*/ P("$ZodOptional", (e, t) => {
	z.init(e, t), N(e, "optin", (e) => e.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional"), e._zod.optout = "optional", N(e, "values", (e) => {
		let t = e.def.innerType._zod.values;
		return t ? /* @__PURE__ */ new Set([...t, void 0]) : void 0;
	}), N(e, "pattern", (e) => {
		let t = e.def.innerType._zod.pattern;
		return t ? RegExp(`^(${Dn(t.source)})?$`) : void 0;
	}), e._zod.parse = (e, n) => {
		if (e.value === void 0) {
			if (t.innerType._zod.optin !== "defaulted") return e;
			let r = t.innerType._zod.run({
				value: e.value,
				issues: []
			}, n);
			return r instanceof Promise ? r.then((t) => ho(e, t)) : ho(e, r);
		}
		return t.innerType._zod.run(e, n);
	};
}), _o = /*@__PURE__*/ P("$ZodExactOptional", (e, t) => {
	go.init(e, t), N(e, "values", (e) => e.def.innerType._zod.values), N(e, "pattern", (e) => e.def.innerType._zod.pattern), e._zod.parse = (e, n) => t.innerType._zod.run(e, n);
}), vo = /*@__PURE__*/ P("$ZodNullable", (e, t) => {
	z.init(e, t), N(e, "optin", (e) => e.def.innerType._zod.optin), N(e, "optout", (e) => e.def.innerType._zod.optout), N(e, "pattern", (e) => {
		let t = e.def.innerType._zod.pattern;
		return t ? RegExp(`^(${Dn(t.source)}|null)$`) : void 0;
	}), N(e, "values", (e) => e.def.innerType._zod.values ? /* @__PURE__ */ new Set([...e.def.innerType._zod.values, null]) : void 0), e._zod.parse = (e, n) => e.value === null ? e : t.innerType._zod.run(e, n);
}), yo = /*@__PURE__*/ P("$ZodDefault", (e, t) => {
	z.init(e, t), e._zod.optin = "defaulted", N(e, "values", (e) => e.def.innerType._zod.values), e._zod.parse = (e, n) => {
		if (n.direction === "backward") return t.innerType._zod.run(e, n);
		if (e.value === void 0) return e.value = t.defaultValue, e;
		let r = t.innerType._zod.run(e, n);
		return r instanceof Promise ? r.then((e) => bo(e, t)) : bo(r, t);
	};
});
function bo(e, t) {
	return e.value === void 0 && (e.value = t.defaultValue), e;
}
var xo = /*@__PURE__*/ P("$ZodPrefault", (e, t) => {
	z.init(e, t), e._zod.optin = "defaulted", N(e, "values", (e) => e.def.innerType._zod.values), e._zod.parse = (e, n) => (n.direction === "backward" || e.value === void 0 && (e.value = t.defaultValue), t.innerType._zod.run(e, n));
}), So = /*@__PURE__*/ P("$ZodNonOptional", (e, t) => {
	z.init(e, t), N(e, "values", (e) => {
		let t = e.def.innerType._zod.values;
		return t ? new Set([...t].filter((e) => e !== void 0)) : void 0;
	}), e._zod.parse = (n, r) => {
		let i = t.innerType._zod.run(n, r);
		return i instanceof Promise ? i.then((t) => Co(t, e)) : Co(i, e);
	};
});
function Co(e, t) {
	return !e.issues.length && e.value === void 0 && e.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: e.value,
		inst: t
	}), e;
}
function wo(e, t, n, r) {
	return t.issues.length ? (e.value = n.catchValue({
		...t,
		value: e.value,
		error: { issues: t.issues.map((e) => or(e, r, L())) },
		input: e.value
	}), e) : (e.value = t.value, t.memo && (e.memo = !0), e);
}
var To = /*@__PURE__*/ P("$ZodCatch", (e, t) => {
	z.init(e, t), N(e, "optin", (e) => e.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional"), N(e, "optout", (e) => e.def.innerType._zod.optout), N(e, "values", (e) => e.def.innerType._zod.values), e._zod.parse = (e, n) => {
		if (n.direction === "backward") return t.innerType._zod.run(e, n);
		let r = t.innerType._zod.run({
			value: e.value,
			issues: []
		}, n);
		return r instanceof Promise ? r.then((r) => wo(e, r, t, n)) : wo(e, r, t, n);
	};
}), Eo = /*@__PURE__*/ P("$ZodPipe", (e, t) => {
	z.init(e, t), N(e, "values", (e) => e.def.in._zod.values), N(e, "optin", (e) => e.def.in._zod.optin), N(e, "optout", (e) => e.def.out._zod.optout), N(e, "propValues", (e) => e.def.in._zod.propValues), e._zod.parse = (e, n) => {
		if (n.direction === "backward") {
			let r = t.out._zod.run(e, n);
			return r instanceof Promise ? r.then((e) => Do(e, t.in, n)) : Do(r, t.in, n);
		}
		let r = t.in._zod.run(e, n);
		return r instanceof Promise ? r.then((e) => Do(e, t.out, n)) : Do(r, t.out, n);
	};
});
function Do(e, t, n) {
	return e.issues.some((e) => e.code !== "unrecognized_keys") ? (e.aborted = !0, e) : t._zod.run({
		value: e.value,
		issues: e.issues
	}, n);
}
var Oo = /*@__PURE__*/ P("$ZodReadonly", (e, t) => {
	z.init(e, t), N(e, "propValues", (e) => e.def.innerType._zod.propValues), N(e, "values", (e) => e.def.innerType._zod.values), N(e, "optin", (e) => e.def.innerType?._zod?.optin), N(e, "optout", (e) => e.def.innerType?._zod?.optout), e._zod.parse = (e, n) => {
		if (n.direction === "backward") return t.innerType._zod.run(e, n);
		let r = t.innerType._zod.run(e, n);
		return r instanceof Promise ? r.then(ko) : ko(r);
	};
});
function ko(e) {
	return e.memo || (e.value = Object.freeze(e.value)), e;
}
var Ao = /*@__PURE__*/ P("$ZodCustom", (e, t) => {
	R.init(e, t), z.init(e, t), e._zod.parse = (e, t) => e, e._zod.check = (n) => {
		let r = n.value, i = t.fn(r);
		if (i instanceof Promise) return i.then((t) => jo(t, n, r, e));
		jo(i, n, r, e);
	};
});
function jo(e, t, n, r) {
	if (!e) {
		let e = {
			code: "custom",
			input: n,
			inst: r,
			path: [...r._zod.def.path ?? []],
			continue: !r._zod.def.abort
		};
		r._zod.def.params && (e.params = r._zod.def.params), t.issues.push(dr(e));
	}
}
// node_modules/zod/v4/core/memoizer.js
var Mo = class extends Error {
	constructor() {
		super("Cannot parse a reference cycle that closes through a transform"), this.name = "ZodCyclicError";
	}
}, No = "~memo", Po = [];
function Fo(e) {
	return typeof e == "object" && !!e;
}
function Io(e) {
	return e.map((e) => e.path ? {
		...e,
		path: e.path.slice()
	} : { ...e });
}
var Lo = /*@__PURE__*/ new WeakMap(), Ro = 0, zo = 1, Bo = 2;
function Vo(e, t, n) {
	let r = Lo.get(e);
	if (r !== void 0) return r ? Bo : Ro;
	if (t.has(e)) return Bo;
	t.add(e);
	let i = Ro, a = (e) => {
		if (i !== Bo && e?._zod) {
			let r = Vo(e, t, n);
			r > i && (i = r);
		}
	}, o = (e, r) => {
		let i = Ro;
		for (let a of Reflect.ownKeys(e)) {
			let o = Object.getOwnPropertyDescriptor(e, a);
			if (r && !o.enumerable) continue;
			let s = o.get ? zo : o.value?._zod ? Vo(o.value, t, n) : Ro;
			s > i && (i = s);
		}
		return i;
	}, s = (e) => {
		e > i && (i = e);
	}, c = e._zod.def;
	switch (c.type) {
		case "object": {
			let e = kn(c);
			s(e ? o(e, !0) : zo), a(c.catchall);
			break;
		}
		case "array":
			a(c.element);
			break;
		case "tuple":
			for (let e of c.items) a(e);
			a(c.rest);
			break;
		case "record":
		case "map":
			a(c.keyType), a(c.valueType);
			break;
		case "set":
			a(c.valueType);
			break;
		case "union":
			for (let e of c.options) a(e);
			break;
		case "intersection":
			a(c.left), a(c.right);
			break;
		case "optional":
		case "nullable":
		case "default":
		case "prefault":
		case "catch":
		case "readonly":
		case "nonoptional":
		case "promise":
		case "success":
			a(c.innerType);
			break;
		case "pipe":
			a(c.in), a(c.out);
			break;
		case "function":
			a(c.input), a(c.output);
			break;
		case "lazy": {
			let r = c._cachedInner ?? (n ? e._zod.innerType : void 0);
			s(r ? Vo(r, t, !1) : zo);
			break;
		}
		case "template_literal":
		case "string":
		case "number":
		case "int":
		case "boolean":
		case "bigint":
		case "symbol":
		case "undefined":
		case "null":
		case "void":
		case "never":
		case "any":
		case "unknown":
		case "date":
		case "nan":
		case "enum":
		case "literal":
		case "file":
		case "transform":
		case "custom": break;
		default: for (let e in c) {
			let t = Object.getOwnPropertyDescriptor(c, e);
			if (!t || t.get) continue;
			let n = t.value;
			if (n && typeof n == "object") {
				if (n._zod) a(n);
				else if (Array.isArray(n)) for (let e of n) a(e);
			}
		}
	}
	return t.delete(e), Ho(e, i);
}
function Ho(e, t) {
	return t !== zo && Lo.set(e, t === Bo), t;
}
function Uo(e, t) {
	let n = e.buckets.get(t);
	return n || (n = /* @__PURE__ */ new WeakMap(), e.buckets.set(t, n)), n;
}
var Wo, Go = [], Ko = {
	alloc(e, t, n) {
		let r = Wo;
		if (!r) return n;
		Wo = void 0;
		let i = {
			value: n,
			issues: null
		};
		return r.set(t.value, i), Go.push(i), n;
	},
	guard(e) {
		var t;
		(t = e._zod).deferred ?? (t.deferred = []), e._zod.deferred.push(() => {
			let t = e._zod.parse, n = (e, n) => {
				if (n.direction !== "backward" && Jo(n, e.value)) throw new Mo();
				return t(e, n);
			};
			e._zod.parse = n, e._zod.run === t && (e._zod.run = n);
		});
	},
	attach(e) {
		var t;
		let n, r = !1, i, a;
		(t = e._zod).deferred ?? (t.deferred = []), e._zod.deferred.push(() => {
			let t = e._zod.parse, o = (s, c) => {
				if (n === void 0) {
					let i = Vo(e, /* @__PURE__ */ new Set(), !1);
					if (i === Ro) return e._zod.parse = t, e._zod.run === o && (e._zod.run = t), t(s, c);
					i === Bo || r ? n = !0 : r = !0;
				}
				let l = s.value;
				if (!Fo(l)) return t(s, c);
				let u = c[No];
				u || (u = {
					buckets: /* @__PURE__ */ new WeakMap(),
					backEdges: void 0
				}, c[No] = u);
				let d;
				i === c ? d = a : (d = Uo(u, e), i = c, a = d);
				let f = d.get(l);
				if (f) return s.value = f.value, f.issues ? f.issues.length && s.issues.push(...Io(f.issues)) : (s.memo = !0, u.backEdges ?? (u.backEdges = /* @__PURE__ */ new WeakSet()), u.backEdges.add(f.value)), s;
				Wo = d;
				let p = Go.length, m = t(s, c);
				Wo = void 0;
				let h = Go.length > p ? Go.pop() : void 0;
				return m instanceof Promise ? m.then((e) => (h && (h.issues = e.issues.length ? Io(e.issues) : Po), e)) : (h && (h.issues = m.issues.length ? Io(m.issues) : Po), m);
			};
			e._zod.parse = o, e._zod.run === t && (e._zod.run = o);
		});
	}
};
function qo() {
	return Ko;
}
function Jo(e, t) {
	let n = e[No]?.backEdges;
	return n !== void 0 && Fo(t) && n.has(t);
}
// node_modules/zod/v4/locales/en.js
var Yo = () => {
	let e = {
		string: {
			unit: "characters",
			verb: "to have"
		},
		file: {
			unit: "bytes",
			verb: "to have"
		},
		array: {
			unit: "items",
			verb: "to have"
		},
		set: {
			unit: "items",
			verb: "to have"
		},
		map: {
			unit: "entries",
			verb: "to have"
		}
	};
	function t(t) {
		return e[t] ?? null;
	}
	let n = {
		regex: "input",
		email: "email address",
		url: "URL",
		emoji: "emoji",
		uuid: "UUID",
		uuidv4: "UUIDv4",
		uuidv6: "UUIDv6",
		nanoid: "nanoid",
		guid: "GUID",
		cuid: "cuid",
		cuid2: "cuid2",
		ulid: "ULID",
		xid: "XID",
		ksuid: "KSUID",
		datetime: "ISO datetime",
		date: "ISO date",
		time: "ISO time",
		duration: "ISO duration",
		ipv4: "IPv4 address",
		ipv6: "IPv6 address",
		mac: "MAC address",
		cidrv4: "IPv4 range",
		cidrv6: "IPv6 range",
		base64: "base64-encoded string",
		base64url: "base64url-encoded string",
		json_string: "JSON string",
		e164: "E.164 number",
		currency_code: "currency code",
		credit_card: "credit card number",
		iban: "IBAN",
		jwt: "JWT",
		template_literal: "input"
	}, r = { nan: "NaN" };
	function i(e, t) {
		return e === "number" && typeof t == "number" && !Number.isFinite(t) ? String(t) : r[e] ?? e;
	}
	return (e) => {
		switch (e.code) {
			case "invalid_type": return `Invalid input: expected ${i(e.expected)}, received ${i(ur(e.input), e.input)}`;
			case "invalid_value": return e.values.length === 1 ? `Invalid input: expected ${Hn(e.values[0])}` : `Invalid option: expected one of ${Sn(e.values, "|")}`;
			case "too_big": {
				let n = e.exact ? "exactly " : e.inclusive ? "<=" : "<", r = t(e.origin);
				return r ? `Too big: expected ${e.origin ?? "value"} to have ${n}${e.maximum.toString()} ${r.unit ?? "elements"}` : `Too big: expected ${e.origin ?? "value"} to be ${n}${e.maximum.toString()}`;
			}
			case "too_small": {
				let n = e.exact ? "exactly " : e.inclusive ? ">=" : ">", r = t(e.origin);
				return r ? `Too small: expected ${e.origin} to have ${n}${e.minimum.toString()} ${r.unit}` : `Too small: expected ${e.origin} to be ${n}${e.minimum.toString()}`;
			}
			case "invalid_format": {
				let t = e;
				return t.format === "starts_with" ? `Invalid string: must start with "${t.prefix}"` : t.format === "ends_with" ? `Invalid string: must end with "${t.suffix}"` : t.format === "includes" ? `Invalid string: must include "${t.includes}"` : t.format === "regex" ? `Invalid string: must match pattern ${t.pattern}` : `Invalid ${n[t.format] ?? e.format}`;
			}
			case "not_multiple_of": return `Invalid number: must be a multiple of ${e.divisor}`;
			case "unrecognized_keys": return `Unrecognized key${e.keys.length > 1 ? "s" : ""}: ${Sn(e.keys, ", ")}`;
			case "invalid_key": return `Invalid key in ${e.origin}`;
			case "invalid_union": return e.options && Array.isArray(e.options) && e.options.length > 0 ? `Invalid discriminator value. Expected ${e.options.map((e) => `'${e}'`).join(" | ")}` : e.inclusive === !1 ? "Invalid input: more than one option matched" : "Invalid input";
			case "invalid_element": return `Invalid value in ${e.origin}`;
			default: return "Invalid input";
		}
	};
};
function Xo() {
	return { localeError: Yo() };
}
// node_modules/zod/v4/core/registries.js
var Zo, Qo = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map();
	}
	add(e, ...t) {
		let n = t[0];
		return this._map.set(e, n), n && typeof n == "object" && "id" in n && this._idmap.set(n.id, e), this;
	}
	clear() {
		return this._map = /* @__PURE__ */ new WeakMap(), this._idmap = /* @__PURE__ */ new Map(), this;
	}
	remove(e) {
		let t = this._map.get(e);
		return t && typeof t == "object" && "id" in t && this._idmap.delete(t.id), this._map.delete(e), this;
	}
	get(e) {
		let t = e._zod.parent;
		if (t) {
			let n = { ...this.get(t) ?? {} };
			delete n.id;
			let r = {
				...n,
				...this._map.get(e)
			};
			return Object.keys(r).length ? r : void 0;
		}
		return this._map.get(e);
	}
	has(e) {
		return this._map.has(e);
	}
};
function $o() {
	return new Qo();
}
(Zo = globalThis).__zod_globalRegistry ?? (Zo.__zod_globalRegistry = $o());
var es = globalThis.__zod_globalRegistry;
// node_modules/zod/v4/core/api.js
function ts(e) {
	return e.checks &&= [...e.checks], e;
}
// @__NO_SIDE_EFFECTS__
function ns(e, t) {
	return new e(ts({
		type: "string",
		...A(t)
	}));
}
// @__NO_SIDE_EFFECTS__
function rs(e, t) {
	return new e({
		type: "string",
		format: "email",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function is(e, t) {
	return new e({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function as(e, t) {
	return new e({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function os(e, t) {
	return new e({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: !1,
		version: "v4",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ss(e, t) {
	return new e({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: !1,
		version: "v6",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function cs(e, t) {
	return new e({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: !1,
		version: "v7",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ls(e, t) {
	return new e({
		type: "string",
		format: "url",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function us(e, t) {
	return new e({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ds(e, t) {
	return new e({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function fs(e, t) {
	return new e({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ps(e, t) {
	return new e({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ms(e, t) {
	return new e({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function hs(e, t) {
	return new e({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function gs(e, t) {
	return new e({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function _s(e, t) {
	return new e({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function vs(e, t) {
	return new e({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ys(e, t) {
	return new e({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function bs(e, t) {
	return new e({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function xs(e, t) {
	return new e({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Ss(e, t) {
	return new e({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Cs(e, t) {
	return new e({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ws(e, t) {
	return new e({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: !1,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Ts(e, t) {
	return new e({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: !1,
		local: !1,
		precision: null,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Es(e, t) {
	return new e({
		type: "string",
		format: "date",
		check: "string_format",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Ds(e, t) {
	return new e({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Os(e, t) {
	return new e({
		type: "string",
		format: "duration",
		check: "string_format",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function ks(e, t) {
	return new e(ts({
		type: "number",
		checks: [],
		...A(t)
	}));
}
// @__NO_SIDE_EFFECTS__
function As(e, t) {
	return new e({
		type: "number",
		check: "number_format",
		abort: !1,
		format: "safeint",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function js(e, t) {
	return new e({
		type: "boolean",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Ms(e) {
	return new e({ type: "unknown" });
}
// @__NO_SIDE_EFFECTS__
function Ns(e, t) {
	return new e({
		type: "never",
		...A(t)
	});
}
// @__NO_SIDE_EFFECTS__
function Ps(e, t) {
	return new Ri({
		check: "less_than",
		...A(t),
		value: e,
		inclusive: !1
	});
}
// @__NO_SIDE_EFFECTS__
function Fs(e, t) {
	return new Ri({
		check: "less_than",
		...A(t),
		value: e,
		inclusive: !0
	});
}
// @__NO_SIDE_EFFECTS__
function Is(e, t) {
	return new zi({
		check: "greater_than",
		...A(t),
		value: e,
		inclusive: !1
	});
}
// @__NO_SIDE_EFFECTS__
function Ls(e, t) {
	return new zi({
		check: "greater_than",
		...A(t),
		value: e,
		inclusive: !0
	});
}
// @__NO_SIDE_EFFECTS__
function Rs(e, t) {
	return new Bi({
		check: "multiple_of",
		...A(t),
		value: e
	});
}
// @__NO_SIDE_EFFECTS__
function zs(e, t) {
	return new Hi({
		check: "max_length",
		...A(t),
		maximum: e
	});
}
// @__NO_SIDE_EFFECTS__
function Bs(e, t) {
	return new Ui({
		check: "min_length",
		...A(t),
		minimum: e
	});
}
// @__NO_SIDE_EFFECTS__
function Vs(e, t) {
	return new Wi({
		check: "length_equals",
		...A(t),
		length: e
	});
}
// @__NO_SIDE_EFFECTS__
function Hs(e, t) {
	return new Ki({
		check: "string_format",
		format: "regex",
		...A(t),
		pattern: e
	});
}
// @__NO_SIDE_EFFECTS__
function Us(e) {
	return new qi({
		check: "string_format",
		format: "lowercase",
		...A(e)
	});
}
// @__NO_SIDE_EFFECTS__
function Ws(e) {
	return new Ji({
		check: "string_format",
		format: "uppercase",
		...A(e)
	});
}
// @__NO_SIDE_EFFECTS__
function Gs(e, t) {
	return new Yi({
		check: "string_format",
		format: "includes",
		...A(t),
		includes: e
	});
}
// @__NO_SIDE_EFFECTS__
function Ks(e, t) {
	return new Xi({
		check: "string_format",
		format: "starts_with",
		...A(t),
		prefix: e
	});
}
// @__NO_SIDE_EFFECTS__
function qs(e, t) {
	return new Zi({
		check: "string_format",
		format: "ends_with",
		...A(t),
		suffix: e
	});
}
// @__NO_SIDE_EFFECTS__
function Js(e) {
	return new Qi({
		check: "overwrite",
		tx: e
	});
}
// @__NO_SIDE_EFFECTS__
function Ys(e) {
	return /* @__PURE__ */ Js((t) => t.normalize(e));
}
// @__NO_SIDE_EFFECTS__
function Xs() {
	return /* @__PURE__ */ Js((e) => e.trim());
}
// @__NO_SIDE_EFFECTS__
function Zs() {
	return /* @__PURE__ */ Js((e) => e.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function Qs() {
	return /* @__PURE__ */ Js((e) => e.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function $s() {
	return /* @__PURE__ */ Js((e) => Pn(e));
}
// @__NO_SIDE_EFFECTS__
function ec(e, t, n) {
	return new e({
		type: "array",
		element: t,
		...A(n)
	});
}
// @__NO_SIDE_EFFECTS__
function tc(e, t, n) {
	return new e({
		type: "custom",
		check: "custom",
		fn: t,
		...A(n)
	});
}
// @__NO_SIDE_EFFECTS__
function nc(e, t) {
	let n = /* @__PURE__ */ rc((t) => (t.addIssue = (e) => {
		if (typeof e == "string") t.issues.push(dr(e, t.value, n._zod.def));
		else {
			let r = e;
			r.fatal && (r.continue = !1), r.code ??= "custom", "input" in r || (r.input = t.value), r.inst ??= n, r.continue ??= !n._zod.def.abort, t.issues.push(dr(r));
		}
	}, e(t.value, t)), t);
	return n;
}
// @__NO_SIDE_EFFECTS__
function rc(e, t) {
	let n = new R({
		check: "custom",
		...A(t)
	});
	return n._zod.check = e, n;
}
// node_modules/zod/v4/core/to-json-schema.js
function ic(e, ...t) {
	for (let n of t) for (let t of Reflect.ownKeys(n)) Object.prototype.propertyIsEnumerable.call(n, t) && T(e, t, n[t]);
	return e;
}
function ac(e) {
	let t = e?.target ?? "draft-2020-12";
	return t === "draft-4" && (t = "draft-04"), t === "draft-7" && (t = "draft-07"), {
		processors: e.processors ?? {},
		metadataRegistry: e?.metadata ?? es,
		target: t,
		unrepresentable: e?.unrepresentable ?? "throw",
		override: e?.override ?? (() => {}),
		io: e?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		sharedDefsExtractedFor: void 0,
		sharedEmitDoneFor: void 0,
		cycles: e?.cycles ?? "ref",
		reused: e?.reused ?? "inline",
		intersections: [],
		deferred: [],
		external: e?.external ?? void 0
	};
}
function V(e, t, n, r, i) {
	let a = typeof t.unrepresentable == "function" ? t.unrepresentable({
		zodSchema: e,
		path: r.path,
		message: i
	}) : t.unrepresentable;
	if (a === "any") return !1;
	if (a === void 0 || a === "throw") throw Error(i);
	return Object.assign(n, a), !0;
}
function H(e, t, n = {
	path: [],
	schemaPath: []
}) {
	var r;
	let i = e._zod.def, a = t.seen.get(e);
	if (a) return a.count++, n.schemaPath.includes(e) && (a.cycle = n.path), a.schema;
	let o = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: n.path
	};
	t.seen.set(e, o), t.sharedDefsExtractedFor = void 0, t.sharedEmitDoneFor = void 0;
	let s = e._zod.toJSONSchema?.();
	if (s) o.schema = s;
	else {
		let r = {
			...n,
			schemaPath: [...n.schemaPath, e],
			path: n.path
		};
		if (e._zod.processJSONSchema) e._zod.processJSONSchema(t, o.schema, r);
		else {
			let n = o.schema, a = t.processors[i.type];
			if (!a) throw Error(`[toJSONSchema]: Non-representable type encountered: ${i.type}`);
			a(e, t, n, r);
		}
		let a = e._zod.parent;
		a && (o.ref ||= a, H(a, t, r), t.seen.get(a).isParent = !0);
	}
	let c = t.metadataRegistry.get(e);
	return c && ic(o.schema, c), t.io === "input" && U(e) && (delete o.schema.examples, delete o.schema.default), t.io === "input" && "_prefault" in o.schema && ((r = o.schema).default ?? (r.default = o.schema._prefault)), delete o.schema._prefault, t.seen.get(e).schema;
}
function oc(e) {
	return e.replace(/~/g, "~0").replace(/\//g, "~1");
}
function sc(e, t) {
	let n = e.seen.get(t);
	if (!n) throw Error("Unprocessed schema. This is a bug in Zod.");
	if (e.external && e.sharedDefsExtractedFor === e.external) return;
	let r = /* @__PURE__ */ new Map();
	for (let t of e.seen.entries()) {
		let n = e.metadataRegistry.get(t[0])?.id;
		if (n) {
			let e = r.get(n);
			if (e && e !== t[0]) throw Error(`Duplicate schema id "${n}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			r.set(n, t[0]);
		}
	}
	let i = (t) => {
		let r = e.target === "draft-2020-12" ? "$defs" : "definitions";
		if (e.external) {
			let n = e.external.registry.get(t[0])?.id, i = e.external.uri ?? ((e) => e);
			if (n) return { ref: i(n) };
			let a = t[1].defId ?? t[1].schema.id ?? `schema${e.counter++}`;
			return t[1].defId = a, {
				defId: a,
				ref: `${i("__shared")}#/${r}/${oc(a)}`
			};
		}
		let i = `#/${r}/`;
		if (t[1] === n && !t[1].schema.id) return { ref: "#" };
		let a = t[1].schema.id ?? `__schema${e.counter++}`;
		return {
			defId: a,
			ref: i + oc(a)
		};
	}, a = (e) => {
		if (e[1].schema.$ref) return;
		let t = e[1], { ref: n, defId: r } = i(e);
		t.def = { ...t.schema }, r && (t.defId = r);
		let a = t.schema;
		for (let e in a) delete a[e];
		a.$ref = n;
	};
	if (e.cycles === "throw") for (let t of e.seen.entries()) {
		let e = t[1];
		if (e.cycle) throw Error(`Cycle detected: #/${e.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (let n of e.seen.entries()) {
		let r = n[1];
		if (t === n[0]) a(n);
		else {
			if (e.external) {
				let r = e.external.registry.get(n[0])?.id;
				if (t !== n[0] && r) {
					a(n);
					continue;
				}
			}
			(e.metadataRegistry.get(n[0])?.id || r.cycle || r.count > 1 && e.reused === "ref") && a(n);
		}
	}
	e.external && (e.sharedDefsExtractedFor = e.external);
}
function cc(e) {
	let t = e.anyOf;
	if (!Array.isArray(t) || t.length === 0 || e.type !== void 0) return;
	let n = [];
	for (let e of t) {
		if (!e || typeof e != "object") return;
		cc(e);
		let t = Object.keys(e);
		if (t.length !== 1 || t[0] !== "type") return;
		let r = e.type;
		for (let e of Array.isArray(r) ? r : [r]) {
			if (typeof e != "string") return;
			n.includes(e) || n.push(e);
		}
	}
	delete e.anyOf, e.type = n.length === 1 ? n[0] : n;
}
var lc = /* @__PURE__ */ new Set([
	"type",
	"properties",
	"required",
	"additionalProperties"
]), uc = ["oneOf", "anyOf"];
function dc(e) {
	let t = e.additionalProperties;
	return t === void 0 || t === !1 || typeof t != "object" || !t ? null : Object.keys(t).length ? t : null;
}
function fc(e) {
	let t = [];
	for (let n of e) {
		if (typeof n != "object" || n.type !== "object") return null;
		for (let e in n) if (!lc.has(e)) return null;
		t.push(n);
	}
	let n = {}, r = /* @__PURE__ */ new Set();
	for (let e of t) {
		for (let r in e.properties) {
			if (Object.prototype.hasOwnProperty.call(n, r)) continue;
			let e = [];
			for (let n of t) {
				let t = n.properties?.[r] ?? dc(n);
				t != null && (e.some((e) => JSON.stringify(e) === JSON.stringify(t)) || e.push(t));
			}
			T(n, r, e.length === 1 ? e[0] : fc(e) ?? { allOf: e });
		}
		for (let t of e.required ?? []) r.add(t);
	}
	let i = {
		type: "object",
		properties: n
	};
	if (r.size && (i.required = [...r]), t.every((e) => e.additionalProperties === !1)) i.additionalProperties = !1;
	else {
		let e = [];
		for (let n of t) {
			let t = dc(n);
			t && !e.some((e) => JSON.stringify(e) === JSON.stringify(t)) && e.push(t);
		}
		e.length === 1 ? i.additionalProperties = e[0] : e.length > 1 && (i.additionalProperties = { allOf: e });
	}
	return i;
}
function pc(e) {
	let t = e.allOf;
	if (!Array.isArray(t) || t.length < 2) return;
	for (let t of lc) if (t in e) return;
	let n = t.filter((e) => uc.some((t) => Array.isArray(e[t]))), r = null;
	if (!n.length) r = fc(t);
	else {
		let e = n[0], i = uc.find((t) => Array.isArray(e[t]));
		if (Object.keys(e).length !== 1) return;
		let a = t.filter((t) => t !== e), o = e[i].map((e) => fc([...a, e]));
		if (o.some((e) => !e)) return;
		r = { [i]: o };
	}
	r && (delete e.allOf, ic(e, r));
}
function mc(e, t) {
	let n = e.seen.get(t);
	if (!n) throw Error("Unprocessed schema. This is a bug in Zod.");
	let r = (t) => {
		let n = e.seen.get(t);
		if (n.ref === null) return;
		let i = n.def ?? n.schema, a = { ...i }, o = n.ref;
		if (n.ref = null, o) {
			r(o);
			let n = e.seen.get(o), s = n.schema;
			if (s.$ref && (e.target === "draft-07" || e.target === "draft-04" || e.target === "openapi-3.0") ? (i.allOf = i.allOf ?? [], i.allOf.push(s)) : ic(i, s), ic(i, a), t._zod.parent === o) for (let e in i) e !== "$ref" && e !== "allOf" && (e in a || delete i[e]);
			if (s.$ref && n.def) for (let e in i) e !== "$ref" && e !== "allOf" && e in n.def && JSON.stringify(i[e]) === JSON.stringify(n.def[e]) && delete i[e];
		}
		let s = t._zod.parent;
		if (s && s !== o) {
			r(s);
			let t = e.seen.get(s);
			if (t?.schema.$ref && (i.$ref = t.schema.$ref, t.def)) for (let e in i) e !== "$ref" && e !== "allOf" && e in t.def && JSON.stringify(i[e]) === JSON.stringify(t.def[e]) && delete i[e];
		}
		e.override({
			zodSchema: t,
			jsonSchema: i,
			path: n.path ?? []
		});
	};
	if (!e.external || e.sharedEmitDoneFor !== e.external) {
		for (let t of [...e.seen.entries()].reverse()) r(t[0]);
		if (e.target !== "openapi-3.0") for (let t of e.seen.entries()) cc(t[1].def ?? t[1].schema);
		for (let t of e.deferred) t();
		if (e.intersections.length) {
			let t = /* @__PURE__ */ new Map();
			for (let n of e.seen.values()) for (let e of [n.schema, n.def]) {
				let n = e?.allOf;
				if (!Array.isArray(n)) continue;
				let r = t.get(n);
				r ? r.push(e) : t.set(n, [e]);
			}
			for (let n of e.intersections) for (let e of t.get(n) ?? []) pc(e);
		}
	}
	let i = {};
	if (e.target === "draft-2020-12" ? i.$schema = "https://json-schema.org/draft/2020-12/schema" : e.target === "draft-07" ? i.$schema = "http://json-schema.org/draft-07/schema#" : e.target === "draft-04" ? i.$schema = "http://json-schema.org/draft-04/schema#" : e.target, e.external?.uri) {
		let n = e.external.registry.get(t)?.id;
		if (!n) throw Error("Schema is missing an `id` property");
		i.$id = e.external.uri(n);
	}
	ic(i, n.defId ? n.schema : n.def ?? n.schema);
	let a = e.metadataRegistry.get(t)?.id;
	a !== void 0 && i.id === a && delete i.id;
	let o = e.external?.defs ?? {};
	if (!e.external || e.sharedEmitDoneFor !== e.external) for (let t of e.seen.entries()) {
		let e = t[1];
		e.def && e.defId && (e.def.id === e.defId && delete e.def.id, T(o, e.defId, e.def));
	}
	e.external && (e.sharedEmitDoneFor = e.external), e.external || Object.keys(o).length > 0 && (e.target === "draft-2020-12" ? i.$defs = o : i.definitions = o);
	try {
		let n = JSON.parse(JSON.stringify(i));
		return Object.defineProperty(n, "~standard", {
			value: {
				...t["~standard"],
				jsonSchema: {
					input: gc(t, "input", e.processors),
					output: gc(t, "output", e.processors)
				}
			},
			enumerable: !1,
			writable: !1
		}), n;
	} catch {
		throw Error("Error converting schema to JSON.");
	}
}
function U(e, t) {
	let n = t ?? { seen: /* @__PURE__ */ new Set() };
	if (n.seen.has(e)) return !1;
	n.seen.add(e);
	let r = e._zod.def;
	if (r.type === "transform") return !0;
	if (r.type === "array") return U(r.element, n);
	if (r.type === "set") return U(r.valueType, n);
	if (r.type === "lazy") return U(r.getter(), n);
	if (r.type === "promise" || r.type === "optional" || r.type === "nonoptional" || r.type === "nullable" || r.type === "readonly" || r.type === "default" || r.type === "prefault" || r.type === "catch") return U(r.innerType, n);
	if (r.type === "intersection") return U(r.left, n) || U(r.right, n);
	if (r.type === "record" || r.type === "map") return U(r.keyType, n) || U(r.valueType, n);
	if (r.type === "pipe") return e._zod.traits.has("$ZodCodec") ? !0 : U(r.in, n) || U(r.out, n);
	if (r.type === "object") {
		for (let e in r.shape) if (U(r.shape[e], n)) return !0;
		return !1;
	}
	if (r.type === "union") {
		for (let e of r.options) if (U(e, n)) return !0;
		return !1;
	}
	if (r.type === "tuple") {
		for (let e of r.items) if (U(e, n)) return !0;
		return !!(r.rest && U(r.rest, n));
	}
	return !1;
}
var hc = (e, t = {}) => (n) => {
	let r = ac({
		...n,
		processors: t
	});
	return H(e, r), sc(r, e), mc(r, e);
}, gc = (e, t, n = {}) => (r) => {
	let { libraryOptions: i, target: a } = r ?? {}, o = ac({
		...i ?? {},
		target: a,
		io: t,
		processors: n
	});
	return H(e, o), sc(o, e), mc(o, e);
}, _c = (e, t, n) => {
	(e[t] === void 0 || n > e[t]) && (e[t] = n);
}, vc = (e, t, n) => {
	(e[t] === void 0 || n < e[t]) && (e[t] = n);
}, yc = (e, t) => {
	_c(e, "minimum", t), vc(e, "maximum", t);
}, bc = (e, t) => {
	e.multipleOf ??= [], e.multipleOf.includes(t) || e.multipleOf.push(t);
}, xc = (e, t) => {
	e.patterns ??= /* @__PURE__ */ new Set(), e.patterns.add(t);
}, Sc = (e, t) => {
	e.mime = e.mime ? e.mime.filter((e) => t.includes(e)) : [...t];
}, Cc = (e, t) => {
	e.format = t, t.includes("int") && (e.isInt = !0);
}, wc = (e, t) => _c(e, "minimum", t.minimum), Tc = (e, t) => vc(e, "maximum", t.maximum), Ec = (e) => (t, n) => {
	Cc(t, n.format);
	let [r, i] = e[n.format];
	_c(t, "minimum", r), vc(t, "maximum", i);
}, Dc = {
	greater_than: (e, t) => _c(e, t.inclusive ? "minimum" : "exclusiveMinimum", t.value),
	less_than: (e, t) => vc(e, t.inclusive ? "maximum" : "exclusiveMaximum", t.value),
	multiple_of: (e, t) => bc(e, t.value),
	number_format: Ec(Wn),
	bigint_format: Ec(Gn),
	min_length: wc,
	max_length: Tc,
	length_equals: (e, t) => yc(e, t.length),
	min_size: wc,
	max_size: Tc,
	size_equals: (e, t) => yc(e, t.size),
	string_format: (e, t) => {
		Cc(e, t.format), t.pattern && xc(e, t.pattern), (t.format === "base64" || t.format === "base64url") && (e.contentEncoding = t.format), (t.local || t.precision === -1) && (e.laxFormat = !0);
	},
	mime_type: (e, t) => Sc(e, t.mime)
};
function W(e) {
	let t = {}, n = e._zod.def, r = e._zod.traits.has("$ZodCheck") ? [e, ...n.checks ?? []] : n.checks ?? [];
	for (let e of r) Dc[e._zod.def.check]?.(t, e._zod.def);
	let i = e._zod.bag;
	i.minimum !== void 0 && _c(t, "minimum", i.minimum), i.exclusiveMinimum !== void 0 && _c(t, "exclusiveMinimum", i.exclusiveMinimum), i.maximum !== void 0 && vc(t, "maximum", i.maximum), i.exclusiveMaximum !== void 0 && vc(t, "exclusiveMaximum", i.exclusiveMaximum), i.multipleOf !== void 0 && bc(t, i.multipleOf), i.format !== void 0 && (t.format ??= i.format, i.format.includes("int") && (t.isInt = !0)), i.mime && Sc(t, i.mime);
	for (let e of i.patterns ?? []) xc(t, e);
	return t;
}
var Oc = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
}, kc = /* @__PURE__ */ new Map([[Fa, xi], [La, Si]]), Ac = (e) => kc.get(e) ?? e, jc = (e, t, n, r) => {
	let i = n;
	i.type = "string";
	let { minimum: a, maximum: o, format: s, patterns: c, contentEncoding: l, laxFormat: u } = W(e);
	if (typeof a == "number" && (i.minLength = a), typeof o == "number" && (i.maxLength = o), s && (i.format = Oc[s] ?? s, i.format === "" && delete i.format, (s === "time" || u) && delete i.format), l && (i.contentEncoding = l), c && c.size > 0) {
		let e = [...c].map(Ac);
		e.length === 1 ? i.pattern = e[0].source : e.length > 1 && (i.allOf = [...e.map((e) => ({
			...t.target === "draft-07" || t.target === "draft-04" || t.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: e.source
		}))]);
	}
}, Mc = (e, t, n, r) => {
	let i = n, { minimum: a, maximum: o, multipleOf: s, exclusiveMaximum: c, exclusiveMinimum: l, isInt: u } = W(e);
	i.type = u ? "integer" : "number";
	let d = typeof l == "number" && l >= (a ?? -Infinity), f = typeof c == "number" && c <= (o ?? Infinity), p = t.target === "draft-04" || t.target === "openapi-3.0";
	if (d ? p ? (i.minimum = l, i.exclusiveMinimum = !0) : i.exclusiveMinimum = l : typeof a == "number" && (i.minimum = a), f ? p ? (i.maximum = c, i.exclusiveMaximum = !0) : i.exclusiveMaximum = c : typeof o == "number" && (i.maximum = o), s) {
		let n = /* @__PURE__ */ new Set();
		for (let a of s) Number.isFinite(a) && a !== 0 ? n.add(Math.abs(a)) : V(e, t, i, r, `A multipleOf divisor of ${a} cannot be represented in JSON Schema`);
		let [a, ...o] = n;
		a !== void 0 && (i.multipleOf = a), o.length && (i.allOf = [...i.allOf ?? [], ...o.map((e) => ({ multipleOf: e }))]);
	}
}, Nc = (e, t, n, r) => {
	n.type = "boolean";
}, Pc = (e, t, n, r) => {
	n.not = {};
}, Fc = (e, t, n, r) => {
	let i = e._zod.def, a = xn(i.entries);
	a.length === 0 ? n.not = {} : (a.every((e) => typeof e == "number") && (n.type = "number"), a.every((e) => typeof e == "string") && (n.type = "string"), n.enum = a);
}, Ic = (e, t, n, r) => {
	let i = e._zod.def;
	if (i.values.length === 0) {
		n.not = {};
		return;
	}
	let a = [];
	for (let o of i.values) if (o === void 0) {
		if (V(e, t, n, r, "Literal `undefined` cannot be represented in JSON Schema")) return;
	} else if (typeof o == "bigint") {
		if (V(e, t, n, r, "BigInt literals cannot be represented in JSON Schema")) return;
		a.push(Number(o));
	} else a.push(o);
	if (a.length !== 0) {
		if (a.length === 1) {
			let e = a[0];
			n.type = e === null ? "null" : typeof e, t.target === "draft-04" || t.target === "openapi-3.0" ? n.enum = [e] : n.const = e;
		} else a.every((e) => typeof e == "number") && (n.type = "number"), a.every((e) => typeof e == "string") && (n.type = "string"), a.every((e) => typeof e == "boolean") && (n.type = "boolean"), a.every((e) => e === null) && (n.type = "null"), n.enum = a;
	}
}, Lc = (e, t, n, r) => {
	V(e, t, n, r, "Custom types cannot be represented in JSON Schema");
}, Rc = (e, t, n, r) => {
	V(e, t, n, r, "Transforms cannot be represented in JSON Schema");
}, zc = (e, t, n, r) => {
	let i = n, a = e._zod.def, { minimum: o, maximum: s } = W(e);
	typeof o == "number" && (i.minItems = o), typeof s == "number" && (i.maxItems = s), i.type = "array", i.items = H(a.element, t, {
		...r,
		path: [...r.path, "items"]
	});
};
function Bc(e) {
	let t = e._zod.def;
	return t.type === "pipe" && t.in._zod.traits.has("$ZodTransform") ? Bc(t.out) : t.type === "catch" ? Bc(t.innerType) : e._zod.optin;
}
var Vc = (e, t, n, r) => {
	let i = n, a = e._zod.def, o = a.shape;
	if (Object.getOwnPropertySymbols(o).length && V(e, t, i, r, "Symbol keys cannot be represented in JSON Schema")) return;
	i.type = "object", i.properties = {};
	for (let e in o) T(i.properties, e, H(o[e], t, {
		...r,
		path: [
			...r.path,
			"properties",
			e
		]
	}));
	let s = [];
	for (let e of Object.keys(o)) {
		let n = a.shape[e];
		(t.io === "input" ? Bc(n) === void 0 : n._zod.optout === void 0) && s.push(e);
	}
	s.length > 0 && (i.required = s), a.catchall?._zod.def.type === "never" ? i.additionalProperties = !1 : a.catchall ? a.catchall && (i.additionalProperties = H(a.catchall, t, {
		...r,
		path: [...r.path, "additionalProperties"]
	})) : t.io === "output" && (i.additionalProperties = !1);
}, Hc = (e, t, n, r) => {
	let i = e._zod.def, a = i.inclusive === !1, o = i.options.map((e, n) => H(e, t, {
		...r,
		path: [
			...r.path,
			a ? "oneOf" : "anyOf",
			n
		]
	}));
	a ? n.oneOf = o : n.anyOf = o;
}, Uc = (e, t, n, r) => {
	let i = e._zod.def, a = H(i.left, t, {
		...r,
		path: [
			...r.path,
			"allOf",
			0
		]
	}), o = H(i.right, t, {
		...r,
		path: [
			...r.path,
			"allOf",
			1
		]
	}), s = (e) => "allOf" in e && Object.keys(e).length === 1, c = [...s(a) ? a.allOf : [a], ...s(o) ? o.allOf : [o]];
	n.allOf = c, t.intersections.push(c);
}, Wc = (e, t, n, r) => {
	let i = e._zod.def, a = H(i.innerType, t, r), o = t.seen.get(e);
	t.target === "openapi-3.0" ? (o.ref = i.innerType, n.nullable = !0) : n.anyOf = [a, { type: "null" }];
}, Gc = (e, t, n, r) => {
	let i = e._zod.def;
	H(i.innerType, t, r);
	let a = t.seen.get(e);
	a.ref = i.innerType;
}, Kc = Symbol();
function qc(e, t, n, r, i) {
	let a = !1, o = JSON.stringify(e, (e, t) => typeof t == "bigint" ? (a = !0, null) : t);
	return a ? (V(t, n, r, i, "BigInt defaults cannot be represented in JSON Schema"), Kc) : JSON.parse(o);
}
var Jc = (e, t, n, r) => {
	let i = e._zod.def;
	H(i.innerType, t, r);
	let a = t.seen.get(e);
	a.ref = i.innerType;
	let o = qc(i.defaultValue, e, t, n, r);
	o !== Kc && (n.default = o);
}, Yc = (e, t, n, r) => {
	let i = e._zod.def;
	H(i.innerType, t, r);
	let a = t.seen.get(e);
	if (a.ref = i.innerType, t.io !== "input") return;
	let o = qc(i.defaultValue, e, t, n, r);
	o !== Kc && (n._prefault = o);
}, Xc = (e, t, n, r) => {
	let i = e._zod.def;
	H(i.innerType, t, r);
	let a = t.seen.get(e);
	a.ref = i.innerType;
	let o;
	try {
		o = i.catchValue(void 0);
	} catch {
		V(e, t, n, r, "Dynamic catch values are not supported in JSON Schema");
		return;
	}
	n.default = o;
}, Zc = (e, t, n, r) => {
	let i = e._zod.def, a = i.in._zod.traits.has("$ZodTransform"), o = t.io === "input" ? a ? i.out : i.in : i.out;
	H(o, t, r);
	let s = t.seen.get(e);
	s.ref = o;
}, Qc = (e, t, n, r) => {
	let i = e._zod.def;
	H(i.innerType, t, r);
	let a = t.seen.get(e);
	a.ref = i.innerType, n.readOnly = !0;
}, $c = (e, t, n, r) => {
	let i = e._zod.def;
	H(i.innerType, t, r);
	let a = t.seen.get(e);
	a.ref = i.innerType;
}, el = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function tl(e, t, n) {
	Object.defineProperty(e, t, {
		configurable: !0,
		enumerable: !1,
		get() {
			let e = n(this);
			return Object.defineProperty(this, t, {
				value: e,
				configurable: !0,
				writable: !0
			}), e;
		},
		set(e) {
			Object.defineProperty(this, t, {
				value: e,
				configurable: !0,
				writable: !0
			});
		}
	});
}
var G = /*@__PURE__*/ P("ZodError", (e, t) => {
	Nr.init(e, t), e.name = "ZodError";
	let n = Object.getPrototypeOf(e);
	el.has(n) || (el.add(n), tl(n, "format", (e) => (t) => Ir(e, t)), tl(n, "flatten", (e) => (t) => Fr(e, t)), tl(n, "addIssue", (e) => (t) => {
		e.issues.push(t), e.message = JSON.stringify(e.issues, Cn, 2);
	}), tl(n, "addIssues", (e) => (t) => {
		e.issues.push(...t), e.message = JSON.stringify(e.issues, Cn, 2);
	}), Object.defineProperty(n, "isEmpty", {
		configurable: !0,
		enumerable: !1,
		get() {
			return this.issues.length === 0;
		}
	}));
}, void 0, { Parent: Error }), nl = /* @__PURE__ */ Br(G), rl = /* @__PURE__ */ Vr(G), il = /* @__PURE__ */ Hr(G), al = /* @__PURE__ */ Wr(G), ol = /* @__PURE__ */ Xr(G), sl = /* @__PURE__ */ Zr(G), cl = /* @__PURE__ */ Qr(G), ll = /* @__PURE__ */ $r(G), ul = /* @__PURE__ */ ei(G), dl = /* @__PURE__ */ ti(G), fl = /* @__PURE__ */ ni(G), pl = /* @__PURE__ */ ri(G);
// node_modules/zod/v4/classic/schemas.js
function ml() {
	I.localeError || L(Xo());
}
function hl() {
	I.memoizer || L({ memoizer: qo() });
}
var K = /*@__PURE__*/ P("ZodType", (e, t) => (ml(), z.init(e, t), e.def = t, e.type = t.type, e), {
	check(...e) {
		let t = this.def;
		return this.clone(O(t, { checks: [...t.checks ?? [], ...e.map((e) => typeof e == "function" ? { _zod: {
			check: e,
			def: { check: "custom" },
			onattach: []
		} } : e)] }), { parent: !0 });
	},
	with(...e) {
		return this.check(...e);
	},
	clone(e, t) {
		return k(this, e, t);
	},
	brand() {
		return this;
	},
	register(e, t) {
		return e.add(this, t), this;
	},
	refine(e, t) {
		return this.check(Au(e, t));
	},
	superRefine(e, t) {
		return this.check(ju(e, t));
	},
	overwrite(e) {
		return this.check(/* @__PURE__ */ Js(e));
	},
	optional() {
		return fu(this);
	},
	exactOptional() {
		return mu(this);
	},
	nullable() {
		return gu(this);
	},
	nullish() {
		return fu(gu(this));
	},
	nonoptional(e) {
		return Su(this, e);
	},
	array() {
		return Y(this);
	},
	or(e) {
		return eu([this, e]);
	},
	and(e) {
		return iu(this, e);
	},
	transform(e) {
		return Eu(this, uu(e));
	},
	default(e) {
		return vu(this, e);
	},
	prefault(e) {
		return bu(this, e);
	},
	catch(e) {
		return wu(this, e);
	},
	pipe(e) {
		return Eu(this, e);
	},
	readonly() {
		return Ou(this);
	},
	describe(e) {
		let t = this.clone();
		return es.add(t, { description: e }), t;
	},
	meta(...e) {
		if (e.length === 0) return es.get(this);
		let t = this.clone();
		return es.add(t, e[0]), t;
	},
	isOptional() {
		return this.safeParse(void 0).success;
	},
	isNullable() {
		return this.safeParse(null).success;
	},
	apply(e, ...t) {
		return t.length === 0 ? e(this) : e(this, ...t);
	},
	get "~standard"() {
		return pr(this, "~standard", {
			...ra(this),
			jsonSchema: {
				input: gc(this, "input"),
				output: gc(this, "output")
			}
		});
	},
	set "~standard"(e) {
		M(this, "~standard", e);
	},
	parse: function e(t, n) {
		return nl(this, t, n, { callee: e });
	},
	parseAsync: async function e(t, n) {
		return await rl(this, t, n, { callee: e });
	},
	safeParse(e, t) {
		return il(this, e, t);
	},
	async safeParseAsync(e, t) {
		return al(this, e, t);
	},
	get spa() {
		return this?.safeParseAsync;
	},
	set spa(e) {
		M(this, "spa", e);
	},
	validate(e, t) {
		return qr(this, e, t);
	},
	validateAsync(e, t) {
		return Yr(this, e, t);
	},
	encode: function e(t, n) {
		return ol(this, t, n, { callee: e });
	},
	decode: function e(t, n) {
		return sl(this, t, n, { callee: e });
	},
	encodeAsync: async function e(t, n) {
		return await cl(this, t, n, { callee: e });
	},
	decodeAsync: async function e(t, n) {
		return await ll(this, t, n, { callee: e });
	},
	safeEncode(e, t) {
		return ul(this, e, t);
	},
	safeDecode(e, t) {
		return dl(this, e, t);
	},
	async safeEncodeAsync(e, t) {
		return fl(this, e, t);
	},
	async safeDecodeAsync(e, t) {
		return pl(this, e, t);
	},
	toJSONSchema(e) {
		return hc(this, {})(e);
	},
	get description() {
		return es.get(this)?.description;
	},
	get _def() {
		return this._zod.def;
	}
}), gl = /*@__PURE__*/ P("_ZodString", (e, t) => {
	ia.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => jc(e, t, n, r);
}, /*@__PURE__*/ mr({
	format: (e) => W(e).format ?? null,
	minLength: (e) => W(e).minimum ?? null,
	maxLength: (e) => W(e).maximum ?? null
}, {
	regex(...e) {
		return this.check(/* @__PURE__ */ Hs(...e));
	},
	includes(...e) {
		return this.check(/* @__PURE__ */ Gs(...e));
	},
	startsWith(...e) {
		return this.check(/* @__PURE__ */ Ks(...e));
	},
	endsWith(...e) {
		return this.check(/* @__PURE__ */ qs(...e));
	},
	min(...e) {
		return this.check(/* @__PURE__ */ Bs(...e));
	},
	max(...e) {
		return this.check(/* @__PURE__ */ zs(...e));
	},
	length(...e) {
		return this.check(/* @__PURE__ */ Vs(...e));
	},
	nonempty(...e) {
		return this.check(/* @__PURE__ */ Bs(1, ...e));
	},
	lowercase(e) {
		return this.check(/* @__PURE__ */ Us(e));
	},
	uppercase(e) {
		return this.check(/* @__PURE__ */ Ws(e));
	},
	trim() {
		return this.check(/* @__PURE__ */ Xs());
	},
	normalize(...e) {
		return this.check(/* @__PURE__ */ Ys(...e));
	},
	toLowerCase() {
		return this.check(/* @__PURE__ */ Zs());
	},
	toUpperCase() {
		return this.check(/* @__PURE__ */ Qs());
	},
	slugify() {
		return this.check(/* @__PURE__ */ $s());
	}
})), _l = /*@__PURE__*/ P("ZodString", (e, t) => {
	ia.init(e, t), gl.init(e, t);
}, {
	email(e) {
		return this.check(/* @__PURE__ */ rs(Sl, e));
	},
	url(e) {
		return this.check(/* @__PURE__ */ ls(Tl, e));
	},
	jwt(e) {
		return this.check(/* @__PURE__ */ ws(Bl, e));
	},
	emoji(e) {
		return this.check(/* @__PURE__ */ us(El, e));
	},
	guid(e) {
		return this.check(/* @__PURE__ */ is(Cl, e));
	},
	uuid(e) {
		return this.check(/* @__PURE__ */ as(wl, e));
	},
	uuidv4(e) {
		return this.check(/* @__PURE__ */ os(wl, e));
	},
	uuidv6(e) {
		return this.check(/* @__PURE__ */ ss(wl, e));
	},
	uuidv7(e) {
		return this.check(/* @__PURE__ */ cs(wl, e));
	},
	nanoid(e) {
		return this.check(/* @__PURE__ */ ds(Dl, e));
	},
	cuid(e) {
		return this.check(/* @__PURE__ */ fs(Ol, e));
	},
	cuid2(e) {
		return this.check(/* @__PURE__ */ ps(kl, e));
	},
	ulid(e) {
		return this.check(/* @__PURE__ */ ms(Al, e));
	},
	base64(e) {
		return this.check(/* @__PURE__ */ xs(Ll, e));
	},
	base64url(e) {
		return this.check(/* @__PURE__ */ Ss(Rl, e));
	},
	xid(e) {
		return this.check(/* @__PURE__ */ hs(jl, e));
	},
	ksuid(e) {
		return this.check(/* @__PURE__ */ gs(Ml, e));
	},
	ipv4(e) {
		return this.check(/* @__PURE__ */ _s(Nl, e));
	},
	ipv6(e) {
		return this.check(/* @__PURE__ */ vs(Pl, e));
	},
	cidrv4(e) {
		return this.check(/* @__PURE__ */ ys(Fl, e));
	},
	cidrv6(e) {
		return this.check(/* @__PURE__ */ bs(Il, e));
	},
	e164(e) {
		return this.check(/* @__PURE__ */ Cs(zl, e));
	},
	datetime(e) {
		return this.check(/* @__PURE__ */ Ts(vl, e));
	},
	date(e) {
		return this.check(/* @__PURE__ */ Es(yl, e));
	},
	time(e) {
		return this.check(/* @__PURE__ */ Ds(bl, e));
	},
	duration(e) {
		return this.check(/* @__PURE__ */ Os(xl, e));
	}
});
function q(e) {
	return /* @__PURE__ */ ns(_l, e);
}
var J = /*@__PURE__*/ P("ZodStringFormat", (e, t) => {
	B.init(e, t), gl.init(e, t);
}), vl = /*@__PURE__*/ P("ZodISODateTime", (e, t) => {
	Ca.init(e, t), J.init(e, t);
}), yl = /*@__PURE__*/ P("ZodISODate", (e, t) => {
	wa.init(e, t), J.init(e, t);
}), bl = /*@__PURE__*/ P("ZodISOTime", (e, t) => {
	Ta.init(e, t), J.init(e, t);
}), xl = /*@__PURE__*/ P("ZodISODuration", (e, t) => {
	Ea.init(e, t), J.init(e, t);
}), Sl = /*@__PURE__*/ P("ZodEmail", (e, t) => {
	sa.init(e, t), J.init(e, t);
}), Cl = /*@__PURE__*/ P("ZodGUID", (e, t) => {
	aa.init(e, t), J.init(e, t);
}), wl = /*@__PURE__*/ P("ZodUUID", (e, t) => {
	oa.init(e, t), J.init(e, t);
}), Tl = /*@__PURE__*/ P("ZodURL", (e, t) => {
	ha.init(e, t), J.init(e, t);
}), El = /*@__PURE__*/ P("ZodEmoji", (e, t) => {
	ga.init(e, t), J.init(e, t);
}), Dl = /*@__PURE__*/ P("ZodNanoID", (e, t) => {
	_a.init(e, t), J.init(e, t);
}), Ol = /*@__PURE__*/ P("ZodCUID", (e, t) => {
	va.init(e, t), J.init(e, t);
}), kl = /*@__PURE__*/ P("ZodCUID2", (e, t) => {
	ya.init(e, t), J.init(e, t);
}), Al = /*@__PURE__*/ P("ZodULID", (e, t) => {
	ba.init(e, t), J.init(e, t);
}), jl = /*@__PURE__*/ P("ZodXID", (e, t) => {
	xa.init(e, t), J.init(e, t);
}), Ml = /*@__PURE__*/ P("ZodKSUID", (e, t) => {
	Sa.init(e, t), J.init(e, t);
}), Nl = /*@__PURE__*/ P("ZodIPv4", (e, t) => {
	Da.init(e, t), J.init(e, t);
}), Pl = /*@__PURE__*/ P("ZodIPv6", (e, t) => {
	Aa.init(e, t), J.init(e, t);
}), Fl = /*@__PURE__*/ P("ZodCIDRv4", (e, t) => {
	ja.init(e, t), J.init(e, t);
}), Il = /*@__PURE__*/ P("ZodCIDRv6", (e, t) => {
	Na.init(e, t), J.init(e, t);
}), Ll = /*@__PURE__*/ P("ZodBase64", (e, t) => {
	Ia.init(e, t), J.init(e, t);
}), Rl = /*@__PURE__*/ P("ZodBase64URL", (e, t) => {
	za.init(e, t), J.init(e, t);
}), zl = /*@__PURE__*/ P("ZodE164", (e, t) => {
	Ba.init(e, t), J.init(e, t);
}), Bl = /*@__PURE__*/ P("ZodJWT", (e, t) => {
	Ha.init(e, t), J.init(e, t);
}), Vl = /*@__PURE__*/ P("ZodNumber", (e, t) => {
	Ua.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Mc(e, t, n, r), e.isFinite = !0;
}, /*@__PURE__*/ mr({
	minValue: (e) => {
		let { minimum: t, exclusiveMinimum: n } = W(e);
		return Math.max(t ?? -Infinity, n ?? -Infinity);
	},
	maxValue: (e) => {
		let { maximum: t, exclusiveMaximum: n } = W(e);
		return Math.min(t ?? Infinity, n ?? Infinity);
	},
	isInt: (e) => {
		let { isInt: t, multipleOf: n } = W(e);
		return !!t || !!n?.some(Number.isSafeInteger);
	},
	format: (e) => W(e).format ?? null
}, {
	gt(e, t) {
		return this.check(/* @__PURE__ */ Is(e, t));
	},
	gte(e, t) {
		return this.check(/* @__PURE__ */ Ls(e, t));
	},
	min(e, t) {
		return this.check(/* @__PURE__ */ Ls(e, t));
	},
	lt(e, t) {
		return this.check(/* @__PURE__ */ Ps(e, t));
	},
	lte(e, t) {
		return this.check(/* @__PURE__ */ Fs(e, t));
	},
	max(e, t) {
		return this.check(/* @__PURE__ */ Fs(e, t));
	},
	int(e) {
		return this.check(Wl(e));
	},
	safe(e) {
		return this.check(Wl(e));
	},
	positive(e) {
		return this.check(/* @__PURE__ */ Is(0, e));
	},
	nonnegative(e) {
		return this.check(/* @__PURE__ */ Ls(0, e));
	},
	negative(e) {
		return this.check(/* @__PURE__ */ Ps(0, e));
	},
	nonpositive(e) {
		return this.check(/* @__PURE__ */ Fs(0, e));
	},
	multipleOf(e, t) {
		return this.check(/* @__PURE__ */ Rs(e, t));
	},
	step(e, t) {
		return this.check(/* @__PURE__ */ Rs(e, t));
	},
	finite() {
		return this;
	}
}));
function Hl(e) {
	return /* @__PURE__ */ ks(Vl, e);
}
var Ul = /*@__PURE__*/ P("ZodNumberFormat", (e, t) => {
	Wa.init(e, t), Vl.init(e, t);
});
function Wl(e) {
	return /* @__PURE__ */ As(Ul, e);
}
var Gl = /*@__PURE__*/ P("ZodBoolean", (e, t) => {
	Ga.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Nc(e, t, n, r);
});
function Kl(e) {
	return /* @__PURE__ */ js(Gl, e);
}
var ql = /*@__PURE__*/ P("ZodUnknown", (e, t) => {
	Ka.init(e, t), K.init(e, t), e._zod.processJSONSchema = (e, t, n) => void 0;
});
function Jl() {
	return /* @__PURE__ */ Ms(ql);
}
var Yl = /*@__PURE__*/ P("ZodNever", (e, t) => {
	qa.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Pc(e, t, n, r);
});
function Xl(e) {
	return /* @__PURE__ */ Ns(Yl, e);
}
var Zl = /*@__PURE__*/ P("ZodArray", (e, t) => {
	hl(), Za.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => zc(e, t, n, r), e.element = t.element;
}, {
	min(e, t) {
		return this.check(/* @__PURE__ */ Bs(e, t));
	},
	nonempty(e) {
		return this.check(/* @__PURE__ */ Bs(1, e));
	},
	max(e, t) {
		return this.check(/* @__PURE__ */ zs(e, t));
	},
	length(e, t) {
		return this.check(/* @__PURE__ */ Vs(e, t));
	},
	unwrap() {
		return this.element;
	}
});
function Y(e, t) {
	return /* @__PURE__ */ ec(Zl, e, t);
}
var Ql = /*@__PURE__*/ P("ZodObject", (e, t) => {
	hl(), ro.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Vc(e, t, n, r), br(e, "shape", (e) => e._zod.def.shape, !1);
}, {
	keyof() {
		return ou(Object.keys(this._zod.def.shape));
	},
	catchall(e) {
		return this.clone(O(this._zod.def, { catchall: e }));
	},
	passthrough() {
		return this.clone(O(this._zod.def, { catchall: Jl() }));
	},
	loose() {
		return this.clone(O(this._zod.def, { catchall: Jl() }));
	},
	strict() {
		return this.clone(O(this._zod.def, { catchall: Xl() }));
	},
	strip() {
		return this.clone(O(this._zod.def, { catchall: void 0 }));
	},
	extend(e) {
		return Yn(this, e);
	},
	safeExtend(e) {
		return Zn(this, e);
	},
	merge(e) {
		return Qn(this, e);
	},
	pick(e) {
		return Kn(this, e);
	},
	omit(e) {
		return Jn(this, e);
	},
	partial(...e) {
		return $n(du, this, e[0]);
	},
	exactPartial(...e) {
		return $n(pu, this, e[0], "exactPartial");
	},
	required(...e) {
		return er(xu, this, e[0]);
	}
});
function X(e, t) {
	return new Ql({
		type: "object",
		shape: e ?? {},
		...A(t)
	});
}
var $l = /*@__PURE__*/ P("ZodUnion", (e, t) => {
	ao.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Hc(e, t, n, r), e.options = t.options;
});
function eu(e, t) {
	return new $l({
		type: "union",
		options: e,
		...A(t)
	});
}
var tu = /*@__PURE__*/ P("ZodDiscriminatedUnion", (e, t) => {
	$l.init(e, t), so.init(e, t);
});
function nu(e, t, n) {
	return new tu({
		type: "union",
		options: t,
		discriminator: e,
		...A(n)
	});
}
var ru = /*@__PURE__*/ P("ZodIntersection", (e, t) => {
	co.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Uc(e, t, n, r);
});
function iu(e, t) {
	return new ru({
		type: "intersection",
		left: e,
		right: t
	});
}
var au = /*@__PURE__*/ P("ZodEnum", (e, t) => {
	fo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Fc(e, t, n, r), e.enum = t.entries, e.options = [...e._zod.values];
	let n = new Set(Object.keys(t.entries));
	e.extract = (e, r) => {
		let i = {};
		for (let r of e) if (n.has(r)) i[r] = t.entries[r];
		else throw Error(`Key ${r} not found in enum`);
		return new au({
			...t,
			checks: [],
			...A(r),
			entries: i
		});
	}, e.exclude = (e, r) => {
		let i = { ...t.entries };
		for (let t of e) if (n.has(t)) delete i[t];
		else throw Error(`Key ${t} not found in enum`);
		return new au({
			...t,
			checks: [],
			...A(r),
			entries: i
		});
	};
});
function ou(e, t) {
	return new au({
		type: "enum",
		entries: Array.isArray(e) ? Object.fromEntries(e.map((e) => [e, e])) : e,
		...A(t)
	});
}
var su = /*@__PURE__*/ P("ZodLiteral", (e, t) => {
	po.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Ic(e, t, n, r), e.values = new Set(t.values), Object.defineProperty(e, "value", { get() {
		if (t.values.length > 1) throw Error("This schema contains multiple valid literal values. Use `.values` instead.");
		return t.values[0];
	} });
});
function cu(e, t) {
	return new su({
		type: "literal",
		values: Array.isArray(e) ? e : [e],
		...A(t)
	});
}
var lu = /*@__PURE__*/ P("ZodTransform", (e, t) => {
	hl(), mo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Rc(e, t, n, r), e._zod.parse = (n, r) => {
		if (r.direction === "backward") throw new Dr(e.constructor.name);
		n.addIssue = (r) => {
			if (typeof r == "string") n.issues.push(dr(r, n.value, t));
			else {
				let t = r;
				t.fatal && (t.continue = !1), t.code ??= "custom", "input" in t || (t.input = n.value), t.inst ??= e, n.issues.push(dr(t));
			}
		};
		let i = t.transform(n.value, n);
		return i instanceof Promise ? i.then((e) => (n.value = e, n)) : (n.value = i, n);
	};
});
function uu(e) {
	return new lu({
		type: "transform",
		transform: e
	});
}
var du = /*@__PURE__*/ P("ZodOptional", (e, t) => {
	go.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => $c(e, t, n, r), e.unwrap = () => e._zod.def.innerType;
});
function fu(e) {
	return new du({
		type: "optional",
		innerType: e
	});
}
var pu = /*@__PURE__*/ P("ZodExactOptional", (e, t) => {
	_o.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => $c(e, t, n, r), e.unwrap = () => e._zod.def.innerType;
});
function mu(e) {
	return new pu({
		type: "optional",
		innerType: e
	});
}
var hu = /*@__PURE__*/ P("ZodNullable", (e, t) => {
	vo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Wc(e, t, n, r), e.unwrap = () => e._zod.def.innerType;
});
function gu(e) {
	return new hu({
		type: "nullable",
		innerType: e
	});
}
var _u = /*@__PURE__*/ P("ZodDefault", (e, t) => {
	yo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Jc(e, t, n, r), e.unwrap = () => e._zod.def.innerType, e.removeDefault = e.unwrap;
});
function vu(e, t) {
	return new _u({
		type: "default",
		innerType: e,
		get defaultValue() {
			return typeof t == "function" ? t() : zn(t);
		}
	});
}
var yu = /*@__PURE__*/ P("ZodPrefault", (e, t) => {
	xo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Yc(e, t, n, r), e.unwrap = () => e._zod.def.innerType;
});
function bu(e, t) {
	return new yu({
		type: "prefault",
		innerType: e,
		get defaultValue() {
			return typeof t == "function" ? t() : zn(t);
		}
	});
}
var xu = /*@__PURE__*/ P("ZodNonOptional", (e, t) => {
	So.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Gc(e, t, n, r), e.unwrap = () => e._zod.def.innerType;
});
function Su(e, t) {
	return new xu({
		type: "nonoptional",
		innerType: e,
		...A(t)
	});
}
var Cu = /*@__PURE__*/ P("ZodCatch", (e, t) => {
	To.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Xc(e, t, n, r), e.unwrap = () => e._zod.def.innerType, e.removeCatch = e.unwrap;
});
function wu(e, t) {
	return new Cu({
		type: "catch",
		innerType: e,
		catchValue: typeof t == "function" ? t : Sr(t)
	});
}
var Tu = /*@__PURE__*/ P("ZodPipe", (e, t) => {
	Eo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Zc(e, t, n, r), e.in = t.in, e.out = t.out;
});
function Eu(e, t) {
	return new Tu({
		type: "pipe",
		in: e,
		out: t
	});
}
var Du = /*@__PURE__*/ P("ZodReadonly", (e, t) => {
	Oo.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Qc(e, t, n, r), e.unwrap = () => e._zod.def.innerType;
});
function Ou(e) {
	return new Du({
		type: "readonly",
		innerType: e
	});
}
var ku = /*@__PURE__*/ P("ZodCustom", (e, t) => {
	Ao.init(e, t), K.init(e, t), e._zod.processJSONSchema = (t, n, r) => Lc(e, t, n, r);
});
function Au(e, t = {}) {
	return /* @__PURE__ */ tc(ku, e, t);
}
function ju(e, t) {
	return /* @__PURE__ */ nc(e, t);
}
// src/validators/workspace.schema.ts
var Mu = q().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, - and _"), Nu = q().trim().min(1).max(200), Pu = Hl().finite(), Fu = X({
	key: q(),
	value: q().default(""),
	enabled: Kl().default(!0)
}), Iu = ou([
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"HEAD",
	"OPTIONS"
]), Lu = nu("mode", [
	X({ mode: cu("none") }),
	X({
		mode: ou([
			"json",
			"text",
			"xml"
		]),
		raw: q()
	}),
	X({
		mode: ou(["urlencoded", "form-data"]),
		fields: Y(Fu)
	})
]), Ru = nu("type", [
	X({ type: cu("inherit") }),
	X({ type: cu("none") }),
	X({
		type: cu("bearer"),
		token: q()
	}),
	X({
		type: cu("basic"),
		username: q(),
		password: q()
	}),
	X({
		type: cu("apikey"),
		key: q(),
		value: q(),
		in: ou(["header", "query"])
	})
]), zu = X({
	format: Hl().int().positive(),
	workspace: X({
		id: Mu,
		name: Nu
	}),
	defaultEnvironment: Mu.nullable().default(null)
}), Bu = X({
	id: Mu,
	name: Nu,
	seq: Pu,
	description: q().default(""),
	auth: Ru.default({ type: "none" }),
	variables: Y(Fu).default([])
}), Vu = X({
	id: Mu,
	name: Nu,
	seq: Pu,
	auth: Ru.default({ type: "inherit" })
}), Hu = X({
	id: Mu,
	name: Nu,
	seq: Pu,
	method: Iu,
	url: q().default(""),
	params: Y(Fu).default([]),
	headers: Y(Fu).default([]),
	body: Lu.default({ mode: "none" }),
	auth: Ru.default({ type: "inherit" })
}), Uu = X({
	id: Mu,
	name: Nu,
	seq: Pu,
	status: Hl().int().min(100).max(599),
	headers: Y(Fu).default([]),
	body: q().default("")
}), Wu = X({
	key: q(),
	value: q().default(""),
	enabled: Kl().default(!0),
	secret: Kl().default(!1)
}), Gu = X({
	id: Mu,
	name: Nu,
	seq: Pu.default(0),
	variables: Y(Wu).default([])
}), Ku = "aurolis.json", qu = "collections", Ju = "environments", Yu = "_collection.json", Xu = "_folder.json", Zu = "_globals.env.json", Qu = ".req.json", $u = ".env.json", ed = ".examples", td = ".json", nd = 60;
function rd(e) {
	return Array.isArray(e) ? e.map(rd) : e && typeof e == "object" ? Object.fromEntries(Object.keys(e).filter((t) => e[t] !== void 0).sort().map((t) => [t, rd(e[t])])) : e;
}
function id(e) {
	return `${JSON.stringify(rd(e), null, 2)}\n`;
}
function ad(e, t) {
	return e.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, nd).replace(/-+$/, "") || t;
}
function od(e, t) {
	return {
		format: 1,
		workspace: {
			id: e,
			name: t
		},
		defaultEnvironment: null
	};
}
var sd = (e, t) => e.seq - t.seq || e.name.localeCompare(t.name) || e.id.localeCompare(t.id), cd = (e) => e.slice(0, e.lastIndexOf("/")), ld = (e) => e.slice(e.lastIndexOf("/") + 1), ud = (e, t) => e ? `${e}/${t}` : t, dd = (e) => `generated-${e.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
function fd(e) {
	let t = [], n = {}, r = /* @__PURE__ */ new Map(), i = (n, r) => {
		let i;
		try {
			i = JSON.parse(e[n]);
		} catch (e) {
			return t.push({
				path: n,
				message: `Invalid JSON: ${e instanceof Error ? e.message : "could not parse"}`
			}), null;
		}
		let a = r.safeParse(i);
		return a.success ? a.data : (t.push({
			path: n,
			message: Rr(a.error)
		}), null);
	}, a = (e, i) => {
		let a = r.get(e);
		return a ? (t.push({
			path: i,
			message: `Duplicate id "${e}", already used by ${a}.`
		}), !1) : (r.set(e, i), n[e] = i, !0);
	}, o = od("", "");
	if (!("aurolis.json" in e)) t.push({
		path: Ku,
		message: "Missing aurolis.json: this folder isn't an Aurolis workspace yet."
	});
	else {
		let e = i(Ku, zu);
		e && (o = e, e.format > 1 && t.push({
			path: Ku,
			message: `Created by a newer version of Aurolis (format ${e.format}). Update Aurolis to edit it safely.`
		}));
	}
	let s = /* @__PURE__ */ new Map(), c = [], l = (e, n = !1) => {
		let r = s.get(e);
		if (r) return r;
		let i = cd(e) === qu, o = ud(e, i ? Yu : Xu), c = dd(e);
		return n || t.push({
			path: o,
			message: `Missing ${i ? Yu : Xu}; using the folder name.`
		}), a(c, o), u(e, i, {
			id: c,
			name: ld(e),
			seq: 0
		});
	}, u = (e, t, n) => {
		if (t) {
			let t = {
				description: "",
				auth: { type: "none" },
				variables: [],
				...n,
				items: []
			};
			c.push(t);
			let r = {
				dir: e,
				kind: "collection",
				collection: t
			};
			return s.set(e, r), r;
		}
		let r = {
			type: "folder",
			id: n.id,
			name: n.name,
			seq: n.seq,
			auth: n.auth ?? { type: "inherit" },
			items: []
		}, i = l(cd(e));
		d(i).push(r);
		let a = {
			dir: e,
			kind: "folder",
			folder: r
		};
		return s.set(e, a), a;
	}, d = (e) => e.kind === "collection" ? e.collection.items : e.folder.items, f = Object.keys(e).sort(), p = f.filter((e) => e.startsWith(`${qu}/`)), m = p.filter((e) => e.endsWith(`/${Yu}`) || e.endsWith(`/${Xu}`)).sort((e, t) => e.split("/").length - t.split("/").length || e.localeCompare(t));
	for (let e of m) {
		let n = cd(e), r = n.split("/").length, o = e.endsWith(`/${Yu}`);
		if (o !== (r === 2)) {
			t.push({
				path: e,
				message: o ? `${Yu} belongs directly inside ${qu}/<collection>/; ignored.` : `${Xu} can't be at the top of ${qu}/; ignored.`
			});
			continue;
		}
		if (n.endsWith(ed)) {
			t.push({
				path: e,
				message: "Folders can't live inside an examples folder; ignored."
			});
			continue;
		}
		let s = i(e, o ? Bu : Vu);
		if (!s) {
			l(n, !0);
			continue;
		}
		let c = a(s.id, e) ? s.id : dd(n);
		c !== s.id && a(c, e), u(n, o, {
			...s,
			id: c
		});
	}
	let h = /* @__PURE__ */ new Map();
	for (let e of p) {
		if (!e.endsWith(Qu)) continue;
		let n = cd(e);
		if (n === qu) {
			t.push({
				path: e,
				message: "Requests must be inside a collection folder; ignored."
			});
			continue;
		}
		if (n.endsWith(ed)) {
			t.push({
				path: e,
				message: "Requests can't live inside an examples folder; ignored."
			});
			continue;
		}
		let r = i(e, Hu);
		if (!r || !a(r.id, e)) continue;
		let o = {
			type: "request",
			...r,
			examples: []
		};
		d(l(n)).push(o), h.set(e, o);
	}
	for (let e of p) {
		if (e.endsWith(Qu) || e.endsWith(`/${Yu}`) || e.endsWith(`/${Xu}`)) continue;
		let n = cd(e);
		if (n.endsWith(ed) && e.endsWith(td)) {
			let r = `${n.slice(0, -9)}${Qu}`, o = h.get(r);
			if (!o) {
				t.push({
					path: e,
					message: `No request at ${r} for this example; ignored.`
				});
				continue;
			}
			let s = i(e, Uu);
			if (!s || !a(s.id, e)) continue;
			o.examples.push(s);
		} else t.push({
			path: e,
			message: "Not an Aurolis workspace file; ignored."
		});
	}
	let ee = (e) => {
		e.sort(sd);
		for (let t of e) t.type === "folder" ? ee(t.items) : t.examples.sort(sd);
	};
	c.sort(sd);
	for (let e of c) ee(e.items);
	let te = [], g = null;
	for (let e of f) {
		if (!e.startsWith(`${Ju}/`)) continue;
		let n = e.slice(13);
		if (n.includes("/") || !n.endsWith($u)) {
			t.push({
				path: e,
				message: "Not an Aurolis environment file; ignored."
			});
			continue;
		}
		let r = i(e, Gu);
		r && a(r.id, e) && (n === Zu ? g = r : te.push(r));
	}
	return te.sort(sd), {
		workspace: {
			manifest: o,
			collections: c,
			environments: te,
			globals: g
		},
		paths: n,
		issues: t
	};
}
// src/validators/workspace-store.schema.ts
var pd = q().trim().min(1, "Enter a name").max(100, "Use 100 characters or fewer"), md = X({
	url: q().min(1),
	github: X({
		owner: q(),
		repo: q()
	}).nullable()
}), hd = X({
	id: q().uuid(),
	name: pd,
	repoDir: q().min(1),
	root: q(),
	managed: Kl(),
	remote: md.nullable(),
	createdAt: q(),
	lastOpenedAt: q()
}), gd = X({
	version: cu(1),
	storageFolder: q().nullable(),
	activeWorkspaceId: q().nullable(),
	workspaces: Y(hd)
}), _d = ["collections", "environments"], vd = 5242880, yd = 3, bd = 400, xd = /* @__PURE__ */ new Set([".git", "node_modules"]), Sd = [
	/[\\/]library[\\/]mobile documents([\\/]|$)/i,
	/[\\/]library[\\/]cloudstorage([\\/]|$)/i,
	/[\\/]icloud ?drive([\\/]|$)/i,
	/[\\/]onedrive[^\\/]*([\\/]|$)/i,
	/[\\/]dropbox([\\/]|$)/i,
	/[\\/]google ?drive([\\/]|$)/i
], Z = class extends Error {
	code;
	constructor(e, t) {
		super(t ?? e), this.name = "WorkspaceError", this.code = e;
	}
}, Cd = () => t.getPath("userData"), wd = () => l.join(Cd(), "workspaces.json"), Td = (e) => l.join(Cd(), "workspaces", e), Ed = () => l.join(t.getPath("home"), "Aurolis"), Dd = (e) => e.split(l.sep).join("/"), Od = (e, t) => {
	let n = l.relative(t, e);
	return n === "" || !n.startsWith("..") && !l.isAbsolute(n);
};
function kd(e) {
	if (process.platform === "win32") return e;
	let n = t.getPath("home");
	return Od(e, n) ? `~${e.slice(n.length) || ""}` : e;
}
async function Ad(e, t) {
	await m(l.dirname(e), { recursive: !0 });
	let n = `${e}.${process.pid}.tmp`;
	await ie(n, t, "utf8"), await te(n, e);
}
var jd = null, Md = Promise.resolve(), Nd = () => ({
	version: 1,
	storageFolder: null,
	activeWorkspaceId: null,
	workspaces: []
});
async function Q() {
	if (jd) return jd;
	try {
		let e = await h(wd(), "utf8"), t = gd.safeParse(JSON.parse(e));
		if (t.success) return jd = t.data, jd;
		await te(wd(), `${wd()}.unreadable-${Date.now()}`);
	} catch (e) {
		e.code !== "ENOENT" && await te(wd(), `${wd()}.unreadable-${Date.now()}`).catch(() => void 0);
	}
	return jd = Nd(), jd;
}
function $() {
	let e = id(jd ?? Nd());
	return Md = Md.catch(() => void 0).then(() => Ad(wd(), e)), Md;
}
async function Pd(e) {
	let t = e;
	for (; !_(t);) {
		let e = l.dirname(t);
		if (e === t) return null;
		t = e;
	}
	return t;
}
async function Fd(e) {
	let t = await Pd(e) ?? e;
	for (;;) {
		if (_(l.join(t, ".git"))) return !0;
		let e = l.dirname(t);
		if (e === t) return !1;
		t = e;
	}
}
async function Id(e) {
	let t = l.resolve(e), n = {
		path: t,
		displayPath: kd(t),
		writable: !1,
		freeBytes: null,
		warnings: [],
		error: null
	};
	if (Od(t, Cd()) || Od(Cd(), t)) return n.error = "Choose a folder outside Aurolis's own app data.", n;
	let r = await Pd(t);
	if (!r) return n.error = "This drive or folder isn't available.", n;
	try {
		await d(r, f.W_OK), n.writable = !0;
	} catch {
		n.error = "Aurolis can't write to this folder.";
	}
	try {
		let e = await re(r);
		n.freeBytes = Number(e.bavail) * Number(e.bsize);
	} catch {
		n.freeBytes = null;
	}
	let i = [];
	return Sd.some((e) => e.test(t)) && i.push("cloud_synced"), process.platform === "win32" && /^\\\\/.test(t) && i.push("network_drive"), await Fd(t) && i.push("inside_git_repo"), n.warnings = i, n;
}
async function Ld() {
	let e = await Q();
	return {
		storageFolder: e.storageFolder,
		storageFolderDisplay: e.storageFolder ? kd(e.storageFolder) : null,
		defaultStorageFolder: await Id(Ed()),
		activeWorkspaceId: e.activeWorkspaceId,
		workspaces: [...e.workspaces].sort((e, t) => t.lastOpenedAt.localeCompare(e.lastOpenedAt)).map((e) => ({
			...e,
			missing: !_(e.repoDir)
		}))
	};
}
var Rd = Ld, zd = null;
async function Bd(e) {
	let r = {
		title: "Choose where Aurolis stores workspaces",
		defaultPath: (await Q()).storageFolder ?? t.getPath("home"),
		properties: [
			"openDirectory",
			"createDirectory",
			"promptToCreate"
		]
	}, i = e ? await n.showOpenDialog(e, r) : await n.showOpenDialog(r);
	return i.canceled || !i.filePaths[0] ? null : (zd = l.resolve(i.filePaths[0]), Id(zd));
}
async function Vd(e) {
	let t = e === "default" ? Ed() : e === "chosen" ? zd : null;
	if (!t) throw new Z("invalid_input", "Choose a folder first.");
	let n = await Id(t);
	if (n.error || !n.writable) throw new Z("storage_invalid", n.error ?? void 0);
	await m(t, { recursive: !0 });
	let r = await Q();
	return r.storageFolder = t, await $(), Ld();
}
async function Hd() {
	let e = await Q();
	if (!e.storageFolder) throw new Z("storage_not_set");
	return await m(e.storageFolder, { recursive: !0 }), e.storageFolder;
}
function Ud(e, t) {
	let n = ad(t, "workspace"), r = n;
	for (let t = 2; _(l.join(e, r)); t++) r = `${n}-${t}`;
	return l.join(e, r);
}
function Wd(e) {
	let t = pd.safeParse(e);
	if (!t.success) throw new Z("invalid_input", t.error.issues[0]?.message);
	return t.data;
}
async function Gd(e) {
	let t = (await Q()).workspaces.find((t) => t.id === e);
	if (!t) throw new Z("not_found");
	return t;
}
async function Kd(e) {
	if (_(l.join(e, "aurolis.json"))) return "";
	let t = [{
		dir: e,
		depth: 0
	}];
	for (; t.length;) {
		let { dir: n, depth: r } = t.shift();
		if (r >= yd) continue;
		let i;
		try {
			i = (await ee(n, { withFileTypes: !0 })).filter((e) => e.isDirectory() && !xd.has(e.name)).map((e) => l.join(n, e.name)).sort();
		} catch {
			continue;
		}
		for (let n of i) {
			if (_(l.join(n, "aurolis.json"))) return Dd(l.relative(e, n));
			t.push({
				dir: n,
				depth: r + 1
			});
		}
	}
	return "";
}
async function qd(e) {
	let t = await Q();
	t.workspaces.push(e), t.activeWorkspaceId = e.id, await m(Td(e.id), { recursive: !0 }), await $();
}
var Jd = () => (/* @__PURE__ */ new Date()).toISOString();
async function Yd(e) {
	let t = Wd(e?.name), n = Ud(await Hd(), t);
	await m(n, { recursive: !0 });
	try {
		await cn(n), await ln(n), await Ad(l.join(n, Ku), id(od(oe(), t))), await gn(n, "Create workspace");
	} catch (e) {
		throw await g(n, {
			recursive: !0,
			force: !0
		}), e;
	}
	let r = oe();
	return await qd({
		id: r,
		name: t,
		repoDir: n,
		root: "",
		managed: !0,
		remote: null,
		createdAt: Jd(),
		lastOpenedAt: Jd()
	}), { workspaceId: r };
}
var Xd = /* @__PURE__ */ new Set();
function Zd() {
	for (let e of Xd) e.abort();
	Xd.clear();
}
async function Qd(e) {
	let t = e?.url, n = typeof t == "string" ? tn(t) : null;
	if (!n) throw new Z("invalid_url", "Paste an https:// or SSH git URL, or a GitHub owner/repo.");
	let r = await Q(), i = r.workspaces.find((e) => e.remote && e.root === "" && an(e.remote.url, n));
	if (i) return r.activeWorkspaceId = i.id, await $(), {
		workspaceId: i.id,
		alreadyAdded: !0
	};
	let a = await Hd(), o = rn(n), s = Ud(a, o), c = new AbortController();
	Xd.add(c);
	try {
		await on(n, s, c.signal), await ln(s);
	} catch (e) {
		throw await g(s, {
			recursive: !0,
			force: !0
		}), e;
	} finally {
		Xd.delete(c);
	}
	let l = oe();
	return await qd({
		id: l,
		name: o,
		repoDir: s,
		root: await Kd(s),
		managed: !0,
		remote: {
			url: n,
			github: nn(n)
		},
		createdAt: Jd(),
		lastOpenedAt: Jd()
	}), {
		workspaceId: l,
		alreadyAdded: !1
	};
}
async function $d(e) {
	let r = {
		title: "Open a git repository",
		defaultPath: t.getPath("home"),
		properties: ["openDirectory"]
	}, i = e ? await n.showOpenDialog(e, r) : await n.showOpenDialog(r);
	if (i.canceled || !i.filePaths[0]) throw new Z("cancelled");
	let a = l.resolve(i.filePaths[0]), o = await sn(a);
	if (!o) throw new Z("not_a_repository", "That folder isn't a git repository. Pick the folder you cloned.");
	let s = Dd(l.relative(o, a)) || await Kd(o), c = await Q(), u = c.workspaces.find((e) => l.resolve(e.repoDir) === o && e.root === s);
	if (u) return c.activeWorkspaceId = u.id, await $(), {
		workspaceId: u.id,
		alreadyAdded: !0
	};
	let d = await un(o), f = oe();
	return await qd({
		id: f,
		name: l.basename(s ? l.join(o, s) : o),
		repoDir: o,
		root: s,
		managed: !1,
		remote: d ? {
			url: d,
			github: nn(d)
		} : null,
		createdAt: Jd(),
		lastOpenedAt: Jd()
	}), {
		workspaceId: f,
		alreadyAdded: !1
	};
}
async function ef(e) {
	let t = {}, n = [], r = async (r) => {
		let i = await p(r);
		if (!i.isFile()) return;
		let a = Dd(l.relative(e, r));
		i.size > vd ? n.push(a) : t[a] = await h(r, "utf8");
	}, i = async (e) => {
		let t;
		try {
			t = await ee(e, { withFileTypes: !0 });
		} catch {
			return;
		}
		for (let n of t) {
			let t = l.join(e, n.name);
			n.isSymbolicLink() || (n.isDirectory() ? await i(t) : n.isFile() && await r(t));
		}
	}, a = l.join(e, Ku);
	_(a) && await r(a);
	for (let t of _d) await i(l.join(e, t));
	return {
		files: t,
		oversized: n
	};
}
var tf = [], nf = null, rf = null;
function af() {
	for (let e of tf) e.close();
	tf = [], nf = null, rf && clearTimeout(rf), rf = null;
}
function of(t) {
	rf && clearTimeout(rf), rf = setTimeout(() => {
		for (let n of e.getAllWindows()) n.webContents.send("aurolis:workspace:changed", t);
	}, bd);
}
function sf(e) {
	if (nf === e.id) return;
	af(), nf = e.id;
	let t = l.join(e.repoDir, e.root), n = () => of(e.id), r = (e, t) => {
		if (_(e)) try {
			let r = ce(e, { recursive: t }, n);
			r.on("error", () => void 0), tf.push(r);
		} catch {
			return;
		}
	};
	r(t, !1);
	for (let e of _d) r(l.join(t, e), !0);
	let i = l.join(e.repoDir, ".git");
	r(i, !1), r(l.join(i, "refs"), !0);
}
async function cf(e) {
	let t = await Gd(e);
	if (!_(t.repoDir)) throw new Z("missing_folder", `The folder ${kd(t.repoDir)} was moved or deleted.`);
	let n = l.join(t.repoDir, t.root), { files: r, oversized: i } = await ef(n), a = Ku in r, o = fd(r), s = [...a ? o.issues : [], ...i.map((e) => ({
		path: e,
		message: "Larger than 5 MB; not loaded."
	}))], [c, u, d] = await Promise.all([
		dn(t.repoDir),
		fn(t.repoDir, t.root),
		un(t.repoDir)
	]), f = d ? await pn(t.repoDir) : 0;
	t.remote = d ? {
		url: d,
		github: nn(d)
	} : null, t.lastOpenedAt = Jd();
	let p = await Q();
	return p.activeWorkspaceId = t.id, await $(), sf(t), {
		entry: t,
		displayPath: kd(n),
		isWorkspace: a,
		data: a ? o.workspace : null,
		issues: s,
		git: {
			branch: c,
			changedFiles: u,
			unpushedCommits: f,
			remoteUrl: d
		}
	};
}
async function lf(e) {
	let t = await Gd(e), n = l.join(t.repoDir, t.root, Ku);
	return _(n) || await Ad(n, id(od(oe(), t.name))), cf(t.id);
}
async function uf(e) {
	let { id: t, name: n } = e ?? {}, r = await Gd(t);
	return r.name = Wd(n), await $(), Ld();
}
async function df(e) {
	let { id: t, owner: n, repo: r, commitChanges: i } = e ?? {};
	if (!ot(n) || !st(r)) throw new Z("invalid_input", "Invalid repository name.");
	let a = await Gd(t), o = a.repoDir;
	if (!_(o)) throw new Z("missing_folder", `The folder ${kd(o)} was moved or deleted.`);
	let s = `https://github.com/${n}/${r}.git`, c = await un(o);
	if (c && !an(c, s)) throw new Z("remote_exists");
	let l = await dn(o);
	if (!l) throw new Z("detached_head");
	let u = !1;
	if (i === !0 && await fn(o, a.root) > 0 && (await gn(o, await _n(o) ? "Update workspace" : "Create workspace", a.root), u = !0), !await _n(o)) throw new Z("nothing_to_publish");
	c || await vn(o, s);
	try {
		await bn(o, l);
	} catch (e) {
		throw c || await yn(o), e;
	}
	return a.remote = {
		url: s,
		github: {
			owner: n,
			repo: r
		}
	}, await $(), {
		webUrl: `https://github.com/${n}/${r}`,
		branch: l,
		committed: u
	};
}
async function ff(e) {
	let t = await Gd(e);
	if (!_(t.repoDir)) throw new Z("missing_folder");
	let n = await c.openPath(l.join(t.repoDir, t.root));
	if (n) throw new Z("unknown", n);
}
async function pf(e) {
	let t = await Gd(e);
	if (!_(t.repoDir)) return {
		managed: t.managed,
		changedFiles: 0,
		unpushedCommits: 0,
		hasRemote: !!t.remote
	};
	let [n, r, i] = await Promise.all([
		fn(t.repoDir, ""),
		pn(t.repoDir),
		un(t.repoDir)
	]);
	return {
		managed: t.managed,
		changedFiles: n,
		unpushedCommits: r,
		hasRemote: !!i
	};
}
async function mf(e) {
	let { id: t, deleteFolder: n } = e ?? {}, r = await Gd(t), i = await Q();
	return nf === r.id && af(), i.workspaces = i.workspaces.filter((e) => e.id !== r.id), i.activeWorkspaceId === r.id && (i.activeWorkspaceId = [...i.workspaces].sort((e, t) => t.lastOpenedAt.localeCompare(e.lastOpenedAt))[0]?.id ?? null), await $(), await g(Td(r.id), {
		recursive: !0,
		force: !0
	}), n === !0 && r.managed && _(l.join(r.repoDir, ".git")) && l.resolve(r.repoDir) !== l.resolve(le.homedir()) && l.resolve(r.repoDir) !== l.resolve(i.storageFolder ?? "") && await g(r.repoDir, {
		recursive: !0,
		force: !0
	}), Ld();
}
async function hf(e) {
	try {
		return {
			ok: !0,
			data: await e()
		};
	} catch (e) {
		let t;
		return t = e instanceof Z || e instanceof It ? {
			code: e.code,
			message: e.message
		} : {
			code: "unknown",
			message: e instanceof Error ? e.message : void 0
		}, t.message === t.code && delete t.message, {
			ok: !1,
			error: t
		};
	}
}
// electron/main.ts
var gf = "app", _f = "aurolis", vf = l.join(import.meta.dirname, ".."), yf = l.join(vf, "dist"), bf = process.env.VITE_DEV_SERVER_URL, xf = "#0c0b0c", Sf = "#f6f3f8", Cf = "#ffffff", wf = "#151017", Tf = 36, Ef = process.platform === "darwin", Df = [
	"light",
	"dark",
	"system"
];
function Of() {
	let e = i.shouldUseDarkColors;
	return {
		background: e ? xf : Sf,
		symbol: e ? Cf : wf
	};
}
function kf(e) {
	let { background: t, symbol: n } = Of();
	e.setBackgroundColor(t), Ef || e.setTitleBarOverlay({
		color: t,
		symbolColor: n,
		height: Tf
	});
}
o.registerSchemesAsPrivileged([{
	scheme: gf,
	privileges: {
		standard: !0,
		secure: !0,
		supportFetchAPI: !0,
		stream: !0
	}
}]);
var Af = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src * data: blob:";
async function jf(e) {
	try {
		return (await ne(e)).isFile();
	} catch {
		return !1;
	}
}
function Mf() {
	o.handle(gf, async (e) => {
		let { pathname: t } = new URL(e.url), n = l.normalize(l.join(yf, decodeURIComponent(t)));
		if (!n.startsWith(yf)) return new Response("Not found", { status: 404 });
		let r = await jf(n) ? n : l.join(yf, "index.html"), i = await a.fetch(u(r).toString());
		if (r.endsWith(".html")) {
			let e = new Headers(i.headers);
			return e.set("Content-Security-Policy", Af), new Response(i.body, {
				status: i.status,
				headers: e
			});
		}
		return i;
	});
}
function Nf() {
	let n = new e({
		title: "Aurolis",
		width: 1440,
		height: 900,
		minWidth: 960,
		minHeight: 600,
		show: !1,
		backgroundColor: Of().background,
		titleBarStyle: "hidden",
		...Ef ? { trafficLightPosition: {
			x: 14,
			y: 11
		} } : { titleBarOverlay: {
			color: Of().background,
			symbolColor: Of().symbol,
			height: Tf
		} },
		icon: l.join(vf, "build", "icon.png"),
		webPreferences: {
			preload: l.join(import.meta.dirname, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1,
			sandbox: !0
		}
	});
	return n.once("ready-to-show", () => {
		n.show(), t.isPackaged || n.webContents.openDevTools({ mode: "detach" });
	}), n.webContents.setWindowOpenHandler(({ url: e }) => (/^https?:\/\//.test(e) && c.openExternal(e), { action: "deny" })), n.webContents.on("will-navigate", (e, t) => {
		let n = bf ? new URL(bf).origin : `${gf}://${_f}`;
		new URL(t).origin !== n && (e.preventDefault(), /^https?:\/\//.test(t) && c.openExternal(t));
	}), bf ? n.loadURL(bf) : n.loadURL(`${gf}://${_f}/`), n;
}
if (t.setName("Aurolis"), !t.requestSingleInstanceLock()) t.quit();
else {
	t.on("second-instance", () => {
		let [t] = e.getAllWindows();
		t && (t.isMinimized() && t.restore(), t.focus());
	}), r.on("aurolis:set-theme", (t, n) => {
		e.fromWebContents(t.sender) && Df.includes(n) && (i.themeSource = n);
	});
	let n = (t) => e.fromWebContents(t.sender) !== null;
	r.handle("aurolis:github:start", (e) => n(e) ? Fe() : null), r.handle("aurolis:github:wait", (e) => n(e) ? Ie() : null), r.handle("aurolis:github:cancel", (e) => {
		n(e) && Le();
	}), r.handle("aurolis:github:status", (e) => n(e) ? ze() : null), r.handle("aurolis:github:sign-out", (e) => n(e) ? He() : null), r.handle("aurolis:github:installations", (e) => n(e) ? jt(vt) : null), r.handle("aurolis:github:install", (e) => n(e) ? yt() : null), r.handle("aurolis:github:repositories", (e) => n(e) ? jt(xt) : null), r.handle("aurolis:github:pull", (e, t) => n(e) ? jt(() => Dt(t)) : null), r.handle("aurolis:github:commit", (e, t) => n(e) ? jt(() => At(t)) : null), r.handle("aurolis:github:create-repository", (e, t) => n(e) ? jt(() => Tt(t)) : null), r.handle("aurolis:github:empty-repository", (e, t) => n(e) ? jt(() => Et(t)) : null);
	let a = (t) => e.fromWebContents(t.sender), o = {
		list: () => Rd(),
		"git-info": () => Kt(),
		"storage-check-default": async () => Id((await Rd()).defaultStorageFolder.path),
		"storage-choose": (e) => Bd(a(e)),
		"storage-set": (e, t) => Vd(t),
		create: (e, t) => Yd(t),
		clone: (e, t) => Qd(t),
		"clone-cancel": async () => Zd(),
		"open-folder": (e) => $d(a(e)),
		open: (e, t) => cf(t),
		initialize: (e, t) => lf(t),
		rename: (e, t) => uf(t),
		publish: (e, t) => df(t),
		"remove-check": (e, t) => pf(t),
		reveal: (e, t) => ff(t),
		remove: (e, t) => mf(t)
	};
	for (let [e, t] of Object.entries(o)) r.handle(`aurolis:workspace:${e}`, (e, r) => n(e) ? hf(() => t(e, r)) : null);
	i.on("updated", () => {
		for (let t of e.getAllWindows()) kf(t);
	}), t.whenReady().then(() => {
		bf || Mf(), Nf(), t.on("activate", () => {
			e.getAllWindows().length === 0 && Nf();
		});
	}), t.on("window-all-closed", () => {
		process.platform !== "darwin" && t.quit();
	});
}
export {};
