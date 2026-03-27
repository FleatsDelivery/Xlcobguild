// /mvp slash command handler — Refactored for high-reliability deferred architecture
import { errorResponse, publicSuccessResponse, InteractionResponseType } from './utils.ts';

export async function handleMvp(body: any, supabase: any): Promise<any> {
  const interactionToken = body.token;
  const applicationId = Deno.env.get('DISCORD_APPLICATION_ID');
  const channelId = body.channel_id;

  try {
    // Get command options
    const options = body.data.options || [];
    const getOption = (name: string) => options.find((opt: any) => opt.name === name)?.value;

    const targetDiscordUser = options.find((opt: any) => opt.name === 'user')?.value;
    const screenshotAttachmentId = getOption('screenshot');
    const action = getOption('action');

    const submitterDiscordId = body.member?.user?.id || body.user?.id;
    const submitterDiscordUser = body.member?.user || body.user;
    const submitterUsername = submitterDiscordUser?.username || submitterDiscordUser?.global_name || 'Unknown';

    const targetDiscordUserData = body.data.resolved?.users?.[targetDiscordUser];
    const targetUsername = targetDiscordUserData?.username || targetDiscordUserData?.global_name || 'Unknown';

    const screenshotAttachment = body.data.resolved?.attachments?.[screenshotAttachmentId];

    if (!screenshotAttachment || !screenshotAttachment.url) {
      return errorResponse('Screenshot attachment is missing!');
    }

    // Lookup users in database
    const { data: submitter } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', submitterDiscordId)
      .maybeSingle();

    const { data: targetUser } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', targetDiscordUser)
      .maybeSingle();

    // Validate permissions/action
    const actionLower = action.toLowerCase().replace(' ', '_');
    let resolvedAction = actionLower;
    
    if (actionLower === 'rank_up' && targetUser) {
      const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
      const targetIsAtMaxRank = targetUser.rank_id >= targetMaxRank;
      const targetCanPrestige = targetUser.prestige_level < 5 && targetIsAtMaxRank;
      if (targetCanPrestige) resolvedAction = 'prestige';
    }

    if (resolvedAction === 'rank_down') {
      if (!submitter || submitter.rank_id !== 10) {
        return errorResponse(`Only **Corn Star** members can submit rank down requests!`);
      }
    }

    // Download and upload screenshot
    const imageResponse = await fetch(screenshotAttachment.url);
    if (!imageResponse.ok) throw new Error('Failed to download screenshot');
    const imageBuffer = await imageResponse.arrayBuffer();

    const fileName = `${Date.now()}_${submitterDiscordId}_${targetDiscordUser}.png`;
    const filePath = `mvp-screenshots/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('make-4789f4af-mvp-screenshots')
      .upload(filePath, imageBuffer, {
        contentType: screenshotAttachment.content_type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Create MVP request
    const { data: mvpRequest, error: insertError } = await supabase
      .from('rank_up_requests')
      .insert({
        user_id: submitter?.id || null,
        target_user_id: targetUser?.id || null,
        action: resolvedAction,
        screenshot_url: filePath,
        status: 'pending',
        type: 'mvp',
        submitter_discord_id: submitterDiscordId,
        submitter_discord_username: submitterUsername,
        target_discord_id: targetDiscordUser,
        target_discord_username: targetUsername,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Build success response
    const { data: signedUrlData } = await supabase.storage
      .from('make-4789f4af-mvp-screenshots')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    const imageUrl = signedUrlData?.signedUrl || '';
    const finalEmbed = publicSuccessResponse(
      submitterDiscordId, submitterUsername,
      targetDiscordUser, targetUsername,
      resolvedAction, null, imageUrl
    );

    // BACKGROUND: Capture message ID after the router patches the response
    (async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const res = await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`);
        if (res.ok) {
          const msgData = await res.json();
          await supabase
            .from('rank_up_requests')
            .update({
              discord_message_id: msgData.id,
              discord_channel_id: channelId,
            })
            .eq('id', mvpRequest.id);
          console.log(`MVP ${mvpRequest.id} message ID stored: ${msgData.id}`);
        }
      } catch (e) {
        console.error('Failed to capture MVP message ID:', e);
      }
    })();

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: finalEmbed.data.embeds,
        components: finalEmbed.data.components,
      }
    };

  } catch (error: any) {
    console.error('MVP Error:', error);
    return errorResponse(`Failed to process MVP request: ${error.message || 'Unknown error'}`);
  }
}