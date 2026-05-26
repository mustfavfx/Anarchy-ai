import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { loraTrainingService, type LoraTrainingRequest, type LoraTrainingStatus } from '../../services/lora/LoraTrainingService';
import { useAuth } from '../auth/AuthContext';
import './LoraTrainingPage.css';

export const LoraTrainingPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const [baseModel, setBaseModel] = useState('black-forest-labs/flux-schnell');
  const [datasetUrl, setDatasetUrl] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [currentTraining, setCurrentTraining] = useState<LoraTrainingStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pollingRef.current !== null) clearInterval(pollingRef.current);
    };
  }, []);

  const handleStartTraining = async () => {
    if (!authUser?.id || !datasetUrl) return;
    setIsTraining(true);
    
    const request: LoraTrainingRequest = { baseModel, datasetUrl };
    const status = await loraTrainingService.startTraining(authUser.id, request);
    setCurrentTraining(status);

    pollingRef.current = setInterval(() => {
      const updated = loraTrainingService.getTrainingStatus(status.id);
      if (updated) {
        setCurrentTraining(updated);
        if (updated.status === 'succeeded' || updated.status === 'failed') {
          if (pollingRef.current !== null) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setIsTraining(false);
        }
      }
    }, 1000);
  };

  return (
    <div className="lora-training-page">
      <div className="page-header">
        <Sparkles size={32} />
        <div>
          <h1>LoRA Training</h1>
          <p>Train custom models for your style</p>
        </div>
      </div>

      <div className="form-card">
        <h2>Training Configuration</h2>
        <div className="form-group">
          <label>Dataset URL</label>
          <input
            type="text"
            value={datasetUrl}
            onChange={(e) => setDatasetUrl(e.target.value)}
            placeholder="https://your-dataset-url.zip"
            className="form-input"
          />
        </div>

        {!isTraining ? (
          <button className="btn-primary" onClick={handleStartTraining} disabled={!datasetUrl}>
            <Play size={18} /> Start Training
          </button>
        ) : (
          <div className="training-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${currentTraining?.progress || 0}%` }} />
            </div>
            <span>{currentTraining?.progress || 0}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
