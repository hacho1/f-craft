"""Audit exact installed decoder and execute the compiled production redirect.

The Java executor/texture manager are explicit unit fixtures, not Minecraft.
Native Mixin application and gameplay remain the separate client QA plane.
"""
from pathlib import Path
import hashlib,json,os,re,subprocess,zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'검증/puffish_texture_thread_v106'
BUILD=json.loads((ROOT/'검증/promotion_bridge_build.json').read_text('utf-8'))
PREVIOUS=json.loads((OUT/'previous_bridge_build.json').read_text('utf-8'))
JDK=Path('C:/Users/wooheewon/AppData/Local/Programs/Eclipse Adoptium/jdk-17.0.20.101-hotspot/bin')
PUFF=next(Path(p)for p in BUILD['classpath']if p.endswith('puffish_skills-0.16.8-1.20-forge.jar'))
CLIENT=next(Path(p)for p in BUILD['classpath']if p.endswith('client-1.20.1-20230612.114412-srg.jar'))
MIXIN='fcraft.promotion.mixin.ClientBackgroundTextureThreadMixin'
rows=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def check(name,value):
 rows.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
def invoke(exe,*args):
 r=subprocess.run([str(JDK/(exe+'.exe')),*map(str,args)],capture_output=True,text=True,encoding='utf-8',errors='replace')
 if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 return r.stdout
def audit(name,jar,clazz):
 raw=invoke('javap','-c','-p','-classpath',jar,clazz)
 (OUT/(name+'.javap.txt')).write_text(raw,encoding='utf-8');return raw
