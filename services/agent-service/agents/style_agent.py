from agents.base_agent import BaseAgent

SYSTEM_PROMPT = """You are a UI Style & Design Token Agent. Your job is to generate a cohesive visual design system (colors, typography, spacing) for a web project.

You MUST respond with ONLY valid JSON in this exact format:
{
  "palette_name": "Midnight Aurora",
  "colors": [
    {"name": "--color-primary", "value": "#6C5CE7", "usage": "Primary buttons, links, accents"},
    {"name": "--color-secondary", "value": "#A29BFE", "usage": "Secondary elements, hover states"},
    {"name": "--color-bg", "value": "#0F0F1A", "usage": "Main background"},
    {"name": "--color-surface", "value": "#1A1A2E", "usage": "Cards, panels"},
    {"name": "--color-text", "value": "#E8E8F0", "usage": "Primary text"},
    {"name": "--color-text-muted", "value": "#8888AA", "usage": "Secondary text"},
    {"name": "--color-accent", "value": "#FF6B9D", "usage": "Highlights, badges"},
    {"name": "--color-border", "value": "#2A2A44", "usage": "Borders, dividers"},
    {"name": "--color-success", "value": "#00D68F", "usage": "Success states"},
    {"name": "--color-error", "value": "#FF4757", "usage": "Error states"}
  ],
  "typography": [
    {"name": "--font-heading", "font_family": "Space Grotesk", "weight": "700", "size": "2.5rem", "usage": "Headings"},
    {"name": "--font-body", "font_family": "DM Sans", "weight": "400", "size": "1rem", "usage": "Body text"},
    {"name": "--font-mono", "font_family": "JetBrains Mono", "weight": "400", "size": "0.875rem", "usage": "Code blocks"}
  ],
  "border_radius": "12px",
  "spacing_unit": "8px",
  "mood": "Modern and elegant with a dark premium feel"
}

Design guidelines:
- Create VIBRANT, PREMIUM color palettes — no generic Bootstrap colors
- Use harmonious HSL-based colors with clear contrast
- Include at least 10 color tokens covering all UI needs
- Suggest distinctive, modern fonts (not Arial/Times/Helvetica)
- Match the mood to the project type and description

DO NOT include any text outside the JSON object."""


class StyleAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="StyleAgent", system_prompt=SYSTEM_PROMPT)

    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        project_name = context.get("name", "")
        project_desc = context.get("description", "")
        project_type = context.get("project_type", "web_app")
        framework = context.get("framework", {})
        components = context.get("layout", {})

        prompt = f"""Generate a cohesive design system for this project:

Project: {project_name}
Type: {project_type}
Description: {project_desc}
Framework: {framework.get("framework", "react") if isinstance(framework, dict) else framework}
Components: {len(components.get("components", [])) if isinstance(components, dict) else 0} components planned

Create a premium, visually striking color palette and typography system that matches the project's mood and purpose.
"""
        if user_feedback:
            prompt += f"\nUser feedback: {user_feedback}\nAdjust the style based on this feedback."

        raw = await self.ask_llm(prompt, model)
        result = self.parse_json_response(raw)

        if "raw_response" in result:
            return self._default_style()

        return result

    def _default_style(self) -> dict:
        return {
            "palette_name": "Cyber Dusk",
            "colors": [
                {"name": "--color-primary", "value": "#7C3AED", "usage": "Primary buttons, links, accents"},
                {"name": "--color-secondary", "value": "#A78BFA", "usage": "Secondary elements, hover states"},
                {"name": "--color-bg", "value": "#0B0B14", "usage": "Main background"},
                {"name": "--color-surface", "value": "#14142B", "usage": "Cards, panels, modals"},
                {"name": "--color-text", "value": "#EEEEF5", "usage": "Primary text"},
                {"name": "--color-text-muted", "value": "#7B7BA0", "usage": "Secondary text, captions"},
                {"name": "--color-accent", "value": "#F472B6", "usage": "Highlights, badges, notifications"},
                {"name": "--color-border", "value": "#252547", "usage": "Borders, dividers, outlines"},
                {"name": "--color-success", "value": "#10B981", "usage": "Success states"},
                {"name": "--color-error", "value": "#EF4444", "usage": "Error states, destructive actions"},
            ],
            "typography": [
                {"name": "--font-heading", "font_family": "Outfit", "weight": "700", "size": "2.5rem", "usage": "Headings and titles"},
                {"name": "--font-body", "font_family": "DM Sans", "weight": "400", "size": "1rem", "usage": "Body text and paragraphs"},
                {"name": "--font-mono", "font_family": "Fira Code", "weight": "400", "size": "0.875rem", "usage": "Code and technical content"},
            ],
            "border_radius": "12px",
            "spacing_unit": "8px",
            "mood": "Modern cybersecurity-inspired dark theme"
        }


style_agent = StyleAgent()
