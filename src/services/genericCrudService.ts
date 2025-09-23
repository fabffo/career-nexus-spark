import { AuditFields, CrudOperations } from '@/types/models';

// Generic CRUD service for all models
export class GenericCrudService<T extends AuditFields> implements CrudOperations<T> {
  private storageKey: string;
  private data: T[] = [];

  constructor(storageKey: string, initialData: T[] = []) {
    this.storageKey = storageKey;
    this.loadData(initialData);
  }

  private loadData(initialData: T[]): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      this.data = JSON.parse(stored, (key, value) => {
        // Convert date strings back to Date objects
        if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } else {
      this.data = initialData;
      this.saveData();
    }
  }

  private saveData(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  async getAll(): Promise<T[]> {
    return Promise.resolve([...this.data]);
  }

  async getById(id: string): Promise<T> {
    const item = this.data.find(item => item.id === id);
    if (!item) {
      throw new Error(`Item with id ${id} not found`);
    }
    return Promise.resolve({ ...item });
  }

  async create(data: Omit<T, keyof AuditFields>): Promise<T> {
    const newItem = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as T;
    
    this.data.push(newItem);
    this.saveData();
    return Promise.resolve({ ...newItem });
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }
    
    const updatedItem = {
      ...this.data[index],
      ...data,
      id: this.data[index].id, // Prevent ID change
      createdAt: this.data[index].createdAt, // Preserve creation date
      updatedAt: new Date(),
    };
    
    this.data[index] = updatedItem;
    this.saveData();
    return Promise.resolve({ ...updatedItem });
  }

  async delete(id: string): Promise<void> {
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }
    
    this.data.splice(index, 1);
    this.saveData();
    return Promise.resolve();
  }

  // Additional utility methods
  async search(predicate: (item: T) => boolean): Promise<T[]> {
    return Promise.resolve(this.data.filter(predicate));
  }

  async count(): Promise<number> {
    return Promise.resolve(this.data.length);
  }
}