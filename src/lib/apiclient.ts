 // lib/apiClient.ts

interface FetchOptions extends RequestInit {
  body?: any;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, headers, ...customConfig } = options;

  const config: RequestInit = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    // Send HTTP-Only cookies automatically with every request
    credentials: "include", 
    ...customConfig,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  // Ensure absolute path formatting
  const url = endpoint.startsWith("/") ? `/api${endpoint}` : `/api/${endpoint}`;

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}