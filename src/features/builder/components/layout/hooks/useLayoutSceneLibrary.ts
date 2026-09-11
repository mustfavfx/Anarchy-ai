import { useState, useMemo } from 'react';
import { anarchyService } from '../../../../../services/anarchy/AnarchyService';
import { useAIConfigStore } from '../../../../../stores/aiConfigStore';
import { getHistory } from '../../../../../services/history/HistoryService';
import type { LayoutData } from '../types';

export interface UseLayoutSceneLibraryProps {
  activeStageImage: string | null;
  rawImage: string | null;
  displayImage: string | null;
  imageHistory: string[];
  layout: LayoutData | null;
}

export const useLayoutSceneLibrary = ({
  activeStageImage,
  rawImage,
  displayImage,
  imageHistory,
  layout
}: UseLayoutSceneLibraryProps) => {
  const [savedScenesList, setSavedScenesList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('anarchy_saved_scenes_list');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  const saveSceneToLibrary = (imageUrl: string, layoutData: any, promptText?: string) => {
    if (!imageUrl || !layoutData || !Array.isArray(layoutData.regions)) return;
    const regionCount = layoutData.regions.length;
    const newEntry = {
      id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      url: imageUrl,
      prompt: promptText || 'Analyzed Scene',
      regionCount,
      timestamp: Date.now(),
      layout: layoutData
    };

    setSavedScenesList(prev => {
      const filtered = prev.filter(s => s.url !== imageUrl);
      const updated = [newEntry, ...filtered];
      try {
        localStorage.setItem('anarchy_saved_scenes_list', JSON.stringify(updated.slice(0, 50)));
      } catch {}
      return updated;
    });
  };

  const deleteSavedScene = (imageUrl: string) => {
    const cacheKey = anarchyService.getCacheKey(imageUrl);
    anarchyService.layoutCache.delete(cacheKey);
    try { localStorage.removeItem(`anarchy_layout_${cacheKey}`); } catch {}

    setSavedScenesList(prev => {
      const updated = prev.filter(s => s.url !== imageUrl);
      try {
        localStorage.setItem('anarchy_saved_scenes_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const availableImages = useMemo(() => {
    const imagesMap = new Map<string, { url: string; prompt?: string; isAnalyzed?: boolean }>();

    // 1. Active stage / raw / display image
    if (activeStageImage) {
      imagesMap.set(activeStageImage, { url: activeStageImage, prompt: 'Current Stage Scene', isAnalyzed: true });
    }
    if (rawImage && !imagesMap.has(rawImage)) {
      imagesMap.set(rawImage, { url: rawImage, prompt: 'Selected Canvas Scene', isAnalyzed: true });
    }
    if (displayImage && !imagesMap.has(displayImage)) {
      imagesMap.set(displayImage, { url: displayImage, prompt: 'Display Scene', isAnalyzed: true });
    }

    // 2. From imageHistory
    imageHistory.forEach(url => {
      if (url && typeof url === 'string' && url.length > 10 && !imagesMap.has(url)) {
        const cacheKey = anarchyService.getCacheKey(url);
        imagesMap.set(url, {
          url,
          prompt: 'Generation Variation',
          isAnalyzed: anarchyService.layoutCache.has(cacheKey)
        });
      }
    });

    // 3. From canvas nodes (workflowSnapshot)
    try {
      const snap = useAIConfigStore.getState().workflowSnapshot;
      if (snap?.nodes) {
        snap.nodes.forEach((n: any) => {
          const data: any = n.data || {};
          const img = data.image || data.outputData?.image;
          if (img && typeof img === 'string' && img.length > 10 && !imagesMap.has(img)) {
            const cacheKey = anarchyService.getCacheKey(img);
            imagesMap.set(img, {
              url: img,
              prompt: (typeof data.prompt === 'string' ? data.prompt : data.label) || 'Canvas Node',
              isAnalyzed: anarchyService.layoutCache.has(cacheKey) || Boolean(data.extractedLayout || data.layout)
            });
          }
        });
      }
    } catch {}

    // 4. From HistoryService entries (getHistory)
    try {
      const historyEntries = getHistory();
      if (Array.isArray(historyEntries)) {
        historyEntries.forEach(entry => {
          const outImg = entry.outputImage;
          if (outImg && typeof outImg === 'string' && outImg.length > 10 && !imagesMap.has(outImg)) {
            const cacheKey = anarchyService.getCacheKey(outImg);
            imagesMap.set(outImg, {
              url: outImg,
              prompt: entry.prompt || entry.label || 'History Scene',
              isAnalyzed: anarchyService.layoutCache.has(cacheKey)
            });
          }

          const inImg = entry.inputImage;
          if (inImg && typeof inImg === 'string' && inImg.length > 10 && !imagesMap.has(inImg)) {
            const cacheKey = anarchyService.getCacheKey(inImg);
            imagesMap.set(inImg, {
              url: inImg,
              prompt: entry.prompt ? `Input: ${entry.prompt}` : 'History Input Scene',
              isAnalyzed: anarchyService.layoutCache.has(cacheKey)
            });
          }

          if (entry.nodeTree?.nodes) {
            entry.nodeTree.nodes.forEach((n: any) => {
              if (n.image && typeof n.image === 'string' && n.image.length > 10 && !imagesMap.has(n.image)) {
                const cacheKey = anarchyService.getCacheKey(n.image);
                imagesMap.set(n.image, {
                  url: n.image,
                  prompt: n.prompt || 'Workflow Step Scene',
                  isAnalyzed: anarchyService.layoutCache.has(cacheKey)
                });
              }
            });
          }
        });
      }
    } catch {}

    // 5. From localStorage anarchy_layout_*
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('anarchy_layout_')) {
          const rawKey = key.replace('anarchy_layout_', '');
          if ((rawKey.startsWith('http') || rawKey.startsWith('data:') || rawKey.startsWith('blob:')) && !imagesMap.has(rawKey)) {
            imagesMap.set(rawKey, { url: rawKey, prompt: 'Analyzed Scene', isAnalyzed: true });
          }
        }
      }
    } catch {}

    return Array.from(imagesMap.values());
  }, [activeStageImage, rawImage, displayImage, imageHistory]);

  const combinedAnalyzedScenes = useMemo(() => {
    const sceneMap = new Map<string, any>();

    // 1. From savedScenesList
    savedScenesList.forEach(s => {
      if (s.url) sceneMap.set(s.url, s);
    });

    // 2. From availableImages that have layout cached
    availableImages.forEach(imgObj => {
      if (!imgObj.url) return;
      const cacheKey = anarchyService.getCacheKey(imgObj.url);
      const cached = anarchyService.layoutCache.get(cacheKey);
      if (cached && Array.isArray(cached.regions) && !sceneMap.has(imgObj.url)) {
        sceneMap.set(imgObj.url, {
          id: `img_${cacheKey}`,
          url: imgObj.url,
          prompt: imgObj.prompt || 'Analyzed Scene',
          regionCount: cached.regions.length,
          timestamp: Date.now(),
          layout: cached
        });
      }
    });

    // 3. Fallback: Include current stage/display/raw image if layout is active
    const targetImg = activeStageImage || displayImage || rawImage;
    if (targetImg && layout && Array.isArray(layout.regions) && layout.regions.length > 0 && !sceneMap.has(targetImg)) {
      sceneMap.set(targetImg, {
        id: `current_stage_${Date.now()}`,
        url: targetImg,
        prompt: 'Current Stage Scene',
        regionCount: layout.regions.length,
        timestamp: Date.now(),
        layout: layout
      });
    }

    return Array.from(sceneMap.values());
  }, [savedScenesList, availableImages, activeStageImage, displayImage, rawImage, layout]);

  return {
    savedScenesList,
    setSavedScenesList,
    saveSceneToLibrary,
    deleteSavedScene,
    availableImages,
    combinedAnalyzedScenes
  };
};
