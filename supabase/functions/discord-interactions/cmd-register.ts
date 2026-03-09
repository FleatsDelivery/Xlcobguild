// /register slash command handler — Kernel Kup tournament registration
// Supports TCF+ early access during "upcoming" phase
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleRegister(body: any, supabase: any): Promise<Response> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser.id;
    const discordUsername = discordUser.username || discordUser.global_name || 'Unknown';

    if (!discordId) {
      return jsonResponse(errorResponse('Could not identify your Discord account.'));
    }

    // Get the role option
    const options = body.data.options || [];
    const role = options.find((opt: any) => opt.name === 'role')?.value;

    if (!role) {
      return jsonResponse(errorResponse('Please select a role!'));
    }

    // Check if user exists in TCF
    const { data: tcfUser } = await supabase
      .from('users')
      .select('id, discord_username, role, tcf_plus_active')
      .eq('discord_id', discordId)
      .maybeSingle();

    // Check for active tournament — try registration_open first, then upcoming for TCF+ early access
    const { data: regOpenTournament } = await supabase
      .from('kkup_tournaments')
      .select('id, name, status')
      .eq('status', 'registration_open')
      .maybeSingle();

    const { data: upcomingTournament } = await supabase
      .from('kkup_tournaments')
      .select('id, name, status')
      .eq('status', 'upcoming')
      .maybeSingle();

    // Determine which tournament to register for
    let tournament = regOpenTournament;
    let isEarlyAccess = false;

    if (!tournament && upcomingTournament) {
      // Only TCF+ members can register during upcoming phase
      if (tcfUser?.tcf_plus_active) {
        tournament = upcomingTournament;
        isEarlyAccess = true;
      } else {
        // There's an upcoming tournament but user isn't TCF+
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [{
              title: '⏳ Registration Not Open Yet',
              description: `**${upcomingTournament.name}** is coming soon, but registration hasn't opened yet.\n\n✨ **TCF+ members** get early access to registration! Visit the website to learn more.`,
              color: 0xD6A615,
              footer: { text: 'The Corn Field • TCF+ Early Access' },
              timestamp: new Date().toISOString(),
            }],
            components: [{
              type: 1,
              components: [{
                type: 2,
                style: 5,
                label: 'Visit The Corn Field',
                url: 'https://thecornfield.figma.site/',
                emoji: { name: '🌽' },
              }],
            }],
            flags: 64,
          },
        });
      }
    }

    if (!tournament) {
      return jsonResponse(
        errorResponse('No tournament is currently accepting registrations! Check back later.')
      );
    }

    // Check if user has already registered for this tournament
    const { data: existingRegistration } = await supabase
      .from('kkup_registrations')
      .select('id, role')
      .eq('tournament_id', tournament.id)
      .eq('discord_id', discordId)
      .maybeSingle();

    if (existingRegistration) {
      return jsonResponse(
        errorResponse(`You're already registered for ${tournament.name} as a **${existingRegistration.role}**!`)
      );
    }

    // Create registration
    const registrationData = {
      tournament_id: tournament.id,
      user_id: tcfUser?.id || null,
      discord_id: discordId,
      discord_username: discordUsername,
      role: role,
      status: 'pending',
    };

    const { data: registration, error: insertError } = await supabase
      .from('kkup_registrations')
      .insert(registrationData)
      .select()
      .single();

    if (insertError || !registration) {
      console.error('Failed to create registration:', insertError);
      return jsonResponse(errorResponse('Failed to register. Please try again later.'));
    }

    console.log(`KKUP registration created: ${registration.id}${isEarlyAccess ? ' (TCF+ early access)' : ''}`);

    // Role-specific emoji and messaging
    const roleEmoji = role === 'player' ? '🎮' : role === 'coach' ? '📋' : role === 'caster' ? '🎙️' : '👁️';
    const earlyAccessBadge = isEarlyAccess ? '\n\n✨ **TCF+ Early Access** — You registered before public registration opened!' : '';
    const roleFollowUp = role === 'player'
      ? '\n\n👉 Visit the KKUP portal to create or join a team!'
      : role === 'caster'
      ? '\n\n🎙️ An officer will reach out about casting assignments!'
      : '';

    const response = {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '👑 Kernel Kup Registration Successful!',
          description: `<@${discordId}>, you've successfully registered for **${tournament.name}**!\n\n${roleEmoji} **Role:** ${role.charAt(0).toUpperCase() + role.slice(1)}${earlyAccessBadge}${roleFollowUp}`,
          color: 0xF97316,
          timestamp: new Date().toISOString(),
        }],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: 'View KKUP Portal',
            url: 'https://thecornfield.figma.site/#kkup',
            emoji: { name: '👑' },
          }],
        }],
        flags: 64, // Ephemeral
      },
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error handling /register command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}
