import { replicateService } from '../replicate/ReplicateService';

export interface LoraTrainingRequest {
  baseModel: string;
  datasetUrl: string;
  triggerWord?: string;
  steps?: number;
  learningRate?: number;
}

export interface LoraTrainingStatus {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  progress?: number;
  error?: string;
  loraUrl?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface LoraModel {
  id: string;
  name: string;
  url: string;
  triggerWord: string;
  baseModel: string;
  createdAt: Date;
  isActive: boolean;
}

class LoraTrainingService {
  private trainingJobs: Map<string, LoraTrainingStatus> = new Map();
  private userLoras: Map<string, LoraModel[]> = new Map();

  async startTraining(userId: string, request: LoraTrainingRequest): Promise<LoraTrainingStatus> {
    const trainingId = `lora_${Date.now()}_${userId}`;
    
    const status: LoraTrainingStatus = {
      id: trainingId,
      status: 'starting',
      createdAt: new Date(),
    };

    this.trainingJobs.set(trainingId, status);

    try {
      status.status = 'processing';
      this.trainingJobs.set(trainingId, status);

      // Simulate training progress (in production, poll Replicate API)
      await this.simulateTraining(trainingId);

      return this.trainingJobs.get(trainingId)!;
    } catch (error) {
      const failedStatus: LoraTrainingStatus = {
        ...status,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Training failed',
      };
      this.trainingJobs.set(trainingId, failedStatus);
      return failedStatus;
    }
  }

  getTrainingStatus(trainingId: string): LoraTrainingStatus | undefined {
    return this.trainingJobs.get(trainingId);
  }

  getUserTrainings(userId: string): LoraTrainingStatus[] {
    return Array.from(this.trainingJobs.values()).filter(job => job.id.includes(userId));
  }

  async cancelTraining(trainingId: string): Promise<boolean> {
    const status = this.trainingJobs.get(trainingId);
    if (!status || status.status === 'succeeded' || status.status === 'failed') {
      return false;
    }

    status.status = 'canceled';
    this.trainingJobs.set(trainingId, status);
    return true;
  }

  saveLora(userId: string, lora: Omit<LoraModel, 'id' | 'isActive' | 'createdAt'>): LoraModel {
    const userLoras = this.userLoras.get(userId) || [];
    
    const newLora: LoraModel = {
      ...lora,
      id: `lora_model_${Date.now()}`,
      isActive: false,
      createdAt: new Date(),
    };

    userLoras.push(newLora);
    this.userLoras.set(userId, userLoras);

    return newLora;
  }

  getUserLoras(userId: string): LoraModel[] {
    return this.userLoras.get(userId) || [];
  }

  toggleLora(userId: string, loraId: string): boolean {
    const userLoras = this.userLoras.get(userId);
    if (!userLoras) return false;

    const lora = userLoras.find(l => l.id === loraId);
    if (!lora) return false;

    userLoras.forEach(l => l.isActive = false);
    lora.isActive = !lora.isActive;
    
    this.userLoras.set(userId, userLoras);
    return true;
  }

  deleteLora(userId: string, loraId: string): boolean {
    const userLoras = this.userLoras.get(userId);
    if (!userLoras) return false;

    const filtered = userLoras.filter(l => l.id !== loraId);
    this.userLoras.set(userId, filtered);
    return true;
  }

  getActiveLora(userId: string): LoraModel | undefined {
    const userLoras = this.userLoras.get(userId);
    if (!userLoras) return undefined;

    return userLoras.find(l => l.isActive);
  }

  private async simulateTraining(trainingId: string): Promise<void> {
    const status = this.trainingJobs.get(trainingId)!;
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      status.progress = i;
      this.trainingJobs.set(trainingId, status);
    }

    status.status = 'succeeded';
    status.progress = 100;
    status.loraUrl = 'https://replicate.com/p/example-lora';
    status.completedAt = new Date();
    this.trainingJobs.set(trainingId, status);
  }
}

export const loraTrainingService = new LoraTrainingService();

