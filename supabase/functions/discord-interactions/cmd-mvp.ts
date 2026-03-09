// /mvp slash command handler
import { errorResponse, publicSuccessResponse, RANK_NAMES, jsonResponse } from './utils.ts';

export async function handleMvp(body: any, supabase: any): Promise<Response> {
  try {
    // Get command options
    const options = body.data.options || [];
    const getOption = (name: string) => options.find((opt: any) => opt.name === name)?.value;

    const targetDiscordUser = options.find((opt: any) => opt.name === 'user')?.value; // Discord user ID
    const screenshotAttachmentId = getOption('screenshot'); // Attachment ID
    const action = getOption('action');

    // Get submitter's Discord ID and username
    const submitterDiscordId = body.member?.user?.id || body.user?.id;
    const submitterDiscordUser = body.member?.user || body.user;
    const submitterUsername = submitterDiscordUser?.username || submitterDiscordUser?.global_name || 'Unknown';

    if (!submitterDiscordId) {
      return jsonResponse(errorResponse('Could not identify your Discord account.'));
    }

    // Get target Discord user info from resolved data
    const targetDiscordUserData = body.data.resolved?.users?.[targetDiscordUser];
    const targetUsername = targetDiscordUserData?.username || targetDiscordUserData?.global_name || 'Unknown';

    // Get the actual attachment data from resolved attachments
    const screenshotAttachment = body.data.resolved?.attachments?.[screenshotAttachmentId];

    console.log('Screenshot attachment ID:', screenshotAttachmentId);
    console.log('Resolved attachments:', body.data.resolved?.attachments);
    console.log('Screenshot attachment data:', screenshotAttachment);
    console.log('Submitter Discord ID:', submitterDiscordId);
    console.log('Submitter Username:', submitterUsername);
    console.log('Target Discord ID:', targetDiscordUser);
    console.log('Target Username:', targetUsername);

    // Step 1: Lookup submitter in database (OPTIONAL — anyone can submit)
    const { data: submitter } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', submitterDiscordId)
      .maybeSingle();

    // Step 2: Lookup target user (OPTIONAL — we'll store Discord info regardless)
    const { data: targetUser } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', targetDiscordUser)
      .maybeSingle();

    // Step 3: Validate permissions based on action
    const actionLower = action.toLowerCase().replace(' ', '_'); // "Rank Up" -> "rank_up"

    // ── Smart action resolution ──
    // If action is rank_up and target is at max rank but can prestige, auto-upgrade to prestige.
    // This mirrors the backend smart resolution for the 2-button Discord UI.
    let resolvedAction = actionLower;
    if (actionLower === 'rank_up' && targetUser) {
      const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
      const targetIsAtMaxRank = targetUser.rank_id >= targetMaxRank;
      const targetCanPrestige = targetUser.prestige_level < 5 && targetIsAtMaxRank;

      if (targetCanPrestige) {
        resolvedAction = 'prestige';
        console.log(`Smart action: auto-upgraded rank_up → prestige for ${targetUsername} (rank ${targetUser.rank_id}, prestige ${targetUser.prestige_level})`);
      }
    }

    // Permission rules:
    // - Rank Up: Anyone can submit (even non-registered)
    // - Rank Down: Only Corn Star (rank 10) can submit — NOT Pop'd Kernel (rank 11)
    // - Prestige: Auto-resolved from rank_up, anyone can submit (officers approve)

    if (resolvedAction === 'rank_down') {
      if (!submitter || submitter.rank_id !== 10) {
        return jsonResponse(
          errorResponse(
            `Only **Corn Star** members can submit rank down requests!${submitter ? `\n\nYour current rank: ${RANK_NAMES[submitter.rank_id]} (Prestige ${submitter.prestige_level})` : '\n\nYou must be registered and achieve Corn Star rank first.'}`
          )
        );
      }
    }

    // Validation: If target is registered, check rank limits
    if (targetUser) {
      if (resolvedAction === 'rank_down') {
        if (targetUser.rank_id <= 1) {
          return jsonResponse(errorResponse('Cannot rank down below Earwig!'));
        }
        if (targetUser.rank_id === 11) {
          return jsonResponse(errorResponse("Cannot rank down Pop'd Kernel! They are protected from de-ranks."));
        }
      }

      if (resolvedAction === 'rank_up') {
        const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
        if (targetUser.rank_id >= targetMaxRank) {
          return jsonResponse(errorResponse(`${targetUsername} is already at maximum rank and prestige!`));
        }
      }

      if (resolvedAction === 'prestige') {
        if (targetUser.prestige_level >= 5) {
          return jsonResponse(errorResponse(`${targetUsername} is already at maximum prestige level!`));
        }
        if (targetUser.rank_id < 10) {
          return jsonResponse(
            errorResponse(
              `Target user must be **Corn Star** to prestige!\n\nTarget rank: ${RANK_NAMES[targetUser.rank_id]}`
            )
          );
        }
      }
    }

    // Step 4: Download and upload screenshot
    if (!screenshotAttachment || !screenshotAttachment.url) {
      return jsonResponse(errorResponse('Screenshot attachment is missing!'));
    }

    const screenshotUrl = screenshotAttachment.url;
    const screenshotContentType = screenshotAttachment.content_type;

    if (!screenshotContentType?.startsWith('image/')) {
      return jsonResponse(errorResponse('Screenshot must be an image file (PNG, JPG, JPEG, etc.)!'));
    }

    console.log('Downloading screenshot from Discord:', screenshotUrl);

    const imageResponse = await fetch(screenshotUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download screenshot from Discord');
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to Supabase Storage
    const fileName = `${Date.now()}_${submitterDiscordId}_${targetDiscordUser}.png`;
    const filePath = `mvp-screenshots/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('make-4789f4af-mvp-screenshots')
      .upload(filePath, imageBuffer, {
        contentType: screenshotContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return jsonResponse(errorResponse('Failed to upload screenshot to storage!'));
    }

    console.log('Screenshot uploaded successfully to:', filePath);

    // Step 5: Create MVP request in database
    const requestData: any = {
      user_id: submitter?.id || null,
      target_user_id: targetUser?.id || null,
      action: resolvedAction,
      match_id: null,
      screenshot_url: filePath,
      status: 'pending',
      type: 'mvp',
      submitter_discord_id: submitterDiscordId,
      submitter_discord_username: submitterUsername,
      target_discord_id: targetDiscordUser,
      target_discord_username: targetUsername,
    };

    const { data: mvpRequest, error: insertError } = await supabase
      .from('rank_up_requests')
      .insert(requestData)
      .select()
      .single();

    if (insertError || !mvpRequest) {
      console.error('Failed to create MVP request:', insertError);
      return jsonResponse(errorResponse('Failed to create MVP request in database'));
    }

    console.log('MVP request created successfully');

    // Step 6: Generate signed URL for Discord embed (7 days expiry)
    const { data: signedUrlData } = await supabase.storage
      .from('make-4789f4af-mvp-screenshots')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    const imageUrl = signedUrlData?.signedUrl || '';
    console.log('Generated signed URL for Discord:', imageUrl);

    // Step 7: Send success response with image
    const response = publicSuccessResponse(
      submitterDiscordId, submitterUsername,
      targetDiscordUser, targetUsername,
      resolvedAction, null, imageUrl,
    );

    // Step 8: Background — fetch the posted message to get its ID and update database
    const interactionToken = body.token;
    const applicationId = Deno.env.get('DISCORD_APPLICATION_ID');
    const channelId = body.channel_id;

    (async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const messageResponse = await fetch(
          `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (messageResponse.ok) {
          const messageData = await messageResponse.json();
          const messageId = messageData.id;
          console.log('Fetched Discord message ID:', messageId);

          await supabase
            .from('rank_up_requests')
            .update({
              discord_message_id: messageId,
              discord_channel_id: channelId,
            })
            .eq('id', mvpRequest.id);

          console.log('Updated MVP request with Discord message info');
        } else {
          console.error('Failed to fetch Discord message:', await messageResponse.text());
        }
      } catch (error) {
        console.error('Error fetching Discord message ID:', error);
      }
    })();

    return jsonResponse(response);
  } catch (error) {
    console.error('Error handling /mvp command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}