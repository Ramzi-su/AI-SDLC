from agents.base_agent import BaseAgent

SYSTEM_PROMPT = """You are a UI Component Selection Agent. Your job is to suggest the ideal page layout and UI components for a web application.

You MUST respond with ONLY valid JSON in this exact format:
{
  "page_name": "index",
  "components": [
    {
      "id": "comp_1",
      "name": "Navigation Bar",
      "type": "navbar",
      "description": "A fixed top navigation with logo, links, and CTA button",
      "variants": ["minimal", "centered", "mega-menu"],
      "order": 1
    }
  ]
}

Available component types: 
- Layout/Blocks: navbar, hero, features, cards, testimonials, pricing, cta, form, footer, sidebar, table, stats, gallery, team, faq, timeline, contact, breadcrumb, tabs, modal
- Atomic/Basic: button, input, textarea, dropdown, checkbox, radio, icon, image, video, heading, paragraph, divider, badge, avatar, alert, spinner

For each component:
- Give a clear, descriptive name
- Describe its purpose and content
- Suggest 2-3 visual variants
- Order them logically (layout blocks first, then atomic components)

Suggest 25 to 35 components covering both layout blocks and atomic web elements to provide a rich palette.
DO NOT include any text outside the JSON object."""


class ComponentAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="ComponentAgent", system_prompt=SYSTEM_PROMPT)

    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        project_name = context.get("name", "")
        project_desc = context.get("description", "")
        project_type = context.get("project_type", "web_app")
        framework = context.get("framework", {})
        framework_name = framework.get("framework", "react") if isinstance(framework, dict) else str(framework)

        prompt = f"""Suggest the ideal page layout and UI components for this project:

Project: {project_name}
Type: {project_type}
Description: {project_desc}
Framework: {framework_name}

Suggest components that make sense for this type of project. Order them logically from top to bottom of the page.
"""
        if user_feedback:
            prompt += f"\nUser feedback: {user_feedback}\nAdjust the component suggestions based on this feedback."

        raw = await self.ask_llm(prompt, model)
        result = self.parse_json_response(raw)

        if "raw_response" in result:
            return self._default_layout(project_type)

        return result

        base_components = [
            # Layout Blocks
            {"id": "comp_1", "name": "Navigation Bar", "type": "navbar", "description": "Top navigation with logo and links", "variants": ["minimal", "centered", "sticky"], "order": 1},
            {"id": "comp_2", "name": "Hero Section", "type": "hero", "description": "Main banner with headline and CTA", "variants": ["centered", "split", "fullscreen"], "order": 2},
            {"id": "comp_3", "name": "Features Grid", "type": "features", "description": "Key features with icons", "variants": ["3-column", "alternating", "cards"], "order": 3},
            {"id": "comp_4", "name": "Content Cards", "type": "cards", "description": "Information cards section", "variants": ["grid", "carousel", "masonry"], "order": 4},
            {"id": "comp_5", "name": "Testimonials", "type": "testimonials", "description": "User reviews and feedback", "variants": ["slider", "grid"], "order": 5},
            {"id": "comp_6", "name": "Pricing Table", "type": "pricing", "description": "Subscription tiers and features", "variants": ["3-tier", "toggle"], "order": 6},
            {"id": "comp_7", "name": "Contact Form", "type": "contact", "description": "User contact form", "variants": ["simple", "with-map"], "order": 7},
            {"id": "comp_8", "name": "FAQ Section", "type": "faq", "description": "Frequently asked questions accordion", "variants": ["list", "grid"], "order": 8},
            {"id": "comp_9", "name": "Call to Action", "type": "cta", "description": "Final CTA section", "variants": ["banner", "split", "minimal"], "order": 9},
            {"id": "comp_10", "name": "Footer", "type": "footer", "description": "Site footer with links and info", "variants": ["simple", "multi-column", "minimal"], "order": 10},
            
            # Atomic Elements
            {"id": "comp_11", "name": "Primary Button", "type": "button", "description": "Main action button", "variants": ["solid", "outline", "ghost"], "order": 11},
            {"id": "comp_12", "name": "Text Input", "type": "input", "description": "Single line text field", "variants": ["standard", "floating-label"], "order": 12},
            {"id": "comp_13", "name": "Text Area", "type": "textarea", "description": "Multi-line text input", "variants": ["standard"], "order": 13},
            {"id": "comp_14", "name": "Dropdown Select", "type": "dropdown", "description": "Selection menu", "variants": ["standard", "searchable"], "order": 14},
            {"id": "comp_15", "name": "Checkbox", "type": "checkbox", "description": "Toggleable boolean input", "variants": ["standard", "switch"], "order": 15},
            {"id": "comp_16", "name": "Radio Group", "type": "radio", "description": "Mutually exclusive options", "variants": ["vertical", "horizontal"], "order": 16},
            {"id": "comp_17", "name": "Vector Icon", "type": "icon", "description": "Scalable vector graphic icon", "variants": ["solid", "outline"], "order": 17},
            {"id": "comp_18", "name": "Responsive Image", "type": "image", "description": "Image with lazy loading", "variants": ["rounded", "circle", "full-width"], "order": 18},
            {"id": "comp_19", "name": "Heading (H1-H6)", "type": "heading", "description": "Typography heading", "variants": ["h1", "h2", "h3"], "order": 19},
            {"id": "comp_20", "name": "Paragraph", "type": "paragraph", "description": "Standard text block", "variants": ["regular", "lead", "small"], "order": 20},
            {"id": "comp_21", "name": "Divider", "type": "divider", "description": "Visual separator", "variants": ["solid", "dashed"], "order": 21},
            {"id": "comp_22", "name": "Status Badge", "type": "badge", "description": "Small status indicator", "variants": ["success", "warning", "error"], "order": 22},
            {"id": "comp_23", "name": "User Avatar", "type": "avatar", "description": "User profile image", "variants": ["circle", "square"], "order": 23},
            {"id": "comp_24", "name": "Alert Box", "type": "alert", "description": "Important notification message", "variants": ["info", "success", "error"], "order": 24},
            {"id": "comp_25", "name": "Loading Spinner", "type": "spinner", "description": "Loading state indicator", "variants": ["circle", "dots"], "order": 25},
        ]
        return {"page_name": "index", "components": base_components}


component_agent = ComponentAgent()
