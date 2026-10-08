// Anarchy AI Admin Dashboard - Vault Prompts Management & Resolution
// Handles prompt caching, fetching, editing, batch importing, and prompt modals.

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
          const val = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(val)) {
            val.forEach(item => {
              const p = item.prompt || item.promptDraft || item.input?.prompt;
              if (p) {
                if (item.id) map.set(item.id, p);
                if (item.predictionId) map.set(item.predictionId, p);
                if (item.nodeId) map.set(item.nodeId, p);
                if (item.imageUrl) {
                  const m = item.imageUrl.match(/([a-zA-Z0-9_-]+)\.[a-zA-Z0-9]+$/);
                  if (m) map.set(m[1], p);
                }
              }
            });
          } else if (val && typeof val === 'object') {
            const p = val.prompt || val.promptDraft || val.input?.prompt;
            if (p) {
              if (val.id) map.set(val.id, p);
              if (val.predictionId) map.set(val.predictionId, p);
              if (val.nodeId) map.set(val.nodeId, p);
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Could not read browser history prompts:', e);
  }
  return map;
}

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
        window._modelSelectUpdateTimeout = setTimeout(() => {
          if (typeof populateVaultModelSelect === 'function') populateVaultModelSelect();
        }, 400);
      }
    }
  } catch (e) {
    console.warn('on-demand prediction fetch error:', predId, e);
  }
}

async function resolvePromptForItem(item) {
  if (!item) return null;
  const cached = getCachedPrompt(item);
  if (cached) return cached;

  const predId = item.fileName.replace(/\.[^/.]+$/, '');
  const folder = item.folderName || '';

  if (window.vaultPredictionsMap) {
    const p = window.vaultPredictionsMap.get(predId) || window.vaultPredictionsMap.get(folder);
    if (p) {
      const pr = p.prompt || p.input?.prompt || p.input?.prompt_template || null;
      if (pr) {
        savePromptToCache(item.fileName, pr);
        return pr;
      }
    }
  }

  // 1. Try fetching from replicate_predictions via direct table query
  try {
    const { data: rows } = await activeClient
      .from('replicate_predictions')
      .select('prompt, input')
      .or(`replicate_id.eq.${predId},node_id.eq.${folder}`)
      .limit(1);

    if (rows && rows.length > 0) {
      const p = rows[0].prompt || rows[0].input?.prompt || rows[0].input?.prompt_template;
      if (p) {
        savePromptToCache(item.fileName, p);
        savePromptToCache(predId, p);
        return p;
      }
    }
  } catch (e) {}

  // 2. Try fetching from credit_transactions metadata
  try {
    const { data: txRows } = await activeClient
      .from('credit_transactions')
      .select('metadata')
      .or(`metadata->>replicate_id.eq.${predId},metadata->>node_id.eq.${folder}`)
      .limit(1);

    if (txRows && txRows.length > 0) {
      const meta = txRows[0].metadata;
      const p = meta?.prompt || meta?.input?.prompt;
      if (p) {
        savePromptToCache(item.fileName, p);
        savePromptToCache(predId, p);
        return p;
      }
    }
  } catch (e) {}

  // 3. Fallback: Query Replicate directly via proxy
  if (predId && predId.length > 15) {
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
        const pred = await res.json();
        const p = pred?.prompt || pred?.input?.prompt || pred?.input?.prompt_template;
        if (p) {
          savePromptToCache(item.fileName, p);
          savePromptToCache(predId, p);
          return p;
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
    const oldText = btn.innerHTML;
    btn.innerHTML = 'تم النسخ ✓';
    btn.style.color = '#34d399';
    setTimeout(() => {
      btn.innerHTML = oldText;
      btn.style.color = '';
    }, 2000);
  }).catch(() => {
    prompt('Copy prompt:', text);
  });
}

async function importOrEditCardPrompt(itemId, btn) {
  let item = cachedVaultFiles.find(f => f.id === itemId);
  if (!item && window.currentUserModalFiles) {
    item = window.currentUserModalFiles.find(f => f.id === itemId);
  }
  if (!item) return;

  // If prompt is already present, open edit modal
  if (!item.prompt) {
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '🔄 فحص...';
    const resolved = await resolvePromptForItem(item);
    btn.disabled = false;
    btn.innerHTML = oldHtml;
    if (resolved) {
      updateCardPromptUI(itemId, resolved);
      return;
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
  const text = textarea ? textarea.value.trim() : '';

  const item = currentPromptModalItem;
  item.prompt = text || null;

  savePromptToCache(item.fileName, text);
  const predId = item.fileName.replace(/\.[^/.]+$/, '');
  savePromptToCache(predId, text);
  if (item.folderName) savePromptToCache(item.folderName, text);
  savePromptToCache(item.id, text);

  updateCardPromptUI(item.id, text);

  if (currentLightboxItem && currentLightboxItem.id === item.id) {
    currentLightboxItem.prompt = text;
    const lbPromptText = document.getElementById('lb-prompt-text');
    if (lbPromptText) {
      lbPromptText.innerHTML = text ? escapeHtml(text) : '<span style="color: var(--text-muted); font-style: italic;">لم يتم استيراد البرومبت بعد</span>';
    }
  }

  closePromptModal();
}

async function fetchOnlinePromptForModal() {
  if (!currentPromptModalItem) return;
  const item = currentPromptModalItem;
  const btn = document.getElementById('btn-modal-fetch-online');
  const spinner = document.getElementById('modal-fetch-spinner');
  const textarea = document.getElementById('prompt-modal-textarea');

  if (btn) btn.disabled = true;
  if (spinner) spinner.innerHTML = '⏳';

  try {
    const resolved = await resolvePromptForItem(item);
    if (resolved && textarea) {
      textarea.value = resolved;
      updatePromptModalCharCount();
      alert('تم استيراد البرومبت بنجاح من قاعدة البيانات / Replicate!');
    } else {
      alert('لم يتم العثور على برومبت مسجل لهذا المعرف. يمكنك كتابته يدوياً ثم الضغط على "حفظ وتطبيق".');
    }
  } catch (err) {
    alert('تعذر استيراد البرومبت: ' + (err.message || err));
  } finally {
    if (btn) btn.disabled = false;
    if (spinner) spinner.innerHTML = '🔄';
  }
}

async function importAllPrompts(btn) {
  if (!cachedVaultFiles || cachedVaultFiles.length === 0) {
    alert('يرجى تحميل الملفات أولاً قبل استيراد البرومبتات.');
    return;
  }

  const icon = document.getElementById('import-prompts-icon');
  const statusEl = document.getElementById('vault-status-text');

  if (btn) btn.disabled = true;
  if (icon) icon.style.animation = 'spin 1s linear infinite';
  if (statusEl) statusEl.innerHTML = 'جاري استيراد البرومبتات من قاعدة البيانات و Replicate...';

  let importedCount = 0;
  let checkedCount = 0;

  try {
    if (window.vaultPredictionsMap.size < 10) {
      try {
        let urlPath = '/predictions?limit=100';
        for (let page = 0; page < 5; page++) {
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
        savePromptToCache(item.fileName, item.prompt);
      }
    }

    if (typeof handleVaultFilter === 'function') handleVaultFilter();

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
