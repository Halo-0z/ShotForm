# Hunyuan Setup

This app reads Tencent Hunyuan credentials from environment variables.

## Default model

The backend default model is:

`hunyuan-turbos-latest`

You can override it with:

```powershell
setx HUNYUAN_MODEL "hunyuan-turbos-latest"
```

## API key

Set your Tencent Hunyuan API key locally:

```powershell
setx HUNYUAN_API_KEY "your-new-key"
```

After running `setx`, fully close and reopen the Tauri app so the new environment variables are loaded.

## Optional base URL

Only set this if you need a custom endpoint:

```powershell
setx HUNYUAN_BASE_URL "https://api.hunyuan.cloud.tencent.com/v1"
```
