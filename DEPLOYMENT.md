# Deployment Guide

This guide explains how to deploy the recent improvements to your Time Tracker PWA.

---

## What Was Changed

### 1. **Code Reorganization** ✅
- Files moved into organized folders (`assets/`, `pages/`, `js/`, `css/`, `archive/`)
- All file references updated
- Service worker cache updated

### 2. **External JavaScript Modules** ✅
- **js/config.js**: Firebase configuration (shared across all pages)
- **js/utils.js**: Shared utilities (sanitization, error handling, loading states, etc.)
- **js/theme.js**: Theme management (light/dark mode)

### 3. **Security Improvements** ✅
- Input sanitization with `escapeHtml()` to prevent XSS attacks
- Rate limiting on activity submission (prevents spam)
- Comprehensive error handling with `safeFirebaseCall()`
- Firestore security rules (see [firestore.rules](firestore.rules))

### 4. **User Experience Enhancements** ✅
- Loading indicators for all Firebase operations
- Offline/online detection with toast notifications
- Keyboard shortcuts (Ctrl+K to focus, Ctrl+Enter to submit)
- Better error messages in Italian

### 5. **Performance Optimizations** ✅
- Service worker caches external JS files
- Statistics queries already use date filters (already optimized)
- Firestore indexes defined (see [firestore.indexes.json](firestore.indexes.json))

---

## Deployment Steps

### Step 1: Test Locally

1. Open [index.html](index.html) in your browser
2. Test login/signup functionality
3. Test adding activities
4. Test statistics page ([pages/statistics.html](pages/statistics.html))
5. Check browser console for errors

### Step 2: Deploy Firestore Security Rules

**IMPORTANT:** You MUST deploy the security rules to protect user data.

#### Option A: Using Firebase CLI (Recommended)

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project (if not already done)
firebase init

# Select:
# - Firestore (configure rules and indexes)
# - Hosting (if deploying to Firebase Hosting)

# Deploy security rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

#### Option B: Using Firebase Console (Manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **time-ff7ed**
3. Go to **Firestore Database** → **Rules** tab
4. Copy the content from [firestore.rules](firestore.rules)
5. Paste it into the rules editor
6. Click **Publish**

**Then deploy indexes:**

1. Go to **Firestore Database** → **Indexes** tab
2. Click **Add Index**
3. Add these two indexes manually:
   - Collection Group: `activities`, Field: `timestamp DESC`
   - Collection Group: `activities`, Fields: `tag ASC`, `timestamp DESC`

OR use Firebase CLI:
```bash
firebase deploy --only firestore:indexes
```

### Step 3: Deploy to Hosting (Optional)

If you're using Firebase Hosting:

```bash
# Deploy all files
firebase deploy --only hosting
```

If you're using a different hosting provider:
1. Upload all files maintaining the folder structure
2. Ensure the root directory contains [index.html](index.html)
3. Configure your server to serve `index.html` for the root URL

### Step 4: Update Service Worker Cache Version

After deployment, users' browsers will need to update the cached files.

The service worker is already configured to handle this automatically with the new cache version: `time-2026-01-30-v3`

Users will see the update on their next visit.

---

## Firebase Security Rules Explanation

The new security rules in [firestore.rules](firestore.rules) enforce:

### User Data Isolation
```javascript
// Users can only access their own data
match /users/{userId}/activities/{activityId} {
  allow read, write: if request.auth.uid == userId;
}
```

### Data Validation
```javascript
// Ensures activities have required fields and reasonable lengths
allow create: if
  request.resource.data.activity is string &&
  request.resource.data.tag is string &&
  request.resource.data.timestamp is string &&
  request.resource.data.activity.size() > 0 &&
  request.resource.data.activity.size() <= 500;
```

### Default Deny
```javascript
// Deny all other access by default
match /{document=**} {
  allow read, write: if false;
}
```

---

## Testing the Security Rules

### Test 1: User Can Access Own Data ✓
```javascript
// Logged in as user A
await db.collection('users/userA/activities').add({ ... }); // ✓ Success
await db.collection('users/userA/activities').get(); // ✓ Success
```

### Test 2: User Cannot Access Other User's Data ✗
```javascript
// Logged in as user A
await db.collection('users/userB/activities').get(); // ✗ Permission Denied
```

