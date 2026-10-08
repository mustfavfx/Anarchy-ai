// Anarchy AI Admin Dashboard - Core Vault Gallery Controller
// Handles gallery rendering, thumbnail load measurement, filtering by user/model/type, and Supabase Storage crawling.

function onMediaThumbLoad(el, itemId) {
  if (!el) return;
  const w = el.naturalWidth || el.videoWidth;
  const h = el.naturalHeight || el.videoHeight;
  if (!w || !h) return;

  const item = cachedVaultFiles.find(f => f.id === itemId);
  if (item) {
    item.width = w;
    item.height = h;

    // If prediction details or prompt were not loaded initially, resolve by prediction ID from Replicate on-demand
    if (!item.model || !item.prompt) {
      const predId = item.fileName.replace(/\.[^/.]+$/, '');
      if (typeof resolvePredictionOnDemand === 'function') {
        resolvePredictionOnDemand(predId, item, itemId);
      }
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
    const browserHistoryPrompts = typeof getPromptsFromBrowserHistory === 'function' ? getPromptsFromBrowserHistory() : new Map();

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

          const cachedPrompt = typeof getCachedPrompt === 'function' ? getCachedPrompt({ fileName, folderName, id: `${userId}_${folderName}_${fileName}` }) : null;
          const historyPrompt = browserHistoryPrompts.get(folderName) || browserHistoryPrompts.get(predId) || browserHistoryPrompts.get(fileName) || null;
          let resolvedPrompt = cachedPrompt || historyPrompt || pred?.prompt || pred?.input?.prompt || pred?.input?.prompt_template || item.prompt || null;
          if (resolvedPrompt && typeof savePromptToCache === 'function') {
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

                    const cachedPrompt = typeof getCachedPrompt === 'function' ? getCachedPrompt({ fileName: f.name, folderName: nodeFolder, id: `${userId}_${nodeFolder}_${f.name}` }) : null;
                    const historyPrompt = browserHistoryPrompts.get(nodeFolder) || browserHistoryPrompts.get(predId) || browserHistoryPrompts.get(f.name) || null;
                    let resolvedPrompt = cachedPrompt || historyPrompt || pred?.prompt || pred?.input?.prompt || pred?.input?.prompt_template || null;
                    if (resolvedPrompt && typeof savePromptToCache === 'function') {
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

  const safePromptEscaped = typeof escapeHtml === 'function' ? escapeHtml(item.prompt || '') : (item.prompt || '');

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
          <div class="media-prompt-body ${item.prompt ? '' : 'body-empty'}" id="prompt-text-${item.id}" title="${safePromptEscaped || 'لم يتم استيراد البرومبت بعد - انقر استيراد'}">
            ${item.prompt ? safePromptEscaped : 'لم يتم استيراد البرومبت بعد — انقر استيراد للجلب أو التعيين'}
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
