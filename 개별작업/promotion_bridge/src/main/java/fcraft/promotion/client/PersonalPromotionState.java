package fcraft.promotion.client;
import java.util.*;
import com.google.gson.*;
/** Trusted server projection only. Shared TeamData never reveals another player's job track. */
public final class PersonalPromotionState {
 private static volatile boolean ready=false,mainland=false;
 private static volatile Set<String> jobs=Set.of(),completed=Set.of(),tasks=Set.of();
 private static final String[] JOBS={"swordsman","berserker","ranger","healer","farmer","herbalist","angler","chef","blacksmith","relic_researcher","prospector","pathfinder"};
 private PersonalPromotionState(){}
 public static synchronized void clear(){ready=false;mainland=false;jobs=Set.of();completed=Set.of();tasks=Set.of();}
 public static synchronized void applyJson(String text){
  try {JsonObject j=JsonParser.parseString(text).getAsJsonObject();if(!j.has("schema")||j.get("schema").getAsInt()!=106){clear();return;}Set<String> a=new HashSet<>(),b=new HashSet<>(),c=new HashSet<>();for(JsonElement e:j.getAsJsonArray("registeredJobs")){String id=e.getAsJsonObject().get("id").getAsString();if(Arrays.asList(JOBS).contains(id))a.add(id);}for(JsonElement e:j.getAsJsonArray("completedQuestIds"))b.add(e.getAsString().toUpperCase(Locale.ROOT));for(JsonElement e:j.getAsJsonArray("readyTaskIds"))c.add(e.getAsString().toUpperCase(Locale.ROOT));jobs=Set.copyOf(a);completed=Set.copyOf(b);tasks=Set.copyOf(c);mainland=j.has("mainland")&&j.get("mainland").getAsBoolean();ready=true;
  }catch(RuntimeException e){clear();}
 }
 public static boolean isReady(){return ready;}
 public static boolean isMainlandUnlockedV110(){return ready&&mainland;}
 public static String hex(long id){return String.format(Locale.ROOT,"%016X",id);}
 private static int jobIndex(String h){if(h.length()!=16||!h.startsWith("7D04"))return -1;try{int i=Integer.parseInt(h.substring(4,6),16)-1;return i>=0&&i<JOBS.length?i:-1;}catch(RuntimeException e){return -1;}}
 public static boolean isPromotion(String h){return jobIndex(h.toUpperCase(Locale.ROOT))>=0;}
 /** null delegates unrelated quest behavior to FTB. */
 public static Boolean visible(String raw){String h=raw.toUpperCase(Locale.ROOT);if(h.equals("7C97000000000001")||h.equals("7C97000000000002"))return Boolean.TRUE;if(h.startsWith("5A11"))return ready&&mainland;if(h.startsWith("7E1"))return Boolean.FALSE;int i=jobIndex(h);if(i<0)return null;int grade=Integer.parseInt(h.substring(6,8),16);return ready&&jobs.contains(JOBS[i])&&(grade<=3||mainland);}
 public static Boolean completion(String raw){String h=raw.toUpperCase(Locale.ROOT);if(h.startsWith("5A11"))return ready&&mainland&&(h.startsWith("5A1110")?tasks.contains(h):completed.contains(h));int i=jobIndex(h);if(i>=0){if(!ready||!jobs.contains(JOBS[i]))return false;return h.endsWith("00000002")?tasks.contains(h):completed.contains(h);}if(h.equals("7E110000000000FE")||h.equals("7E100000000000FE"))return ready&&mainland;if(h.startsWith("7E110000000000")){try{int n=Integer.parseInt(h.substring(14),16)-1;return ready&&n>=0&&n<JOBS.length&&jobs.contains(JOBS[n]);}catch(RuntimeException e){return false;}}return null;}
}
