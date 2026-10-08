// Anarchy AI Admin Dashboard - Vault Lightbox, Modals & Media Actions
// Handles lightbox viewer, user media modal, file download, copy link, and deletion.

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

  loadingEl.style.display = 'flex';
  emptyEl.style.display = 'none';
  gridEl.innerHTML = '';

  try {
    let userFiles = [];
    if (cachedVaultFiles && cachedVaultFiles.length > 0) {
      userFiles = cachedVaultFiles.filter(f => f.userId === userId);
    }

    if (userFiles.length === 0) {
      try {
        const { data: rpcFiles, error: rpcErr } = await activeClient.rpc('get_admin_storage_media', { p_user_id: userId });
        if (!rpcErr && Array.isArray(rpcFiles) && rpcFiles.length > 0) {
          userFiles = rpcFiles.map(item => {
            const fullPath = item.name;
            const parts = fullPath.split('/');
            const folderName = parts.length > 2 ? parts[1] : 'root';
            const fileName = parts[parts.length - 1];
            const isVid = /\.(mp4|webm|mov)$/i.test(fileName);
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fullPath}`;

            const predId = fileName.replace(/\.[^/.]+$/, '');
            const pred = window.vaultPredictionsMap ? (window.vaultPredictionsMap.get(predId) || window.vaultPredictionsMap.get(folderName)) : null;

            return {
              id: `${userId}_${folderName}_${fileName}`,
              userId,
              userEmail: displayEmail,
              folderName,
              fileName,
              fullPath,
              publicUrl,
              isVideo: isVid,
              size: item.size || 0,
              createdAt: item.created_at || new Date().toISOString(),
              mimetype: item.mimetype,
              prompt: item.prompt || pred?.prompt || pred?.input?.prompt || getCachedPrompt({ fileName, folderName }) || null,
              model: item.model || pred?.model || null,
              metrics: pred?.metrics,
              input: item.input || pred?.input,
              replicateId: pred?.replicate_id || predId,
            };
          });
        }
      } catch (rpcEx) {
        console.warn('Modal RPC fetch fallback:', rpcEx);
      }
    }

    if (userFiles.length === 0) {
      const { data: folders, error: fErr } = await activeClient.storage
        .from('generated-images')
        .list(userId, { limit: 100 });

      if (!fErr && folders) {
        for (const item of folders) {
          if (item.id === null) {
            const { data: subFiles } = await activeClient.storage
              .from('generated-images')
              .list(`${userId}/${item.name}`, { limit: 100 });

            if (subFiles) {
              subFiles.forEach(sf => {
                if (sf.id !== null) {
                  const fullPath = `${userId}/${item.name}/${sf.name}`;
                  const isVid = /\.(mp4|webm|mov)$/i.test(sf.name);
                  const predId = sf.name.replace(/\.[^/.]+$/, '');
                  const pred = window.vaultPredictionsMap ? (window.vaultPredictionsMap.get(predId) || window.vaultPredictionsMap.get(item.name)) : null;

                  userFiles.push({
                    id: `${userId}_${item.name}_${sf.name}`,
                    userId,
                    userEmail: displayEmail,
                    folderName: item.name,
                    fileName: sf.name,
                    fullPath,
                    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/generated-images/${fullPath}`,
                    isVideo: isVid,
                    size: sf.metadata?.size || 0,
                    createdAt: sf.created_at || sf.updated_at,
                    mimetype: sf.metadata?.mimetype,
                    prompt: pred?.prompt || pred?.input?.prompt || getCachedPrompt({ fileName: sf.name, folderName: item.name }) || null,
                    model: pred?.model || null,
                    metrics: pred?.metrics,
                    input: pred?.input,
                    replicateId: pred?.replicate_id || predId,
                  });
                }
              });
            }
          } else {
            const fullPath = `${userId}/${item.name}`;
            const isVid = /\.(mp4|webm|mov)$/i.test(item.name);
            const predId = item.name.replace(/\.[^/.]+$/, '');
            const pred = window.vaultPredictionsMap ? window.vaultPredictionsMap.get(predId) : null;

            userFiles.push({
              id: `${userId}_root_${item.name}`,
              userId,
              userEmail: displayEmail,
              folderName: 'root',
              fileName: item.name,
              fullPath,
              publicUrl: `${SUPABASE_URL}/storage/v1/object/public/generated-images/${fullPath}`,
              isVideo: isVid,
              size: item.metadata?.size || 0,
              createdAt: item.created_at || item.updated_at,
              mimetype: item.metadata?.mimetype,
              prompt: pred?.prompt || pred?.input?.prompt || getCachedPrompt({ fileName: item.name }) || null,
              model: pred?.model || null,
              metrics: pred?.metrics,
              input: pred?.input,
              replicateId: pred?.replicate_id || predId,
            });
          }
        }
      }
    }

    userFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    window.currentUserModalFiles = userFiles;

    const totalBytes = userFiles.reduce((acc, cur) => acc + (cur.size || 0), 0);
    countEl.textContent = `${userFiles.length} عنصر`;
    sizeEl.textContent = formatFileSize(totalBytes);

    loadingEl.style.display = 'none';

    if (userFiles.length === 0) {
      emptyEl.style.display = 'flex';
    } else {
      emptyEl.style.display = 'none';
      if (typeof renderVaultGrid === 'function') {
        renderVaultGrid(userFiles, 'modal-gallery-grid', 'modal-empty-state');
      }
    }
  } catch (err) {
    console.error('Error fetching user media:', err);
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    emptyEl.innerHTML = `<span style="font-size: 32px;">⚠️</span><p>فشل جلب ملفات المستخدم: ${err.message || err}</p>`;
  }
}

function closeUserMediaModal() {
  const modal = document.getElementById('user-media-modal');
  if (modal) modal.style.display = 'none';
  window.currentUserModalFiles = [];
  const lbModal = document.getElementById('lightbox-modal');
  if (!lbModal || lbModal.style.display !== 'flex') {
    document.body.style.overflow = 'auto';
  }
}

function handleModalBackdropClick(e) {
  if (e.target.id === 'user-media-modal') {
    closeUserMediaModal();
  }
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
    if (typeof handleVaultFilter === 'function') handleVaultFilter();

    const userModal = document.getElementById('user-media-modal');
    if (userModal && userModal.style.display === 'flex') {
      const activeUserId = document.getElementById('modal-user-id')?.textContent.replace('User ID: ', '').trim();
      if (activeUserId) {
        const userFiles = cachedVaultFiles.filter(f => f.userId === activeUserId);
        if (typeof renderVaultGrid === 'function') {
          renderVaultGrid(userFiles, 'modal-gallery-grid', 'modal-empty-state');
        }
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

// Global keyboard shortcuts for modals
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
      return;
    }
    const pm = document.getElementById('prompt-modal');
    if (pm && pm.style.display === 'flex') {
      if (typeof closePromptModal === 'function') closePromptModal();
    }
  }
});
