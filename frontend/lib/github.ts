// lib/github.ts
// Client-side GitHub API utilities for the Codebase Auditor.
// Runs in the browser — no backend needed for ingestion.

export interface FilePayload {
    path: string;
    content: string;
  }
  
  export interface RepoIngestion {
    repo: string;
    totalFiles: number;
    fileTree: string[];       // up to 150 paths
    sampledFiles: FilePayload[];
  }
  
  export type ScanStage =
    | 'idle'
    | 'fetching-tree'
    | 'sampling-files'
    | 'ready';
  
  // ── Parse a repo input into "owner/repo" ──────────────────────────────────────
  
  export function parseRepo(input: string): string | null {
    const clean = input
      .trim()
      .replace(/\/$/, '')
      .replace('https://github.com/', '')
      .replace('http://github.com/', '')
      .replace('github.com/', '');
    const parts = clean.split('/').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return null;
  }
  
  // ── Fetch the full repo file tree ─────────────────────────────────────────────
  
  export async function fetchRepoTree(repo: string): Promise<string[]> {
    const res = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
        {
          headers: process.env.NEXT_PUBLIC_GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}` }
            : {},
        }
      );

    if (res.status === 404) throw new Error(`Repository "${repo}" not found or is private.`);
    if (res.status === 403) throw new Error('GitHub API rate limit exceeded. Wait a moment and try again.');
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  
    const data = await res.json();
    if (!data.tree) throw new Error('Unexpected GitHub response — no tree found.');
  
    return (data.tree as { type: string; path: string }[])
      .filter(f => f.type === 'blob')
      .map(f => f.path);
  }
  
  // ── Score files by ML/infra relevance to pick what to sample ─────────────────
  
  const PRIORITY_PATTERNS: RegExp[] = [
    /readme\.md$/i,
    /requirements\.txt$/i,
    /setup\.py$/i,
    /pyproject\.toml$/i,
    /environment\.ya?ml$/i,
    /dockerfile/i,
    /docker-compose/i,
    /\.github\/workflows/,
    /config\.(py|yaml|yml|json|toml)$/i,
    /main\.py$/i,
    /train(ing)?\.py$/i,
    /infer(ence)?\.py$/i,
    /predict\.py$/i,
    /model\.py$/i,
    /app\.py$/i,
    /server\.py$/i,
    /serve\.py$/i,
    /test_.*\.py$/i,
    /__init__\.py$/i,
    /conftest\.py$/i,
    /\.env\.example$/i,
    /makefile$/i,
    /tox\.ini$/i,
    /\.pre-commit-config/i,
  ];
  
  export function selectFilesToSample(paths: string[], limit = 20): string[] {
    const scored = paths.map(p => ({
      path: p,
      score: PRIORITY_PATTERNS.reduce(
        (s, re, i) => (re.test(p) ? s + (PRIORITY_PATTERNS.length - i) : s),
        0
      ),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(x => x.path);
  }
  
  // ── Fetch a single file's content from GitHub ─────────────────────────────────
  
  async function fetchFile(repo: string, path: string): Promise<string | null> {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
            {
              headers: process.env.NEXT_PUBLIC_GITHUB_TOKEN
                ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}` }
                : {},
            }
          );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.encoding === 'base64' && data.content) {
        return atob(data.content.replace(/\n/g, ''));
      }
      return null;
    } catch {
      return null;
    }
  }
  
  // ── Full ingestion pipeline ───────────────────────────────────────────────────
  
  export async function ingestRepo(
    repo: string,
    onStage: (stage: ScanStage, detail?: string) => void
  ): Promise<RepoIngestion> {
    onStage('fetching-tree');
    const allPaths = await fetchRepoTree(repo);
  
    onStage('sampling-files');
    const toSample = selectFilesToSample(allPaths);
    const rawResults = await Promise.all(toSample.map(path => fetchFile(repo, path)));
    const sampledFiles: FilePayload[] = rawResults
      .map((raw, i) => raw ? { path: toSample[i], content: raw.slice(0, 1800) } : null)
      .filter((f): f is FilePayload => f !== null);
  
    onStage('ready');
  
    return {
      repo,
      totalFiles: allPaths.length,
      fileTree: allPaths.slice(0, 150),
      sampledFiles,
    };
  }