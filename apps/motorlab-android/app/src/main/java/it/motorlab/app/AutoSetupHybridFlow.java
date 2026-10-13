package it.motorlab.app;

import java.net.URI;

/**
 * Deterministic LAB-only AutoSetup handoff policy.
 * AUTO -> CHAT -> bounded RECOVERY -> LAST_RESORT.
 * This class controls permission to offer a fallback; it is not a browser agent,
 * does not touch secrets, and never claims provider-side completion.
 */
final class AutoSetupHybridFlow {
    enum Stage { IDLE, AUTO, CHAT, RECOVERY, LAST_RESORT, BLOCKED }
    private static final int MAX_RECOVERY_ATTEMPTS = 2;
    private Stage stage = Stage.IDLE;
    private String origin = "";
    private String page = "";
    private int recoveryAttempts = 0;
    private boolean autoTried = false;
    private boolean chatTried = false;
    private String reason = "";

    Stage stage() { return stage; }
    String reason() { return reason; }
    int recoveryAttempts() { return recoveryAttempts; }
    int maxRecoveryAttempts() { return MAX_RECOVERY_ATTEMPTS; }

    void start(String expectedOrigin, String currentPage) {
        if (!sameOrigin(expectedOrigin, currentPage))
            throw new IllegalArgumentException("HTTPS site identity mismatch");
        origin = expectedOrigin;
        page = currentPage;
        stage = Stage.AUTO;
        reason = "";
        recoveryAttempts = 0;
        autoTried = true;
        chatTried = false;
    }

    boolean isCurrent(String expectedOrigin, String currentPage) {
        return stage != Stage.IDLE && origin.equals(expectedOrigin)
            && page.equals(currentPage) && sameOrigin(origin, currentPage);
    }

    void visited(String expectedOrigin, String currentPage) {
        if (stage != Stage.AUTO || !sameOrigin(origin, currentPage)
                || !origin.equals(expectedOrigin))
            throw new IllegalStateException("Unexpected AutoSetup navigation");
        page = currentPage;
    }

    void requestHumanChoice(String why) {
        if (stage != Stage.AUTO)
            throw new IllegalStateException("Not an active automatic step");
        chatTried = true;
        stage = Stage.CHAT;
        reason = limited(why);
    }

    void approvedChatOperationObserved() {
        if (stage != Stage.CHAT)
            throw new IllegalStateException("No pending chat action");
        stage = Stage.AUTO;
        reason = "Effetto osservato nella pagina, esito remoto non verificato";
    }

    void cannotUseChat(String why) {
        if (stage != Stage.CHAT)
            throw new IllegalStateException("Chat path has not been attempted");
        stage = Stage.RECOVERY;
        reason = limited(why);
    }

    boolean requestRepair() {
        if (stage != Stage.RECOVERY)
            throw new IllegalStateException("Not in recovery");
        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) return false;
        recoveryAttempts++;
        return true;
    }

    void repairSucceeded() {
        if (stage != Stage.RECOVERY)
            throw new IllegalStateException("Recovery step missing");
        stage = Stage.AUTO;
        reason = "";
    }

    void repairFailed(String why) {
        if (stage != Stage.RECOVERY)
            throw new IllegalStateException("Recovery step missing");
        reason = limited(why);
        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            if (!autoTried || !chatTried)
                throw new IllegalStateException("Autonomy/chat not exhausted");
            stage = Stage.LAST_RESORT;
        }
    }

    boolean lastResortAllowed(String expectedOrigin, String currentPage) {
        return stage == Stage.LAST_RESORT && autoTried && chatTried
            && recoveryAttempts >= MAX_RECOVERY_ATTEMPTS
            && isCurrent(expectedOrigin, currentPage);
    }

    /**
     * Only official, bare HTTPS URLs on the same origin.
     * Queries/fragments might contain tokens and are not transferred in fallback.
     */
    String officialFallbackUrl(String expectedOrigin, String currentPage) {
        if (!lastResortAllowed(expectedOrigin, currentPage))
            throw new IllegalStateException("Last resort not authorized yet");
        try {
            URI u = new URI(currentPage);
            if (u.getRawQuery() != null || u.getRawFragment() != null)
                return origin;
            return u.toASCIIString();
        } catch (Exception e) {
            throw new IllegalStateException("Invalid fallback location");
        }
    }

    void blocked(String why) {
        stage = Stage.BLOCKED;
        reason = limited(why);
    }

    void reset() {
        stage = Stage.IDLE;
        origin = "";
        page = "";
        reason = "";
        recoveryAttempts = 0;
        autoTried = false;
        chatTried = false;
    }

    private static String limited(String value) {
        if (value == null) return "Passaggio non disponibile";
        // No site-provided text in records or model prompts.
        return value.length() > 130 ? value.substring(0, 130) : value;
    }

    private static boolean sameOrigin(String expectedOrigin, String currentPage) {
        try {
            URI origin = new URI(expectedOrigin);
            URI url = new URI(currentPage);
            if (!"https".equalsIgnoreCase(origin.getScheme())
                || !"https".equalsIgnoreCase(url.getScheme())
                || origin.getHost() == null || url.getHost() == null
                || origin.getRawUserInfo() != null || url.getRawUserInfo() != null
                || origin.getRawQuery() != null || origin.getRawFragment() != null
                || origin.getRawPath() != null && !origin.getRawPath().isEmpty())
                return false;
            return origin.getHost().equalsIgnoreCase(url.getHost())
                && origin.getPort() == url.getPort();
        } catch (Exception e) { return false; }
    }
}
