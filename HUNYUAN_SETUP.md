# Hunyuan Setup

This app reads Tencent Hunyuan credentials from environment variables.

## Default model

The backend default model is:

`hy3`

You can override it with:

```powershell
setx HUNYUAN_MODEL "hy3"
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
setx HUNYUAN_BASE_URL "https://tokenhub.tencentmaas.com/v1"
```

## Image requests and fallback

Default text model: `hy3`. Default image model: `hy4` (`HUNYUAN_VISION_MODEL` overrides it). Tencent documents Hy4 image input and Hy3 text capabilities in the [TokenHub guide](https://cloud.tencent.cn/document/product/1823/132252). `hy3-preview` is not treated as an image model.

With an image, a recognized vision model receives text and `image_url` content parts. If that model is unavailable, the next distinct text candidate receives only structured pose text. Authentication/rate-limit errors stop fallback. Equal candidates are requested once. Names containing `vision` or `vl` retain legacy recognition; availability of a custom model at a custom endpoint must be verified by its operator. No paid API was called during the 2026-11-15 validation.
