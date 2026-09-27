import type { PageGeneration } from '@/store/projectStore';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  project_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRecord extends ProjectSummary {
  framework: Record<string, unknown> | null;
  layout: Record<string, unknown> | null;
  style: Record<string, unknown> | null;
  generated: Record<string, unknown> | null;
  wizard_state: Record<string, unknown> | null;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** An API error that keeps the HTTP status, so callers can tell "signed out" (401) apart. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Set by the auth store, so an expired session anywhere sends the user back to sign in.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Set by the auth store: the API refused a request because the email isn't confirmed yet.
let onEmailNotVerified: (() => void) | null = null;
export function setEmailNotVerifiedHandler(handler: () => void) {
  onEmailNotVerified = handler;
}

export interface User {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// Endpoints where a 401 is the real answer (wrong password, bad code...), not an expired access token.
const NO_REFRESH_ENDPOINTS = [
  '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout',
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email',
];

// Access tokens live 15 minutes. Concurrent requests that hit an expired one share a single refresh,
// since each refresh token can only be used once.
let refreshing: Promise<boolean> | null = null;
function refreshAccessToken(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(response => response.ok)
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    // Send the session cookies to the API (a different port, same site).
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401 && !isRetry && !NO_REFRESH_ENDPOINTS.includes(endpoint)) {
    if (await refreshAccessToken()) return request<T>(endpoint, options, true);
    onUnauthorized?.();
  }

  if (response.status === 403 && response.headers.get('X-Error-Code') === 'email_not_verified') {
    onEmailNotVerified?.();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new ApiError(error.detail || `HTTP ${response.status}`, response.status);
  }

  return response.json();
}

// ---------- Models ----------

export interface ModelProvider {
  id: 'ollama' | 'vllm' | 'openai' | 'gemini';
  label: string;
  configured: boolean;
  available: boolean;
  error: string | null;
  models: { id: string; label: string }[];
}

export interface ModelCatalog {
  providers: ModelProvider[];
  default_model: string;
}

// ---------- Learning ----------

export type ChallengeKind = 'complete' | 'modify' | 'scratch';

export interface LessonContent {
  title: string;
  summary: string;
  sections: { title: string; explanation: string; file?: string; start_line?: number; end_line?: number; code?: string }[];
  key_concepts: { name: string; explanation: string }[];
}

export interface QuizContent {
  topic: string | null;
  // answer_index and explanation are only present once the quiz is submitted.
  questions: { question: string; options: string[]; answer_index?: number; explanation?: string }[];
}

export interface QuizResult {
  answers: (number | null)[];
  correct: boolean[];
  score: number;
  total: number;
}

export interface ChallengeContent {
  kind: ChallengeKind;
  title: string;
  instructions: string;
  hints: string[];
  criteria: string[];
  starter_code: string;
  // Only present once completed or revealed.
  solution?: string | null;
}

export interface ChallengeGrade {
  passed: boolean;
  score: number;
  feedback: string;
  hint: string;
}

export interface ChallengeResult {
  attempts: ChallengeGrade[];
  last_submission?: string;
  solution_revealed?: boolean;
}

export interface LearningActivity<C, R = Record<string, unknown>> {
  id: string;
  project_id: string | null;
  page_id: string | null;
  kind: 'lesson' | 'quiz' | 'challenge';
  content: C;
  result: R | null;
  points: number;
  completed: boolean;
  created_at: string;
}

export interface LearningProgress {
  total_points: number;
  project_points: number | null;
  completed: Partial<Record<'lesson' | 'quiz' | 'challenge', number>>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Where learning content comes from: a page of a project, or a free topic.
export interface LearnSource {
  project_id?: string;
  page_id?: string;
  topic?: string;
}

interface LearnOptions {
  level: string;
  model: string;
}

export const api = {
  // Accounts
  me: () => request<User>('/api/auth/me'),

  register: (data: { email: string; password: string; name: string }) =>
    request<User>('/api/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    request<User>('/api/auth/login', { method: 'POST', body: data }),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  verifyEmail: (token: string) =>
    request<User>('/api/auth/verify-email', { method: 'POST', body: { token } }),

  resendVerification: () =>
    request<{ status: 'sent' | 'already_verified' }>('/api/auth/resend-verification', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ status: string; message: string }>('/api/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (data: { email: string; code: string; password: string }) =>
    request<User>('/api/auth/reset-password', { method: 'POST', body: data }),

  authProviders: () => request<{ providers: string[] }>('/api/auth/providers'),

  // A full-page navigation, not fetch: the provider's sign-in page takes over the tab.
  oauthStartUrl: (provider: string, next: string) =>
    `${API_BASE}/api/auth/oauth/${provider}/start?next=${encodeURIComponent(next)}`,

  // Projects
  createProject: (data: { name: string; description: string; project_type: string }) =>
    request('/api/projects', { method: 'POST', body: data }),

  listProjects: () =>
    request<ProjectSummary[]>('/api/projects'),

  getProject: (id: string) =>
    request<ProjectRecord>(`/api/projects/${id}`),

  saveWizardState: (id: string, state: Record<string, unknown>) =>
    request(`/api/projects/${id}/state`, { method: 'PUT', body: state }),

  // Best-effort save while the tab is closing; keepalive lets the request outlive the page.
  saveWizardStateOnExit: (id: string, state: Record<string, unknown>) => {
    fetch(`${API_BASE}/api/projects/${id}/state`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      keepalive: true,
    }).catch(() => {});
  },

  deleteProject: (id: string) =>
    request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Agent
  runAgent: (data: { project_id: string; step: string; model?: string; user_feedback?: string }) =>
    request<Record<string, unknown>>('/api/agent/run', { method: 'POST', body: data }),

  confirmStep: (projectId: string, data: { step: string; approved: boolean; feedback?: string; modifications?: Record<string, unknown> }) =>
    request(`/api/agent/confirm?project_id=${projectId}`, { method: 'POST', body: data }),

  // Page-by-page generation
  generatePage: (data: { project_id: string; page_id: string; model?: string; user_feedback?: string }) =>
    request<PageGeneration>('/api/agent/pages/generate', { method: 'POST', body: data }),

  approvePage: (data: { project_id: string; page_id: string }) =>
    request<{ generation: PageGeneration; all_approved: boolean; next_page_id: string | null }>('/api/agent/pages/approve', { method: 'POST', body: data }),

  // Learning
  createLesson: (data: { project_id: string; page_id: string; regenerate?: boolean } & LearnOptions) =>
    request<LearningActivity<LessonContent>>('/api/learn/lessons', { method: 'POST', body: data }),

  completeLesson: (id: string) =>
    request<LearningActivity<LessonContent>>(`/api/learn/lessons/${id}/complete`, { method: 'POST' }),

  askTutor: (data: { question: string; history: ChatMessage[] } & LearnSource & LearnOptions) =>
    request<{ answer: string }>('/api/learn/ask', { method: 'POST', body: data }),

  createQuiz: (data: LearnSource & LearnOptions) =>
    request<LearningActivity<QuizContent, QuizResult>>('/api/learn/quizzes', { method: 'POST', body: data }),

  submitQuiz: (id: string, answers: (number | null)[]) =>
    request<LearningActivity<QuizContent, QuizResult>>(`/api/learn/quizzes/${id}/submit`, { method: 'POST', body: { answers } }),

  createChallenge: (data: { kind: ChallengeKind } & LearnSource & LearnOptions) =>
    request<LearningActivity<ChallengeContent, ChallengeResult>>('/api/learn/challenges', { method: 'POST', body: data }),

  submitChallenge: (id: string, data: { code: string } & LearnOptions) =>
    request<{ activity: LearningActivity<ChallengeContent, ChallengeResult>; grade: ChallengeGrade }>(`/api/learn/challenges/${id}/submit`, { method: 'POST', body: data }),

  revealSolution: (id: string) =>
    request<LearningActivity<ChallengeContent, ChallengeResult>>(`/api/learn/challenges/${id}/solution`, { method: 'POST' }),

  learningActivities: (params: { project_id?: string; page_id?: string; standalone?: boolean }) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    );
    return request<LearningActivity<Record<string, unknown>>[]>(`/api/learn/activities?${query}`);
  },

  learningProgress: (projectId?: string) =>
    request<LearningProgress>(`/api/learn/progress${projectId ? `?project_id=${projectId}` : ''}`),

  // Models
  // Every provider (Ollama, vLLM, OpenAI, Gemini), whether it is usable, and its models.
  modelCatalog: () => request<ModelCatalog>('/api/models/catalog'),

  listModels: () =>
    request<{ models: Array<Record<string, unknown>> }>('/api/models'),

  pullModel: (modelName: string) =>
    request('/api/models/pull', { method: 'POST', body: { model_name: modelName } }),

  deleteModel: (modelName: string) =>
    request(`/api/models/${modelName}`, { method: 'DELETE' }),

  // Health
  healthCheck: () =>
    request<{ status: string }>('/api/health'),
};