def main():
 check('exact audited Puffish0.16.8 binary',sha(PUFF)=='35d4c6f33b88b6eb5b90c20d290699cc4ac212dcfa4073d76295235162f93804')
 bg=audit('puffish_background',PUFF,'net.puffish.skillsmod.client.config.ClientBackgroundConfig')
 registrar=audit('puffish_registrar',PUFF,'net.puffish.skillsmod.main.ForgeClientMain$ClientRegistrarImpl')
 packet=audit('puffish_show_packet',PUFF,'net.puffish.skillsmod.client.network.packets.in.ShowCategoryInPacket')
 texture=audit('puffish_tickable',PUFF,'net.puffish.skillsmod.client.config.ClientBackgroundConfig$ClientBackgroundTexture')
 vanilla=audit('minecraft_texture_manager',CLIENT,'net.minecraft.client.renderer.texture.TextureManager')
 check('one exact SRG registration invocation in create',bg.count('TextureManager.m_118495_:')==1)
 check('decoder apply occurs before handler enqueue',registrar.index('Function.apply:')<registrar.index('Context.enqueueWork:'))
 check('category packet decoding creates background texture',packet.index('Method readBackground:')>=0 and 'ClientBackgroundConfig.create:' in packet)
 check('category background implements Tickable', 'implements net.minecraft.client.renderer.texture.Tickable' in texture)
 tick=re.search(r'public void m_7673_\(\);([\s\S]*?)(?=\n  (?:public|private)|$)',vanilla)[1]
 check('vanilla tick iterates original mutable Tickable set', 'f_118469_' in tick and 'Set.iterator:' in tick)
 source=ROOT/'개별작업/promotion_bridge/src/main/java/fcraft/promotion/mixin/ClientBackgroundTextureThreadMixin.java'
 text=source.read_text('utf-8');conf=json.loads((ROOT/'개별작업/promotion_bridge/src/main/resources/fcraft_promotion_bridge.mixins.json').read_text('utf-8'))
 check('optional client-only target with exact audited redirect', '@Pseudo' in text and 'targets="net.puffish.skillsmod.client.config.ClientBackgroundConfig"' in text and 'require=1,remap=false' in text and conf['client']==['PersonalQuestVisibilityMixin','PersonalTeamProgressMixin','PersonalQuestButtonMixin','ClientBackgroundTextureThreadMixin','PersonalQuestPanelBoundsMixin'] and not conf.get('mixins'))
 current=BUILD['entries'];check('every previous bridge class/resource retained byte-for-byte',all(current.get(p)==h for p,h in PREVIOUS['entries'].items()if p!='fcraft_promotion_bridge.mixins.json'))
 check('all previous personal FTB sources unchanged',all(BUILD['sources'].get(p)==h for p,h in PREVIOUS['sources'].items()))
 compiled=audit('compiled_redirect',BUILD['jar'],MIXIN)
 head=compiled[compiled.index('private static void fcraft$registerOnClient'):compiled.index('private static void lambda$')]
 check('compiled redirect schedules only, actual registration is inside lambda','Minecraft.execute:' in head and 'TextureManager.m_118495_:' not in head and 'TextureManager.m_118495_:' in compiled[compiled.index('private static void lambda$'):])
 src=OUT/'unit_src';classes=OUT/'unit_classes';src.mkdir(exist_ok=True);classes.mkdir(exist_ok=True)
 files={
 'net/minecraft/resources/ResourceLocation.java':'''package net.minecraft.resources; public record ResourceLocation(String id) {}''',
 'net/minecraft/client/renderer/texture/AbstractTexture.java':'''package net.minecraft.client.renderer.texture; public class AbstractTexture {}''',
 'net/minecraft/client/Minecraft.java':'''package net.minecraft.client; import java.util.*; import java.util.concurrent.*; public final class Minecraft { private static final Minecraft INSTANCE=new Minecraft(); public final Thread owner=Thread.currentThread(); public final Queue<Runnable> queue=new ConcurrentLinkedQueue<>(); public static Minecraft m_91087_(){return INSTANCE;} public void execute(Runnable r){if(Thread.currentThread()==owner)r.run();else queue.add(r);} public void drain(){if(Thread.currentThread()!=owner)throw new AssertionError("wrong drain thread");for(Runnable r;(r=queue.poll())!=null;)r.run();} }''',
 'net/minecraft/client/renderer/texture/TextureManager.java':'''package net.minecraft.client.renderer.texture; import net.minecraft.client.Minecraft; import net.minecraft.resources.ResourceLocation; import java.util.*; public final class TextureManager { public final List<String> events=new ArrayList<>(); public final Set<AbstractTexture> tickables=new HashSet<>(); public void m_118495_(ResourceLocation id,AbstractTexture texture){if(Thread.currentThread()!=Minecraft.m_91087_().owner)throw new AssertionError("off-thread texture mutation");tickables.add(texture);events.add("register:"+id.id());} }''',
 'PuffishThreadProbe.java':'''import java.lang.reflect.*; import java.util.*; import java.util.concurrent.atomic.*; import net.minecraft.client.Minecraft; import net.minecraft.client.renderer.texture.*; import net.minecraft.resources.ResourceLocation;
public final class PuffishThreadProbe { static int checks; static void check(boolean b){checks++;if(!b)throw new AssertionError("check"+checks);} static Method redirect; static void call(TextureManager m,String id,AbstractTexture t){try{redirect.invoke(null,m,new ResourceLocation(id),t);}catch(Exception e){throw new RuntimeException(e);}} public static void main(String[] args)throws Exception{Minecraft mc=Minecraft.m_91087_();TextureManager tm=new TextureManager();AbstractTexture original=new AbstractTexture(),a=new AbstractTexture(),b=new AbstractTexture(),c=new AbstractTexture();tm.tickables.add(original);redirect=Class.forName("fcraft.promotion.mixin.ClientBackgroundTextureThreadMixin").getDeclaredMethod("fcraft$registerOnClient",TextureManager.class,ResourceLocation.class,AbstractTexture.class);redirect.setAccessible(true);Iterator<AbstractTexture> ticking=tm.tickables.iterator();AtomicReference<Throwable> error=new AtomicReference<>();Thread network=new Thread(()->{try{call(tm,"A",a);mc.execute(()->tm.events.add("handler:A"));}catch(Throwable x){error.set(x);}},"owned-unit-network-decoder");network.start();network.join();check(error.get()==null);check(tm.events.isEmpty());check(tm.tickables.size()==1);check(mc.queue.size()==2);check(ticking.next()==original);check(!ticking.hasNext());mc.drain();check(tm.events.equals(List.of("register:A","handler:A")));check(tm.tickables.contains(a));check(mc.queue.isEmpty());call(tm,"B",b);check(tm.events.get(2).equals("register:B"));check(mc.queue.isEmpty());Thread later=new Thread(()->{call(tm,"C",c);mc.execute(()->tm.events.add("handler:C"));},"owned-unit-network-decoder-2");later.start();later.join();check(!tm.tickables.contains(c));check(mc.queue.size()==2);mc.drain();check(tm.events.equals(List.of("register:A","handler:A","register:B","register:C","handler:C")));check(tm.tickables.size()==4);check(mc.queue.isEmpty());System.out.println("COMPILED_PRODUCTION_THREAD_ORDER_PASS "+checks);}}
'''}
 java=[]
 for rel,body in files.items():
  p=src/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body,encoding='utf-8');java.append(p)
 invoke('javac','--release','17','-encoding','UTF-8','-proc:none','-d',classes,*java)
 output=invoke('java','-cp',os.pathsep.join([str(classes),BUILD['jar']]),'PuffishThreadProbe').strip()
 check('actual compiled production redirect passes off-thread/current-thread/FIFO unit',output=='COMPILED_PRODUCTION_THREAD_ORDER_PASS 16')
 with zipfile.ZipFile(BUILD['jar'])as z:check('built jar contains compiled optional mixin','fcraft/promotion/mixin/ClientBackgroundTextureThreadMixin.class' in z.namelist())
 report={'passed':all(r['passed']for r in rows),'actualMinecraft':False,'actualCompiledProductionBytecode':True,'executorAndTextureManager':'explicit Java unit fixtures; not game render verification','checks':rows,'javaUnit':output,'jarSHA256':sha(Path(BUILD['jar'])),'puffishJARSHA256':sha(PUFF),'clientJARSHA256':sha(CLIENT),'mixinSourceSHA256':sha(source),'testSHA256':sha(Path(__file__))}
 (ROOT/'검증/v10_6_puffish_texture_thread_regression.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
