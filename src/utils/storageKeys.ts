/** Shared storage key constants — single source of truth */

export const STORAGE_KEYS = {
  BUILDER_AUTOSAVE:   'anarchy_builder_silent_autosave',
  HISTORY:            'anarchy_history',
  SETTINGS:           'anarchy_settings',
  WATERMARK_CONFIG:   'anarchy_watermark_config',
  WATERMARK_IMAGE:    'anarchy_watermark_config_img',
  ACCOUNT:            'anarchy_account',
} as const;

export const SESSION_KEYS = {
  PRESET_PROMPT:      'presetPrompt',
  PRESET_IMAGE:       'presetImage',
  PRESET_WORKFLOW:    'presetWorkflow',
  OPEN_PROJECT_PATH:  'openProjectPath',
  LOADED_WORKFLOW:    'loadedWorkflow',
} as const;
