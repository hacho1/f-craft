package fcraft.promotion.mixin;

import java.util.Iterator;
import java.util.List;
import java.util.Set;
import dev.ftb.mods.ftblibrary.ui.Widget;
import dev.ftb.mods.ftbquests.client.ClientQuestFile;
import dev.ftb.mods.ftbquests.client.gui.quests.ChapterPanel;
import dev.ftb.mods.ftbquests.client.gui.quests.QuestButton;
import dev.ftb.mods.ftbquests.client.gui.quests.QuestPanel;
import dev.ftb.mods.ftbquests.quest.Movable;
import dev.ftb.mods.ftbquests.quest.Quest;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Hidden F-Craft nodes must not move the native chapter's initial viewport. */
@Mixin(value=QuestPanel.class,remap=false)
public abstract class PersonalQuestPanelBoundsMixin {
 private static final Set<String> FCRAFT_CHAPTERS=Set.of(
  "7900000000000000","3000000000000000","6000000000000000","4000000000000000","5A10000000000000");

 @Redirect(method="updateMinMax()V",
  at=@At(value="INVOKE",target="Ljava/util/List;iterator()Ljava/util/Iterator;",ordinal=0,remap=false),
  require=1,remap=false)
 private Iterator<Widget> fcraft$drawnQuestBounds(List<Widget> widgets) {
  // Return a view of the iteration only; retain every widget and its progress.
  return widgets.stream().filter(widget -> {
   if(!(widget instanceof QuestButton button))return true;
   // Audited FTB2001.4.18 getter: returns the quest/link object without mutation.
   Movable movable=button.moveAndDeleteFocus();
   if(!(movable instanceof Quest quest))return true;
   if(!FCRAFT_CHAPTERS.contains(quest.getChapter().getCodeString()))return true;
   return widget.shouldDraw();
  }).iterator();
 }

 @Inject(method="resetScroll()V",at=@At("RETURN"),require=1,remap=false)
 private void fcraft$centerBesidePinnedChapters(CallbackInfo ci) {
  QuestPanel panel=(QuestPanel)(Object)this;
  Minecraft client=Minecraft.m_91087_();
  ClientQuestFile file=ClientQuestFile.INSTANCE;
  if(client==null||client.f_91074_==null||file==null||file.selfTeamData==null
   ||!file.selfTeamData.isChapterPinned(client.f_91074_))return;
  boolean fcraft=false;
  for(Widget widget:panel.getWidgets()) {
   if(widget instanceof QuestButton button
    &&button.moveAndDeleteFocus() instanceof Quest quest
    &&FCRAFT_CHAPTERS.contains(quest.getChapter().getCodeString())) {
    fcraft=true;
    break;
   }
  }
  if(!fcraft||panel.getGui()==null)return;
  for(Widget widget:panel.getGui().getWidgets()) {
   if(widget instanceof ChapterPanel) {
    // Native resetScroll centers the whole panel; use its unobscured right area.
    // This runs only on a native reset, preserving the user's later manual pan.
    double overlap=Math.min(panel.getWidth(),Math.max(0,
     widget.getX()+widget.getWidth()-panel.getX()));
    panel.setScrollX(panel.getScrollX()-overlap/2.0);
    return;
   }
  }
 }
}
