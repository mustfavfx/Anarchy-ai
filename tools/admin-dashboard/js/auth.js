// Anarchy AI Admin Dashboard - Authentication & Realtime Sync
// Initialize Auth state
    window.addEventListener('DOMContentLoaded', async () => {
      // 1. Check if saved service role master key exists
      const savedKey = localStorage.getItem('anarchy_service_key');
      if (savedKey) {
        try {
          activeClient = window.supabase.createClient(SUPABASE_URL, savedKey);
          onAuthenticated({ email: 'Master Service Key' });
          return;
        } catch (e) {
          console.warn('Invalid saved key', e);
        }
      }

      // 2. Check active Supabase session
      const { data: { session } } = await activeClient.auth.getSession();
      if (session?.user) {
        onAuthenticated(session.user);
      }
    });

    async function handleServiceKeyLogin() {
      const key = document.getElementById('service-key-input').value.trim();
      const errBox = document.getElementById('login-error');
      errBox.style.display = 'none';

      if (!key) {
        errBox.textContent = 'Please paste your service_role secret key from Supabase.';
        errBox.style.display = 'block';
        return;
      }

      try {
        localStorage.setItem('anarchy_service_key', key);
        activeClient = window.supabase.createClient(SUPABASE_URL, key);
        onAuthenticated({ email: 'Master Service Key' });
      } catch (err) {
        errBox.textContent = err.message || 'Failed to initialize service key.';
        errBox.style.display = 'block';
      }
    }

    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btnLogin = document.getElementById('btn-login');
      const errBox = document.getElementById('login-error');

      errBox.style.display = 'none';
      btnLogin.disabled = true;
      btnLogin.innerHTML = '<span class="spinner"></span> Signing in...';

      try {
        const { data, error } = await activeClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated(data.user);
      } catch (err) {
        errBox.textContent = err.message || 'Authentication failed. Verify credentials.';
        errBox.style.display = 'block';
      } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Sign In with Password';
      }
    }

    let autoSyncInterval = null;
    let realtimeChannel = null;

    function startAutoSync() {
      if (autoSyncInterval) clearInterval(autoSyncInterval);
      // Auto-sync polling every 25 seconds in background
      autoSyncInterval = setInterval(() => {
        fetchSubscribersData(true);
      }, 25000);

      // Realtime push notification on table changes
      try {
        if (realtimeChannel) {
          activeClient.removeChannel(realtimeChannel);
        }
        realtimeChannel = activeClient
          .channel('admin-subscribers-pulse')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stripe_sessions' }, () => {
            fetchSubscribersData(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_credits' }, () => {
            fetchSubscribersData(true);
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription optional fallback:', err);
      }
    }

    function onAuthenticated(user) {
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('dashboard-section').style.display = 'flex';
      document.getElementById('header-actions').style.display = 'flex';
      fetchSubscribersData();
      startAutoSync();
      loadVaultMedia();
    }

    async function handleLogout() {
      if (autoSyncInterval) clearInterval(autoSyncInterval);
      if (realtimeChannel) activeClient.removeChannel(realtimeChannel);
      localStorage.removeItem('anarchy_service_key');
      await activeClient.auth.signOut();
      document.getElementById('auth-section').style.display = 'flex';
      document.getElementById('dashboard-section').style.display = 'none';
      document.getElementById('header-actions').style.display = 'none';
    }

    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-refresh').addEventListener('click', () => {
      fetchSubscribersData(false);
      loadVaultMedia(true);
    });
    document.getElementById('btn-export').addEventListener('click', exportToCSV);

