import React, { useState } from 'react';
import { Wand2, Loader2, RotateCcw } from 'lucide-react';
import { autoPromptService, detectLanguage } from '../../../services/ai/autoPromptService';
import { useNotificationStore } from '../../../stores/notificationStore';
import './AutoPromptButton.css';

interface AutoPromptButtonProps {
  prompt: string;
  onApplyPrompt: (newPrompt: string) => void;
  mode?: 'generate' | 'inpaint' | 'upscale';
  compact?: boolean;
  isArabicUI?: boolean;
  className?: string;
}

export const AutoPromptButton: React.FC<AutoPromptButtonProps> = ({
  prompt,
  onApplyPrompt,
  mode = 'generate',
  compact = false,
  isArabicUI = false,
  className = '',
}) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleEnhance = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      addNotification({
        type: 'info',
        title: isArabicUI ? 'AutoPrompt' : 'AutoPrompt',
        message: isArabicUI 
          ? 'يرجى كتابة فكرة أولاً لتحسينها (بالعربية أو الإنجليزية).' 
          : 'Please enter a prompt or keywords first to enhance.',
        duration: 3000,
      });
      return;
    }

    setIsEnhancing(true);
    const originalText = prompt;

    try {
      const detected = detectLanguage(trimmed);
      const result = await autoPromptService.enhancePrompt(trimmed, {
        mode,
        language: detected,
      });

      if (result.enhancedPrompt && result.enhancedPrompt !== trimmed) {
        setPreviousPrompt(originalText);
        onApplyPrompt(result.enhancedPrompt);

        addNotification({
          type: 'success',
          title: isArabicUI ? 'تم تحسين البروموت' : 'Prompt Enhanced',
          message: isArabicUI
            ? (result.detectedLanguage === 'ar'
                ? 'تمت ترقية البروموت العربي بصياغة معمارية احترافية.'
                : 'تمت ترقية البروموت الإنجليزي بمصطلحات معمارية دقيقة.')
            : (result.detectedLanguage === 'ar'
                ? 'Enhanced Arabic architectural prompt successfully.'
                : 'Enhanced with architectural visual cues.'),
          duration: 3500,
        });
      } else {
        addNotification({
          type: 'info',
          title: 'AutoPrompt',
          message: isArabicUI ? 'البروموت مفصل وغني بالفعل.' : 'Prompt is already well-detailed.',
          duration: 2500,
        });
      }
    } catch (err) {
      console.error('[AutoPromptButton] Enhancement failed:', err);
      addNotification({
        type: 'error',
        title: isArabicUI ? 'خطأ' : 'Error',
        message: isArabicUI ? 'تعذر تحسين البروموت حالياً.' : 'Failed to enhance prompt.',
        duration: 3000,
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUndo = () => {
    if (previousPrompt !== null) {
      onApplyPrompt(previousPrompt);
      setPreviousPrompt(null);
      addNotification({
        type: 'info',
        title: isArabicUI ? 'تراجع' : 'Reverted',
        message: isArabicUI ? 'تمت استعادة النص الأصلي.' : 'Restored original prompt.',
        duration: 2500,
      });
    }
  };

  const buttonTitle = isArabicUI 
    ? 'تحسين البروموت بذكاء (يدعم العربي والإنجليزي)' 
    : 'AutoPrompt: Enhance prompt with architectural keywords (Supports AR & EN)';

  return (
    <div className={`auto-prompt-wrapper ${className}`}>
      <button
        type="button"
        className={`auto-prompt-btn ${compact ? 'compact' : ''} ${isEnhancing ? 'enhancing' : ''}`}
        onClick={handleEnhance}
        disabled={isEnhancing}
        title={buttonTitle}
        aria-label="AutoPrompt"
      >
        {isEnhancing ? (
          <Loader2 size={compact ? 14 : 16} className="auto-prompt-spinner" />
        ) : (
          <Wand2 size={compact ? 14 : 16} className="auto-prompt-icon" />
        )}
      </button>

      {previousPrompt !== null && !isEnhancing && (
        <button
          type="button"
          className={`auto-prompt-undo-btn ${compact ? 'compact' : ''}`}
          onClick={handleUndo}
          title={isArabicUI ? 'تراجع عن التحسين واستعادة النص الأصلي' : 'Undo AutoPrompt and restore original prompt'}
          aria-label="Undo AutoPrompt"
        >
          <RotateCcw size={compact ? 12 : 13} />
        </button>
      )}
    </div>
  );
};
