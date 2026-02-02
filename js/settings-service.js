/**
 * Settings Service
 * Handles user settings CRUD with Firestore sync
 */

/* ===== Default Tags ===== */
const DEFAULT_TAGS = [
  { name: "Entertainment", category: "neutral" },
  { name: "Survive", category: "non" },
  { name: "Study", category: "good" },
  { name: "Work", category: "non" },
  { name: "Nut", category: "neutral" },
  { name: "Slavery", category: "non" },
  { name: "Productivity", category: "good" },
  { name: "Waste", category: "bad" },
  { name: "Chess", category: "good" },
  { name: "Gym", category: "good" },
  { name: "Bike", category: "good" },
  { name: "Holiday", category: "neutral" },
  { name: "Chinese", category: "good" },
  { name: "Sleep", category: "non" },
  { name: "Book", category: "good" }
];

const DEFAULT_SETTINGS = {
  tags: { custom: [], showDefaults: true },
  tagMappings: {},
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
      settingsUnsubscribe = ref.onSnapshot((doc) => {
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
