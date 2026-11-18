import dev.latvian.mods.rhino.Context;
import dev.latvian.mods.rhino.ScriptableObject;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

/** Test-only real File/WindowsPath bindings; never launches Minecraft. */
public final class PromotionProfileGuardProbe {
 public static final class ReadOnlySentinel { private final String proof="read-only-reflection"; }
 public static void main(String[] args) throws Exception {
  Context cx=Context.enter();
  // Installed ScriptManager's exact distinction: only explicit loading(type2)
  // consults denied java.io/java.nio/java.lang.reflect namespaces.
  cx.setClassShutter((name,type)->type!=2||!(name.startsWith("java.io")||name.startsWith("java.nio")||name.startsWith("java.lang.reflect")));
  ScriptableObject scope=cx.initSafeStandardObjects();
  File profile=new File(args[0]).getCanonicalFile();
  Path world=profile.toPath().resolve("saves").resolve("FCraftPhase7UiQA");
  ScriptableObject.putProperty(scope,"PROFILE_FILE",Context.javaToJS(cx,profile,scope),cx);
  ScriptableObject.putProperty(scope,"WORLD_PATH",Context.javaToJS(cx,world,scope),cx);
  ScriptableObject.putProperty(scope,"READ_ONLY_SENTINEL",Context.javaToJS(cx,new ReadOnlySentinel(),scope),cx);
  Object result=cx.evaluateString(scope,Files.readString(Path.of(args[1])),"real-file-profile-guard",1,null);
  Files.writeString(Path.of(args[2]),cx.toString(result));
 }
}
