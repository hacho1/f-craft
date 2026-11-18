package fcraft.promotion.client;

import com.google.gson.*;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.ClientPlayerNetworkEvent;
import net.minecraftforge.client.event.RenderLivingEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.registries.ForgeRegistries;
import org.joml.Matrix3f;
import org.joml.Matrix4f;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Per-client server projection. No entity names/tags, shared quests or rewards are changed. */
@Mod.EventBusSubscriber(modid="fcraft_promotion_bridge",value=Dist.CLIENT)
public final class PersonalNpcQuestMarkers {
    private static final ResourceLocation AVAIL=new ResourceLocation("f_rank_days","textures/gui/quests/marker_quest_avail.png");
    private static final ResourceLocation TURNIN=new ResourceLocation("f_rank_days","textures/gui/quests/marker_quest_turnin.png");
    private static final ResourceLocation VILLAGER=new ResourceLocation("minecraft","villager");
    private static final AtomicLong REQUEST=new AtomicLong();
    private static final Map<UUID,Draw> DRAWS=new ConcurrentHashMap<>();
    private static volatile Map<UUID,Marker> markers=Map.of();
    private static volatile Object level;
    private static volatile UUID owner;
    private static volatile boolean ready=false,uiBlocked=true;
    private static volatile long totalDraws;

    private record Marker(String npcId,String kind) {}
    private record Draw(String npcId,String kind,String texture,long at,float anchorHeight,double distanceSquared) {}
    private PersonalNpcQuestMarkers() {}

    /** Validate the entire map first; malformed/duplicate rows never publish a partial projection. */
    static Map<UUID,Marker> parse(String text) {
        if(text==null||text.length()>32768)throw new IllegalArgumentException("marker projection size");
        JsonObject root=JsonParser.parseString(text).getAsJsonObject();
        if(!root.has("version")||!root.get("version").isJsonPrimitive()||!root.get("version").getAsJsonPrimitive().isNumber()||root.get("version").getAsDouble()!=110.0)
            throw new IllegalArgumentException("marker projection version");
        JsonArray rows=root.getAsJsonArray("markers");
        if(rows==null||rows.size()>64)throw new IllegalArgumentException("marker projection count");
        Map<UUID,Marker> next=new HashMap<>();Set<String> npcIds=new HashSet<>();
        for(JsonElement element:rows){
            JsonObject row=element.getAsJsonObject();
            String raw=strictString(row,"uuid"),npc=strictString(row,"npc_id"),kind=strictString(row,"kind");
            UUID id=UUID.fromString(raw);
            if(!id.toString().equals(raw.toLowerCase(Locale.ROOT))||!npc.matches("[a-z][a-z0-9_]{0,47}")||!(kind.equals("avail")||kind.equals("turnin"))||!npcIds.add(npc)||next.put(id,new Marker(npc,kind))!=null)
                throw new IllegalArgumentException("marker projection row");
        }
        return Map.copyOf(next);
    }
    private static String strictString(JsonObject row,String key){
        JsonElement value=row.get(key);
        if(value==null||!value.isJsonPrimitive()||!value.getAsJsonPrimitive().isString())throw new IllegalArgumentException("marker projection string");
        return value.getAsString();
    }

    public static void applyJson(String text){
        final Map<UUID,Marker> next;
        try{next=parse(text);}catch(RuntimeException invalid){clear();return;}
        final long request=REQUEST.incrementAndGet();
        Minecraft client=Minecraft.m_91087_();
        final Object receivedLevel=client.f_91073_;
        final UUID receivedOwner=client.f_91074_==null?null:client.f_91074_.m_20148_();
        // The KubeJS packet callback may be queued; publish only on the render executor.
        client.execute(()->{
            if(request!=REQUEST.get())return;
            if(receivedLevel==null||receivedOwner==null||client.f_91073_!=receivedLevel||client.f_91074_==null||!receivedOwner.equals(client.f_91074_.m_20148_())){clear();return;}
            markers=next;level=receivedLevel;owner=receivedOwner;ready=true;
            DRAWS.keySet().retainAll(next.keySet());
        });
    }
    public static void setUiBlocked(boolean value){uiBlocked=value;}
    public static void clear(){REQUEST.incrementAndGet();markers=Map.of();DRAWS.clear();level=null;owner=null;ready=false;uiBlocked=true;totalDraws=0;}
    @SubscribeEvent public static void logout(ClientPlayerNetworkEvent.LoggingOut event){clear();}
    @SubscribeEvent public static void tick(TickEvent.ClientTickEvent event){
        if(event.phase!=TickEvent.Phase.END)return;
        Minecraft client=Minecraft.m_91087_();
        if(ready&&(client.f_91073_!=level||client.f_91074_==null||!client.f_91074_.m_20148_().equals(owner)))clear();
    }

