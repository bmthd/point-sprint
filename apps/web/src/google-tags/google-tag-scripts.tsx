import { googleTagIds } from "./ids";
import { googleTagScripts } from "./scripts";

/**
 * The Google tags, rendered straight into the document head rather than through the route's
 * `head()`: TanStack Router re-inserts head scripts on client-side navigation, which ran the gtag
 * snippet again and sent a second page_view. React keeps these elements as they were prerendered.
 */
export function GoogleTagScripts() {
  return googleTagScripts(googleTagIds).map(({ children, ...attrs }) =>
    children === undefined ? (
      <script key={attrs.src} {...attrs} />
    ) : (
      <script key="inline" dangerouslySetInnerHTML={{ __html: children }} />
    ),
  );
}
