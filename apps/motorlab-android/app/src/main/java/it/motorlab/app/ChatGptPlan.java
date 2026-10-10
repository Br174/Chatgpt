package it.motorlab.app;

/**
 * Adapter identity for Sign in with ChatGPT (open-source client preview).
 *
 * LAB01 is deliberately NOT an OAuth client: eligibility, stable host id,
 * PKCE, callback, ID token/JWKS, granted scope and token refresh must be
 * implemented and tested before offering an active sign-in. No fake login.
 * A ChatGPT Plus subscription is not a general-purpose OpenAI API key.
 */
final class ChatGptPlan {
    static final String DOCS = "https://developers.openai.com/siwc/token-sharing-open-source";
    static final String NAME = "ChatGPT (Sign in with ChatGPT)";
    static boolean usableNow() { return false; }
    static String status() {
        return "Integrazione in preparazione: OAuth ufficiale, idoneità open-source "
            + "e callback Android non ancora verificati. Nessun accesso è stato avviato.";
    }
}
