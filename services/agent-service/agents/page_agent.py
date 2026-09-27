import re
import logging
from agents.base_agent import BaseAgent
from agents.generator_agent import generator_agent

logger = logging.getLogger(__name__)

# Code inside JSON strings breaks easily (unescaped quotes/newlines), so this
# agent asks for plain delimited blocks instead and parses them with regexes.
SYSTEM_PROMPT = """You are a Page Generator Agent. You turn ONE page drawn by the user in a visual site builder into real, working code in the framework the user chose.

The user placed components on a canvas with pixel positions and sizes. Treat the canvas as a wireframe:
- Components with similar Y values sit on the same row (side by side), ordered by X.
- Relative widths hint at column proportions. Make the result responsive, do not hard-code canvas pixels.
- Respect every custom text, content and color the user set. Never drop a component.
- Some components come with a freehand outline the user drew (an SVG path inside the component's box).
  Reproduce that shape: use CSS border-radius for simple shapes, clip-path or an inline SVG for irregular ones.
  A closed outline (ends with Z) is a filled shape; an open one is a stroke such as a line or divider.
- A component of type "sketch" is a drawing the user has not assigned a function to. Infer its role from
  its shape, size and position (e.g. a thin line is a divider, a small blob near the top is a logo),
  or render it as a decorative shape.

Respond using ONLY these delimited blocks, with no text outside them:

===FILE: <relative/path/with.extension>===
<full file content>
===END===
(repeat the FILE block for every source file of this page, written in the chosen framework)

===PREVIEW===
<one complete, self-contained HTML document (inline CSS and JS, no build step, no imports of local files) that renders this page exactly as the framework code would look>
===END===

===EXPLANATION===
<3-6 short sentences explaining how the code is structured, written for a learner>
===END===
"""

FILE_RE = re.compile(r"===FILE:\s*(.+?)\s*===\s*\n(.*?)\n?===END===", re.S)
PREVIEW_RE = re.compile(r"===PREVIEW===\s*\n(.*?)\n?===END===", re.S)
EXPLANATION_RE = re.compile(r"===EXPLANATION===\s*\n(.*?)\n?===END===", re.S)

LANGUAGE_BY_EXT = {
    "html": "html", "htm": "html", "css": "css", "scss": "css",
    "js": "javascript", "jsx": "javascript", "mjs": "javascript",
    "ts": "typescript", "tsx": "typescript",
    "vue": "vue", "svelte": "svelte", "json": "json", "py": "python",
}

# Keep prompts within a small local model's context window.
MAX_CONTEXT_CHARS_PER_PAGE = 3000
MAX_OUTLINE_CHARS = 800


class PageAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="PageAgent", system_prompt=SYSTEM_PROMPT)

    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        """context = {"project": {...}, "page": {...}, "approved_pages": [...], "previous_attempt": {...} | None}"""
        project = context.get("project", {})
        page = context.get("page", {})
        approved_pages = context.get("approved_pages", [])
        previous_attempt = context.get("previous_attempt")

        framework = project.get("framework") or {}
        style = project.get("style") or {}
        framework_name = framework.get("frontend_framework", "vanilla") if isinstance(framework, dict) else str(framework)
        colors = style.get("colors", []) if isinstance(style, dict) else []
        typography = style.get("typography", []) if isinstance(style, dict) else []
        border_radius = style.get("border_radius", "12px") if isinstance(style, dict) else "12px"

        prompt = f"""Project: {project.get('name', '')}
Description: {project.get('description', '')}
Framework: {framework_name}

PAGE TO GENERATE: "{page.get('name', 'Home')}"
Components on the canvas (sorted top-to-bottom, left-to-right):
{self._describe_components(page.get('components', []))}

DESIGN TOKENS (use them as CSS variables):
Colors:
{self._describe_colors(colors)}
Typography:
{self._describe_typography(typography)}
Border radius: {border_radius}
"""

        if approved_pages:
            prompt += "\nALREADY APPROVED PAGES (stay consistent: reuse shared parts such as navbar/footer, naming and styling):\n"
            for approved in approved_pages:
                prompt += self._describe_approved_page(approved)

        if previous_attempt and user_feedback:
            prompt += f"""
YOUR PREVIOUS ATTEMPT FOR THIS PAGE WAS REJECTED.
Previous main file:
{self._main_file_excerpt(previous_attempt)}

User feedback: {user_feedback}
Fix the page according to this feedback and keep everything the user did not complain about.
"""
        elif user_feedback:
            prompt += f"\nUser instructions: {user_feedback}\n"

        raw = await self.ask_llm(prompt, model)
        result = self._parse(raw)

        if result is None:
            logger.warning(f"[{self.name}] Could not parse LLM output for page {page.get('id')}, using fallback")
            return self._build_fallback(project, page, colors, typography, border_radius)

        return result

    def _describe_components(self, components: list) -> str:
        if not components:
            return "  (empty page)"
        ordered = sorted(components, key=lambda c: (c.get("y") or 0, c.get("x") or 0))
        lines = []
        for i, c in enumerate(ordered, 1):
            line = (
                f"  {i}. {c.get('name', '')} [type: {c.get('type', '')}] "
                f"at x={c.get('x') or 0}, y={c.get('y') or 0}, "
                f"size={c.get('width') or 200}x{c.get('height') or 80}"
            )
            if c.get("description"):
                line += f"\n     purpose: {c['description']}"
            if c.get("selected_variant"):
                line += f"\n     variant: {c['selected_variant']}"
            if c.get("customText"):
                line += f"\n     text: {c['customText']}"
            if c.get("content"):
                line += f"\n     content: {c['content']}"
            if c.get("customColor"):
                line += f"\n     color: {c['customColor']}"
            if c.get("customShape"):
                line += f"\n     shape: {c['customShape']}"
            if c.get("path"):
                line += "\n     " + self._describe_outline(c)
            lines.append(line)
        return "\n".join(lines)

    def _describe_outline(self, c: dict) -> str:
        if c.get("shapeKind") == "rectangle":
            return "drawn outline: a rectangle filling the component's box"
        if c.get("shapeKind") == "ellipse":
            shape = "a circle" if c.get("width") == c.get("height") else "an ellipse"
            return f"drawn outline: {shape} filling the component's box (use border-radius: 50%)"
        path = c["path"]
        kind = "closed shape" if path.rstrip().endswith("Z") else "open stroke"
        box = f"{c.get('pathWidth') or c.get('width')}x{c.get('pathHeight') or c.get('height')}"
        if len(path) > MAX_OUTLINE_CHARS:
            return f"drawn outline: {kind}, too detailed to list (irregular freehand shape in a {box} box)"
        return f"drawn outline ({kind}, SVG path in a {box} box): {path}"

    def _describe_colors(self, colors: list) -> str:
        return "\n".join(f"  {c.get('name', '')}: {c.get('value', '')} ({c.get('usage', '')})" for c in colors) or "  (none)"

    def _describe_typography(self, typography: list) -> str:
        return "\n".join(
            f"  {t.get('name', '')}: {t.get('font_family', '')} {t.get('weight', '')} {t.get('size', '')} ({t.get('usage', '')})"
            for t in typography
        ) or "  (none)"

    def _describe_approved_page(self, approved: dict) -> str:
        filenames = ", ".join(f.get("filename", "") for f in approved.get("files", []))
        return f"""- Page "{approved.get('page_name', '')}" (files: {filenames})
{self._main_file_excerpt(approved)}
"""

    def _main_file_excerpt(self, generation: dict) -> str:
        files = generation.get("files", [])
        if not files:
            return "  (no files)"
        main = files[0]
        content = main.get("content", "")
        if len(content) > MAX_CONTEXT_CHARS_PER_PAGE:
            content = content[:MAX_CONTEXT_CHARS_PER_PAGE] + "\n... (truncated)"
        return f"--- {main.get('filename', '')} ---\n{content}\n---"

    def _parse(self, raw: str) -> dict | None:
        files = [
            {
                "filename": name.strip(),
                "content": content,
                "language": LANGUAGE_BY_EXT.get(name.rsplit(".", 1)[-1].lower(), "text"),
            }
            for name, content in FILE_RE.findall(raw)
        ]
        preview = PREVIEW_RE.search(raw)
        explanation = EXPLANATION_RE.search(raw)

        preview_html = preview.group(1).strip() if preview else ""
        # Vanilla HTML output is already previewable on its own.
        if not preview_html:
            html_file = next((f for f in files if f["language"] == "html"), None)
            preview_html = html_file["content"] if html_file else ""

        if not files or not preview_html:
            return None

        return {
            "files": files,
            "preview_html": preview_html,
            "explanation": explanation.group(1).strip() if explanation else "",
            "fallback": False,
        }

    def _build_fallback(self, project: dict, page: dict, colors: list, typography: list, border_radius: str) -> dict:
        built = generator_agent._build_fallback(project.get("name", ""), [page], colors, typography, border_radius)
        html_file = next(f for f in built["files"] if f["language"] == "html")
        return {
            "files": [{k: v for k, v in f.items() if k != "preview_html"} for f in built["files"]],
            "preview_html": html_file["preview_html"],
            "explanation": "The AI response could not be understood, so a basic template was generated instead. Click Redo to try again, or pick a stronger model.",
            "fallback": True,
        }


page_agent = PageAgent()
