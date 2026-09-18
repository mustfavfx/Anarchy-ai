// Anarchy AI Admin Dashboard - Financial Economics & Subscribers Ledger
async function fetchSubscribersData(isSilent = false) {
      const refreshIcon = document.getElementById('refresh-icon');
      if (!isSilent) {
        refreshIcon.style.display = 'inline-block';
        refreshIcon.style.animation = 'spin 0.8s linear infinite';
      }

      try {
        const isServiceKey = !!localStorage.getItem('anarchy_service_key');

        if (isServiceKey) {
          // Direct Admin Fetch via Service Key
          const [usersRes, creditsRes, sessionsRes] = await Promise.all([
            activeClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
            activeClient.from('user_credits').select('*'),
            activeClient.from('stripe_sessions').select('*'),
          ]);

          if (usersRes.error) throw usersRes.error;

          const users = usersRes.data?.users || [];
          const credits = creditsRes.data || [];
          const sessions = (sessionsRes.data || []).filter(s => s.status === 'completed');

          // Map credits by user_id
          const creditsMap = new Map();
          credits.forEach(c => creditsMap.set(c.user_id, c));

          // Map sessions by user_id
          const sessionsMap = new Map();
          sessions.forEach(s => {
            if (!sessionsMap.has(s.user_id)) sessionsMap.set(s.user_id, []);
            sessionsMap.get(s.user_id).push(s);
          });

          // Build subscriber records
          const subscribers = users.map(u => {
            const c = creditsMap.get(u.id) || {};
            const uSessions = sessionsMap.get(u.id) || [];
            const totalPaid = uSessions.reduce((sum, s) => sum + (Number(s.amount_cents || 0) / 100), 0);

            let lastPurchase = c.last_purchase_at || null;
            if (uSessions.length > 0) {
              const sorted = [...uSessions].sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));
              lastPurchase = sorted[0].completed_at || sorted[0].created_at || lastPurchase;
            }

            // Calculate most recent activity timestamp across:
            // 1. user_credits.updated_at (updated on every AI generation/upscale/credit debit)
            // 2. auth.users.last_sign_in_at (last user login)
            // 3. lastPurchase
            // 4. created_at
            const activityDates = [
              c.updated_at ? new Date(c.updated_at).getTime() : 0,
              u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0,
              lastPurchase ? new Date(lastPurchase).getTime() : 0,
              u.created_at ? new Date(u.created_at).getTime() : 0,
            ].filter(t => t > 0 && !isNaN(t));

            const lastActiveAt = activityDates.length > 0 ? new Date(Math.max(...activityDates)).toISOString() : null;

            return {
              user_id: u.id,
              email: u.email || 'No email',
              created_at: u.created_at,
              last_sign_in_at: u.last_sign_in_at,
              last_active_at: lastActiveAt,
              balance: Number(c.balance || 0),
              total_purchased: Number(c.total_purchased || 0),
              total_used: Number(c.total_used || 0),
              total_paid_usd: Math.round(totalPaid * 100) / 100,
              payments_count: uSessions.length,
              last_purchase_at: lastPurchase,
            };
          });

          // Calculate aggregate metrics
          const totalRevenue = sessions.reduce((sum, s) => sum + (Number(s.amount_cents || 0) / 100), 0);
          const payingCount = new Set(sessions.map(s => s.user_id)).size;
          const totalCreditsBalance = credits.reduce((sum, c) => sum + Number(c.balance || 0), 0);
          const totalCreditsPurchased = credits.reduce((sum, c) => sum + Number(c.total_purchased || 0), 0);
          const totalCreditsUsed = credits.reduce((sum, c) => sum + Number(c.total_used || 0), 0);

          rawData = {
            stats: {
              total_users: users.length,
              paying_users: payingCount,
              total_revenue_usd: Math.round(totalRevenue * 100) / 100,
              total_credits_balance: totalCreditsBalance,
              total_credits_purchased: totalCreditsPurchased,
              total_credits_used: totalCreditsUsed,
            },
            subscribers: subscribers.sort((a, b) => {
              const timeA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
              const timeB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
              return timeB - timeA;
            }),
          };

          renderKPIs(rawData.stats);
          handleFilter();
          return;
        }

        // Fallback: Execute RPC
        const { data, error } = await activeClient.rpc('get_admin_subscribers');
        if (error) throw error;

        if (data?.subscribers) {
          data.subscribers.forEach(sub => {
            if (!sub.last_active_at) {
              const dates = [
                sub.last_sign_in_at ? new Date(sub.last_sign_in_at).getTime() : 0,
                sub.last_purchase_at ? new Date(sub.last_purchase_at).getTime() : 0,
                sub.created_at ? new Date(sub.created_at).getTime() : 0,
              ].filter(t => t > 0 && !isNaN(t));
              sub.last_active_at = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : sub.created_at;
            }
          });
        }

        rawData = data;
        renderKPIs(data.stats);
        handleFilter();
      } catch (err) {
        console.error('Failed to load admin subscribers:', err);
        const tbody = document.getElementById('subscribers-tbody');
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state" style="color: #fb7185;">
              ⚠️ Error fetching subscriber data: ${err.message}<br><br>
              <small style="color: var(--text-muted);">
                Make sure the service key is valid and has read permissions.
              </small>
            </td>
          </tr>
        `;
      } finally {
        refreshIcon.style.animation = 'none';
      }
    }

    function renderKPIs(stats) {
      if (!stats) return;

      const totalRevenue = Number(stats.total_revenue_usd || 0);
      const totalCreditsUsed = Number(stats.total_credits_used || 0);
      const totalCreditsBalance = Number(stats.total_credits_balance || 0);

      // 1. Stripe Inflow & Fees Calculation (Stripe: 2.9% + $0.30)
      const paymentsCount = rawData?.subscribers?.reduce((acc, s) => acc + (s.payments_count || 0), 0) || 0;
      const stripeFees = totalRevenue > 0 
        ? Math.round(((totalRevenue * 0.029) + (paymentsCount * 0.30)) * 100) / 100 
        : 0;
      const stripeNet = Math.max(0, Math.round((totalRevenue - stripeFees) * 100) / 100);

      // 2. Replicate Outflow Calculation (Average cost per credit consumed: $0.055)
      const replicateCost = Math.round((totalCreditsUsed * 0.055) * 100) / 100;

      // 3. Replicate Prepaid Wallet Tracker
      const replicateDeposit = Number(localStorage.getItem('anarchy_replicate_deposit') || 50);
      const replicateRemaining = Math.max(0, Math.round((replicateDeposit - replicateCost) * 100) / 100);

      // 4. Net Profit Calculation
      const netProfit = Math.round((totalRevenue - stripeFees - replicateCost) * 100) / 100;
      const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

      // Financial Pulse Cards
      document.getElementById('f-stripe-gross').textContent = `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      document.getElementById('f-stripe-net').textContent = `صافي بعد رسوم Stripe ($${stripeFees}): $${stripeNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

      document.getElementById('f-replicate-cost').textContent = `$${replicateCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      document.getElementById('f-replicate-info').textContent = `تكلفة ${totalCreditsUsed.toLocaleString()} كريدت مستهلك في AI`;

      document.getElementById('f-net-profit').textContent = `$${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      document.getElementById('f-net-profit').className = netProfit >= 0 ? 'card-value green' : 'card-value orange';
      document.getElementById('f-margin-badge').textContent = `${marginPct}% Margin`;
      document.getElementById('f-margin-badge').className = netProfit >= 0 ? 'card-badge badge-green' : 'card-badge badge-orange';
      document.getElementById('f-profit-sub').textContent = `دخل $${totalRevenue} - ربلكيت $${replicateCost} - عمولة $${stripeFees}`;

      document.getElementById('f-replicate-remaining').textContent = `$${replicateRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      document.getElementById('f-replicate-deposit-info').textContent = `شحنت $${replicateDeposit} | استهلك $${replicateCost}`;

      // Revenue Split Bar
      if (totalRevenue > 0) {
        const profitRatio = Math.max(0, (netProfit / totalRevenue) * 100);
        const repRatio = Math.min(100, (replicateCost / totalRevenue) * 100);
        const stripeRatio = Math.min(100, (stripeFees / totalRevenue) * 100);

        document.getElementById('split-bar-profit').style.width = `${profitRatio}%`;
        document.getElementById('split-bar-replicate').style.width = `${repRatio}%`;
        document.getElementById('split-bar-stripe').style.width = `${stripeRatio}%`;

        document.getElementById('split-summary-text').textContent = 
          `صافي الربح: ${profitRatio.toFixed(1)}% | تكلفة Replicate: ${repRatio.toFixed(1)}% | عمولة Stripe: ${stripeRatio.toFixed(1)}%`;
      } else {
        document.getElementById('split-bar-profit').style.width = '0%';
        document.getElementById('split-bar-replicate').style.width = '0%';
        document.getElementById('split-bar-stripe').style.width = '0%';
        document.getElementById('split-summary-text').textContent = 'لا توجد مبيعات مكتملة بعد لحساب النسب';
      }

      // Standard Engagement Cards
      document.getElementById('kpi-users').textContent = Number(stats.total_users || 0).toLocaleString();
      document.getElementById('kpi-paying').textContent = Number(stats.paying_users || 0).toLocaleString();
      
      const convRate = stats.total_users > 0 
        ? ((stats.paying_users / stats.total_users) * 100).toFixed(1) 
        : 0;
      document.getElementById('kpi-conversion').textContent = `${convRate}% conversion rate`;

      document.getElementById('kpi-credits').textContent = totalCreditsBalance.toLocaleString();
      document.getElementById('kpi-credits-used').textContent = totalCreditsUsed.toLocaleString();
    }

    function promptReplicateDeposit() {
      const current = localStorage.getItem('anarchy_replicate_deposit') || 50;
      const input = prompt('كم المبلغ الكلي الذي شحنته في رصيد Replicate بالدولار؟ ($)', current);
      if (input !== null && !isNaN(Number(input))) {
        localStorage.setItem('anarchy_replicate_deposit', Number(input));
        if (rawData?.stats) renderKPIs(rawData.stats);
      }
    }

    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
      });
      handleFilter();
    }

    function handleFilter() {
      if (!rawData?.subscribers) return;

      const query = document.getElementById('search-input').value.toLowerCase().trim();
      const sortType = document.getElementById('sort-select').value;

      let filtered = [...rawData.subscribers];

      // 1. Search Query
      if (query) {
        filtered = filtered.filter(sub => sub.email.toLowerCase().includes(query));
      }

      // 2. Filter Pills
      if (currentFilter === 'paying') {
        filtered = filtered.filter(sub => sub.total_paid_usd > 0);
      } else if (currentFilter === 'credits') {
        filtered = filtered.filter(sub => sub.balance > 0);
      } else if (currentFilter === 'zero') {
        filtered = filtered.filter(sub => sub.balance === 0);
      }

      // 3. Sorting
      filtered.sort((a, b) => {
        if (sortType === 'active-desc') {
          const timeA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
          const timeB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
          return timeB - timeA;
        }
        if (sortType === 'paid-desc') return b.total_paid_usd - a.total_paid_usd;
        if (sortType === 'credits-desc') return b.balance - a.balance;
        if (sortType === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortType === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        return 0;
      });

      renderTable(filtered);
    }

    function renderTable(subscribers) {
      const tbody = document.getElementById('subscribers-tbody');

      if (!subscribers || subscribers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No matching subscribers found.</td></tr>`;
        return;
      }

      tbody.innerHTML = subscribers.map(sub => {
        const isPaying = sub.total_paid_usd > 0;
        const initial = (sub.email[0] || 'U').toUpperCase();
        
        let creditClass = 'credit-mid';
        if (sub.balance > 20) creditClass = 'credit-high';
        else if (sub.balance === 0) creditClass = 'credit-zero';

        const lastActiveText = sub.last_active_at
          ? new Date(sub.last_active_at).toLocaleString(undefined, { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          : '—';

        const lastPurchaseText = sub.last_purchase_at 
          ? new Date(sub.last_purchase_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          : '—';

        const regDateText = new Date(sub.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

        return `
          <tr>
            <td>
              <div class="user-cell">
                <div class="user-avatar">${initial}</div>
                <div class="user-email-stack">
                  <div class="user-email-row">
                    <span class="user-email">${sub.email}</span>
                    ${isPaying ? '<span class="badge-paying">⭐ Paid</span>' : '<span class="badge-free">Free</span>'}
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
                    <span class="user-id">${sub.user_id.slice(0, 18)}...</span>
                    <button class="mini-btn" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); font-size: 10.5px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;" onclick="openUserMediaModal('${sub.user_id}', '${sub.email}')" title="عرض الصور والفيديوهات التي أنتجها هذا المستخدم">
                      🖼️ إنتاج المستخدم
                    </button>
                  </div>
                </div>
              </div>
            </td>
            <td>
              <span class="${isPaying ? 'amount-value' : 'amount-zero'}">
                $${Number(sub.total_paid_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </td>
            <td>
              <span class="credit-badge ${creditClass}">
                ${Number(sub.balance).toLocaleString()}
              </span>
            </td>
            <td>
              <span style="color: var(--text-secondary); font-family: 'JetBrains Mono', monospace;">
                ${Number(sub.total_purchased).toLocaleString()}
              </span>
            </td>
            <td>
              <span style="color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
                ${Number(sub.total_used).toLocaleString()}
              </span>
            </td>
            <td>
              <span class="date-text" style="color: #38bdf8; font-weight: 600;">${lastActiveText}</span>
            </td>
            <td>
              <span class="date-text">${lastPurchaseText}</span>
            </td>
            <td>
              <span class="date-text">${regDateText}</span>
            </td>
          </tr>
        `;
      }).join('');
    }

    function exportToCSV() {
      if (!rawData?.subscribers || rawData.subscribers.length === 0) {
        alert('No data to export.');
        return;
      }

      const headers = ['Email', 'Total Paid (USD)', 'Current Credits', 'Total Purchased', 'Total Used', 'Last Purchase', 'Registered At', 'User ID'];
      const rows = rawData.subscribers.map(sub => [
        `"${sub.email}"`,
        sub.total_paid_usd,
        sub.balance,
        sub.total_purchased,
        sub.total_used,
        sub.last_purchase_at || '',
        sub.created_at,
        `"${sub.user_id}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `anarchy_subscribers_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // ==========================================================================

