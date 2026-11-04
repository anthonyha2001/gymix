export { PageTabs, TabPanel } from "./page-tabs-bar";

// Reads ?tab= against the allowed ids, falling back to the first.
export function activeTab<T extends string>(value: string | string[] | undefined, ids: readonly T[]): T {
  return (ids as readonly string[]).includes(String(value)) ? (value as T) : ids[0];
}
