const AI_TEXT_PATTERN =
  /\b(ai|artificial intelligence|machine learning|\bml\b|llm|large language model|generative|gen\s*ai|gpt|copilot|prompt engineering|\brag\b|transformer|deep learning|nlp|natural language|computer vision|automation|agentic)\b/i;

const AI_TECH_NAMES = new Set([
  "openai",
  "chatgpt",
  "gpt-4",
  "gpt-3",
  "claude",
  "anthropic",
  "langchain",
  "llamaindex",
  "hugging face",
  "pytorch",
  "tensorflow",
  "scikit-learn",
  "keras",
  "spark",
  "databricks",
  "snowflake",
  "dbt",
  "airflow",
]);

export function textMentionsAiTrend(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return AI_TEXT_PATTERN.test(text);
}

export function technologyMentionsAi(name: string): boolean {
  const key = name.trim().toLowerCase();
  if (!key) return false;
  if (AI_TECH_NAMES.has(key)) return true;
  return AI_TEXT_PATTERN.test(key);
}

export function jobPostMentionsAi(input: {
  title?: string | null;
  technologies?: string[];
  projectNames?: string[];
  projectGoals?: string[];
}): boolean {
  if (textMentionsAiTrend(input.title)) return true;
  for (const tech of input.technologies ?? []) {
    if (technologyMentionsAi(tech)) return true;
  }
  for (const name of input.projectNames ?? []) {
    if (textMentionsAiTrend(name)) return true;
  }
  for (const goal of input.projectGoals ?? []) {
    if (textMentionsAiTrend(goal)) return true;
  }
  return false;
}
