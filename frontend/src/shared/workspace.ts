export function workspacePrefix(pathname = window.location.pathname) {
  return pathname.match(/^\/demos\/[a-f0-9]{64}(?=\/|$)/)?.[0] ?? "";
}
