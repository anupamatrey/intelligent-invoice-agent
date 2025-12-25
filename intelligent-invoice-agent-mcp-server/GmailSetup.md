# Gmail API Setup Guide

Complete step-by-step guide to configure Gmail API for reading emails with Excel attachments.

---

## Prerequisites

- Google Cloud Account
- Gmail account
- ngrok installed
- Spring Boot app running on port 8081

---

## Step 1: Google Cloud Console Setup

### 1.1 Enable Gmail API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing: `gmail-push-reader`
3. Navigate to **APIs & Services > Library**
4. Search for "Gmail API"
5. Click **Enable**

### 1.2 Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Configure consent screen if prompted:
   - User Type: **External**
   - App name: `Invoice Agent`
   - User support email: Your email
   - Developer contact: Your email
4. Application type: **Web application**
5. Name: `Invoice Agent OAuth`
6. Add **Authorized redirect URIs**:
   ```
   https://YOUR_NGROK_URL.ngrok-free.app/auth/callback
   ```
   Example: `https://f88c24295d33.ngrok-free.app/auth/callback`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### 1.3 Setup Pub/Sub (Optional - for push notifications)
1. Go to **Pub/Sub > Topics**
2. Click **Create Topic**
3. Topic ID: `gmail-push-topic`
4. Click **Create**

---

## Step 2: Configure .env File

Update your `.env` file with the credentials:

```properties
# Gmail Configuration
email.username=your-email@gmail.com

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://YOUR_NGROK_URL.ngrok-free.app/auth/callback
GOOGLE_REFRESH_TOKEN=
GOOGLE_PUB_SUB_TOPIC_NAME=projects/gmail-push-reader/topics/gmail-push-topic
GOOGLE_PUSH_ENDPOINT_URI=https://YOUR_NGROK_URL.ngrok-free.app/webhook/gmail/push
```

**Important:** 
- No spaces before or after the `=` sign
- Use your actual Gmail address
- Leave `GOOGLE_REFRESH_TOKEN` empty for now

---

## Step 3: Start Required Services

### 3.1 Start ngrok
```bash
ngrok http 8081
```

Copy the ngrok URL (e.g., `https://f88c24295d33.ngrok-free.app`)

### 3.2 Update Redirect URI
If ngrok URL changed:
1. Update `GOOGLE_REDIRECT_URI` in `.env`
2. Update redirect URI in Google Cloud Console
3. Update authorization URL below

### 3.3 Start Spring Boot App
```bash
./gradlew bootRun
```

Wait for: `Started IntelligentInvoiceAgentMcpServerApplication`

---

## Step 4: Generate Refresh Token

### 4.1 Build Authorization URL
Replace `YOUR_CLIENT_ID` and `YOUR_NGROK_URL`:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=https://YOUR_NGROK_URL.ngrok-free.app/auth/callback&response_type=code&scope=https://www.googleapis.com/auth/gmail.modify&access_type=offline&prompt=consent
```

**Scopes:**
- `gmail.readonly` - Read emails only
- `gmail.modify` - Read emails + mark as read (recommended)

### 4.2 Authorize the App
1. Open the authorization URL in browser
2. Click through ngrok warning page (if shown)
3. Select your Google account
4. Click **Allow** to grant permissions
5. You'll be redirected to `/auth/callback`

### 4.3 Copy Refresh Token
You should see JSON response:
```json
{
  "refresh_token": "1//05XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "access_token": "ya29.XXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "message": "✅ Copy the refresh_token above to your .env file as GOOGLE_REFRESH_TOKEN"
}
```

Copy the `refresh_token` value (starts with `1//`)

