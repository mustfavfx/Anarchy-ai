// Anarchy AI Admin Dashboard - Media Vault, Prompts Management & Storage Explorer
async function resolvePredictionOnDemand(predId, item, cardId) {
      if (!predId || predId.length < 15) return;
      if (window._pendingPredictionFetches && window._pendingPredictionFetches.has(predId)) return;
      if (!window._pendingPredictionFetches) window._pendingPredictionFetches = new Set();
      window._pendingPredictionFetches.add(predId);

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/replicate-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'x-replicate-path': `/predictions/${encodeURIComponent(predId)}`,
            'x-replicate-method': 'GET'
          }
        });
        if (res.ok) {
          const p = await res.json();
          if (p && p.id) {
            if (window.vaultPredictionsMap) window.vaultPredictionsMap.set(p.id, p);
            if (p.model) item.model = p.model;
            if (p.metrics) item.metrics = p.metrics;
            if (p.input) item.input = p.input;

            const fetchedPrompt = p.prompt || p.input?.prompt || p.input?.prompt_template || null;
            if (fetchedPrompt) {
              item.prompt = fetchedPrompt;
              savePromptToCache(item.fileName, fetchedPrompt);
              savePromptToCache(p.id, fetchedPrompt);
              if (item.folderName) savePromptToCache(item.folderName, fetchedPrompt);
              updateCardPromptUI(cardId, fetchedPrompt);

              if (currentLightboxItem && currentLightboxItem.id === item.id) {
                currentLightboxItem.prompt = fetchedPrompt;
                const lbPromptText = document.getElementById('lb-prompt-text');
                if (lbPromptText) lbPromptText.innerHTML = escapeHtml(fetchedPrompt);
              }
            }

            const eco = resolveModelEconomics(item, item.width, item.height);
            item._resolvedEco = eco;

            const card = document.getElementById(`card-${cardId}`);
            if (card) {
              const modelPill = card.querySelector('.media-model-pill');
              if (modelPill) {
                modelPill.innerHTML = `${eco.icon} ${eco.modelName}`;
                modelPill.title = `محرك الذكاء الاصطناعي: ${eco.modelName} (${eco.vendor}) | كود الموديل: ${eco.modelKey}`;
              }
              const creditPill = card.querySelector('.media-credit-pill');
              if (creditPill) {
                creditPill.innerHTML = `🪙 ${eco.credits} Credits`;
              }
              const costPill = card.querySelector('.media-cost-pill');
              if (costPill) {
                costPill.innerHTML = `💵 Replicate: $${eco.costUsd.toFixed(3)}`;
              }
              const marginPill = card.querySelector('.media-margin-pill');
              if (marginPill) {
                marginPill.innerHTML = `📈 ${eco.profitMargin}%`;
              }
            }
            if (window._modelSelectUpdateTimeout) clearTimeout(window._modelSelectUpdateTimeout);
            window._modelSelectUpdateTimeout = setTimeout(() => { populateVaultModelSelect(); }, 400);
          }
        }
      } catch (e) {
        console.warn('on-demand prediction fetch error:', predId, e);
      }
    }

    function onMediaThumbLoad(el, itemId) {
      if (!el) return;
      const w = el.naturalWidth || el.videoWidth;
      const h = el.naturalHeight || el.videoHeight;
      if (!w || !h) return;

      const item = cachedVaultFiles.find(f => f.id === itemId);
      if (item) {
        item.width = w;
        item.height = h;

        // If prediction details or prompt were not loaded initially, resolve by prediction ID from Replicate on-demand!
        if (!item.model || !item.prompt) {
          const predId = item.fileName.replace(/\.[^/.]+$/, '');
          resolvePredictionOnDemand(predId, item, itemId);
        }
      }

      const ar = getStandardAspectRatio(w, h);
      const desc = getAspectRatioDescription(ar);
      
      const dimText = document.getElementById(`dim-text-${itemId}`);
      if (dimText) {
        dimText.innerHTML = `📐 ${ar ? '<b>' + ar + '</b> • ' : ''}${w}×${h}px`;
        dimText.title = `أبعاد الصورة الحقيقية: ${w}×${h} بكسل${desc ? ' | ' + desc : ''}`;
      }
      
      const dimFloat = document.getElementById(`dim-float-${itemId}`);
      if (dimFloat) {
        dimFloat.innerHTML = `📐 ${ar ? ar + ' • ' : ''}${w}×${h}`;
        dimFloat.title = `أبعاد الصورة الحقيقية: ${w}×${h} بكسل${desc ? ' | ' + desc : ''}`;
        dimFloat.style.display = 'inline-flex';
      }

      // Re-evaluate model and economics with the exact measured dimensions
      if (item) {
        const eco = resolveModelEconomics(item, w, h);
        item._resolvedEco = eco;
        const card = document.getElementById(`card-${itemId}`);
        if (card) {
          const modelPill = card.querySelector('.media-model-pill');
          if (modelPill) {
            modelPill.innerHTML = `${eco.icon} ${eco.modelName}`;
            modelPill.title = `محرك الذكاء الاصطناعي: ${eco.modelName} (${eco.vendor}) | كود الموديل: ${eco.modelKey}`;
          }
          const creditPill = card.querySelector('.media-credit-pill');
          if (creditPill) {
            creditPill.innerHTML = `🪙 ${eco.credits} Credits`;
            creditPill.title = `الرصيد المخصوم: ${eco.credits} رصيد ($${eco.revenueUsd.toFixed(2)})`;
          }
          const costPill = card.querySelector('.media-cost-pill');
          if (costPill) {
            costPill.innerHTML = `💵 Replicate: $${eco.costUsd.toFixed(3)}`;
            costPill.title = `تكلفة التوليد المدفوعة لـ Replicate: $${eco.costUsd.toFixed(3)} USD`;
          }
          const marginPill = card.querySelector('.media-margin-pill');
          if (marginPill) {
            marginPill.innerHTML = `📈 ${eco.profitMargin}%`;
            marginPill.title = `هامش الربح التشغيلي: ${eco.profitMargin}%`;
          }
        }

        // Debounced refresh of Model filter dropdown counts
        if (window._modelSelectUpdateTimeout) clearTimeout(window._modelSelectUpdateTimeout);
        window._modelSelectUpdateTimeout = setTimeout(() => {
          populateVaultModelSelect();
        }, 400);
      }
    }

