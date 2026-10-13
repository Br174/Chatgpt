package it.motorlab.app;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Local, provider-neutral hint for choosing a website page from an explicit goal.
 * Never navigates, submits forms, reads secrets, or transmits text to a model.
 */
final class AutoSetupGoalRouter {
    private static final Set<String> STOP = new HashSet<>(Arrays.asList(
        "per", "del", "della", "delle", "dei", "degli", "una", "uno", "che", "con",
        "sito", "pagina", "aprire", "apri", "vai", "andare", "cerca", "trova",
        "voglio", "vorrei", "devo", "fare", "configura", "configurare", "devi",
        "the", "and", "for", "page", "site", "open", "link", "please", "demo",
        "this", "that", "nelle", "alla", "alle", "sulle", "sulla", "dentro"
    ));

    private AutoSetupGoalRouter() { }

    private static Set<String> tokens(String value) {
        Set<String> found=new HashSet<>();
        if(value==null||value.length()>1000)return found;
        String normalized=Normalizer.normalize(value,Normalizer.Form.NFD)
            .replaceAll("\\p{M}+","").toLowerCase(Locale.ROOT);
        for(String token:normalized.split("[^a-z0-9]+")) {
            if(token.length()>=4&&!STOP.contains(token))found.add(token);
        }
        return found;
    }

    /** Zero means no match; positive means a possible hint, NOT permission to navigate. */
    static int score(String goal,String linkLabel) {
        Set<String> goalWords=tokens(goal),linkWords=tokens(linkLabel);
        if(goalWords.isEmpty()||linkWords.isEmpty())return 0;
        int matched=0;
        for(String word:linkWords)if(goalWords.contains(word))matched++;
        return matched;
    }
}
