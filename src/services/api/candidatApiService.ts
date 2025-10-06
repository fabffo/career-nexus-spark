import { apiClient } from './apiClient';
import { Candidat } from '@/types/models';

const ENDPOINT = 'api-candidats';

/**
 * Service pour l'API Candidats
 * Utilise les Edge Functions au lieu d'accéder directement à la base de données
 */
export const candidatApiService = {
  async getAll(): Promise<Candidat[]> {
    return apiClient.get<Candidat[]>(ENDPOINT);
  },

  async getById(id: string): Promise<Candidat> {
    return apiClient.get<Candidat>(ENDPOINT, `/${id}`);
  },

  async create(candidat: Omit<Candidat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Candidat> {
    return apiClient.post<Candidat>(ENDPOINT, candidat);
  },

  async update(id: string, candidat: Partial<Candidat>): Promise<Candidat> {
    return apiClient.put<Candidat>(ENDPOINT, id, candidat);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(ENDPOINT, id);
  },

  async count(): Promise<number> {
    const result = await apiClient.get<{ count: number }>(ENDPOINT, '/count');
    return result.count;
  }
};
