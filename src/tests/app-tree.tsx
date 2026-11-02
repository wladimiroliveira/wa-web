import type { ComponentType, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { matchPattern, registerPatterns } from "@/tests/navigation";

/**
 * The application as Next assembles it from `src/app`: a page wrapped in every layout above it.
 *
 * A screen's guards live in the file tree, so a test that wants to know whether `/roles` asks for a
 * permission has to read the tree itself. This does, through the bundler, so the test exercises the
 * real pages and layouts rather than a copy of their arrangement.
 */
type PageModule = { default: ComponentType };
type LayoutModule = { default: ComponentType<{ children: ReactNode }> };

const pages = import.meta.glob<PageModule>("../app/**/page.tsx", { eager: true });
const layouts = import.meta.glob<LayoutModule>("../app/**/layout.tsx", { eager: true });
const notFound = import.meta.glob<PageModule>("../app/not-found.tsx", { eager: true });
const layoutSources = import.meta.glob<string>("../app/**/layout.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
});

const APP_ROOT = "../app";

/** The directory of a module, relative to the app root: `/(app)/(reports)/stock/[sku]`. */
const directoryOf = (key: string) => key.slice(APP_ROOT.length).replace(/\/[^/]+$/, "");

/** The address a directory answers to: groups vanish, `[sku]` becomes `:sku`. */
function patternOf(directory: string): string {
  const segments = directory
    .split("/")
    .filter((segment) => segment !== "" && !segment.startsWith("("))
    .map((segment) => segment.replace(/^\[(\w+)\]$/, ":$1"));

  return `/${segments.join("/")}`;
}

export type Route = { pattern: string; directory: string; page: ComponentType; layouts: string[]; guards: string[] };

/** The permissions a layout asks for, read from its source: Next allows a layout no export but its component. */
function guardsOf(directory: string): string[] {
  const source = layoutSources[`${APP_ROOT}${directory}/layout.tsx`] ?? "";
  const permissions = [...source.matchAll(/permission="(\w+)"/g)].map(([, permission]) => permission!);

  return source.includes("<RequireSession") ? ["SESSION", ...permissions] : permissions;
}

/** Every page under `src/app`, with the layouts that wrap it from the outermost in. The root layout is left out: it renders `<html>`. */
export const routes: Route[] = Object.entries(pages)
  .map(([key, module]) => {
    const directory = directoryOf(key);
    const wrapping = Object.keys(layouts)
      .map(directoryOf)
      .filter((candidate) => candidate !== "" && (directory === candidate || directory.startsWith(`${candidate}/`)))
      .sort((a, b) => a.length - b.length);

    return {
      pattern: patternOf(directory),
      directory,
      page: module.default,
      layouts: wrapping,
      guards: wrapping.flatMap(guardsOf),
    };
  })
  .sort((a, b) => a.pattern.localeCompare(b.pattern));

registerPatterns(routes.map((route) => route.pattern));

function findRoute(pathname: string): Route | undefined {
  // A static segment wins over a dynamic one, as `/pre-weighings/new` does over `/pre-weighings/:id`.
  const matching = routes.filter((route) => matchPattern(route.pattern, pathname) !== null);

  return matching.find((route) => !route.pattern.includes(":")) ?? matching[0];
}

function layoutOf(directory: string): ComponentType<{ children: ReactNode }> {
  return layouts[`${APP_ROOT}${directory}/layout.tsx`]!.default;
}

const NotFound = notFound[`${APP_ROOT}/not-found.tsx`]!.default;

/** Renders whatever page the current address resolves to, wrapped in its layouts. */
export function AppTree() {
  const pathname = usePathname();
  const route = findRoute(pathname);

  if (route === undefined) return <NotFound />;

  const Page = route.page;

  return route.layouts.reduceRight<ReactNode>(
    (children, directory) => {
      const Layout = layoutOf(directory);

      return <Layout>{children}</Layout>;
    },
    <Page />,
  );
}
