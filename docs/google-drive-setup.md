# Google Drive Sync Setup Guide

## Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click project dropdown > New Project
3. Name: Video Notes Extension
4. Click Create

## Step 2: Enable Google Drive API

1. Sidebar > APIs & Services > Library
2. Search "Google Drive API"
3. Click Enable

## Step 3: Configure OAuth Consent Screen

1. APIs & Services > OAuth consent screen
2. Choose External, click Create
3. App name: Video Notes
4. User support email: your email
5. Developer contact: your email
6. Click **Save and Continue**
7. On the **Scopes** page, click **Add or Remove Scopes**
8. In the search box, enter: `https://www.googleapis.com/auth/drive.appdata`
9. Check the box next to the scope, click **Update**
10. Click **Save and Continue**
11. On the **Test users** page, click **Add Users**, enter your email
12. Click **Save and Continue**

## Step 4: Get Extension ID

1. Run `pnpm build`
2. Chrome > chrome://extensions > Developer mode ON
3. Load unpacked > select build/chrome-mv3-prod
4. Copy the 32-character extension ID

## Step 5: Create OAuth Client ID

1. APIs & Services > Credentials > Create Credentials > OAuth client ID
2. Application type: Chrome Extension
3. Name: Video Notes
4. Item ID: paste the extension ID from Step 4
5. Click Create
6. Copy the Client ID (looks like 123456789-xxxxx.apps.googleusercontent.com)

## Step 6: Update package.json

Replace the placeholder in package.json:
```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/drive.appdata"]
}
```

## Step 7: Rebuild and Reload

1. `pnpm build`
2. chrome://extensions > reload the extension

## Step 8: Publish (for production)

1. OAuth consent screen > Publish App
2. Or keep in testing mode (only test users can sign in)

## How It Works

- `chrome.identity.getAuthToken()` handles OAuth flow automatically
- Data stored in user's Drive appDataFolder (hidden, private)
- Each user's data isolated in their own Google account
- `drive.appdata` scope: cannot access any other Drive files
- Chrome manages token refresh automatically

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth failed | Client ID or extension ID mismatch |
| No backup found | Upload first from another device |
| OAuth popup blocked | Check chrome://extensions errors |
| Consent screen warning | App in testing mode, publish or add test user |
