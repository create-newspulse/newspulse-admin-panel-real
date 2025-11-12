export async function streamChat({
  apiBase,
  founderKey,
  message,
  history,
}: {
  apiBase: string;
  founderKey: string;
  message: string;
  history: any[];
}) {
  const res = await fetch(`${apiBase}/api/kiranos/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${founderKey}`,
    },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Chat failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  return {
    async *tokens(): AsyncGenerator<any, void, unknown> {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n\n").filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.replace("data:", "").trim());
          yield payload;
        }
      }
    },
  };
}

export async function runCommand({
  apiBase,
  founderKey,
  tool,
  args,
}: {
  apiBase: string;
  founderKey: string;
  tool: string;
  args?: Record<string, any>;
}) {
  const res = await fetch(`${apiBase}/api/kiranos/command`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${founderKey}`,
    },
    body: JSON.stringify({ tool, args }),
  });
  return res.json();
}
