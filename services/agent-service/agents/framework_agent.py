from agents.base_agent import BaseAgent

SYSTEM_PROMPT = """You are a Senior Solutions Architect Agent. Your job is to design the optimal tech stack and architectural style for a web project based on the user's requirements.

You MUST respond with ONLY valid JSON in this exact format:
{
  "frontend_framework": "react|nextjs|vue|nuxt|svelte|vanilla|...",
  "backend_language": "fastapi|nodejs|nestjs|springboot|go|django|...",
  "database": "postgresql|mysql|mongodb|redis|sqlite|...",
  "architecture_style": "monolith|microservices|serverless|event-driven",
  "rag_implementation": true/false,
  "vector_database": "pgvector|milvus|qdrant|pinecone|none",
  "key_features": ["Feature 1", "Feature 2", "Feature 3"],
  "rationale": "A clear 3-4 sentence explanation of why this combined architecture and stack fits perfectly.",
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2"],
  "complexity": "beginner|intermediate|advanced"
}

If the user explicitly specifies their 'Tech Preferences' in the description, YOU MUST strongly favor or outright select those preferred technologies unless they are completely incompatible.
If the project description implies AI usage, semantic search, or querying external documentation, set "rag_implementation" to true and select an appropriate "vector_database". Otherwise, set it to false and use "none".

Consider these factors:
- Project type (landing page, web app, dashboard, portfolio)
- Scale, complexity, and real-time requirements
- AI integration / RAG necessity
- SEO needs (SSR/SSG)
- Developer experience level (infer from description)
- Ecosystem and community support

DO NOT include any text outside the JSON object."""


class FrameworkAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="FrameworkAgent", system_prompt=SYSTEM_PROMPT)

    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        project_name = context.get("name", "Unnamed Project")
        project_desc = context.get("description", "")
        project_type = context.get("project_type", "web_app")

        prompt = f"""Analyze this project and recommend the best architecture and tech stack:

Project Name: {project_name}
Project Type: {project_type}
Description: {project_desc}
"""
        if user_feedback:
            prompt += f"\nUser feedback on previous suggestion: {user_feedback}\nPlease adjust your recommendation based on this feedback."

        raw = await self.ask_llm(prompt, model)
        result = self.parse_json_response(raw)

        if "raw_response" in result:
            return {
                "frontend_framework": "nextjs",
                "backend_language": "fastapi",
                "database": "postgresql",
                "architecture_style": "monolith",
                "rag_implementation": False,
                "vector_database": "none",
                "key_features": ["User Interface", "API Endpoints"],
                "rationale": result["raw_response"],
                "pros": ["Widely adopted", "Great for AI", "High performance"],
                "cons": ["Multiple moving parts"],
                "complexity": "intermediate"
            }

        return result


framework_agent = FrameworkAgent()
