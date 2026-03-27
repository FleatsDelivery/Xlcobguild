// /report slash command handler — Report bugs, player issues, or other concerns
import { errorResponse, InteractionResponseType } from './utils.ts';

const REPORT_TYPE_LABELS: Record<string, string> = {
  bug: '🐛 Bug Report',
  player: '👤 Player Report',
  officer: '🛡️ Officer Report',
  other: '📝 Other',
};

export async function handleReport(body: any, supabase: any): Promise<any> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;
    const username = discordUser?.username || discordUser?.global_name || 'Unknown';

    if (!discordId) {
      return errorResponse('Could not identify your Discord account.');
    }

    const options = body.data.options || [];
    const reportType = options.find((opt: any) => opt.name === 'type')?.value;
    const description = options.find((opt: any) => opt.name === 'description')?.value;
    const screenshotAttachmentId = options.find((opt: any) => opt.name === 'screenshot')?.value;

    if (!reportType || !description) {
      return errorResponse('Please provide both a report type and description.');
    }

    if (description.length > 2000) {
      return errorResponse('Description is too long! Please keep it under 2000 characters.');
    }

    let screenshotUrl = null;
    if (screenshotAttachmentId) {
      const screenshotAttachment = body.data.resolved?.attachments?.[screenshotAttachmentId];
      if (screenshotAttachment?.url && screenshotAttachment.content_type?.startsWith('image/')) {
        try {
          const imageResponse = await fetch(screenshotAttachment.url);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const fileName = `${Date.now()}_${discordId}_report.png`;
            const filePath = `reports/${fileName}`;
            const bucketName = 'make-4789f4af-reports';

            const { error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(filePath, imageBuffer, {
                contentType: screenshotAttachment.content_type,
                upsert: false,
              });

            if (!uploadError) {
              screenshotUrl = filePath;
            }
          }
        } catch (imgErr) {
          console.error('Non-critical screenshot error:', imgErr);
        }
      }
    }

    const { data: tcfUser } = await supabase
      .from('users')
      .select('id, discord_username')
      .eq('discord_id', discordId)
      .maybeSingle();

    const sortableId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const typeLabel = REPORT_TYPE_LABELS[reportType] || reportType;
    const truncatedDesc = description.length > 100 ? description.substring(0, 100) + '…' : description;

    const logEntry = {
      key: `admin_log:${sortableId}`,
      value: {
        type: 'report',
        action: `${typeLabel} from ${username}: "${truncatedDesc}"`,
        actor_id: tcfUser?.id || null,
        actor_name: username,
        actor_discord_id: discordId,
        report_type: reportType,
        report_description: description,
        screenshot_url: screenshotUrl,
        source: 'discord',
        created_at: new Date().toISOString(),
      },
    };

    await supabase.from('kv_store_4789f4af').upsert(logEntry);

    const embedFields: any[] = [{ name: 'Type', value: typeLabel, inline: true }];
    if (screenshotUrl) embedFields.push({ name: 'Attachment', value: '📎 Screenshot attached', inline: true });

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '📋 Report Submitted!',
          description: `Thanks, <@${discordId}>! Your report has been sent to the officers.\n\n> ${description.length > 300 ? description.substring(0, 300) + '…' : description}`,
          fields: embedFields,
          color: 0xD6A615,
          footer: { text: 'The Corn Field • Officers will review this in their inbox' },
          timestamp: new Date().toISOString(),
        }],
        flags: 64,
      },
    };
  } catch (error: any) {
    console.error('Error handling /report command:', error);
    return errorResponse(`An unexpected error occurred: ${error.message || 'Unknown error'}`);
  }
}
