import re
import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a patient, encouraging coding teacher inside a web-development learning app.
You adapt every explanation to the learner's level: beginners get plain words and analogies, experts get precise terminology and trade-offs.
When asked for JSON, respond with ONLY valid JSON and never put multi-line code inside JSON strings
(refer to code by file name and line numbers instead; short inline snippets like `display: flex` are fine)."""

# Keep prompts within a small local model's context window.
MAX_CODE_CHARS = 6000
MAX_EXAMPLE_LINES = 80

CHALLENGE_POINTS_KINDS = ("complete", "modify", "scratch")

SCRATCH_STARTER = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My challenge</title>
  <style>
    /* ✏️ Your CSS here */
  </style>
</head>
<body>
  <!-- ✏️ Your HTML here -->

  <script>
    // ✏️ Your JavaScript here (if needed)
  </script>
</body>
</html>"""

CODE_BLOCK_RE = re.compile(r"===CODE===\s*\n(.*?)\n?===END===", re.S)


class LearningError(Exception):
    """The model's answer could not be used; the message is safe to show to the learner."""


def number_lines(code: str) -> str:
    return "\n".join(f"{i:>4}| {line}" for i, line in enumerate(code.splitlines(), 1))


def truncate(text: str, limit: int = MAX_CODE_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + "\n... (truncated)"


def blank_marker(code_before: str, indent: str) -> str:
    """A 'write your code here' comment in the syntax of the surrounding block."""
    lower = code_before.lower()
    if lower.rfind("<style") > lower.rfind("</style>"):
        return f"{indent}/* ✏️ Write the missing code here */"
    if lower.rfind("<script") > lower.rfind("</script>"):
        return f"{indent}// ✏️ Write the missing code here"
    return f"{indent}<!-- ✏️ Write the missing code here -->"


class LearningAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="LearningAgent", system_prompt=SYSTEM_PROMPT)

    async def execute(self, context: dict, model: str = None, user_feedback: str = None) -> dict:
        raise NotImplementedError("Use the specific learning methods")

    async def _ask_json(self, prompt: str, model: str, what: str) -> dict:
        raw = await self.ask_llm(prompt, model)
        data = self.parse_json_response(raw)
        if "raw_response" in data:
            raise LearningError(f"The AI could not produce a valid {what}. Try again, or pick a stronger model.")
        return data

    def _files_listing(self, files: list) -> str:
        parts = [f"=== FILE: {f.get('filename', '')} ===\n{number_lines(f.get('content', ''))}" for f in files]
        return truncate("\n\n".join(parts))

    # ---------- Lessons ----------

    async def lesson(self, page_name: str, files: list, level: str, model: str) -> dict:
        prompt = f"""Learner level: {level}

Teach the learner how the page "{page_name}" of their own website is built. Here is its real code:

{self._files_listing(files)}

Respond with JSON in exactly this shape:
{{
  "title": "short lesson title",
  "summary": "2-3 sentences: what this page is and how its code is organised",
  "sections": [
    {{"title": "...", "explanation": "what this part does and why, 3-6 sentences", "file": "exact file name from above", "start_line": 1, "end_line": 10}}
  ],
  "key_concepts": [{{"name": "e.g. Flexbox", "explanation": "1-2 sentences"}}]
}}
Use 3 to 6 sections in reading order, each pointing at a real line range of 3-25 lines."""
        data = await self._ask_json(prompt, model, "lesson")

        by_name = {f.get("filename"): f.get("content", "") for f in files}
        sections = []
        for s in data.get("sections", []) or []:
            if not isinstance(s, dict) or not s.get("explanation"):
                continue
            section = {"title": s.get("title", ""), "explanation": s["explanation"], "file": s.get("file")}
            # The excerpt comes from the real file, not from the model, so it is always accurate.
            content = by_name.get(s.get("file"))
            if content is not None:
                lines = content.splitlines()
                try:
                    start = max(1, int(s.get("start_line", 1)))
                    end = min(len(lines), int(s.get("end_line", start)))
                except (TypeError, ValueError):
                    start, end = 1, 0
                if start <= end:
                    section.update(start_line=start, end_line=end, code="\n".join(lines[start - 1:end]))
            sections.append(section)

        if not sections:
            raise LearningError("The AI lesson came back empty. Try again, or pick a stronger model.")

        return {
            "title": data.get("title") or f"How “{page_name}” is built",
            "summary": data.get("summary", ""),
            "sections": sections,
            "key_concepts": [c for c in data.get("key_concepts", []) or [] if isinstance(c, dict) and c.get("name")],
        }

    # ---------- Tutor chat ----------

    async def ask(self, question: str, history: list, files: list | None, level: str, model: str) -> dict:
        prompt = f"Learner level: {level}\n\n"
        if files:
            prompt += f"The learner is asking about this code from their own project:\n\n{self._files_listing(files)}\n\n"
        if history:
            prompt += "Conversation so far:\n" + "\n".join(
                f"{'Learner' if m.get('role') == 'user' else 'Teacher'}: {m.get('content', '')}" for m in history[-8:]
            ) + "\n\n"
        prompt += (
            f"Learner: {question}\n\n"
            "Answer as the teacher in plain text (short code examples in backticks are fine). "
            "Be concise, point to line numbers when relevant, and end with one question that checks understanding."
        )
        answer = (await self.ask_llm(prompt, model)).strip()
        if not answer:
            raise LearningError("The AI returned an empty answer. Try asking again.")
        return {"answer": answer}

    # ---------- Quizzes ----------

    async def quiz(self, files: list | None, topic: str | None, level: str, model: str, count: int = 5) -> dict:
        source = (
            f"about this code from the learner's own project:\n\n{self._files_listing(files)}"
            if files else f"about the topic: {topic or 'HTML, CSS and JavaScript basics'}"
        )
        prompt = f"""Learner level: {level}

Write a {count}-question multiple-choice quiz {source}

Respond with JSON in exactly this shape:
{{"questions": [{{"question": "...", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "why the answer is right"}}]}}
Each question has exactly 4 options and one correct answer. Vary the position of the correct answer."""
        data = await self._ask_json(prompt, model, "quiz")

        questions = []
        for q in data.get("questions", []) or []:
            if not isinstance(q, dict):
                continue
            options = [str(o) for o in q.get("options", []) or []]
            try:
                answer = int(q.get("answer_index"))
            except (TypeError, ValueError):
                continue
            if q.get("question") and len(options) >= 2 and 0 <= answer < len(options):
                questions.append({
                    "question": q["question"],
                    "options": options,
                    "answer_index": answer,
                    "explanation": q.get("explanation", ""),
                })
        if not questions:
            raise LearningError("The AI could not produce valid quiz questions. Try again, or pick a stronger model.")
        return {"topic": topic, "questions": questions[:count]}

    # ---------- Challenges ----------

    async def _example_code(self, topic: str, level: str, model: str) -> str:
        prompt = f"""Learner level: {level}

Write a small, self-contained HTML page (inline <style> and <script>, at most {MAX_EXAMPLE_LINES} lines) that demonstrates: {topic}.
It will be used as the basis of a coding exercise, so keep it clean and idiomatic.

Respond with ONLY this block:
===CODE===
<the complete HTML document>
===END==="""
        raw = await self.ask_llm(prompt, model)
        match = CODE_BLOCK_RE.search(raw)
        code = match.group(1).strip() if match else ""
        if "<" not in code:
            raise LearningError("The AI could not write an example to practice on. Try again, or pick a stronger model.")
        return code

    async def challenge(self, kind: str, source_code: str | None, topic: str | None, level: str, model: str) -> dict:
        if kind not in CHALLENGE_POINTS_KINDS:
            raise LearningError(f"Unknown challenge type: {kind}")

        if kind == "scratch":
            return await self._scratch_challenge(source_code, topic, level, model)

        code = source_code or await self._example_code(topic or "a simple styled web page", level, model)
        if kind == "complete":
            return await self._complete_challenge(code, level, model)
        return await self._modify_challenge(code, level, model)

    async def _complete_challenge(self, code: str, level: str, model: str) -> dict:
        lines = code.splitlines()
        prompt = f"""Learner level: {level}

Create a "complete the missing code" exercise from this code. Pick ONE contiguous block of 3 to 12 lines
that teaches something meaningful at this level (a CSS rule set, an HTML structure, a JS function...).
The block will be removed and the learner must rewrite it.

{number_lines(truncate(code))}

Respond with JSON in exactly this shape:
{{"title": "...", "instructions": "what the missing code must do, without giving the answer away", "start_line": 10, "end_line": 15, "hints": ["gentle hint", "stronger hint"]}}"""
        data = await self._ask_json(prompt, model, "challenge")
        try:
            start = int(data.get("start_line"))
            end = int(data.get("end_line"))
        except (TypeError, ValueError):
            raise LearningError("The AI chose an invalid part of the code. Try again.")
        if not (1 <= start <= end <= len(lines)) or end - start > 30:
            raise LearningError("The AI chose an invalid part of the code. Try again.")

        removed = lines[start - 1:end]
        indent = re.match(r"\s*", removed[0]).group(0)
        marker = blank_marker("\n".join(lines[:start - 1]), indent)
        starter = "\n".join(lines[:start - 1] + [marker] + lines[end:])

        return {
            "kind": "complete",
            "title": data.get("title") or "Complete the missing code",
            "instructions": data.get("instructions", ""),
            "hints": [str(h) for h in data.get("hints", []) or []][:3],
            "criteria": [],
            "starter_code": starter,
            "reference_code": code,
            "solution": "\n".join(removed),
        }

    async def _modify_challenge(self, code: str, level: str, model: str) -> dict:
        prompt = f"""Learner level: {level}

Create a "modify the page" exercise: a concrete change the learner must make to this code
(e.g. make the navbar sticky, add a hover effect, make a section responsive), sized for their level.

{number_lines(truncate(code))}

Respond with JSON in exactly this shape:
{{"title": "...", "instructions": "the change to make", "criteria": ["checkable requirement 1", "requirement 2"], "hints": ["gentle hint", "stronger hint"]}}"""
        data = await self._ask_json(prompt, model, "challenge")
        if not data.get("instructions"):
            raise LearningError("The AI challenge had no instructions. Try again.")
        return {
            "kind": "modify",
            "title": data.get("title") or "Modify the page",
            "instructions": data["instructions"],
            "hints": [str(h) for h in data.get("hints", []) or []][:3],
            "criteria": [str(c) for c in data.get("criteria", []) or []],
            "starter_code": code,
            "reference_code": code,
            "solution": None,
        }

    async def _scratch_challenge(self, source_code: str | None, topic: str | None, level: str, model: str) -> dict:
        context = (
            f"Base it on a component from this page of the learner's project, so they rebuild it themselves:\n\n{number_lines(truncate(source_code))}"
            if source_code else f"Topic: {topic or 'a common UI component'}"
        )
        prompt = f"""Learner level: {level}

Create a "build it from scratch" exercise: a small UI component the learner writes in plain HTML/CSS/JS.
{context}

Respond with JSON in exactly this shape:
{{"title": "...", "instructions": "what to build, clearly described", "criteria": ["checkable requirement 1", "requirement 2", "requirement 3"], "hints": ["gentle hint", "stronger hint"]}}"""
        data = await self._ask_json(prompt, model, "challenge")
        if not data.get("instructions"):
            raise LearningError("The AI challenge had no instructions. Try again.")
        return {
            "kind": "scratch",
            "title": data.get("title") or "Build it from scratch",
            "instructions": data["instructions"],
            "hints": [str(h) for h in data.get("hints", []) or []][:3],
            "criteria": [str(c) for c in data.get("criteria", []) or []],
            "starter_code": SCRATCH_STARTER,
            "reference_code": source_code,
            "solution": None,
        }

    async def grade(self, challenge: dict, submission: str, level: str, model: str) -> dict:
        expected = ""
        if challenge.get("solution"):
            expected = f"\nReference solution for the missing block (other correct approaches are fine too):\n{challenge['solution']}\n"
        if challenge.get("criteria"):
            expected += "\nRequirements:\n" + "\n".join(f"- {c}" for c in challenge["criteria"]) + "\n"

        prompt = f"""Learner level: {level}

Grade this coding exercise fairly: accept any solution that meets the goal, even if it differs from the reference.

Exercise: {challenge.get('title', '')}
Instructions: {challenge.get('instructions', '')}
{expected}
Learner's submitted code:
{number_lines(truncate(submission))}

Respond with JSON in exactly this shape:
{{"passed": true, "score": 85, "feedback": "what is good and what is wrong, 2-4 sentences", "hint": "one hint toward fixing the problems, or empty if passed"}}"""
        data = await self._ask_json(prompt, model, "grade")
        try:
            score = max(0, min(100, int(data.get("score", 0))))
        except (TypeError, ValueError):
            score = 0
        return {
            "passed": bool(data.get("passed")) and score >= 60,
            "score": score,
            "feedback": data.get("feedback", ""),
            "hint": data.get("hint", ""),
        }


learning_agent = LearningAgent()