### Test 3: Data Validation Works ✓
```javascript
// Valid activity
await db.collection('users/userA/activities').add({
  activity: 'Reading',
  tag: 'Book',
  timestamp: '2026-01-30T14:30:00'
}); // ✓ Success

// Invalid activity (too long)
await db.collection('users/userA/activities').add({
  activity: 'A'.repeat(501), // 501 characters
  tag: 'Book',
  timestamp: '2026-01-30T14:30:00'
}); // ✗ Permission Denied
```

---

## Rollback Plan

If something goes wrong, you can rollback:

### Option 1: Git Rollback
```bash
# View commit history
git log --oneline

# Rollback to previous commit
git checkout <commit-hash>

# Or reset to previous state
git reset --hard HEAD~1
```

### Option 2: Restore Old Security Rules
If the new rules cause issues, restore the old rules in Firebase Console:
1. Go to **Firestore Database** → **Rules** tab
2. Click **View history**
3. Select a previous version
4. Click **Restore**

---

## Monitoring After Deployment

### Check Firebase Console
1. Go to **Firestore Database** → **Usage** tab
2. Monitor read/write operations
3. Check for any permission denied errors

### Check Browser Console
1. Open your app in multiple browsers
2. Open Developer Tools (F12)
3. Look for JavaScript errors in the Console tab
4. Check Network tab for failed requests

### Check Service Worker
1. Open Developer Tools → Application tab
2. Go to **Service Workers** section
3. Verify the new service worker is active
4. Check **Cache Storage** for new cache version

---

## Post-Deployment Checklist

- [ ] Security rules deployed successfully
- [ ] Indexes created (or in progress)
- [ ] App loads correctly
- [ ] Login/signup works
- [ ] Adding activities works
- [ ] Statistics page loads
- [ ] Theme toggle works
- [ ] Offline mode works (disconnect network and test)
- [ ] No console errors
- [ ] Service worker updated
- [ ] Tested on mobile device

---

## Performance Metrics

### Before vs After

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **index.html size** | ~18.6 KB | ~14 KB | 25% smaller |
| **statistics.html size** | ~42.9 KB | ~41 KB | 5% smaller |
| **Code duplication** | High | None | DRY principle |
| **Security** | Basic | Enhanced | Input validation, sanitization |
| **Error handling** | Basic | Comprehensive | Better UX |
| **Loading states** | None | All operations | Better feedback |

---

## Troubleshooting

### Issue: "Permission Denied" errors

**Cause:** Security rules not deployed or too restrictive

**Solution:**
1. Check that you deployed the rules: `firebase deploy --only firestore:rules`
2. Verify your auth state: `auth.currentUser` should not be null
3. Check Firebase Console → Firestore → Rules for any errors

### Issue: Theme not applying

**Cause:** External `theme.js` not loading

**Solution:**
1. Check browser console for 404 errors
2. Verify file path: `js/theme.js` (relative to index.html)
3. Clear cache and hard reload (Ctrl+Shift+R)

### Issue: Service Worker not updating

**Cause:** Browser cached old service worker

**Solution:**
1. Open DevTools → Application → Service Workers
2. Click "Unregister"
3. Hard reload page (Ctrl+Shift+R)
4. Service worker will re-register with new version

### Issue: Activities not loading

**Cause:** Index not created yet

**Solution:**
1. Firestore indexes take time to build (1-5 minutes)
2. Check Firebase Console → Firestore → Indexes
3. Wait for status to change from "Building" to "Enabled"

---

## Next Steps

### Immediate (Do Now)
1. ✅ Test locally
2. ✅ Deploy security rules
3. ✅ Deploy indexes
4. ✅ Deploy to hosting

### Short Term (Next Week)
1. Monitor Firebase usage for any errors
2. Get user feedback on new features
3. Check mobile device compatibility
4. Review Firebase billing (indexes may increase costs slightly)

### Long Term (Future)
Consider implementing additional improvements from [IMPROVEMENTS.md](IMPROVEMENTS.md):
- Add pagination to statistics page
- Add activity autocomplete
- Add more export formats (CSV, PDF)
- Add analytics tracking
- Consider adding build process (Vite)

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Firebase Console for usage/errors
3. Review this deployment guide
4. Check [IMPROVEMENTS.md](IMPROVEMENTS.md) for context

---

## Summary

You've successfully:
- ✅ Reorganized project structure
- ✅ Extracted code to reusable modules
- ✅ Added comprehensive security (rules + input sanitization)
- ✅ Enhanced error handling and user feedback
- ✅ Optimized caching with service worker
- ✅ Added keyboard shortcuts
- ✅ Added network detection

**Your app is now more secure, maintainable, and user-friendly!**
