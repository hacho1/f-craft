import dev.latvian.mods.rhino.Context;
import dev.latvian.mods.rhino.ScriptableObject;
import java.nio.file.Files;
import java.nio.file.Path;
public final class RhinoPlanProbe {
 public static void main(String[] args) throws Exception {
  Context context=Context.enter();
  ScriptableObject scope=context.initSafeStandardObjects();
  Object result=context.evaluateString(scope,Files.readString(Path.of(args[0])),"owned-plan-probe",1,null);
  Files.writeString(Path.of(args[1]),context.toString(result));
 }
}
