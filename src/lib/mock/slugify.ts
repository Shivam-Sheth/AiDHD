export function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "untitled-event"
  );
}

export function uniqueSlug(base: string, existing: Record<string, unknown>): string {
  if (!(base in existing)) return base;
  let n = 2;
  while (`${base}-${n}` in existing) n++;
  return `${base}-${n}`;
}
