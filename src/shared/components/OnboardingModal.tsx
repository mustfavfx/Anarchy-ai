import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, ImagePlus, MousePointerClick } from 'lucide-react';
import './OnboardingModal.css';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <ImagePlus size={48} />,
    title: 'Add Your First Image',
    description: 'Start by adding a source image to the canvas. You can drag & drop an image, paste from clipboard (Ctrl+V), or click "Add Source Node".',
    tip: 'Tip: The canvas is infinite — zoom and pan to organize your workflow.',
  },
  {
    icon: <Sparkles size={48} />,
    title: 'Generate & Transform',
    description: 'Select any node and type a prompt. Click "Generate" or press Ctrl+Enter to create AI-powered variations, edits, and renders.',
    tip: 'Tip: Each result becomes a new node you can further transform.',
  },
  {
    icon: <MousePointerClick size={48} />,
    title: 'Save & Organize',
    description: 'Save your projects with Ctrl+S. Browse your Library and History anytime. Right-click on the canvas for quick actions.',
    tip: 'Tip: Projects auto-save locally — your work is always protected.',
  },
];

const STORAGE_KEY = 'anarchy_onboarding_completed';

export const OnboardingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Show after a short delay so the app is ready
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];

  return (
    <div className="onboarding-overlay" onClick={handleClose}>
      <div className="onboarding-modal" onClick={e => e.stopPropagation()}>
        <button className="onboarding-close" onClick={handleClose}>
          <X size={20} />
        </button>

        <div className="onboarding-header">
          <div className="onboarding-icon">{step.icon}</div>
          <h2 className="onboarding-title">{step.title}</h2>
        </div>

        <div className="onboarding-content">
          <p className="onboarding-description">{step.description}</p>
          <div className="onboarding-tip">
            <Sparkles size={14} />
            <span>{step.tip}</span>
          </div>
        </div>

        <div className="onboarding-footer">
          <div className="onboarding-progress">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`progress-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
              />
            ))}
          </div>

          <div className="onboarding-actions">
            <button
              className="onboarding-btn secondary"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button className="onboarding-btn skip" onClick={handleSkip}>
              Skip Tour
            </button>

            <button className="onboarding-btn primary" onClick={handleNext}>
              {currentStep === STEPS.length - 1 ? 'Get Started' : (
                <>
                  Next
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="onboarding-step-indicator">
          Step {currentStep + 1} of {STEPS.length}
        </div>
      </div>
    </div>
  );
};
