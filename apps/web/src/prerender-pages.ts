/** Every route, rendered to HTML at build time. Listed so none depends on being reached by a link. */
export const prerenderedPages = ["/", "/plan", "/plan/settings", "/profile"].map((path) => ({
  path,
  file: path === "/" ? "index.html" : `${path.slice(1)}/index.html`,
}));

/** HTML files, relative to the client output directory, that the build did not write. */
export const missingPrerenderedPages = (exists: (file: string) => boolean): string[] =>
  prerenderedPages.map((page) => page.file).filter((file) => !exists(file));
