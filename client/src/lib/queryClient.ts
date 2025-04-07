import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

interface ApiRequestOptions {
  method?: string;
  data?: unknown;
  queryParams?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>(
  method: string,
  url: string, 
  data?: any,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { 
    queryParams = {}, 
    headers = {} 
  } = options;
  
  // Handle FormData specially to prevent automatic Content-Type setting
  const isFormData = data instanceof FormData;
  
  // Build URL with query parameters
  const queryString = Object.entries(queryParams)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  
  const fullUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
  
  // Set default headers
  const requestHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...headers
  };
  
  // Only set Content-Type if data is not FormData (browser will set it automatically with boundary)
  if (data && !isFormData) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(fullUrl, {
    method,
    headers: requestHeaders,
    // Only stringify if data is not FormData
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // If no content, return empty object
  if (res.status === 204) {
    return {} as T;
  }
  
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const queryParams = queryKey.length > 1 ? queryKey[1] as Record<string, string> : {};
    
    // Build URL with query parameters if provided
    const queryString = Object.entries(queryParams)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    const fullUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: {
        'Accept': 'application/json'
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // If no content, return empty object
    if (res.status === 204) {
      return {} as T;
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
