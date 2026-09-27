from agents.base_agent import BaseAgent

SYSTEM_PROMPT = """You are a Code Generator Agent. Your job is to generate production-ready HTML, CSS, and JavaScript code for a web page based on the confirmed framework, components, and design tokens.

You MUST respond with ONLY valid JSON in this exact format:
{
  "files": [
    {
      "filename": "index.html",
      "content": "<!DOCTYPE html>...",
      "language": "html"
    },
    {
      "filename": "index.html",
      "content": "<!DOCTYPE html>...",
      "language": "html",
      "preview_html": "<!DOCTYPE html>... (complete self-contained HTML with inline CSS/JS for preview)"
    },
    {
      "filename": "styles.css",
      "content": ":root { ... }",
      "language": "css"
    },
    {
      "filename": "script.js",
      "content": "// ...",
      "language": "javascript"
    }
  ],
  "instructions": "Open index.html in a browser to preview."
}

Code generation rules:
1. Use the EXACT design tokens (CSS variables) provided
2. Implement ALL confirmed components in the correct order
3. Make the code responsive (mobile-first)
4. Add smooth transitions and micro-animations
5. Include proper semantic HTML5
6. For each HTML file, provide a preview_html that is a complete, self-contained HTML document with all CSS and JS inline
7. Generate clean, well-structured, production-quality code

DO NOT include any text outside the JSON object."""


class GeneratorAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="GeneratorAgent", system_prompt=SYSTEM_PROMPT)

    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        project_name = context.get("name", "")
        project_desc = context.get("description", "")
        framework = context.get("framework", {})
        layout = context.get("layout", {})
        style = context.get("style", {})

        framework_name = framework.get("framework", "vanilla") if isinstance(framework, dict) else str(framework)
        components = layout.get("components", []) if isinstance(layout, dict) else []
        colors = style.get("colors", []) if isinstance(style, dict) else []
        typography = style.get("typography", []) if isinstance(style, dict) else []
        border_radius = style.get("border_radius", "12px") if isinstance(style, dict) else "12px"

        pages = layout.get("pages", []) if isinstance(layout, dict) else []
        components = layout.get("components", []) if isinstance(layout, dict) else []
        
        # If we have pages, we should format the description per page
        if pages:
            component_desc = ""
            for p in pages:
                component_desc += f"Page: {p.get('name', 'index')}\n"
                for i, c in enumerate(p.get("components", [])):
                    component_desc += f"  {i+1}. {c.get('name', '')} ({c.get('type', '')}) - {c.get('description', '')}\n"
        else:
            component_desc = "\n".join([
                f"  {i+1}. {c.get('name', '')} ({c.get('type', '')}) - {c.get('description', '')}"
                for i, c in enumerate(components)
            ])

        color_desc = "\n".join([
            f"  {c.get('name', '')}: {c.get('value', '')} — {c.get('usage', '')}"
            for c in colors
        ])

        font_desc = "\n".join([
            f"  {t.get('name', '')}: {t.get('font_family', '')} {t.get('weight', '')} — {t.get('usage', '')}"
            for t in typography
        ])

        prompt = f"""Generate the complete code for this web page:

Project: {project_name}
Description: {project_desc}
Framework: {framework_name}

COMPONENTS (in order):
{component_desc}

DESIGN TOKENS:
Colors:
{color_desc}

Typography:
{font_desc}

Border Radius: {border_radius}

Generate production-ready code using these exact design tokens as CSS variables. Include all components in order. Make it responsive and add smooth animations.
"""
        if user_feedback:
            prompt += f"\nUser feedback: {user_feedback}\nAdjust the generated code based on this feedback."

        raw = await self.ask_llm(prompt, model)
        result = self.parse_json_response(raw)

        if "raw_response" in result:
            return self._build_fallback(project_name, pages if pages else [{"id": "index", "name": "index", "components": components}], colors, typography, border_radius)

        return result

    def _build_fallback(self, name: str, pages: list, colors: list, typography: list, border_radius: str) -> dict:
        css_vars = "\n".join([f"    {c.get('name', '')}: {c.get('value', '')};" for c in colors])
        font_imports = set()
        font_vars = ""
        for t in typography:
            family = t.get("font_family", "sans-serif")
            font_imports.add(family.replace(" ", "+"))
            font_vars += f"    {t.get('name', '')}: '{family}', sans-serif;\n"

        import_url = "https://fonts.googleapis.com/css2?" + "&".join([f"family={f}:wght@400;700" for f in font_imports]) + "&display=swap"

        files = []
        
        # Generate CSS
        css = f"""@import url('{import_url}');

:root {{
{css_vars}
{font_vars}    --radius: {border_radius};
}}

* {{ margin: 0; padding: 0; box-sizing: border-box; }}

body {{
  font-family: var(--font-body, sans-serif);
  background: var(--color-bg, #0B0B14);
  color: var(--color-text, #EEEEF5);
  line-height: 1.6;
}}

.container {{
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}}

.section {{
  padding: 5rem 0;
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.6s ease forwards;
}}

.section h2 {{
  font-family: var(--font-heading, sans-serif);
  font-size: 2.5rem;
  margin-bottom: 1rem;
}}

@keyframes fadeInUp {{
  to {{ opacity: 1; transform: translateY(0); }}
}}"""

        js = """document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.section');
  sections.forEach((section, i) => {
    section.style.animationDelay = `${i * 0.15}s`;
  });
});"""

        files.append({"filename": "styles.css", "content": css, "language": "css"})
        files.append({"filename": "script.js", "content": js, "language": "javascript"})

        for page in pages:
            page_name = page.get("name", "index").lower().replace(" ", "-")
            if not page_name.endswith(".html"):
                page_name += ".html"
            
            sections_html = ""
            for comp in page.get("components", []):
                comp_type = comp.get("type", "section")
                comp_name = comp.get("name", "Section")
                comp_desc = comp.get("description", "")
                
                # Apply custom styles if present
                style_attr = ""
                if comp.get("customColor"):
                    style_attr += f"background-color: {comp.get('customColor')}; "
                if comp.get("width"):
                    style_attr += f"width: {comp.get('width')}px; "
                if comp.get("height"):
                    style_attr += f"height: {comp.get('height')}px; "
                
                style_str = f' style="{style_attr}"' if style_attr else ""
                
                sections_html += f"""
      <section class="section section--{comp_type}" id="{comp.get('id', '')}"{style_str}>
        <div class="container">
          <h2>{comp.get('customText') or comp_name}</h2>
          <p>{comp.get('content') or comp_desc}</p>
        </div>
      </section>"""

            html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{name} - {page.get('name', 'Home')}</title>
  <link rel="stylesheet" href="styles.css">
  <link href="{import_url}" rel="stylesheet">
</head>
<body>
{sections_html}
  <script src="script.js"></script>
</body>
</html>"""
            
            preview_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{name} - {page.get('name', 'Home')}</title>
  <link href="{import_url}" rel="stylesheet">
  <style>{css}</style>
</head>
<body>
{sections_html}
  <script>{js}</script>
</body>
</html>"""
            files.append({"filename": page_name, "content": html, "language": "html", "preview_html": preview_html})

        return {
            "files": files,
            "instructions": "Open the generated HTML files in a browser to preview your pages."
        }


generator_agent = GeneratorAgent()
