/** The narrowest width the layout is made for. A narrower screen shows the page scaled down to it. */
const MIN_WIDTH = 360;

const DEFAULT_CONTENT = "width=device-width, initial-scale=1";

// Runs before the page is drawn. iOS keeps `screen.width` at the portrait width, so the width the
// page gets comes from the orientation.
const fitScript = `(function(){
var m=document.querySelector('meta[name="viewport"]'),p=matchMedia("(orientation: portrait)");
function fit(){var w=p.matches?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height);
m.setAttribute("content",w<${MIN_WIDTH}?"width=${MIN_WIDTH}":"${DEFAULT_CONTENT}")}
fit();p.addEventListener("change",fit)})()`;

/**
 * The viewport meta, rendered straight into the document head rather than through the route's
 * `head()`: the script rewrites its `content`, and the router would put it back on navigation.
 * React adopts a head meta only when its `content` matches, so the client renders what the script
 * left there.
 */
export function ViewportMeta() {
  const content =
    typeof document === "undefined"
      ? DEFAULT_CONTENT
      : (document.querySelector('meta[name="viewport"]')?.getAttribute("content") ??
        DEFAULT_CONTENT);
  return (
    <>
      <meta name="viewport" content={content} />
      <script dangerouslySetInnerHTML={{ __html: fitScript }} />
    </>
  );
}
