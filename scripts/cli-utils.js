// Pure CLI-argument and filename helpers, pulled out of index.js so they're
// importable and testable without triggering the CLI's main() (index.js
// calls main() at module load time, which isn't test-friendly).

/** Path-safe slug: strips filesystem-unsafe characters, collapses
 * whitespace, strips leading dots, and caps length. Falls back to a
 * timestamp-based name if the topic sanitizes to an empty string (e.g. a
 * topic made only of stripped characters) instead of resolving to the
 * output/ directory itself. */
export function slugify(topic, now = Date.now()) {
  const slug = topic
    .trim()
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 50);
  if (slug.length === 0) {
    return `topic-${now}`;
  }
  return slug;
}

/** Minimal `--flag=value` / `--flag` argv parser. Returns { options,
 * positional }. `--render` additionally sets `options._renderFlag`. */
export function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (const arg of argv) {
    const match = arg.match(/^--([a-z-]+)=(.*)$/);
    if (match) {
      options[match[1]] = match[2];
    } else if (arg === "--generate-only" || arg === "--render") {
      options[arg.slice(2)] = true;
      if (arg === "--render") options._renderFlag = true;
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}
