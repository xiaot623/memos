type MermaidTheme = "default" | "dark";

const toMermaidTheme = (appTheme: string): MermaidTheme => (appTheme === "default-dark" ? "dark" : "default");

export async function renderMermaidSvg(code: string, appTheme: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  await document.fonts?.ready;

  mermaid.initialize({
    startOnLoad: false,
    theme: toMermaidTheme(appTheme),
    securityLevel: "strict",
    fontFamily: getComputedStyle(document.body).fontFamily || "sans-serif",
    suppressErrorRendering: true,
  });

  const id = `mermaid-${Math.random().toString(36).substring(7)}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}

export function createMermaidPreviewRenderer(getTheme: () => string) {
  return (language: string, content: string, applyPreview: (value: null | string | HTMLElement) => void) => {
    if (language !== "mermaid" || !content.trim()) {
      return null;
    }

    const host = document.createElement("div");
    host.className = "mermaid-diagram w-full flex justify-center items-center my-2 overflow-x-auto";
    applyPreview(host);

    void renderMermaidSvg(content, getTheme())
      .then((svg) => {
        host.innerHTML = svg;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to render diagram";
        host.textContent = `Mermaid Error: ${msg}`;
        host.classList.add("text-sm", "text-destructive");
      });

    return host;
  };
}
