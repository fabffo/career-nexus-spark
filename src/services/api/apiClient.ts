import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = 'https://cpwjmfxyjtrdsnkcwruq.supabase.co/functions/v1';

/**
 * Generic API client for making requests to Edge Functions
 */
class ApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(endpoint: string, path: string = ''): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${API_BASE_URL}/${endpoint}${path}`;
    
    console.log(`API GET: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    const result = await response.json();
    return result.data;
  }

  async post<T>(endpoint: string, data: any, path: string = ''): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${API_BASE_URL}/${endpoint}${path}`;
    
    console.log(`API POST: ${url}`, data);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('API POST error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Erreur de connexion au serveur. Veuillez réessayer.');
      }
      throw error;
    }
  }

  async put<T>(endpoint: string, id: string, data: any): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = `${API_BASE_URL}/${endpoint}/${id}`;
    
    console.log(`API PUT: ${url}`, data);
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('API PUT error:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Erreur de connexion au serveur. Veuillez réessayer.');
      }
      throw error;
    }
  }

  async delete(endpoint: string, id: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const url = `${API_BASE_URL}/${endpoint}/${id}`;
    
    console.log(`API DELETE: ${url}`);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
  }
}

export const apiClient = new ApiClient();
