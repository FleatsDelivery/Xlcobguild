// /suggestion slash command handler — Send a suggestion to the officer inbox
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleSuggestion(body: any, supabase: any): Promise<Response> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;
    const username = discordUser?.username || discordUser?.global_name || 'Unknown';

    if (!discordId) {
      return jsonResponse(errorResponse('Could not identify your Discord account.'));
    }

    // Get the suggestion text
    const options = body.data.options || [];
    const suggestion = options.find((opt: any) => opt.name === 'text')?.value;

    if (!suggestion || suggestion.trim().length === 0) {
      return jsonResponse(errorResponse('Please provide a suggestion!'));
    }

    if (suggestion.length > 1000) {
      return jsonResponse(errorResponse('Suggestion is too long! Please keep it under 1000 characters.'));
    }

    // Look up the user's TCF profile for richer logging
    const { data: tcfUser } = await supabase
      .from('users')
      .select('id, discord_username')
      .eq('discord_id', discordId)
      .maybeSingle();

    // Store as admin_log entry so it shows in Officer Inbox
    const sortableId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const logEntry = {
      key: `admin_log:${sortableId}`,
      value: {
        type: 'suggestion',
        action: `Suggestion from ${username}: "${suggestion.length > 100 ? suggestion.substring(0, 100) + '…' : suggestion}"`,
        actor_id: tcfUser?.id || null,
        actor_name: username,
        actor_discord_id: discordId,
        suggestion_text: suggestion,
        source: 'discord',
        created_at: new Date().toISOString(),
      },
    };

    const { error: kvError } = await supabase
      .from('kv_store_4789f4af')
      .upsert(logEntry);

    if (kvError) {
      console.error('Failed to store suggestion in admin_log:', kvError);
      return jsonResponse(errorResponse('Failed to submit your suggestion. Please try again later.'));
    }

    console.log(`Suggestion submitted by ${username} (${discordId}): ${suggestion.substring(0, 80)}`);

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '💡 Suggestion Submitted!',
          description: `Thanks, <@${discordId}>! Your suggestion has been sent to the officers.\n\n> ${suggestion.length > 200 ? suggestion.substring(0, 200) + '…' : suggestion}`,
          color: 0xD6A615,
          footer: {
            text: 'The Corn Field • Officers will review this in their inbox',
          },
          timestamp: new Date().toISOString(),
        }],
        flags: 64, // Ephemeral
      },
    });
  } catch (error) {
    console.error('Error handling /suggestion command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}
