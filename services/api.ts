const API_URL = '/api'; // Vercel rewrites will handle this

const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken');
};

interface ApiOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
}

export const api = async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
    const { method = 'GET', body } = options;
    const token = getAuthToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
        localStorage.removeItem('authToken');
        // A full page reload is a simple way to reset app state
        window.location.reload();
        throw new Error('Sesión expirada o inválida.');
    }

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error: ${response.statusText}`);
        } catch {
             throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
    }

    if (response.status === 204) { // No Content
        return null as T;
    }

    return response.json();
};
