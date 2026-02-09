/**
 * Settings Service
 * Handles user settings CRUD with Firestore sync
 */
(function() {
'use strict';

/* ===== Default Templates ===== */
const DEFAULT_TEMPLATES = [
  { id: 't1', emoji: '🌅', name: 'Wake', tag: 'Sleep' }
];

/* ===== Default Tags ===== */
const DEFAULT_TAGS = [
  { name: "Sleep", category: "non" },
  { name: "Food", category: "non" },
  { name: "Survive", category: "non" },
  { name: "Work", category: "non" },
  { name: "Study", category: "good" },
  { name: "Exercise", category: "good" },
  { name: "Entertainment", category: "neutral" }
];

const DEFAULT_SETTINGS = {
  tags: { custom: [], showDefaults: true },
  tagMappings: {},
  templates: null, // null = use defaults, array = custom templates
  theme: 'system',
  language: 'it',
  version: 1
};

/* ===== Local Cache ===== */
let cachedSettings = null;
let settingsUnsubscribe = null;

/* ===== Firestore Reference ===== */
function getSettingsRef(uid) {
  return db.collection('users').doc(uid).collection('settings').doc('preferences');
}

/* ===== Load Settings ===== */
/**
 * Load settings from Firestore with optional real-time updates
 * @param {string} uid - User ID
 * @param {Function} onUpdate - Optional callback for real-time updates
 * @returns {Promise<Object>} Settings object
 */
async function loadSettings(uid, onUpdate = null) {
  const ref = getSettingsRef(uid);

  try {
    const snap = await ref.get();
    cachedSettings = snap.exists
      ? { ...DEFAULT_SETTINGS, ...snap.data() }
      : { ...DEFAULT_SETTINGS };

    // Set up real-time listener if callback provided
    if (onUpdate) {
      let firstSnapshot = true;
      settingsUnsubscribe = ref.onSnapshot((doc) => {
        // Skip first snapshot since we already loaded data above
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }
        cachedSettings = doc.exists
          ? { ...DEFAULT_SETTINGS, ...doc.data() }
          : { ...DEFAULT_SETTINGS };
        onUpdate(cachedSettings);
      });
    }

    return cachedSettings;
  } catch (error) {
    console.error('Error loading settings:', error);
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
}

/* ===== Save Settings ===== */
/**
 * Save settings to Firestore
 * @param {string} uid - User ID
 * @param {Object} updates - Settings to update (merged)
 * @returns {Promise<Object>} Updated settings
 */
async function saveSettings(uid, updates) {
  const ref = getSettingsRef(uid);
  const data = { ...updates, updatedAt: new Date().toISOString() };

  await ref.set(data, { merge: true });
  cachedSettings = { ...cachedSettings, ...data };
  return cachedSettings;
}

/* ===== Tag Functions ===== */

/**
 * Get all tags (defaults + custom) with categories
 * @param {Object} settings - Settings object (uses cache if not provided)
 * @returns {Array} Array of tag objects
 */
function getAllTags(settings = cachedSettings) {
  if (!settings) return DEFAULT_TAGS.map(t => ({ ...t, isDefault: true }));

  const result = [];

  // Add defaults if enabled
  if (settings.tags?.showDefaults !== false) {
    DEFAULT_TAGS.forEach(tag => {
      const override = settings.tagMappings?.[tag.name];
      result.push({
        name: tag.name,
        category: override || tag.category,
        isDefault: true
      });
    });
  }

  // Add custom tags
  (settings.tags?.custom || []).forEach(tag => {
    result.push({ ...tag, isDefault: false });
  });

  return result;
}

/**
 * Get tag names only (for dropdown)
 * @returns {Array<string>} Array of tag names
 */
function getTagNames() {
  return getAllTags().map(t => t.name);
}

/**
 * Get tag category (for statistics calculations)
 * @param {string} tagName - Tag name
 * @param {Object} settings - Settings object (uses cache if not provided)
 * @returns {string} Category: 'good', 'neutral', 'bad', 'non'
 */
function getTagCategory(tagName, settings = cachedSettings) {
  const t = String(tagName || '').trim();
  if (!t) return 'neutral';

  // Check custom mappings first
  if (settings?.tagMappings?.[t]) {
    return settings.tagMappings[t];
  }

  // Check custom tags
  const customTag = settings?.tags?.custom?.find(tag => tag.name === t);
  if (customTag) return customTag.category;

  // Check defaults
  const defaultTag = DEFAULT_TAGS.find(tag => tag.name === t);
  if (defaultTag) return defaultTag.category;

  // Fallback
  return 'neutral';
}

/**
 * Add a custom tag
 * @param {string} uid - User ID
 * @param {string} name - Tag name
 * @param {string} category - Tag category
 * @returns {Promise<Object>} Updated settings
 */
async function addCustomTag(uid, name, category) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Nome tag richiesto');

  const current = cachedSettings?.tags?.custom || [];

  // Check for duplicates (including defaults)
  const allTags = getAllTags();
  if (allTags.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error('Tag già esistente');
  }

  const updated = [...current, { name: trimmedName, category: category || 'neutral' }];
  return saveSettings(uid, {
    tags: { ...cachedSettings.tags, custom: updated }
  });
}

/**
 * Update tag category
 * @param {string} uid - User ID
 * @param {string} name - Tag name
 * @param {string} category - New category
 * @param {boolean} isDefault - Whether it's a default tag
 * @returns {Promise<Object>} Updated settings
 */
async function updateTag(uid, name, category, isDefault) {
  if (isDefault) {
    // Update mapping for default tag
    const mappings = { ...cachedSettings.tagMappings, [name]: category };
    return saveSettings(uid, { tagMappings: mappings });
  } else {
    // Update custom tag
    const custom = (cachedSettings.tags?.custom || []).map(t =>
      t.name === name ? { ...t, category } : t
    );
    return saveSettings(uid, { tags: { ...cachedSettings.tags, custom } });
  }
}

/**
 * Delete a custom tag
 * @param {string} uid - User ID
 * @param {string} name - Tag name
 * @returns {Promise<Object>} Updated settings
 */
async function deleteCustomTag(uid, name) {
  const custom = (cachedSettings.tags?.custom || []).filter(t => t.name !== name);
  return saveSettings(uid, { tags: { ...cachedSettings.tags, custom } });
}

/**
 * Reset a default tag to its original category
 * @param {string} uid - User ID
 * @param {string} name - Tag name
 * @returns {Promise<Object>} Updated settings
 */
async function resetTagMapping(uid, name) {
  const mappings = { ...cachedSettings.tagMappings };
  delete mappings[name];
  return saveSettings(uid, { tagMappings: mappings });
}

/**
 * Toggle showing default tags
 * @param {string} uid - User ID
 * @param {boolean} show - Whether to show defaults
 * @returns {Promise<Object>} Updated settings
 */
async function setShowDefaults(uid, show) {
  return saveSettings(uid, {
    tags: { ...cachedSettings.tags, showDefaults: show }
  });
}

/* ===== Template Functions ===== */

/**
 * Get all templates (defaults or custom)
 * @param {Object} settings - Settings object (uses cache if not provided)
 * @returns {Array} Array of template objects
 */
function getTemplates(settings = cachedSettings) {
  // If user has custom templates, return those; otherwise return defaults
  if (settings?.templates && Array.isArray(settings.templates)) {
    return settings.templates;
  }
  return [...DEFAULT_TEMPLATES];
}

/**
 * Add a new template
 * @param {string} uid - User ID
 * @param {Object} template - Template object { emoji, name, tag }
 * @returns {Promise<Object>} Updated settings
 */
async function addTemplate(uid, template) {
  const { emoji, name, tag } = template;
  if (!name?.trim()) throw new Error('Nome template richiesto');
  if (!tag?.trim()) throw new Error('Tag richiesto');

  const current = getTemplates();
  const newTemplate = {
    id: 't' + Date.now(),
    emoji: emoji || '📌',
    name: name.trim(),
    tag: tag.trim()
  };

  const updated = [...current, newTemplate];
  return saveSettings(uid, { templates: updated });
}

/**
 * Update an existing template
 * @param {string} uid - User ID
 * @param {string} templateId - Template ID
 * @param {Object} updates - { emoji?, name?, tag? }
 * @returns {Promise<Object>} Updated settings
 */
async function updateTemplate(uid, templateId, updates) {
  const current = getTemplates();
  const updated = current.map(t =>
    t.id === templateId ? { ...t, ...updates } : t
  );
  return saveSettings(uid, { templates: updated });
}

/**
 * Delete a template
 * @param {string} uid - User ID
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Updated settings
 */
async function deleteTemplate(uid, templateId) {
  const current = getTemplates();
  const updated = current.filter(t => t.id !== templateId);
  return saveSettings(uid, { templates: updated });
}

/**
 * Reorder templates
 * @param {string} uid - User ID
 * @param {Array} templateIds - Array of template IDs in new order
 * @returns {Promise<Object>} Updated settings
 */
async function reorderTemplates(uid, templateIds) {
  const current = getTemplates();
  const templateMap = new Map(current.map(t => [t.id, t]));
  const reordered = templateIds
    .map(id => templateMap.get(id))
    .filter(Boolean);
  return saveSettings(uid, { templates: reordered });
}

/**
 * Reset templates to defaults
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Updated settings
 */
async function resetTemplates(uid) {
  return saveSettings(uid, { templates: null });
}

/* ===== Theme Functions ===== */

/**
 * Save theme preference
 * @param {string} uid - User ID
 * @param {string} theme - 'light', 'dark', or 'system'
 * @returns {Promise<Object>} Updated settings
 */
async function saveTheme(uid, theme) {
  return saveSettings(uid, { theme });
}

/**
 * Get theme preference
 * @returns {string} Theme: 'light', 'dark', or 'system'
 */
function getTheme() {
  return cachedSettings?.theme || 'system';
}

/* ===== Language Functions ===== */

/**
 * Save language preference
 * @param {string} uid - User ID
 * @param {string} language - Language code (e.g., 'it', 'en')
 * @returns {Promise<Object>} Updated settings
 */
async function saveLanguage(uid, language) {
  return saveSettings(uid, { language });
}

/**
 * Get language preference
 * @returns {string} Language code
 */
function getLanguage() {
  return cachedSettings?.language || 'it';
}

/* ===== Migration ===== */

/**
 * Migrate localStorage tag mappings to Firestore (one-time)
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} Whether migration occurred
 */
async function migrateLocalStorageSettings(uid) {
  const LS_KEY = 'tt_custom_tag_map';

  try {
    const localMapStr = localStorage.getItem(LS_KEY);
    if (!localMapStr) return false;

    const localMap = JSON.parse(localMapStr);
    if (!localMap || Object.keys(localMap).length === 0) return false;

    // Check if already has settings
    const ref = getSettingsRef(uid);
    const snap = await ref.get();

    if (snap.exists && snap.data().version >= 1) {
      // Already has settings, just clear localStorage
      localStorage.removeItem(LS_KEY);
      return false;
    }

    // Migrate
    await saveSettings(uid, {
      tagMappings: localMap,
      tags: { custom: [], showDefaults: true },
      version: 1
    });

    // Clear localStorage
    localStorage.removeItem(LS_KEY);
    console.log('Settings migrated to Firestore');
    return true;
  } catch (error) {
    console.error('Migration error:', error);
    return false;
  }
}

/* ===== Cleanup ===== */

/**
 * Cleanup on logout (stop listeners, clear cache)
 */
function cleanupSettings() {
  if (settingsUnsubscribe) {
    settingsUnsubscribe();
    settingsUnsubscribe = null;
  }
  cachedSettings = null;
}

/* ===== Export to Window ===== */
window.SettingsService = {
  // Constants
  DEFAULT_TAGS,
  DEFAULT_TEMPLATES,
  DEFAULT_SETTINGS,

  // Core functions
  loadSettings,
  saveSettings,
  getCachedSettings: () => cachedSettings,

  // Tag functions
  getAllTags,
  getTagNames,
  getTagCategory,
  addCustomTag,
  updateTag,
  deleteCustomTag,
  resetTagMapping,
  setShowDefaults,

  // Template functions
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplates,
  resetTemplates,

  // Theme functions
  saveTheme,
  getTheme,

  // Language functions
  saveLanguage,
  getLanguage,

  // Migration
  migrateLocalStorageSettings,

  // Cleanup
  cleanupSettings
};
})();
