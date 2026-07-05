/**
 * Builds the self-contained HTML document rendered inside the sandboxed
 * preview iframe. No external resources are loaded: the CSS equivalents of
 * the generated Tailwind utilities / SCSS are inlined, so the preview shows
 * exactly what a consumer of the generated component would see.
 *
 * The embedded script adds an interactive inspector (hover to highlight a
 * layer, click to select it) and listens for zoom / foreground-color
 * messages from the app.
 */
export function buildPreviewDoc(componentHtml: string, componentCss: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  #stage { transform-origin: center center; color: #0f172a; line-height: 0; }
  svg { max-width: 100%; height: auto; }
  .__hover { outline: 1.5px dashed #38bdf8 !important; outline-offset: 2px; cursor: crosshair; }
  .__selected { outline: 1.5px solid #f472b6 !important; outline-offset: 2px; }
  #tip {
    position: fixed; pointer-events: none; z-index: 10; display: none;
    background: #0f172a; color: #e2e8f0; border: 1px solid #334155;
    font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 2px 7px; border-radius: 5px; white-space: nowrap;
  }
${componentCss}
</style>
</head>
<body>
<div id="stage">
${componentHtml}
</div>
<div id="tip"></div>
<script>
(function () {
  var stage = document.getElementById("stage");
  var tip = document.getElementById("tip");
  var selected = null;

  function layerOf(el) {
    while (el && el !== stage) {
      if (el.getAttribute && el.getAttribute("data-name")) return el;
      el = el.parentNode;
    }
    return null;
  }

  document.addEventListener("mousemove", function (e) {
    var prev = document.querySelector(".__hover");
    if (prev) prev.classList.remove("__hover");
    var layer = layerOf(e.target);
    if (!layer) { tip.style.display = "none"; return; }
    layer.classList.add("__hover");
    tip.textContent = layer.getAttribute("data-name");
    tip.style.display = "block";
    tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + "px";
    tip.style.top = (e.clientY + 14) + "px";
  });

  document.addEventListener("mouseleave", function () {
    tip.style.display = "none";
    var prev = document.querySelector(".__hover");
    if (prev) prev.classList.remove("__hover");
  });

  document.addEventListener("click", function (e) {
    var layer = layerOf(e.target);
    if (selected) selected.classList.remove("__selected");
    selected = layer;
    if (layer) layer.classList.add("__selected");
    parent.postMessage(
      {
        type: "svg-preview:select",
        name: layer ? layer.getAttribute("data-name") : null,
        tag: layer ? layer.tagName.toLowerCase() : null,
      },
      "*"
    );
  });

  window.addEventListener("message", function (e) {
    var data = e.data || {};
    if (data.type === "svg-preview:zoom") {
      stage.style.transform = "scale(" + data.value + ")";
    } else if (data.type === "svg-preview:fg") {
      stage.style.color = data.value;
    }
  });
})();
</script>
</body>
</html>`;
}