### 4.4 Update .env
Paste the refresh token:
```properties
GOOGLE_REFRESH_TOKEN=1//05XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Step 5: Restart and Test

### 5.1 Restart Spring Boot App
```bash
# Stop the app (Ctrl+C)
./gradlew bootRun
```

### 5.2 Verify Logs
You should see:
```
Polling Gmail for new invoices...
```

NOT:
```
Skipping Gmail poll - refresh token not configured
```

### 5.3 Test Email Processing
1. Send an email to your Gmail with `.xlsx` or `.xls` attachment
2. Wait up to 60 seconds (polling interval)
3. Check app logs for:
   ```
   Processing Excel attachment: filename.xlsx
   Parsed X invoices from attachment: filename.xlsx
   ```
4. Email should be marked as read

---

## Troubleshooting

### Error: "invalid_grant"
- Authorization code expired (valid for 10 minutes)
- Solution: Visit authorization URL again

### Error: "Insufficient Permission" / 403
- Wrong OAuth scope
- Solution: Re-authorize with `gmail.modify` scope

### Error: "Connection refused" on port 8081
- Spring Boot app not running
- Solution: Start app with `./gradlew bootRun`

### Error: 502 Bad Gateway (ngrok)
- Port mismatch between ngrok and Spring Boot
- Solution: Ensure both use port 8081

### Ngrok login page
- It's a warning page, not login
- Solution: Click "Visit Site" button

### Refresh token empty in response
- Using authorization code instead of refresh token
- Solution: Let the callback endpoint handle it automatically

---

## File Changes Made

### New Files Created:
1. `src/main/java/com/anupam/mcp/server/controller/OAuthController.java`
   - Handles OAuth callback
   - Exchanges authorization code for refresh token

2. `src/main/java/com/anupam/mcp/server/config/SecurityConfig.java`
   - Disables authentication for `/auth/**` and `/api/**` endpoints
   - Allows public access to OAuth callback

### Modified Files:
1. `src/main/resources/application.properties`
   - Added `server.port=8081`
   - Added Google OAuth2 configuration properties

2. `src/main/java/com/anupam/mcp/server/service/GmailService.java`
   - Added check to skip polling when refresh token is empty
   - Prevents errors on startup

3. `.env`
   - Added all Google OAuth2 credentials
   - Added Gmail username

---

## How It Works

1. **Scheduled Task**: Runs every 60 seconds
2. **Gmail API**: Searches for unread emails with attachments
3. **Filter**: Only processes `.xlsx` and `.xls` files
4. **Parse**: Extracts invoice data using ExcelParser
5. **Mark Read**: Marks processed emails as read
6. **Log**: Outputs invoice details to console

---

## Security Notes

- ✅ `.env` file is in `.gitignore` (credentials not committed)
- ✅ Refresh token is long-lived (no need to re-authorize)
- ✅ OAuth 2.0 secure authentication
- ⚠️ Keep Client Secret and Refresh Token private
- ⚠️ Revoke access in Google Account settings if compromised

---

## Next Steps

- [ ] Add database to store processed invoices
- [ ] Implement duplicate detection
- [ ] Add email notification on processing
- [ ] Setup Pub/Sub for real-time push notifications
- [ ] Add error handling and retry logic
- [ ] Create admin dashboard to view processed invoices

---

## Quick Reference

**Authorization URL Template:**
```
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&access_type=offline&prompt=consent
```

**Scopes:**
- Read only: `https://www.googleapis.com/auth/gmail.readonly`
- Modify: `https://www.googleapis.com/auth/gmail.modify`
- Full access: `https://mail.google.com/`

**Callback Endpoint:**
```
GET /auth/callback?code=AUTHORIZATION_CODE
```

**Polling Interval:**
- Current: 60 seconds (60000ms)
- Configurable in `@Scheduled(fixedRate = 60000)`

---

## Support

For issues:
1. Check logs for detailed error messages
2. Verify all credentials in `.env`
3. Ensure ngrok URL matches redirect URI
4. Confirm Gmail API is enabled in Google Cloud Console
5. Check OAuth consent screen is configured

---

**Last Updated:** 2024
**Version:** 1.0
