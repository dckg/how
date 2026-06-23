/* =========================================================================
   FluoLingo · /f1/ — site config
   -------------------------------------------------------------------------
   GOOGLE LOGIN: paste your OAuth 2.0 *Web* Client ID below to activate
   "Se connecter avec Google" across the portal. Create one at
   https://console.cloud.google.com/apis/credentials  →  OAuth client ID
   → Web application, and add these to "Authorised JavaScript origins":
       https://fluolingo.com
       https://www.fluolingo.com
   Leave it as "" to run the portal in guest mode (progress saved locally
   on the device only).

   Cross-device progress sync is NOT possible with this alone — that needs a
   backend (e.g. Firebase/Firestore). See docs/F1-PORTAL-ICAP.md.
   ========================================================================= */
window.FLUO_GOOGLE_CLIENT_ID = "";
