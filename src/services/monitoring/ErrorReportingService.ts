/**
 * ErrorReportingService — Phase B: Monitoring & Sentry Integration
 *
 * Responsibilities:
 * - Initialize Sentry with release version, user ID (hashed), OS/build context.
 * - Capture unhandled JS errors and promise rejections.
 * - Maintain an in-memory sliding buffer of the last 50 errors (for Diagnostic Bundle).
 * - On startup: read any saved Tauri Rust panic, report it, clear it.
 * - Expose anonymized user context and error buffer for export.
 */

import * as Sentry from '@sentry/react';
import { APP_INFO } from '../../config/appInfo';
import { logger } from '../../utils/logger';

export interface CapturedError {
  timestamp: number;
  type: 'react' | 'unhandled' | 'promise' | 'tauri_panic' | 'supabase' | 'replicate' | 'manual';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

const MAX_ERROR_BUFFER = 50;
const errorBuffer: CapturedError[] = [];

let _initialized = false;
let _sentryActive = false;

// ── SHA-256 hashing for user ID anonymization ─────────────────────────────
async function hashUserId(userId: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(userId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    return 'anonymous';
  }
}

// ── Add to local error buffer ─────────────────────────────────────────────
function addToBuffer(entry: CapturedError): void {
  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_ERROR_BUFFER) {
    errorBuffer.shift();
  }
}

// ── Read any saved Tauri panic from previous session ─────────────────────
async function checkAndReportTauriPanic(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const panicData = await invoke<string | null>('get_tauri_panic');
    if (!panicData) return;

    const parsed = JSON.parse(panicData) as { message: string; file?: string; line?: number; timestamp: number };
    const entry: CapturedError = {
      timestamp: parsed.timestamp || Date.now(),
      type: 'tauri_panic',
      message: `Tauri Panic: ${parsed.message}`,
      stack: parsed.file ? `${parsed.file}:${parsed.line ?? '?'}` : undefined,
    };

    addToBuffer(entry);
    logger.error('[ErrorReporting] Tauri panic detected from previous session:', parsed.message);

    if (_sentryActive) {
      Sentry.captureException(new Error(`Tauri Panic: ${parsed.message}`), {
        tags: { type: 'tauri_panic', file: parsed.file, line: String(parsed.line ?? '') },
      });
    }
  } catch {
    // Not running in Tauri context or no panic file — silently ignore
  }
}

// ── Initialize ────────────────────────────────────────────────────────────
export const ErrorReportingService = {
  async init(): Promise<void> {
    if (_initialized) return;
    _initialized = true;

    const dsn = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SENTRY_DSN) as string | undefined;

    if (dsn) {
      Sentry.init({
        dsn,
        release: `anarchy-ai@${APP_INFO.version}`,
        environment: import.meta.env.DEV ? 'development' : 'production',
        tracesSampleRate: 0.15,
        integrations: [
          Sentry.browserTracingIntegration(),
        ],
        // Don't send PII: strip URLs and breadcrumb data
        beforeSend(event) {
          // Remove any auth tokens or sensitive data from request
          if (event.request?.url) {
            event.request.url = event.request.url.split('?')[0];
          }
          return event;
        },
      });
      _sentryActive = true;
      logger.log('[ErrorReporting] Sentry initialized successfully');
    } else {
      logger.warn('[ErrorReporting] No VITE_SENTRY_DSN found. Error reporting in local-only mode.');
    }

    // Wire up global unhandled error event
    window.addEventListener('error', (event) => {
      const entry: CapturedError = {
        timestamp: Date.now(),
        type: 'unhandled',
        message: event.message || String(event.error),
        stack: event.error?.stack,
        context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      };
      addToBuffer(entry);
    });

    // Wire up unhandled promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const entry: CapturedError = {
        timestamp: Date.now(),
        type: 'promise',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      };
      addToBuffer(entry);
    });

    // Check for previous-session Tauri panics
    await checkAndReportTauriPanic();
  },

  // Set anonymized user context in Sentry
  async setUser(userId: string | null): Promise<void> {
    if (!_sentryActive) return;
    if (!userId) {
      Sentry.setUser(null);
      return;
    }
    const hashedId = await hashUserId(userId);
    Sentry.setUser({ id: hashedId });
  },

  // Capture React component errors (from ErrorBoundary)
  captureError(error: Error, context?: Record<string, unknown>): void {
    const entry: CapturedError = {
      timestamp: Date.now(),
      type: 'react',
      message: error.message,
      stack: error.stack,
      context,
    };
    addToBuffer(entry);

    if (_sentryActive) {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    }

    logger.error('[ErrorReporting] Captured error:', error.message);
  },

  // Capture named service-level error (supabase, replicate, etc.)
  captureServiceError(
    service: 'supabase' | 'replicate' | 'tauri_panic' | 'manual',
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry: CapturedError = {
      timestamp: Date.now(),
      type: service,
      message,
      context,
    };
    addToBuffer(entry);

    if (_sentryActive) {
      Sentry.captureMessage(message, {
        level: 'error',
        tags: { service },
        extra: context,
      });
    }
  },

  // Return the error buffer for Diagnostic Bundle
  getRecentErrors(): CapturedError[] {
    return [...errorBuffer];
  },

  // Export for Sentry HOC integration
  getSentryReact() {
    return Sentry;
  },
};

export default ErrorReportingService;
