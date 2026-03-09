// /report slash command handler — Report bugs, player issues, or other concerns
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';

const REPORT_TYPE_LABELS: Record<string, string> = {
  bug: '🐛 Bug Report',
  player: '👤 Player Report',
  officer: '🛡️ Officer Report',
  other: '📝 Other',
};

export async function handleReport(body: any, supabase: any): Promise<Response> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;
    const username = discordUser?.username || discordUser?.global_name || 'Unknown';

    if (!discordId) {
      return jsonResponse(errorResponse('Could not identify your Discord account.'));
    }

    // Get command options
    const options = body.data.options || [];
    const reportType = options.find((opt: any) => opt.name === 'type')?.value;
    const description = options.find((opt: any) => opt.name === 'description')?.value;
    const screenshotAttachmentId = options.find((opt: any) => opt.name === 'screenshot')?.value;

    if (!reportType || !description) {
      return jsonResponse(errorResponse('Please provide both a report type and description.'));
    }

    if (description.length > 2000) {
      return jsonResponse(errorResponse('Description is too long! Please keep it under 2000 characters.'));
    }

    // Handle optional screenshot
    let screenshotUrl = null;
    if (screenshotAttachmentId) {
      const screenshotAttachment = body.data.resolved?.attachments?.[screenshotAttachmentId];
      if (screenshotAttachment?.url && screenshotAttachment.content_type?.startsWith('image/')) {
        try {
          // Download from Discord CDN
          const imageResponse = await fetch(screenshotAttachment.url);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const fileName = `${Date.now()}_${discordId}_report.png`;
            const filePath = `reports/${fileName}`;

            // Ensure bucket exists
            const bucketName = 'make-4789f4af-reports';
            const { data: buckets } = await supabase.storage.listBuckets();
            const bucketExists = buckets?.some((b: any) => b.name === bucketName);
            if (!bucketExists) {
              await supabase.storage.createBucket(bucketName, { public: false });
            }

            const { error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(filePath, imageBuffer, {
                contentType: screenshotAttachment.content_type,
                upsert: false,
              });

            if (!uploadError) {
              screenshotUrl = filePath;
              console.log(`Report screenshot uploaded: ${filePath}`);
            } else {
              console.error('Report screenshot upload failed:', uploadError);
            }
          }
        } catch (imgErr) {
          console.error('Non-critical: report screenshot download failed:', imgErr);
        }
      }
    }

    // Look up the user's TCF profile for richer logging
    const { data: tcfUser } = await supabase
      .from('users')
      .select('id, discord_username')
      .eq('discord_id', discordId)
      .maybeSingle();

    // Store as admin_log entry so it shows in Officer Inbox
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

    const { error: kvError } = await supabase
      .from('kv_store_4789f4af')
      .upsert(logEntry);

    if (kvError) {
      console.error('Failed to store report in admin_log:', kvError);
      return jsonResponse(errorResponse('Failed to submit your report. Please try again later.'));
    }

    console.log(`Report submitted by ${username} (${discordId}): [${reportType}] ${truncatedDesc}`);

    const embedFields: any[] = [
      { name: 'Type', value: typeLabel, inline: true },
    ];
    if (screenshotUrl) {
      embedFields.push({ name: 'Attachment', value: '📎 Screenshot attached', inline: true });
    }

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '📋 Report Submitted!',
          description: `Thanks, <@${discordId}>! Your report has been sent to the officers.\n\n> ${description.length > 300 ? description.substring(0, 300) + '…' : description}`,
          fields: embedFields,
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
    console.error('Error handling /report command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}