function onLightboxMediaLoad(el) {
      if (!el) return;
      const w = el.naturalWidth || el.videoWidth;
      const h = el.naturalHeight || el.videoHeight;
      if (!w || !h) return;
      const ar = getStandardAspectRatio(w, h);
      const desc = getAspectRatioDescription(ar);
      const pill = document.getElementById('lb-dim-pill');
      if (pill) {
        pill.innerHTML = `📐 <b>الأبعاد:</b> ${ar ? '<b>' + ar + '</b> • ' : ''}${w}×${h} بكسل`;
        pill.title = `الأبعاد الحقيقية: ${w}×${h} بكسل${desc ? ' (' + desc + ')' : ''}`;
      }

      if (currentLightboxItem) {
        currentLightboxItem.width = w;
        currentLightboxItem.height = h;
        const eco = resolveModelEconomics(currentLightboxItem, w, h);
        currentLightboxItem._resolvedEco = eco;
        const econStrip = document.getElementById('lb-econ-strip');
        if (econStrip) {
          const modelPill = econStrip.querySelector('.media-model-pill');
          if (modelPill) {
            modelPill.innerHTML = `${eco.icon} <b>المحرك:</b> ${eco.modelName} (${eco.vendor})`;
            modelPill.title = `محرك الذكاء الاصطناعي: ${eco.modelName} (${eco.vendor}) | كود الموديل: ${eco.modelKey}`;
          }
          const creditPill = econStrip.querySelector('.media-credit-pill');
          if (creditPill) {
            creditPill.innerHTML = `🪙 <b>الخصم:</b> ${eco.credits} رصيد ($${eco.revenueUsd.toFixed(2)})`;
          }
          const costPill = econStrip.querySelector('.media-cost-pill');
          if (costPill) {
            costPill.innerHTML = `💵 <b>تكلفة Replicate:</b> $${eco.costUsd.toFixed(3)} USD`;
          }
          const marginPill = econStrip.querySelector('.media-margin-pill');
          if (marginPill) {
            marginPill.innerHTML = `📈 <b>الربحية:</b> ${eco.profitMargin}% هامش`;
          }
        }
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const PROMPT_CACHE_KEY = 'anarchy_admin_prompt_cache';

    function getPromptCache() {
      try {
        const raw = localStorage.getItem(PROMPT_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    function savePromptToCache(key, promptText) {
      if (!key || !promptText || !String(promptText).trim()) return;
      try {
        const cache = getPromptCache();
        const trimmed = String(promptText).trim();
        cache[key] = trimmed;
        const cleanKey = String(key).replace(/\.[^/.]+$/, '');
        cache[cleanKey] = trimmed;
        localStorage.setItem(PROMPT_CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        console.warn('Failed to save prompt to cache:', e);
      }
    }

    function getCachedPrompt(item) {
      if (!item) return null;
      const cache = getPromptCache();
      const fn = item.fileName || '';
      const predId = fn.replace(/\.[^/.]+$/, '');
      const folder = item.folderName || '';
      return cache[fn] || cache[predId] || cache[folder] || (item.id ? cache[item.id] : null) || null;
    }

    function getPromptsFromBrowserHistory() {
      const map = new Map();
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('anarchy_history') || k.startsWith('anarchy_project') || k.startsWith('anarchy_builder'))) {
            try {
              const raw = localStorage.getItem(k);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              const entries = Array.isArray(parsed) ? parsed : (parsed.entries || []);
              entries.forEach(e => {
                const p = e.prompt || e.label;
                if (p && typeof p === 'string' && p.trim()) {
                  const trimmed = p.trim();
                  if (e.id) map.set(e.id, trimmed);
                  if (e.outputImage) {
                    map.set(e.outputImage, trimmed);
                    const lastPart = e.outputImage.split('/').pop();
                    if (lastPart) map.set(lastPart, trimmed);
                  }
                  if (e.nodeTree && Array.isArray(e.nodeTree.nodes)) {
                    e.nodeTree.nodes.forEach(n => {
                      const nodePrompt = n.prompt || n.data?.prompt || trimmed;
                      if (n.id) map.set(n.id, nodePrompt);
                      if (n.image) {
                        map.set(n.image, nodePrompt);
                        const nImg = n.image.split('/').pop();
                        if (nImg) map.set(nImg, nodePrompt);
                      }
                    });
                  }
                }
              });
            } catch (e) {}
          }
        }
      } catch (e) {}
      return map;
    }

    async function resolvePromptForItem(item) {
      if (!item) return null;
      if (item.prompt && item.prompt.trim()) return item.prompt.trim();

      // 1. Check local persistent prompt cache
      const cached = getCachedPrompt(item);
      if (cached) {
        item.prompt = cached;
        return cached;
      }

      // 2. Check browser history
      const historyMap = getPromptsFromBrowserHistory();
      const folder = item.folderName;
      const predId = (item.fileName || '').replace(/\.[^/.]+$/, '');
      if (folder && historyMap.has(folder)) {
        const p = historyMap.get(folder);
        item.prompt = p;
        savePromptToCache(item.fileName, p);
        savePromptToCache(folder, p);
        return p;
      }
      if (predId && historyMap.has(predId)) {
        const p = historyMap.get(predId);
        item.prompt = p;
        savePromptToCache(item.fileName, p);
        return p;
      }
      if (item.fileName && historyMap.has(item.fileName)) {
        const p = historyMap.get(item.fileName);
        item.prompt = p;
        savePromptToCache(item.fileName, p);
        return p;
      }

      // 3. Check memory predictionsMap
      if (window.vaultPredictionsMap) {
        const pred = window.vaultPredictionsMap.get(predId) || window.vaultPredictionsMap.get(folder);
        const p = pred?.prompt || pred?.input?.prompt || pred?.input?.prompt_template;
        if (p && typeof p === 'string' && p.trim()) {
          item.prompt = p.trim();
          savePromptToCache(item.fileName, item.prompt);
          return item.prompt;
        }
      }

      // 4. Check credit transactions
      if (window.vaultTransactionsMap) {
        const tx = window.vaultTransactionsMap.get(predId) || window.vaultTransactionsMap.get(folder);
        if (tx) {
          let txPrompt = tx.metadata?.prompt || tx.metadata?.input?.prompt;
          if (!txPrompt && tx.description) {
            const m = tx.description.match(/(?:Generation|Inpaint|Prompt):\s*(.+)/i);
            if (m) txPrompt = m[1].replace(/\.\.\.$/, '');
          }
          if (txPrompt && typeof txPrompt === 'string' && txPrompt.trim()) {
            item.prompt = txPrompt.trim();
            savePromptToCache(item.fileName, item.prompt);
            return item.prompt;
          }
        }
      }

      // 5. Live Replicate API lookup on demand
      if (predId && predId.length >= 15) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/replicate-proxy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': ANON_KEY,
              'Authorization': `Bearer ${ANON_KEY}`,
              'x-replicate-path': `/predictions/${encodeURIComponent(predId)}`,
              'x-replicate-method': 'GET'
            }
          });
          if (res.ok) {
            const pData = await res.json();
            const p = pData?.input?.prompt || pData?.input?.prompt_template || pData?.prompt;
            if (p && typeof p === 'string' && p.trim()) {
              item.prompt = p.trim();
              savePromptToCache(item.fileName, item.prompt);
              savePromptToCache(predId, item.prompt);
              return item.prompt;
            }
          }
        } catch (e) {}
      }

      return null;
    }

    function updateCardPromptUI(itemId, promptText) {
      let item = cachedVaultFiles.find(f => f.id === itemId);
      if (!item && window.currentUserModalFiles) {
        item = window.currentUserModalFiles.find(f => f.id === itemId);
      }
      if (item) item.prompt = promptText;

      const box = document.getElementById(`prompt-box-${itemId}`);
      if (!box) return;

      if (promptText && promptText.trim()) {
        box.className = 'media-prompt-box';
        box.innerHTML = `
          <div class="media-prompt-header">
            <span class="media-prompt-tag">✨ البرومبت</span>
            <div class="media-prompt-actions">
              <button class="btn-prompt-action" onclick="copyCardPrompt('${itemId}', this)" title="نسخ البرومبت بالكامل">
                📋 نسخ
              </button>
              <button class="btn-prompt-action" onclick="importOrEditCardPrompt('${itemId}', this)" title="تعديل أو إعادة استيراد البرومبت">
                ✏️ تعديل
              </button>
            </div>
          </div>
          <div class="media-prompt-body" id="prompt-text-${itemId}" title="${escapeHtml(promptText)}">
            ${escapeHtml(promptText)}
          </div>
        `;
      } else {
        box.className = 'media-prompt-box is-empty';
        box.innerHTML = `
          <div class="media-prompt-header">
            <span class="media-prompt-tag tag-empty">💬 البرومبت</span>
            <div class="media-prompt-actions">
              <button class="btn-prompt-action btn-fetch-active" onclick="importOrEditCardPrompt('${itemId}', this)" title="استيراد البرومبت من Replicate أو السجل أو إدخاله">
                ⚡ استيراد
              </button>
            </div>
          </div>
          <div class="media-prompt-body body-empty" id="prompt-text-${itemId}">
            لم يتم استيراد البرومبت بعد — انقر استيراد للجلب أو التعيين
          </div>
        `;
      }
    }

    function copyCardPrompt(itemId, btn) {
      let item = cachedVaultFiles.find(f => f.id === itemId);
      if (!item && window.currentUserModalFiles) {
        item = window.currentUserModalFiles.find(f => f.id === itemId);
      }
      const promptText = item?.prompt || getCachedPrompt(item || { id: itemId });
      if (!promptText) return;
      navigator.clipboard.writeText(promptText).then(() => {
        const oldText = btn.innerHTML;
        btn.innerHTML = 'تم النسخ ✓';
        btn.style.color = '#34d399';
        setTimeout(() => {
          btn.innerHTML = oldText;
          btn.style.color = '';
        }, 2000);
      }).catch(() => {
        prompt('Copy prompt:', promptText);
      });
    }

    function copyPromptText(encodedPrompt, btn) {
      const text = decodeURIComponent(encodedPrompt);
      navigator.clipboard.writeText(text).then(() => {
        const oldText = btn.textContent;
        btn.textContent = 'تم النسخ ✓';
        setTimeout(() => { btn.textContent = oldText; }, 2000);
      });
    }

    let currentPromptModalItem = null;

    async function importOrEditCardPrompt(itemId, btn) {
      let item = cachedVaultFiles.find(f => f.id === itemId);
      if (!item && window.currentUserModalFiles) {
        item = window.currentUserModalFiles.find(f => f.id === itemId);
      }
      if (!item) return;

      // If item does NOT have a prompt yet, attempt online/offline resolution first
      if (!item.prompt) {
        if (btn) {
          const oldHtml = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner" style="width: 10px; height: 10px; display: inline-block; vertical-align: middle;"></span> فحص...';
          const resolved = await resolvePromptForItem(item);
          btn.disabled = false;
          btn.innerHTML = oldHtml;
          if (resolved) {
            updateCardPromptUI(itemId, resolved);
            return;
          }
        }
      }

      // If not resolved or user wants to edit, open the interactive modal
      openPromptModal(item);
    }

    function openPromptModal(item) {
      currentPromptModalItem = item;
      const modal = document.getElementById('prompt-modal');
      const filenameEl = document.getElementById('prompt-modal-filename');
      const thumbEl = document.getElementById('prompt-modal-thumb');
      const userEl = document.getElementById('prompt-modal-user');
      const folderEl = document.getElementById('prompt-modal-folder');
      const modelEl = document.getElementById('prompt-modal-model');
      const textarea = document.getElementById('prompt-modal-textarea');

      if (!modal) return;

      filenameEl.textContent = item.fileName;
      thumbEl.src = item.publicUrl;
      thumbEl.onerror = () => { thumbEl.src = 'https://placehold.co/100x100/18181d/71717a?text=Preview'; };
      userEl.textContent = `👤 ${item.userEmail}`;
      folderEl.textContent = `📁 ${item.folderName}`;

      const eco = item._resolvedEco || resolveModelEconomics(item, item.width, item.height);
      modelEl.textContent = `⚡ ${eco.modelName} (${eco.vendor})`;

      const existingPrompt = item.prompt || getCachedPrompt(item) || '';
      textarea.value = existingPrompt;
      updatePromptModalCharCount();

      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      setTimeout(() => textarea.focus(), 80);
    }

    function closePromptModal() {
      const modal = document.getElementById('prompt-modal');
      if (modal) modal.style.display = 'none';
      currentPromptModalItem = null;
      const userModal = document.getElementById('user-media-modal');
      const lbModal = document.getElementById('lightbox-modal');
      if ((!userModal || userModal.style.display !== 'flex') && (!lbModal || lbModal.style.display !== 'flex')) {
        document.body.style.overflow = 'auto';
      }
    }

    function handlePromptModalBackdropClick(e) {
      if (e.target.id === 'prompt-modal') {
        closePromptModal();
      }
    }

    function updatePromptModalCharCount() {
      const textarea = document.getElementById('prompt-modal-textarea');
      const countEl = document.getElementById('prompt-modal-char-count');
      if (textarea && countEl) {
        countEl.textContent = `${textarea.value.length} حرف`;
      }
    }

    function savePromptModal() {
      if (!currentPromptModalItem) return;
      const textarea = document.getElementById('prompt-modal-textarea');
      const newPrompt = textarea ? textarea.value.trim() : '';

      currentPromptModalItem.prompt = newPrompt;
      savePromptToCache(currentPromptModalItem.fileName, newPrompt);
      const predId = (currentPromptModalItem.fileName || '').replace(/\.[^/.]+$/, '');
      savePromptToCache(predId, newPrompt);
      if (currentPromptModalItem.folderName) savePromptToCache(currentPromptModalItem.folderName, newPrompt);

      updateCardPromptUI(currentPromptModalItem.id, newPrompt);

      // If lightbox is open for this item, update lightbox too
      if (currentLightboxItem && currentLightboxItem.id === currentPromptModalItem.id) {
        currentLightboxItem.prompt = newPrompt;
        const lbPromptText = document.getElementById('lb-prompt-text');
        if (lbPromptText) {
          lbPromptText.innerHTML = newPrompt ? escapeHtml(newPrompt) : '<span style="color: var(--text-muted); font-style: italic;">لم يتم استيراد البرومبت بعد</span>';
        }
      }

      closePromptModal();
    }

    async function fetchOnlinePromptForModal() {
      if (!currentPromptModalItem) return;
      const btn = document.getElementById('btn-modal-fetch-online');
      const spinner = document.getElementById('modal-fetch-spinner');
      const textarea = document.getElementById('prompt-modal-textarea');

      if (btn) btn.disabled = true;
      if (spinner) spinner.style.animation = 'spin 0.8s linear infinite';

      try {
        const resolved = await resolvePromptForItem(currentPromptModalItem);
        if (resolved) {
          if (textarea) {
            textarea.value = resolved;
            updatePromptModalCharCount();
          }
          alert('تم العثور على البرومبت بنجاح من الخادم! ✨');
        } else {
          alert('لم يتم العثور على البرومبت تلقائياً على خوادم Replicate (ربما انتهت فترة احتفاظ Replicate بالبيانات). يمكنك كتابة أو لصق البرومبت يدوياً.');
        }
      } catch (err) {
        alert('حدث خطأ أثناء فحص الخادم: ' + (err.message || err));
      } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.animation = 'none';
      }
    }

    async function importAllPrompts(btn) {
      if (!cachedVaultFiles || cachedVaultFiles.length === 0) {
        alert('مستودع الوسائط فارغ حالياً.');
        return;
      }

      const icon = document.getElementById('import-prompts-icon');
      if (btn) btn.disabled = true;
      if (icon) icon.style.display = 'inline-block';
      if (icon) icon.style.animation = 'spin 0.8s linear infinite';

      const statusEl = document.getElementById('vault-status-text');
      const oldStatus = statusEl ? statusEl.innerHTML : '';

      try {
        let importedCount = 0;
        let checkedCount = 0;

        // 1. Prime browser history prompts
        const historyMap = getPromptsFromBrowserHistory();

        // 2. Fetch paginated predictions from Replicate (up to 3 pages / 300 items)
        if (!window.vaultPredictionsMap || window.vaultPredictionsMap.size < 100) {
          try {
            if (!window.vaultPredictionsMap) window.vaultPredictionsMap = new Map();
            let urlPath = '/predictions?limit=100';
            for (let page = 0; page < 3; page++) {
              const repRes = await fetch(`${SUPABASE_URL}/functions/v1/replicate-proxy`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': ANON_KEY,
                  'Authorization': `Bearer ${ANON_KEY}`,
                  'x-replicate-path': urlPath,
                  'x-replicate-method': 'GET'
                }
              });
              if (!repRes.ok) break;
              const repJson = await repRes.json();
              if (repJson.results && repJson.results.length > 0) {
                repJson.results.forEach(p => {
                  window.vaultPredictionsMap.set(p.id, {
                    id: p.id,
                    replicate_id: p.id,
                    model: p.model,
                    metrics: p.metrics,
                    input: p.input,
                    prompt: p.input?.prompt || p.input?.prompt_template || null,
                    created_at: p.created_at,
                    status: p.status
                  });
                });
              }
              if (!repJson.next) break;
              const nextUrl = new URL(repJson.next);
              urlPath = nextUrl.pathname.replace('/v1', '') + nextUrl.search;
            }
          } catch (e) {
            console.warn('Batch Replicate fetch fallback:', e);
          }
        }

        for (const item of cachedVaultFiles) {
          checkedCount++;
          if (statusEl && checkedCount % 5 === 0) {
            statusEl.innerHTML = `جاري استيراد البرومبتات... (${checkedCount}/${cachedVaultFiles.length})`;
          }

          if (!item.prompt) {
            const found = await resolvePromptForItem(item);
            if (found) {
              item.prompt = found;
              importedCount++;
              updateCardPromptUI(item.id, found);
            }
          } else {
            // Already has prompt, ensure it's in cache
            savePromptToCache(item.fileName, item.prompt);
          }
        }

        // Re-run filter to update count and UI
        handleVaultFilter();

        if (statusEl) {
          statusEl.innerHTML = `✅ تم فحص <b>${checkedCount}</b> عنصر واستيراد <b>${importedCount}</b> برومبت بنجاح!`;
        }
      } catch (err) {
        console.error('Error importing all prompts:', err);
        alert('حدث خطأ أثناء استيراد البرومبتات: ' + (err.message || err));
      } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.style.animation = 'none';
      }
    }

    function scrollToVault() {
      const el = document.getElementById('section-media-vault');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function toggleThumbGrid(mode) {
      const grid = document.getElementById('vault-gallery-grid');
      const modalGrid = document.getElementById('modal-gallery-grid');
      const minWidth = mode === 'compact' ? '200px' : '280px';
      if (grid) grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidth}, 1fr))`;
      if (modalGrid) modalGrid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidth}, 1fr))`;
    }

    function formatFileSize(bytes) {
      if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function getUserEmail(userId) {
      if (!userId) return 'Unknown User';
      if (userId === 'user') return 'Dev / Guest (توليد محلي أثناء التطوير)';
      if (userId === 'anonymous') return 'Anonymous (زائر بدون تسجيل)';
      if (userId === 'default_user') return 'Default User (افتراضي)';
      const sub = rawData?.subscribers?.find(s => s.user_id === userId);
      return sub ? sub.email : (userId.length > 20 ? userId.slice(0, 16) + '...' : userId);
    }

    function setVaultTypeFilter(type) {
      currentVaultType = type;
      ['all', 'image', 'video'].forEach(t => {
        const btn = document.getElementById(`btn-vtype-${t}`);
        if (btn) btn.classList.toggle('active', t === type);
      });
      handleVaultFilter();
    }

    function handleVaultFilter() {
      const userSelect = document.getElementById('vault-user-select');
      currentVaultUser = userSelect ? userSelect.value : 'all';

      const modelSelect = document.getElementById('vault-model-select');
      currentVaultModel = modelSelect ? modelSelect.value : 'all';

      const searchVal = (document.getElementById('vault-search-input')?.value || '').toLowerCase().trim();

      let filtered = [...cachedVaultFiles];

      // 1. Filter by user
      if (currentVaultUser !== 'all') {
        filtered = filtered.filter(f => f.userId === currentVaultUser);
      }

      // 2. Filter by AI Model
      if (currentVaultModel !== 'all') {
        filtered = filtered.filter(f => {
          const eco = f._resolvedEco || resolveModelEconomics(f, f.width, f.height);
          return eco.modelName === currentVaultModel || f.model === currentVaultModel;
        });
      }

      // 3. Filter by media type
      if (currentVaultType === 'image') {
        filtered = filtered.filter(f => !f.isVideo);
      } else if (currentVaultType === 'video') {
        filtered = filtered.filter(f => f.isVideo);
      }

      // 4. Filter by search query
      if (searchVal) {
        filtered = filtered.filter(f => {
          const eco = f._resolvedEco || resolveModelEconomics(f, f.width, f.height);
          return (
            f.fileName.toLowerCase().includes(searchVal) ||
            f.userEmail.toLowerCase().includes(searchVal) ||
            f.folderName.toLowerCase().includes(searchVal) ||
            (f.prompt && f.prompt.toLowerCase().includes(searchVal)) ||
            (f.model && f.model.toLowerCase().includes(searchVal)) ||
            eco.modelName.toLowerCase().includes(searchVal) ||
            eco.vendor.toLowerCase().includes(searchVal) ||
            f.userId.toLowerCase().includes(searchVal)
          );
        });
      }

      renderVaultGrid(filtered, 'vault-gallery-grid', 'vault-empty-state');

      const countEl = document.getElementById('vault-total-count');
      const sizeEl = document.getElementById('vault-total-size');
      const statusText = document.getElementById('vault-status-text');

      const totalBytes = filtered.reduce((sum, f) => sum + (f.size || 0), 0);
      const sizeFormatted = formatFileSize(totalBytes);

      if (countEl) countEl.textContent = `${filtered.length} Files`;
      if (sizeEl) sizeEl.textContent = sizeFormatted;
      if (statusText) {
        const userLabel = currentVaultUser === 'all' ? 'كل المستخدمين' : getUserEmail(currentVaultUser);
        const modelLabel = currentVaultModel === 'all' ? 'كل المحركات' : currentVaultModel;
        statusText.innerHTML = `عرض <b>${filtered.length}</b> من أصل <b>${cachedVaultFiles.length}</b> عنصر (${userLabel} • ${modelLabel})`;
      }
    }

    async function loadVaultMedia(forceRefresh = false) {
      if (isVaultLoading && !forceRefresh) return;
      isVaultLoading = true;

      const spinner = document.getElementById('vault-refresh-spinner');
      const loadingEl = document.getElementById('vault-loading-state');
      const emptyEl = document.getElementById('vault-empty-state');
      const gridEl = document.getElementById('vault-gallery-grid');
      const statusEl = document.getElementById('vault-status-text');

      if (spinner) {
        spinner.style.display = 'inline-block';
        spinner.style.animation = 'spin 0.8s linear infinite';
      }
      if (loadingEl) loadingEl.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';
      if (gridEl) gridEl.innerHTML = '';
      if (statusEl) statusEl.textContent = 'جاري مسح مجلدات Supabase Storage ومزامنة التوليدات...';

      try {
        const STORAGE_BUCKET = 'generated-images';
        let allDiscovered = [];

        // Fetch predictions: First from live Replicate API via replicate-proxy (bypasses RLS 100%), then from Supabase table
        const predictionsMap = new Map();
        try {
          let urlPath = '/predictions?limit=100';
          for (let page = 0; page < 3; page++) {
            const repRes = await fetch(`${SUPABASE_URL}/functions/v1/replicate-proxy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`,
                'x-replicate-path': urlPath,
                'x-replicate-method': 'GET'
              }
            });
            if (!repRes.ok) break;
            const repJson = await repRes.json();
            if (repJson.results && repJson.results.length > 0) {
              repJson.results.forEach(p => {
                predictionsMap.set(p.id, {
                  id: p.id,
                  replicate_id: p.id,
                  model: p.model,
                  metrics: p.metrics,
                  input: p.input,
                  prompt: p.input?.prompt || p.input?.prompt_template || null,
                  created_at: p.created_at,
                  status: p.status
                });
              });
            }
            if (!repJson.next) break;
            const nextUrl = new URL(repJson.next);
            urlPath = nextUrl.pathname.replace('/v1', '') + nextUrl.search;
          }
        } catch (repErr) {
          console.warn('Replicate live predictions fetch fallback:', repErr);
        }
        window.vaultPredictionsMap = predictionsMap;

        try {
          let preds = [];
          try {
            const { data: rpcPreds, error: rpcPredErr } = await activeClient.rpc('get_admin_predictions', { p_limit: 5000 });
            if (!rpcPredErr && Array.isArray(rpcPreds) && rpcPreds.length > 0) {
              preds = rpcPreds;
            }
          } catch (e) {}

          if (preds.length === 0) {
            const { data: directPreds } = await activeClient
              .from('replicate_predictions')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(5000);
            if (directPreds && directPreds.length > 0) preds = directPreds;
          }

          if (preds && preds.length > 0) {
            preds.forEach(p => {
              const existing = predictionsMap.get(p.replicate_id) || {};
              const merged = { ...existing, ...p };
              if (p.replicate_id) predictionsMap.set(p.replicate_id, merged);
              if (p.node_id) predictionsMap.set(p.node_id, merged);
            });
          }
        } catch (predErr) {
          console.warn('Predictions table lookup fallback:', predErr);
        }

        // Fetch credit transactions to link exact deductions where logged
        const transactionsMap = new Map();
        try {
          const { data: txs } = await activeClient
            .from('credit_transactions')
            .select('*')
            .eq('type', 'usage')
            .order('created_at', { ascending: false })
            .limit(3000);

          if (txs && txs.length > 0) {
            txs.forEach(t => {
              if (t.metadata?.replicate_id) transactionsMap.set(t.metadata.replicate_id, t);
              if (t.metadata?.node_id) transactionsMap.set(t.metadata.node_id, t);
              if (t.metadata?.prediction_id) transactionsMap.set(t.metadata.prediction_id, t);
            });
          }
        } catch (txErr) {
          console.warn('Credit transactions lookup fallback:', txErr);
        }

        window.vaultTransactionsMap = transactionsMap;
        const browserHistoryPrompts = getPromptsFromBrowserHistory();

        // --- METHOD 1: Direct SQL RPC (Bypasses Storage RLS, instant & complete across all users) ---
        let rpcLoaded = false;
        try {
          const { data: rpcFiles, error: rpcErr } = await activeClient.rpc('get_admin_storage_media', { p_user_id: null });
          if (!rpcErr && Array.isArray(rpcFiles) && rpcFiles.length > 0) {
            rpcLoaded = true;
            for (const item of rpcFiles) {
              const fullPath = item.name;
              const parts = fullPath.split('/');
              const userId = parts[0] || 'unknown';
              const folderName = parts.length > 2 ? parts[1] : 'root';
              const fileName = parts[parts.length - 1];
              const isVid = /\.(mp4|webm|mov)$/i.test(fileName);
              const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fullPath}`;

              let timestamp = item.created_at || item.updated_at;
              const ghostMatch = folderName.match(/ghost-(\d+)/);
              if (ghostMatch) {
                const parsedMs = Number(ghostMatch[1]);
                if (!isNaN(parsedMs) && parsedMs > 1000000000000) {
                  timestamp = new Date(parsedMs).toISOString();
                }
              }

              const predId = fileName.replace(/\.[^/.]+$/, '');
              const pred = predictionsMap.get(predId) || predictionsMap.get(folderName);
              const tx = transactionsMap.get(predId) || transactionsMap.get(folderName);

              const cachedPrompt = getCachedPrompt({ fileName, folderName, id: `${userId}_${folderName}_${fileName}` });
              const historyPrompt = browserHistoryPrompts.get(folderName) || browserHistoryPrompts.get(predId) || browserHistoryPrompts.get(fileName) || null;
              let resolvedPrompt = cachedPrompt || historyPrompt || pred?.prompt || pred?.input?.prompt || pred?.input?.prompt_template || item.prompt || null;
              if (resolvedPrompt) {
                savePromptToCache(fileName, resolvedPrompt);
                savePromptToCache(predId, resolvedPrompt);
                savePromptToCache(folderName, resolvedPrompt);
              }

              allDiscovered.push({
                id: `${userId}_${folderName}_${fileName}`,
                userId,
                userEmail: getUserEmail(userId),
                folderName,
                fileName,
                fullPath,
                publicUrl,
                size: item.size || 0,
                createdAt: timestamp || new Date().toISOString(),
                isVideo: isVid,
                prompt: resolvedPrompt,
                model: pred?.model || item.model || null,
                input: pred?.input || item.input || null,
                metrics: pred?.metrics || null,
                creditAmount: tx?.amount ? Math.abs(tx.amount) : (item.credits_used ? Number(item.credits_used) : null),
              });
            }
          }
        } catch (rpcEx) {
          console.warn('RPC get_admin_storage_media not available, falling back to API:', rpcEx);
        }

        // --- METHOD 2: Fallback to Storage API listing if RPC was not available ---
        if (!rpcLoaded) {
          const { data: rootItems, error: rootErr } = await activeClient.storage
            .from(STORAGE_BUCKET)
            .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });

          if (!rootErr && rootItems && rootItems.length > 0) {
            const userFolders = rootItems.filter(item => !item.id || item.id === null || !item.metadata || item.name.includes('-') || item.name === 'anonymous' || item.name === 'default_user');

            const rootFiles = rootItems.filter(item => item.metadata && item.metadata.size);
            for (const rf of rootFiles) {
              const { data: { publicUrl } } = activeClient.storage.from(STORAGE_BUCKET).getPublicUrl(rf.name);
              const isVid = /\.(mp4|webm|mov)$/i.test(rf.name);
              allDiscovered.push({
                id: 'root_' + rf.name,
                userId: 'root',
                userEmail: 'Storage Root',
                folderName: 'root',
                fileName: rf.name,
                fullPath: rf.name,
                publicUrl,
                size: rf.metadata?.size || 0,
                createdAt: rf.created_at || rf.updated_at || new Date().toISOString(),
                isVideo: isVid,
                prompt: null,
                model: null
              });
            }

            const folderPromises = userFolders.map(async (uf) => {
              const userId = uf.name;
              const userEmail = getUserEmail(userId);

              try {
                const { data: subFolders } = await activeClient.storage
                  .from(STORAGE_BUCKET)
                  .list(userId, { limit: 100, sortBy: { column: 'name', order: 'desc' } });

                if (!subFolders) return;

                for (const sub of subFolders) {
                  if (!sub.id || sub.id === null || !sub.metadata?.size) {
                    const nodeFolder = sub.name;
                    const { data: files } = await activeClient.storage
                      .from(STORAGE_BUCKET)
                      .list(`${userId}/${nodeFolder}`, { limit: 50 });

                    if (files && files.length > 0) {
                      for (const f of files) {
                        const fullPath = `${userId}/${nodeFolder}/${f.name}`;
                        const { data: { publicUrl } } = activeClient.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
                        const isVid = /\.(mp4|webm|mov)$/i.test(f.name);

                        let timestamp = f.created_at || f.updated_at;
                        const ghostMatch = nodeFolder.match(/ghost-(\d+)/);
                        if (ghostMatch) {
                          const parsedMs = Number(ghostMatch[1]);
                          if (!isNaN(parsedMs) && parsedMs > 1000000000000) {
                            timestamp = new Date(parsedMs).toISOString();
                          }
                        }

                        const predId = f.name.replace(/\.[^/.]+$/, '');
                        const pred = predictionsMap.get(predId) || predictionsMap.get(nodeFolder);
                        const tx = transactionsMap.get(predId) || transactionsMap.get(nodeFolder);

                        const cachedPrompt = getCachedPrompt({ fileName: f.name, folderName: nodeFolder, id: `${userId}_${nodeFolder}_${f.name}` });
                        const historyPrompt = browserHistoryPrompts.get(nodeFolder) || browserHistoryPrompts.get(predId) || browserHistoryPrompts.get(f.name) || null;
                        let resolvedPrompt = cachedPrompt || historyPrompt || pred?.prompt || pred?.input?.prompt || pred?.input?.prompt_template || null;
                        if (resolvedPrompt) {
                          savePromptToCache(f.name, resolvedPrompt);
                          savePromptToCache(predId, resolvedPrompt);
                          savePromptToCache(nodeFolder, resolvedPrompt);
                        }

                        allDiscovered.push({
                          id: `${userId}_${nodeFolder}_${f.name}`,
                          userId,
                          userEmail,
                          folderName: nodeFolder,
                          fileName: f.name,
                          fullPath,
                          publicUrl,
                          size: f.metadata?.size || 0,
                          createdAt: timestamp || new Date().toISOString(),
                          isVideo: isVid,
                          prompt: resolvedPrompt,
                          model: pred?.model || null,
                          input: pred?.input || null,
                          metrics: pred?.metrics || null,
                          creditAmount: tx?.amount ? Math.abs(tx.amount) : null,
                        });
                      }
                    }
                  } else {
                    const fullPath = `${userId}/${sub.name}`;
                    const { data: { publicUrl } } = activeClient.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
                    const isVid = /\.(mp4|webm|mov)$/i.test(sub.name);

                    allDiscovered.push({
                      id: `${userId}_${sub.name}`,
                      userId,
                      userEmail,
                      folderName: 'root',
                      fileName: sub.name,
                      fullPath,
                      publicUrl,
                      size: sub.metadata?.size || 0,
                      createdAt: sub.created_at || sub.updated_at || new Date().toISOString(),
                      isVideo: isVid,
                      prompt: null,
                      model: null,
                      input: null,
                      creditAmount: null,
                    });
                  }
                }
              } catch (err) {
                console.warn(`Error scanning user folder ${userId}:`, err);
              }
            });

            await Promise.all(folderPromises);
          }
        }

        // Sort descending by created timestamp
        allDiscovered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        cachedVaultFiles = allDiscovered;

        populateVaultUserSelect();
        populateVaultModelSelect();
        handleVaultFilter();
      } catch (err) {
        console.error('Error reading Supabase Storage:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (statusEl) {
          statusEl.innerHTML = `
            <span style="color: #fb7185;">
              ⚠️ خطأ في قراءة Supabase Storage: ${err.message || err}.
            </span>
          `;
        }
      } finally {
        isVaultLoading = false;
        if (loadingEl) loadingEl.style.display = 'none';
        if (spinner) {
          spinner.style.animation = 'none';
        }
      }
    }

    function populateVaultUserSelect() {
      const select = document.getElementById('vault-user-select');
      if (!select) return;

      const countsByUser = new Map();
      cachedVaultFiles.forEach(f => {
        countsByUser.set(f.userId, (countsByUser.get(f.userId) || 0) + 1);
      });

      const currentVal = select.value;
      select.innerHTML = `<option value="all">👥 All Users — كل المستخدمين (${cachedVaultFiles.length} ملف)</option>`;

      const userList = Array.from(countsByUser.entries()).sort((a, b) => b[1] - a[1]);
      userList.forEach(([uid, count]) => {
        const email = getUserEmail(uid);
        const opt = document.createElement('option');
        opt.value = uid;
        opt.textContent = `👤 ${email} (${count} ملف)`;
        select.appendChild(opt);
      });

      if (rawData?.subscribers) {
        rawData.subscribers.forEach(sub => {
          if (!countsByUser.has(sub.user_id)) {
            const opt = document.createElement('option');
            opt.value = sub.user_id;
            opt.textContent = `👤 ${sub.email} (0 ملف)`;
            select.appendChild(opt);
          }
        });
      }

      if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
      }
    }

    function populateVaultModelSelect() {
      const select = document.getElementById('vault-model-select');
      if (!select) return;

      const countsByModel = new Map();
      cachedVaultFiles.forEach(f => {
        const eco = f._resolvedEco || resolveModelEconomics(f, f.width, f.height);
        const name = eco.modelName || 'Unknown Engine';
        countsByModel.set(name, (countsByModel.get(name) || 0) + 1);
      });

      const currentVal = select.value;
      select.innerHTML = `<option value="all">⚡ All AI Models — كل المحركات (${cachedVaultFiles.length} ملف)</option>`;

      const modelList = Array.from(countsByModel.entries()).sort((a, b) => b[1] - a[1]);
      modelList.forEach(([mName, count]) => {
        const opt = document.createElement('option');
        opt.value = mName;
        opt.textContent = `🤖 ${mName} (${count} ملف)`;
        select.appendChild(opt);
      });

      if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
      }
    }

    function renderVaultGrid(items, targetGridId, targetEmptyId) {
      const grid = document.getElementById(targetGridId);
      const empty = document.getElementById(targetEmptyId);

      if (!grid) return;

      if (!items || items.length === 0) {
        grid.innerHTML = '';
        if (empty) {
          empty.style.display = 'block';
          empty.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 12px;">📂</div>
            <div style="font-weight: 700; color: #fff; font-size: 15px; margin-bottom: 4px;">لا توجد ملفات وسائط معروضة حالياً</div>
            <div style="color: var(--text-muted); font-size: 13px; max-width: 580px; margin: 0 auto; line-height: 1.5;">
              إذا كان لديك ملفات في Supabase Storage ولكن لا تظهر، يمكنك تفعيل استعراض ملفات الـ Storage بضغطة واحدة:
            </div>
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 14px; margin: 16px auto 0; max-width: 600px; text-align: right; direction: rtl; color: #fbbf24; font-size: 12.5px;">
              ⚡ <b>تفعيل القراءة عبر SQL Editor في Supabase:</b><br>
              انسخ كود الـ SQL المرفق وألصقه في <b>Supabase > SQL Editor</b> واضغط Run:
              <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: flex-start;">
                <button class="btn btn-secondary" onclick="copyStorageSqlCode(this)" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); font-weight: 700; font-size: 12px; padding: 7px 14px;">
                  📋 نسخ كود SQL لـ Supabase
                </button>
                <button class="btn btn-secondary" onclick="loadVaultMedia(true)" style="font-size: 12px; padding: 7px 14px;">
                  🔄 تحديث وفحص
                </button>
              </div>
            </div>
          `;
        }
        return;
      }

      if (empty) empty.style.display = 'none';
      grid.innerHTML = items.map(item => renderMediaCardHtml(item)).join('');
    }

    function renderMediaCardHtml(item) {
      const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const sizeText = formatFileSize(item.size);
      const typeBadgeClass = item.isVideo ? 'badge-vid' : 'badge-img';
      const typeLabel = item.isVideo ? '🎥 MP4' : '📷 IMG';
      const ext = item.fileName.split('.').pop()?.toUpperCase() || 'FILE';

      const eco = item._resolvedEco || resolveModelEconomics(item, item.width, item.height);

      // Determine initial aspect ratio & dimension info if provided in input
      let initialDimHtml = '📐 قياس...';
      let initialDimTitle = 'أبعاد الصورة: جاري قياس البكسلات والنسبة بدقة';
      if (item.input?.aspect_ratio) {
        const ar = item.input.aspect_ratio;
        const desc = getAspectRatioDescription(ar);
        initialDimHtml = `📐 <b>${ar}</b>`;
        initialDimTitle = `نسبة العرض للارتفاع: ${ar}${desc ? ' (' + desc + ')' : ''}`;
      } else if (item.input?.width && item.input?.height) {
        const ar = getStandardAspectRatio(item.input.width, item.input.height);
        const desc = getAspectRatioDescription(ar);
        initialDimHtml = `📐 ${ar ? '<b>' + ar + '</b> • ' : ''}${item.input.width}×${item.input.height}px`;
        initialDimTitle = `الأبعاد: ${item.input.width}×${item.input.height}px${desc ? ' | ' + desc : ''}`;
      }

      const previewMedia = item.isVideo
        ? `<video class="media-thumb-video" preload="metadata" muted playsinline src="${item.publicUrl}" onloadedmetadata="onMediaThumbLoad(this, '${item.id}')"></video>`
        : `<img class="media-thumb-img" src="${item.publicUrl}" loading="lazy" alt="${item.fileName}" onload="onMediaThumbLoad(this, '${item.id}')" onerror="this.src='https://placehold.co/400x300/18181d/71717a?text=Preview+Unavailable'">`;

      return `
        <div class="media-card" id="card-${item.id}">
          <div class="media-thumb-box" onclick="openLightbox('${item.id}')">
            <span class="media-type-badge ${typeBadgeClass}">${typeLabel} (${ext})</span>
            <span class="media-size-badge">${sizeText}</span>
            <span id="dim-float-${item.id}" class="media-dim-float">${item.input?.aspect_ratio ? '📐 ' + item.input.aspect_ratio : ''}</span>
            ${previewMedia}
            <div class="media-zoom-overlay">
              <div class="media-zoom-icon">${item.isVideo ? '▶' : '🔍'}</div>
            </div>
          </div>

          <div class="media-card-body">
            <div class="media-user-row">
              <span class="media-user-pill" title="${item.userEmail}">
                👤 ${item.userEmail}
              </span>
              <span class="media-time" title="${item.createdAt}">${formattedDate}</span>
            </div>

            <div class="media-meta-info">
              <span class="media-filename" title="${item.fileName}">${item.fileName}</span>
              <span style="font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;" title="${item.folderName}">
                📁 ${item.folderName.length > 25 ? item.folderName.slice(0, 25) + '...' : item.folderName}
              </span>
            </div>

            <!-- Economics & AI Engine & Dimensions Meta Badges -->
            <div class="media-meta-badges">
              <div class="media-badge-group">
                <span class="media-model-pill" title="محرك الذكاء الاصطناعي: ${eco.modelName} (${eco.vendor}) | كود الموديل: ${eco.modelKey}">
                  ${eco.icon} ${eco.modelName}
                </span>
                <span id="dim-text-${item.id}" class="media-dim-pill" title="${initialDimTitle}">
                  ${initialDimHtml}
                </span>
              </div>
              <div class="media-badge-group">
                <span class="media-credit-pill" title="الرصيد المخصوم من المستخدم: ${eco.credits} رصيد (ما يعادل $${eco.revenueUsd.toFixed(2)} USD)">
                  🪙 ${eco.credits} Credits
                </span>
                <span class="media-cost-pill" title="تكلفة التوليد المدفوعة لموقع Replicate: $${eco.costUsd.toFixed(3)} USD">
                  💵 Replicate: $${eco.costUsd.toFixed(3)}
                </span>
                <span class="media-margin-pill" title="هامش الربح التشغيلي: ${eco.profitMargin}%">
                  📈 ${eco.profitMargin}%
                </span>
              </div>
            </div>

            <!-- Prompt Box on every card -->
            <div class="media-prompt-box ${item.prompt ? '' : 'is-empty'}" id="prompt-box-${item.id}">
              <div class="media-prompt-header">
                <span class="media-prompt-tag ${item.prompt ? '' : 'tag-empty'}">
                  ${item.prompt ? '✨ البرومبت' : '💬 البرومبت'}
                </span>
                <div class="media-prompt-actions">
                  ${item.prompt ? `
                    <button class="btn-prompt-action" onclick="copyCardPrompt('${item.id}', this)" title="نسخ البرومبت بالكامل">
                      📋 نسخ
                    </button>
                  ` : ''}
                  <button class="btn-prompt-action ${item.prompt ? '' : 'btn-fetch-active'}" onclick="importOrEditCardPrompt('${item.id}', this)" title="${item.prompt ? 'تعديل أو إعادة استيراد البرومبت' : 'استيراد البرومبت من Replicate أو السجل أو إدخاله'}">
                    ${item.prompt ? '✏️ تعديل' : '⚡ استيراد'}
                  </button>
                </div>
              </div>
              <div class="media-prompt-body ${item.prompt ? '' : 'body-empty'}" id="prompt-text-${item.id}" title="${escapeHtml(item.prompt || 'لم يتم استيراد البرومبت بعد - انقر استيراد')}">
                ${item.prompt ? escapeHtml(item.prompt) : 'لم يتم استيراد البرومبت بعد — انقر استيراد للجلب أو التعيين'}
              </div>
            </div>

            <div class="media-actions-row">
              <button class="btn-media-action" onclick="openLightbox('${item.id}')" title="معاينة كبيرة مع تفاصيل التكلفة والمحرك والأبعاد">
                🔍 عرض
              </button>
              <button class="btn-media-action" onclick="copyMediaLink('${item.publicUrl}', this)" title="نسخ رابط Supabase العام">
                🔗 رابط
              </button>
              <button class="btn-media-action" onclick="downloadFile('${item.publicUrl}', '${item.fileName}')" title="تحميل الملف">
                📥 تحميل
              </button>
              <button class="btn-media-action btn-del" onclick="deleteStorageFile('${item.fullPath}', '${item.id}')" title="حذف نهائي من Storage">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    }

    async function openUserMediaModal(userId, userEmail) {
      const modal = document.getElementById('user-media-modal');
      const avatarEl = document.getElementById('modal-user-avatar');
      const emailEl = document.getElementById('modal-user-email');
      const idEl = document.getElementById('modal-user-id');
      const countEl = document.getElementById('modal-user-count');
      const sizeEl = document.getElementById('modal-user-size');
      const loadingEl = document.getElementById('modal-loading-state');
      const emptyEl = document.getElementById('modal-empty-state');
      const gridEl = document.getElementById('modal-gallery-grid');

      if (!modal) return;

      const displayEmail = userEmail || getUserEmail(userId);
      avatarEl.textContent = (displayEmail[0] || 'U').toUpperCase();
      emailEl.textContent = displayEmail;
      idEl.textContent = `User ID: ${userId}`;

      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      if (loadingEl) loadingEl.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';
      if (gridEl) gridEl.innerHTML = '';

      let userFiles = [];

      // 1. Check cached vault files first (already enriched with predictions & economics)
      if (cachedVaultFiles && cachedVaultFiles.length > 0) {
        userFiles = cachedVaultFiles.filter(f => f.userId === userId);
      }

      // 2. Direct RPC for this specific user if not in cache (instant & bypasses Storage RLS)
      if (userFiles.length === 0) {
        try {
          const { data: rpcFiles, error: rpcErr } = await activeClient.rpc('get_admin_storage_media', { p_user_id: userId });
          if (!rpcErr && Array.isArray(rpcFiles) && rpcFiles.length > 0) {
            userFiles = rpcFiles.map(item => {
              const parts = item.name.split('/');
              const folderName = parts.length > 2 ? parts[1] : 'root';
              const fileName = parts[parts.length - 1];
              const isVid = /\.(mp4|webm|mov)$/i.test(fileName);
              let timestamp = item.created_at || item.updated_at;
              const ghostMatch = folderName.match(/ghost-(\d+)/);
              if (ghostMatch) {
                const parsedMs = Number(ghostMatch[1]);
                if (!isNaN(parsedMs) && parsedMs > 1000000000000) {
                  timestamp = new Date(parsedMs).toISOString();
                }
              }
              return {
                id: `${userId}_${folderName}_${fileName}`,
                userId,
                userEmail: displayEmail,
                folderName,
                fileName,
                fullPath: item.name,
                publicUrl: `${SUPABASE_URL}/storage/v1/object/public/generated-images/${item.name}`,
                size: item.size || 0,
                createdAt: timestamp || new Date().toISOString(),
                isVideo: isVid,
                prompt: null,
                model: null,
                input: null,
                creditAmount: null,
              };
            });
          }
        } catch (rpcEx) {
          console.warn('RPC in openUserMediaModal error:', rpcEx);
        }
      }

      // 3. Fallback: try direct crawl for this specific userId
      if (userFiles.length === 0) {
        try {
          const { data: subFolders } = await activeClient.storage
            .from('generated-images')
            .list(userId, { limit: 100, sortBy: { column: 'name', order: 'desc' } });

          if (subFolders && subFolders.length > 0) {
            for (const sub of subFolders) {
              if (!sub.id || sub.id === null || !sub.metadata?.size) {
                const nodeFolder = sub.name;
                const { data: files } = await activeClient.storage
                  .from('generated-images')
                  .list(`${userId}/${nodeFolder}`, { limit: 50 });

                if (files && files.length > 0) {
                  for (const f of files) {
                    const fullPath = `${userId}/${nodeFolder}/${f.name}`;
                    const { data: { publicUrl } } = activeClient.storage.from('generated-images').getPublicUrl(fullPath);
                    const isVid = /\.(mp4|webm|mov)$/i.test(f.name);
                    let timestamp = f.created_at || f.updated_at;
                    const ghostMatch = nodeFolder.match(/ghost-(\d+)/);
                    if (ghostMatch) {
                      const parsedMs = Number(ghostMatch[1]);
                      if (!isNaN(parsedMs) && parsedMs > 1000000000000) {
                        timestamp = new Date(parsedMs).toISOString();
                      }
                    }
                    userFiles.push({
                      id: `${userId}_${nodeFolder}_${f.name}`,
                      userId,
                      userEmail: displayEmail,
                      folderName: nodeFolder,
                      fileName: f.name,
                      fullPath,
                      publicUrl,
                      size: f.metadata?.size || 0,
                      createdAt: timestamp || new Date().toISOString(),
                      isVideo: isVid,
                      prompt: null,
                      model: null,
                      input: null,
                      creditAmount: null,
                    });
                  }
                }
              }
            }
          }
        } catch (crawlErr) {
          console.warn('Direct crawl in modal error:', crawlErr);
        }
      }

      if (loadingEl) loadingEl.style.display = 'none';

      const totalBytes = userFiles.reduce((sum, f) => sum + (f.size || 0), 0);
      countEl.textContent = `${userFiles.length} ملفات`;
      sizeEl.textContent = formatFileSize(totalBytes);

      if (userFiles.length === 0) {
        if (emptyEl) {
          emptyEl.style.display = 'block';
          emptyEl.innerHTML = `
            <div style="font-size: 28px; margin-bottom: 8px;">📂</div>
            <div style="font-weight: 700; color: #fff; font-size: 14px; margin-bottom: 4px;">
              لم يتم العثور على وسائط معروضة لهذا المستخدم حالياً
            </div>
            <div style="color: var(--text-muted); font-size: 12.5px; line-height: 1.5; max-width: 600px; margin: 0 auto;">
              إذا كان للمستخدم ملفات في مجلد <code>${userId.slice(0, 16)}...</code>، فإن قيود أمان Supabase (Storage RLS) تتطلب تفعيل صلاحية الاستعراض.
            </div>
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 14px; margin: 16px auto 0; max-width: 640px; text-align: right; direction: rtl; color: #fbbf24; font-size: 12.5px;">
              ⚡ <b>طريقة التفعيل بضغطة واحدة:</b><br>
              انسخ سكربت SQL الخاص بقراءة Storage وألصقه في <b>Supabase Dashboard > SQL Editor</b> واضغط Run:
              <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: flex-start;">
                <button class="btn btn-secondary" onclick="copyStorageSqlCode(this)" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); font-weight: 700; font-size: 12px; padding: 7px 14px;">
                  📋 نسخ كود SQL لـ Supabase
                </button>
                <button class="btn btn-secondary" onclick="loadVaultMedia(true).then(() => openUserMediaModal('${userId}', '${displayEmail}'))" style="font-size: 12px; padding: 7px 14px;">
                  🔄 إعادة فحص الملفات
                </button>
              </div>
            </div>
          `;
        }
      } else {
        if (emptyEl) emptyEl.style.display = 'none';
        window.currentUserModalFiles = userFiles;
        renderVaultGrid(userFiles, 'modal-gallery-grid', 'modal-empty-state');
      }
    }

    function closeUserMediaModal() {
      const modal = document.getElementById('user-media-modal');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }

    function handleModalBackdropClick(e) {
      if (e.target.id === 'user-media-modal') {
        closeUserMediaModal();
      }
    }

    function openLightbox(itemId) {
      let item = cachedVaultFiles.find(f => f.id === itemId);
      if (!item && window.currentUserModalFiles) {
        item = window.currentUserModalFiles.find(f => f.id === itemId);
      }
      if (!item) return;

      currentLightboxItem = item;
      const modal = document.getElementById('lightbox-modal');
      const container = document.getElementById('lightbox-media-container');
      const filenameEl = document.getElementById('lb-filename');
      const metaEl = document.getElementById('lb-meta');
      const econStrip = document.getElementById('lb-econ-strip');

      filenameEl.textContent = item.fileName;
      metaEl.textContent = `${getUserEmail(item.userId)} • ${formatFileSize(item.size)} • ${new Date(item.createdAt).toLocaleString()}`;

      // Populate economics strip
      const eco = item._resolvedEco || resolveModelEconomics(item, item.width, item.height);
      if (econStrip) {
        let dimLabel = item.input?.aspect_ratio ? `📐 ${item.input.aspect_ratio}` : '📐 جاري القياس...';
        econStrip.style.display = 'flex';
        econStrip.innerHTML = `
          <span class="media-model-pill" style="font-size: 12px; padding: 4px 10px;" title="محرك الذكاء الاصطناعي: ${eco.modelName} (${eco.vendor}) | كود الموديل: ${eco.modelKey}">
            ${eco.icon} <b>المحرك:</b> ${eco.modelName} (${eco.vendor})
          </span>
          <span id="lb-dim-pill" class="media-dim-pill" style="font-size: 12px; padding: 4px 10px;" title="أبعاد الصورة ونسبة العرض">
            ${dimLabel}
          </span>
          <span class="media-credit-pill" style="font-size: 12px; padding: 4px 10px;" title="الرصيد المخصوم من المستخدم">
            🪙 <b>الخصم:</b> ${eco.credits} رصيد ($${eco.revenueUsd.toFixed(2)})
          </span>
          <span class="media-cost-pill" style="font-size: 12px; padding: 4px 10px;" title="التكلفة الفعلية المدفوعة لموقع Replicate">
            💵 <b>تكلفة Replicate:</b> $${eco.costUsd.toFixed(3)} USD
          </span>
          <span class="media-margin-pill" style="font-size: 12px; padding: 4px 10px;" title="هامش الربح التشغيلي">
            📈 <b>الربحية:</b> ${eco.profitMargin}% هامش
          </span>
          <div id="lb-prompt-container" style="flex-basis: 100%; margin-top: 8px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(245, 158, 11, 0.35); padding: 10px 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11.5px; font-weight: 700; color: #fbbf24; display: flex; align-items: center; gap: 4px;">
                ✨ <b>البرومبت المكتوب / Prompt:</b>
              </span>
              <div style="display: flex; gap: 6px;">
                ${item.prompt ? `
                  <button class="mini-btn" onclick="copyCardPrompt('${item.id}', this)" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); font-size: 11px; padding: 4px 10px; font-weight: 600;">
                    📋 نسخ البرومبت
                  </button>
                ` : ''}
                <button class="mini-btn" onclick="importOrEditCardPrompt('${item.id}', this)" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); font-size: 11px; padding: 4px 10px; font-weight: 600;">
                  ${item.prompt ? '✏️ تعديل' : '⚡ استيراد البرومبت'}
                </button>
              </div>
            </div>
            <div id="lb-prompt-text" style="font-size: 12px; line-height: 1.5; color: #f8fafc; max-height: 120px; overflow-y: auto; word-break: break-word; scrollbar-width: thin;">
              ${item.prompt ? escapeHtml(item.prompt) : '<span style="color: var(--text-muted); font-style: italic;">لم يتم استيراد البرومبت بعد — انقر على "استيراد البرومبت" لجلبه أو كتابته</span>'}
            </div>
          </div>
        `;
      }

      if (item.isVideo) {
        container.innerHTML = `<video class="lightbox-media" controls autoplay playsinline src="${item.publicUrl}" onloadedmetadata="onLightboxMediaLoad(this)"></video>`;
      } else {
        container.innerHTML = `<img class="lightbox-media" src="${item.publicUrl}" alt="${item.fileName}" onload="onLightboxMediaLoad(this)">`;
      }

      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      const modal = document.getElementById('lightbox-modal');
      const container = document.getElementById('lightbox-media-container');
      if (container) container.innerHTML = '';
      if (modal) modal.style.display = 'none';
      currentLightboxItem = null;

      const userModal = document.getElementById('user-media-modal');
      if (!userModal || userModal.style.display !== 'flex') {
        document.body.style.overflow = 'auto';
      }
    }

    function handleLightboxBackdropClick(e) {
      if (e.target.id === 'lightbox-modal') {
        closeLightbox();
      }
    }

    function copyLightboxUrl(btn) {
      if (currentLightboxItem?.publicUrl) {
        copyMediaLink(currentLightboxItem.publicUrl, btn);
      }
    }

    function downloadLightboxFile() {
      if (currentLightboxItem) {
        downloadFile(currentLightboxItem.publicUrl, currentLightboxItem.fileName);
      }
    }

    async function copyMediaLink(url, btnElement) {
      try {
        await navigator.clipboard.writeText(url);
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = '✅ Copied!';
        btnElement.style.color = '#34d399';
        setTimeout(() => {
          btnElement.innerHTML = originalText;
          btnElement.style.color = '';
        }, 1800);
      } catch (err) {
        prompt('Copy media link:', url);
      }
    }

    function downloadFile(url, filename) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = filename || 'media_file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    async function deleteStorageFile(fullPath, itemId) {
      const confirmed = confirm(`هل أنت متأكد من حذف هذا الملف نهائياً من Supabase Storage؟\n\n${fullPath}`);
      if (!confirmed) return;

      try {
        let deleted = false;
        try {
          const { data: res, error } = await activeClient.rpc('delete_admin_storage_file', { p_file_path: fullPath });
          if (!error && res === true) deleted = true;
        } catch (e) {
          console.warn('RPC delete fallback:', e);
        }

        if (!deleted) {
          const { error } = await activeClient.storage.from('generated-images').remove([fullPath]);
          if (error) throw error;
        }

        cachedVaultFiles = cachedVaultFiles.filter(f => f.id !== itemId && f.fullPath !== fullPath);
        handleVaultFilter();

        const userModal = document.getElementById('user-media-modal');
        if (userModal && userModal.style.display === 'flex') {
          const activeUserId = document.getElementById('modal-user-id')?.textContent.replace('User ID: ', '').trim();
          if (activeUserId) {
            const userFiles = cachedVaultFiles.filter(f => f.userId === activeUserId);
            renderVaultGrid(userFiles, 'modal-gallery-grid', 'modal-empty-state');
          }
        }
      } catch (err) {
        alert('فشل حذف الملف من Storage: ' + (err.message || err));
      }
    }

async function copyStorageSqlCode(btn) {
      try {
        await navigator.clipboard.writeText(STORAGE_SQL_SCRIPT);
        const orig = btn.innerHTML;
        btn.innerHTML = '✅ تم نسخ كود SQL بنجاح!';
        btn.style.color = '#34d399';
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.style.color = '';
        }, 2500);
      } catch (e) {
        prompt('انسخ كود SQL التالي:', STORAGE_SQL_SCRIPT);
      }
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const lb = document.getElementById('lightbox-modal');
        if (lb && lb.style.display === 'flex') {
          closeLightbox();
          return;
        }
        const um = document.getElementById('user-media-modal');
        if (um && um.style.display === 'flex') {
          closeUserMediaModal();
        }
      }
    });

