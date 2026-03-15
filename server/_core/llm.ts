import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  model?: string;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent,
  options: { supportsFileUrl: boolean }
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    if (!options.supportsFileUrl) {
      return {
        type: "text",
        text: `Datei-URL: ${part.file_url.url}`,
      };
    }
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (
  message: Message,
  options: { supportsFileUrl: boolean }
) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(part =>
    normalizeContentPart(part, options)
  );

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

type LlmProvider = "openai" | "forge";

type ResolvedLlmConfig = {
  provider: LlmProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
  supportsThinking: boolean;
  supportsFileUrl: boolean;
};

const createOpenAiConfig = (modelOverride?: string): ResolvedLlmConfig | null => {
  const apiKey = (ENV.openaiApiKey ?? "").trim();
  if (!apiKey) return null;
  const apiUrl =
    ENV.openaiApiUrl && ENV.openaiApiUrl.trim().length > 0
      ? ENV.openaiApiUrl.replace(/\/$/, "")
      : "https://api.openai.com/v1/chat/completions";
  const model = (modelOverride || ENV.openaiModel || ENV.llmModel || "gpt-5.4").trim();
  return {
    provider: "openai",
    apiUrl,
    apiKey,
    model,
    supportsThinking: false,
    supportsFileUrl: false,
  };
};

const createForgeConfig = (modelOverride?: string): ResolvedLlmConfig | null => {
  const apiKey = (ENV.forgeApiKey ?? "").trim();
  if (!apiKey) return null;
  const apiUrl =
    ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
      : "https://forge.manus.im/v1/chat/completions";
  const model = (modelOverride || ENV.forgeModel || ENV.llmModel || "gemini-2.5-flash").trim();
  return {
    provider: "forge",
    apiUrl,
    apiKey,
    model,
    supportsThinking: model.toLowerCase().includes("gemini"),
    supportsFileUrl: true,
  };
};

const resolveLlmAttemptChain = (requestedModel?: string): ResolvedLlmConfig[] => {
  const providerRaw = (ENV.llmProvider ?? "").trim().toLowerCase();
  const openaiPrimary = createOpenAiConfig(requestedModel);
  const openaiDefaultPrimary = createOpenAiConfig("gpt-5.4");
  const openaiFallback = createOpenAiConfig("gpt-4o-mini");
  const forgePrimary = createForgeConfig(requestedModel);
  const forgeDefaultPrimary = createForgeConfig("gemini-2.5-flash");
  const forgeFallback = createForgeConfig("gemini-2.5-flash");

  const uniqueByProviderAndModel = (items: Array<ResolvedLlmConfig | null>) => {
    const byKey = new Map<string, ResolvedLlmConfig>();
    for (const item of items) {
      if (!item) continue;
      const key = `${item.provider}:${item.model}`;
      if (!byKey.has(key)) {
        byKey.set(key, item);
      }
    }
    return Array.from(byKey.values());
  };

  if (providerRaw === "openai") {
    return uniqueByProviderAndModel([
      openaiPrimary,
      openaiDefaultPrimary,
      openaiFallback,
      forgeDefaultPrimary,
      forgeFallback,
    ]);
  }
  if (providerRaw === "forge") {
    return uniqueByProviderAndModel([
      forgePrimary,
      forgeDefaultPrimary,
      forgeFallback,
      openaiDefaultPrimary,
      openaiFallback,
    ]);
  }

  return uniqueByProviderAndModel([
    openaiPrimary,
    openaiDefaultPrimary,
    openaiFallback,
    forgePrimary,
    forgeDefaultPrimary,
    forgeFallback,
  ]);
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    model,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const attempts = resolveLlmAttemptChain(model);
  if (attempts.length === 0) {
    throw new Error(
      "Kein LLM konfiguriert. Bitte OPENAI_API_KEY oder BUILT_IN_FORGE_API_KEY setzen."
    );
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  const attemptErrors: string[] = [];

  for (const attempt of attempts) {
    const payload: Record<string, unknown> = {
      model: attempt.model,
      messages: messages.map(message =>
        normalizeMessage(message, { supportsFileUrl: attempt.supportsFileUrl })
      ),
      max_tokens: 32768,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }
    if (normalizedToolChoice) {
      payload.tool_choice = normalizedToolChoice;
    }
    if (normalizedResponseFormat) {
      payload.response_format = normalizedResponseFormat;
    }
    if (attempt.supportsThinking) {
      payload.thinking = { budget_tokens: 128 };
    }

    try {
      const response = await fetch(attempt.apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${attempt.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${response.statusText} – ${errorText}`);
      }

      return (await response.json()) as InvokeResult;
    } catch (error: any) {
      const msg = String(error?.message ?? error ?? "Unbekannter Fehler");
      attemptErrors.push(`${attempt.provider}(${attempt.model}): ${msg}`);
    }
  }

  throw new Error(`LLM invoke failed after fallback chain: ${attemptErrors.join(" || ")}`);
}