    @SubscribeEvent public static void render(RenderLivingEvent.Post<?,?> event){
        Minecraft client=Minecraft.m_91087_();
        if(!ready||uiBlocked||client.f_91073_!=level||client.f_91074_==null||!client.f_91074_.m_20148_().equals(owner)||client.f_91080_!=null||client.f_91066_.f_92062_)return;
        LivingEntity entity=event.getEntity();
        Marker marker=markers.get(entity.m_20148_());
        if(marker==null||!entity.m_6084_())return;
        ResourceLocation type=ForgeRegistries.ENTITY_TYPES.getKey(entity.m_6095_());
        if(type==null||!("customnpcs".equals(type.m_135827_())||VILLAGER.equals(type)))return;
        double distance=client.f_91074_.m_20280_(entity);
        if(distance>1600.0)return;
        ResourceLocation texture=marker.kind.equals("turnin")?TURNIN:AVAIL;
        PoseStack pose=event.getPoseStack();
        // Keep the medallion above the existing name/title plate rather than on it.
        float anchor=entity.m_20206_()+1.1F;
        pose.m_85836_();
        try{
            pose.m_85837_(0.0,anchor,0.0);
            pose.m_252781_(client.m_91290_().m_253208_());
            pose.m_85841_(-0.025F,-0.025F,0.025F);
            Matrix4f matrix=pose.m_85850_().m_252922_();
            Matrix3f normal=pose.m_85850_().m_252943_();
            VertexConsumer buffer=event.getMultiBufferSource().m_6299_(RenderType.m_110458_(texture));
            vertex(buffer,matrix,normal,-16F,16F,0F,1F);
            vertex(buffer,matrix,normal,16F,16F,1F,1F);
            vertex(buffer,matrix,normal,16F,-16F,1F,0F);
            vertex(buffer,matrix,normal,-16F,-16F,0F,0F);
        }finally{pose.m_85849_();}
        // Diagnostics record completed real entity render calls, never synthetic Painter markers.
        totalDraws++;DRAWS.put(entity.m_20148_(),new Draw(marker.npcId,marker.kind,texture.toString(),System.nanoTime(),anchor,distance));
    }
    private static void vertex(VertexConsumer buffer,Matrix4f matrix,Matrix3f normal,float x,float y,float u,float v){
        buffer.m_252986_(matrix,x,y,0F).m_6122_(255,255,255,255).m_7421_(u,v)
            .m_86008_(OverlayTexture.f_118083_).m_85969_(15728880).m_252939_(normal,0F,0F,1F).m_5752_();
    }

    public static String getDiagnosticsJson(){
        JsonObject root=new JsonObject();root.addProperty("ready",ready);root.addProperty("owner",owner==null?"":owner.toString());root.addProperty("uiBlocked",uiBlocked);root.addProperty("markerCount",markers.size());root.addProperty("totalNativeRenderCalls",totalDraws);
        JsonArray projection=new JsonArray(),draws=new JsonArray();
        for(var entry:markers.entrySet()){JsonObject row=new JsonObject();row.addProperty("uuid",entry.getKey().toString());row.addProperty("npc_id",entry.getValue().npcId);row.addProperty("kind",entry.getValue().kind);projection.add(row);}
        long now=System.nanoTime();
        for(var entry:DRAWS.entrySet()){Draw draw=entry.getValue();JsonObject row=new JsonObject();row.addProperty("uuid",entry.getKey().toString());row.addProperty("npc_id",draw.npcId);row.addProperty("kind",draw.kind);row.addProperty("texture",draw.texture);row.addProperty("ageMs",(now-draw.at)/1_000_000);row.addProperty("anchorHeight",draw.anchorHeight);row.addProperty("distanceSquared",draw.distanceSquared);draws.add(row);}
        root.add("projection",projection);root.add("draws",draws);return root.toString();
    }
}
