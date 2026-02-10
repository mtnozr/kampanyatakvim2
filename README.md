<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1sFXCfTOXMNI4bQmJiG9oxT_8utoSHOSj

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`

3. Run the app:
   `npm run dev`

## Auto Changelog

Admin panelindeki **Sürüm Notları** artık `changelog.ts` üzerinden otomatik güncellenebilir.

- Workflow: `.github/workflows/auto-changelog.yml`
- Script: `scripts/update-changelog.mjs`

Manuel backfill (geçmiş commitlerden sürüm notu üretmek için):
- `npm run changelog:backfill`

Not:
- API bağımlılığı yoktur.
- Commit mesajları sürüm notlarına olduğu gibi eklenir; Türkçe görmek için commit mesajlarını Türkçe yazmanız önerilir.
