import { test, expect } from '@playwright/test';

test.describe('Anarchy AI Phase B & C E2E Journeys', () => {
  
  test.beforeEach(async ({ page }) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    };

    // Global CORS preflight handler
    await page.route('**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 200,
          headers: corsHeaders
        });
      } else {
        await route.fallback();
      }
    });

    // Intercept replicate API proxy and mock image generation response
    await page.route('**/functions/v1/replicate-proxy', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        console.log('[Mock Proxy Route] Intercepted replicate-proxy POST payload:', body);
        
        await route.fulfill({
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({
            id: 'mock_pred_123',
            status: 'succeeded',
            output: 'https://example.com/mock-generation-output.png',
            version: 'mock-model-version'
          })
        });
      } else {
        await route.fallback();
      }
    });

    // Intercept checkout session creation
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          url: 'https://checkout.stripe.com/mock-session'
        })
      });
    });

    // Intercept remote image downloads to return a valid 1x1 transparent PNG
    await page.route('https://example.com/mock-generation-output.png', async (route) => {
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      await route.fulfill({
        contentType: 'image/png',
        headers: corsHeaders,
        body: pngBuffer
      });
    });

    // Intercept Supabase REST API requests for user credits table
    await page.route('**/rest/v1/user_credits*', async (route) => {
      console.log('[Mock Supabase REST] user_credits table query:', route.request().url());
      await route.fulfill({
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          user_id: 'mock-user-id',
          balance: 1000,
          total_purchased: 1000,
          total_used: 0,
          last_purchase_at: null,
          expires_at: null
        })
      });
    });

    // Intercept Supabase RPC deduct_credits calls
    await page.route('**/rest/v1/rpc/deduct_credits', async (route) => {
      console.log('[Mock Supabase RPC] deduct_credits');
      await route.fulfill({
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(990) // remaining balance
      });
    });

    // Intercept Supabase RPC refund_credits calls
    await page.route('**/rest/v1/rpc/refund_credits', async (route) => {
      console.log('[Mock Supabase RPC] refund_credits');
      await route.fulfill({
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(true)
      });
    });

    // Inject Tauri native API mocks before the application loads
    await page.addInitScript(() => {
      // Mock window fetch to intercept Supabase edge functions
      const originalFetch = window.fetch;
      window.fetch = async function (input: any, init?: any) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/functions/v1/replicate-proxy')) {
          return new Response(JSON.stringify({
            id: 'mock_pred_123',
            status: 'succeeded',
            output: 'https://example.com/mock-generation-output.png',
            version: 'mock-model-version'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        if (url.includes('/functions/v1/create-checkout-session')) {
          return new Response(JSON.stringify({
            url: 'https://checkout.stripe.com/mock-session'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch.apply(this, arguments as any);
      };

      // Set mock Supabase session in localStorage
      const mockSession = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'mock-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'mock@example.com',
          email_confirmed_at: new Date().toISOString(),
          phone: '',
          confirmed_at: new Date().toISOString(),
          user_metadata: {
            full_name: 'Mock User'
          },
          app_metadata: {
            provider: 'email',
            providers: ['email']
          }
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      window.localStorage.setItem('sb-mock-supabase-auth-token', JSON.stringify(mockSession));
      window.localStorage.setItem('sb-ejzsbkxpqmhpjuqmszvd-auth-token', JSON.stringify(mockSession));
      window.localStorage.setItem('anarchy_onboarding_completed', 'true');

      const mockFiles: Record<string, string> = {};
      const listeners: Record<string, Function[]> = {};

      // 1. Mock Event Plugin Internals to prevent unregisterListener errors
      (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
        unregisterListener: (event: string, eventId: any) => {
          console.log(`[Mock Tauri event] unregisterListener event: ${event}, id: ${eventId}`);
        }
      };

      // 2. Mock Tauri Internals
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args: any) => {
          console.log(`[Mock Tauri IPC] invoke command: ${cmd}`, args);
          switch (cmd) {
            case 'get_startup_file':
            case 'get_deep_link':
            case 'get_tauri_panic':
              return null;
            case 'get_app_data_dir':
              return 'C:\\Users\\NITRO\\AppData\\Local\\anarchy-ai';
            case 'ensure_dir':
              return;
            case 'save_file':
              mockFiles[args.path] = args.contents;
              return;
            case 'load_file':
              return mockFiles[args.path] || JSON.stringify({
                signature: 'ANARCHY_AI_PROJECT_FILE',
                version: 1,
                fileVersion: 1,
                appVersion: '0.2.1',
                program: 'Anarchy AI',
                programVersion: '0.2.1',
                name: 'Untitled',
                nodes: [
                  { id: 'node_1', type: 'source', position: { x: 100, y: 100 }, data: { type: 'source', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' } }
                ],
                edges: []
              });
            case 'plugin:dialog|save':
              return 'C:\\mock-path\\untitled.ana';
            case 'plugin:dialog|open':
              return 'C:\\mock-path\\untitled.ana';
            case 'url_to_base64':
              return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            case 'open_url':
              (window as any).__last_opened_url = args.url;
              return;
            case 'plugin:event|listen':
              return 12345;
            default:
              return null;
          }
        },
        transformCallback: (callback: Function, once: boolean) => {
          const id = Math.floor(Math.random() * 1000000);
          (window as any)[`_${id}`] = (event: any) => {
            if (once) delete (window as any)[`_${id}`];
            callback(event);
          };
          return id;
        },
        metadata: {
          windows: [{ label: 'main' }],
          webviews: [{ label: 'main' }],
          currentWindow: { label: 'main' },
          currentWebview: { label: 'main' }
        }
      };
    });

    // Go to home page, which triggers automatic login under mock mode
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the dashboard page successfully', async ({ page }) => {
    await expect(page.locator('.nav-rail')).toBeVisible();
    await expect(page.locator('.hero-card h2')).toContainText(/Welcome to ANARCHY/i);
  });

  test('should run Image Generation flow successfully on builder canvas', async ({ page }) => {
    // Navigate directly to the builder canvas
    await page.goto('/builder');
    


    // Canvas container check
    const canvas = page.locator('.canvas-container');
    await expect(canvas).toBeVisible();

    // Type a generation prompt
    const promptInput = page.locator('.builder-prompt-input');
    await expect(promptInput).toBeVisible();
    await promptInput.fill('An E2E Generated Cyberpunk Landmark');

    // Click generate button
    const generateBtn = page.locator('.generate-btn');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Verify Toast Notification for successful generation
    const toast = page.locator('text=Image Generated');
    await expect(toast).toBeVisible();
  });

  test('should save project successfully on builder canvas', async ({ page }) => {
    await page.goto('/builder');
    


    // Trigger Save Project via Control+S keyboard shortcut
    await page.keyboard.press('Control+S');

    // Check for success notification
    const toast = page.locator('text=Project Saved');
    await expect(toast).toBeVisible();
  });

  test('should import history data and restore imported workflow successfully', async ({ page }) => {
    // Navigate to Settings Page
    await page.goto('/settings');
    await expect(page.locator('.settings-layout')).toBeVisible();

    // Open Storage tab
    const storageTab = page.locator('.settings-tab >> text=Storage');
    await expect(storageTab).toBeVisible();
    await storageTab.click();

    // Prepare a mock data backup JSON payload
    const mockBackupJson = JSON.stringify({
      version: '0.7.0',
      exportedAt: new Date().toISOString(),
      data: {
        settings: '{}',
        history: JSON.stringify([
          {
            id: 'h_mock_import_e2e_1',
            timestamp: Date.now(),
            type: 'generate',
            prompt: 'E2E Import Landmark',
            model: 'google/nano-banana-2',
            outputImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            nodeTree: {
              nodes: [
                { id: 'n_1', type: 'source', position: { x: 100, y: 100 }, data: { type: 'source', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' } }
              ],
              sourceNodeId: 'n_1',
              activeNodeId: 'n_1',
              createdAt: Date.now()
            }
          }
        ]),
        workflows: '[]',
        library: '[]'
      }
    });

    // Upload backup file using setInputFiles
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles({
      name: 'anarchy-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(mockBackupJson)
    });

    // Verify success toast notification
    const successToast = page.locator('text=Data imported successfully!');
    await expect(successToast).toBeVisible();

    // Navigate to History in the SAME session context to verify the imported entry
    await page.goto('/history');
    await expect(page.locator('.history-page')).toBeVisible();

    // Ensure our imported history entry is visible in flat mode
    const importedCardText = page.locator('text=E2E Import Landmark');
    await expect(importedCardText).toBeVisible();

    // Hover card item to show actions
    const card = page.locator('.history-grid-item').first();
    await card.hover();

    // Click "Use (Workflow)" action button
    const useWorkflowBtn = page.locator('button[title="Use (Workflow)"]').first();
    await expect(useWorkflowBtn).toBeVisible();
    await useWorkflowBtn.click();

    // Verify we navigated to builder and toast "Project Loaded" is displayed
    await expect(page).toHaveURL(/\/builder/);
    const toast = page.locator('text=Project Loaded');
    await expect(toast).toBeVisible();
  });

  test('should handle Credits Purchase flow and initiate checkout', async ({ page }) => {
    // Navigate to Add Credit page
    await page.goto('/add-credit');
    await expect(page.locator('.add-credit-page')).toBeVisible();

    // Choose the $10 credit package button
    const tenDollarPkg = page.locator('.package-card').first();
    await expect(tenDollarPkg).toBeVisible();
    await tenDollarPkg.click();

    // Click buy/purchase button
    const buyBtn = page.locator('.header-purchase-btn');
    await expect(buyBtn).toBeVisible();
    await buyBtn.click();

    // Assert that checkout session redirection was triggered and captured by our window mock
    await expect(async () => {
      const lastUrl = await page.evaluate(() => (window as any).__last_opened_url);
      expect(lastUrl).toBe('https://checkout.stripe.com/mock-session');
    }).toPass();
  });
});
