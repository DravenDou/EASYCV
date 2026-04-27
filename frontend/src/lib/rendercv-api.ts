export type ValidationIssue = {
  schema_location: string[] | null;
  yaml_source: string;
  start_line: number | null;
  start_column: number | null;
  end_line: number | null;
  end_column: number | null;
  message: string;
  input_value: string;
};

export type ValidateRequestPayload = {
  main_yaml: string;
  design_yaml: string | null;
  locale_yaml: string | null;
  settings_yaml: string | null;
  overrides: Record<string, string> | null;
};

export type RenderFormats = {
  include_pdf: boolean;
  include_png: boolean;
  include_html: boolean;
  include_markdown: boolean;
  include_typst: boolean;
};

export type RenderRequestOptions = {
  designYaml?: string | null;
  localeYaml?: string | null;
  settingsYaml?: string | null;
  overrides?: Record<string, string> | null;
};

export const defaultRenderFormats: RenderFormats = {
  include_pdf: true,
  include_png: true,
  include_html: true,
  include_markdown: false,
  include_typst: false,
};

export type RenderRequestPayload = ValidateRequestPayload & {
  formats: RenderFormats;
};

export type ValidateResponsePayload = {
  request_id: string;
  valid: boolean;
  errors: ValidationIssue[];
};

export type RenderedArtifact = {
  format: "pdf" | "png" | "html" | "markdown" | "typst";
  filename: string;
  media_type: string;
  encoding: "base64" | "utf-8";
  content: string;
};

export type RenderResponsePayload = {
  request_id: string;
  artifacts: RenderedArtifact[];
};

type ApiErrorPayload = {
  request_id?: string;
  error_code?: string;
  message?: string;
  validation_errors?: ValidationIssue[] | null;
};

const fallbackApiBaseUrl = "/rendercv-api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  return trimmed.replace(/\/+$/, "") || fallbackApiBaseUrl;
}

function buildUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function buildValidateRequest(
  mainYaml: string,
  options: RenderRequestOptions = {},
): ValidateRequestPayload {
  return {
    main_yaml: mainYaml,
    design_yaml: options.designYaml ?? null,
    locale_yaml: options.localeYaml ?? null,
    settings_yaml: options.settingsYaml ?? null,
    overrides: options.overrides ?? null,
  };
}

function buildRenderRequest(
  mainYaml: string,
  formats: RenderFormats,
  options: RenderRequestOptions = {},
): RenderRequestPayload {
  return {
    ...buildValidateRequest(mainYaml, options),
    formats,
  };
}

async function parseApiError(response: Response): Promise<ApiErrorPayload | null> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.detail)) {
      return body.detail as ApiErrorPayload;
    }
    if (isRecord(body)) {
      return body as ApiErrorPayload;
    }
  } catch {
    return null;
  }
  return null;
}

async function requestJson<T>(
  url: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await parseApiError(response);
    throw new RenderCvApiError(
      errorPayload?.message || `Request failed with status ${response.status}.`,
      response.status,
      errorPayload?.error_code || "http_error",
      errorPayload?.request_id || null,
      errorPayload?.validation_errors || null,
    );
  }

  return (await response.json()) as T;
}

export class RenderCvApiError extends Error {
  status: number;
  errorCode: string;
  requestId: string | null;
  validationErrors: ValidationIssue[] | null;

  constructor(
    message: string,
    status: number,
    errorCode: string,
    requestId: string | null,
    validationErrors: ValidationIssue[] | null,
  ) {
    super(message);
    this.name = "RenderCvApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.requestId = requestId;
    this.validationErrors = validationErrors;
  }
}

export function createRendercvClient(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    validate: (
      mainYaml: string,
      options: RenderRequestOptions = {},
      signal?: AbortSignal,
    ) =>
      requestJson<ValidateResponsePayload>(
        buildUrl(normalizedBaseUrl, "/api/v1/validate"),
        buildValidateRequest(mainYaml, options),
        signal,
      ),
    render: (
      mainYaml: string,
      formats: RenderFormats = defaultRenderFormats,
      options: RenderRequestOptions = {},
      signal?: AbortSignal,
    ) =>
      requestJson<RenderResponsePayload>(
        buildUrl(normalizedBaseUrl, "/api/v1/render"),
        buildRenderRequest(mainYaml, formats, options),
        signal,
      ),
  };
}
