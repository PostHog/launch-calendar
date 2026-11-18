import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Quill's tokens, copied from the posthog repo by `pnpm sync:quill`. */
const TOKENS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../styles/quill-tokens.css",
);

export const QUILL_TOKENS = readFileSync(TOKENS_PATH, "utf8");

/**
 * Page styles on Quill tokens, following the look of Quill's components:
 * ghost buttons for navigation, cards with a hairline ring, small radii, 13px UI text.
 */
export const PAGE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--background);color:var(--foreground);font-family:var(--font-sans);font-size:var(--text-sm);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{margin:0 auto;padding:16px 16px 48px}
a{color:inherit;text-underline-offset:3px;text-decoration-color:color-mix(in oklab,var(--foreground) 30%,transparent)}
a:hover{text-decoration-color:currentColor}
h1{font-size:var(--text-2xl);line-height:var(--text-2xl--line-height);font-weight:600;letter-spacing:-.01em;margin:8px 0}
h2{font-size:var(--text-lg);font-weight:600;margin:36px 0 8px}
h3{font-size:var(--text-base);font-weight:600;margin:24px 0 8px}
p,li{color:var(--foreground)}
.muted{color:var(--muted-foreground)}
code{font-family:var(--font-mono);font-size:.85em;background:var(--muted);border-radius:var(--radius-xs);padding:1px 5px}
pre{background:var(--card);border-radius:var(--radius-md);padding:12px 14px;overflow-x:auto;box-shadow:0 0 0 1px color-mix(in oklab,var(--foreground) 10%,transparent);white-space:pre-wrap}
pre code{background:none;padding:0}

/* Quill ghost buttons: the top navigation */
.topnav{display:flex;flex-wrap:wrap;gap:2px;margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.topnav a{font-size:var(--text-ui);font-weight:500;padding:4px 8px;border-radius:var(--radius-sm);text-decoration:none;color:var(--muted-foreground)}
.topnav a:hover{background:var(--fill-hover);color:var(--foreground)}
.topnav a[aria-current="page"]{background:var(--fill-selected);color:var(--foreground)}

/* Quill outline buttons */
.btn{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;font-size:var(--text-ui);font-weight:500;line-height:1;text-decoration:none;color:var(--foreground);border-radius:var(--radius-sm);border:1px solid color-mix(in oklab,var(--foreground) 10%,transparent);background:color-mix(in oklab,var(--muted) 30%,transparent)}
.btn:hover{background:var(--fill-hover)}
@media (prefers-color-scheme:dark){.btn{border-color:color-mix(in oklab,var(--foreground) 15%,transparent)}}

/* Quill card */
.card{background:var(--card);color:var(--card-foreground);border-radius:var(--radius-lg);box-shadow:0 0 0 1px color-mix(in oklab,var(--foreground) 10%,transparent);overflow:hidden}

/* Tables inside a card */
.table-card{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:var(--text-ui)}
th,td{padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:0}
th{color:var(--muted-foreground);font-weight:500;background:color-mix(in oklab,var(--muted) 60%,transparent)}
tr.tentative td{color:var(--muted-foreground)}

/* The naming guide's own tables and lists */
.prose{max-width:760px}
.prose table{background:var(--card);border-radius:var(--radius-lg);box-shadow:0 0 0 1px color-mix(in oklab,var(--foreground) 10%,transparent);overflow:hidden;margin:12px 0}
`;
