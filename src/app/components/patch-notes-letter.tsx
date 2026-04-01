import { useState } from 'react';
import { BookOpen, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export function PatchNotesLetter() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border-2 border-primary/20 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-harvest via-amber to-kernel-gold" />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-harvest font-bold text-sm tracking-widest uppercase mb-1 block">April 1st, 2026</span>
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-kernel-gold" />
            The Final Announcement 🌽
          </h2>
        </div>
      </div>

      <div className="max-w-none text-[15px] sm:text-[16px] leading-relaxed">
        <p className="text-lg italic text-muted-foreground border-l-4 border-harvest pl-4 mb-6">
          A Letter from Kernel
        </p>

        <div className={`space-y-4 text-foreground/90 transition-all duration-500 ${isExpanded ? '' : 'line-clamp-[12]'}`}>
          <p>Hey there folks, Kernel here. Been thinking alot about what The Corn Field is lately.</p>
          
          <p>The Corn Field as is, consists of about 80-90 people in a Discord server. Maybe 20-25 of us are active week to week. Some folks only play Turbo. Some only play with certain groups. Some are lurkers who pop in for Kernel Kup and disappear into the void. It's a little fragmented, and honestly? That's kind of beautiful.</p>
          
          <p>What really has brought us all together in the past, is Kernel Kup.<br/>
          9 Kups. 14 event staff. 21 teams. 46 matches. 52 players. 98 heroes picked. And memories that still make me grin like an idiot when I think about them.</p>
          
          <p>At one point this all felt genuinely impossible to pull off, and yet somehow we did it anyway. I didn't do it alone, and I'm proud of that. Truly.</p>
          
          <p>If you asked me back in 2023 why I started The Corn Field, I don't think I would've had a good answer. I do now tho.</p>
          
          <p>I grew up playing a lot of basketball. Good enough for my area, not good enough for anything past that. Which I think most gingers under 6 foot come to terms with around 8th grade, lol. I stopped playing competitive ball and started playing in rec leagues with my friends, and right around that same time, my late great buddy Sam, got me into Dota. Man, where would I be without Sam. Looking back I was definitely using Dota to fill the competitive void that basketball had left. The baby Mavi years, ahhh. I'm sure a handful of y'all remember baby Mavi. Bring back the Mavi Arc Warden! (it's not coming back, sorry).</p>
          
          <p>Anyway, there's this concept in basketball called the Open Gym. It's a space where anyone can show up and play. Good players, not-so-good players, people trying to get in shape, people just there to run games. It's competitive, but it's welcoming. No real barrier to walk in. That's always been the vibe I wanted for The Corn Field. A place where people can show up, compete, laugh, get better, and just be part of something cool. And Kernel Kup is where we all come together and actually try to knock each other's heads off in the best possible way.</p>
          
          <p>For a while, it really felt like that.</p>
          
          <p>But over the past 18 months or more, something changed. Not with the community, but with me. My priorities shifted. Life got fuller in the best of ways. I've got a career path that actually makes sense for me long-term, a girlfriend who loves me unconditionally, and arguably the cutest dog in the world in Scoops. Things are genuinely good.</p>
          
          <p>But somewhere in there, I started half-assing The Corn Field. Kernel Kups 6, 7, and 8 weren't what they could've been. That's on me. I didn't give them the time or care they deserved, and I think we all felt it. Kernel Kup 9 gave me more than a small spark of hope. Moumpt and Holiday's casting, the way the bracket played out, crowning Bojangles as the ultimate Pudge player! and I remember sitting there thinking, okay, we might actually be able to pull off a Kernel Kup 10.</p>
          
          <p>Soon after the 9th Kup, I made my decision. I don't want to run this thing at 60%. If I'm doing it, I want to do it right. So I've spent the last several months quietly rebuilding everything from the ground up. New Discord server. New bot. New website. New systems. No more duct tape and Google Forms.</p>
          
          <p>So yeah. I'm shutting down The Corn Field, as it exists today.</p>
          
          <p className="text-xl font-bold text-kernel-gold my-6">But this isn't the end. It's quite the opposite. This is The Corn Field 2.0.</p>
          
          <p>The goal hasn't changed. Same open gym, just different building. And this one's built to last.</p>
          
          <p>To everyone who's been part of this community so far, whether you played or casted in a Kup, helped me work on a custom game, dropped an MVP screenshot, or just hung around in the Discord.<br/>
          Thank you. Seriously. This only exists because of you.</p>
          
          <p className="font-bold text-harvest mt-4">Now grab a snack. We got patch notes. 🌽<br/>- Kernel</p>

          <hr className="my-8 border-border" />

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-6 flex items-center gap-2">
            🔥 Core System Changes
          </h3>

          <div className="space-y-8">
            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-kernel-gold mb-3 flex items-center gap-2">
                💸 TCF+ Membership — $20/year ($1.67/month)
              </h4>
              <p className="mb-4">Here's the honest truth about why The Corn Field never got as big as it could've been: I was too scared to charge for anything. I thought keeping it all free was the right call, and what that actually did was limit what I could build. No real website. No custom bot. No prize pool funding. Just Google Forms, Zapier hacks, and vibes.<br/>TCF+ is how we fix that. It's what keeps the lights on and lets us build real things. Here's what you get:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Free Kernel Kup registrations (no ticket needed)</li>
                <li>Early registration access during Upcoming phase</li>
                <li>+1 bonus KKUP ticket on purchase</li>
                <li>Discord soundboard access</li>
                <li>Exclusive Discord &amp; Twitch roles</li>
                <li>2x giveaway entries</li>
                <li>Create &amp; manage up to 20 KKUP teams</li>
                <li>Create &amp; manage your own Guild (Guild Wars)</li>
                <li>Full access to all bot commands</li>
                <li>Access to future community game servers (Valheim + whatever we add)</li>
                <li>Annual birthday reward (opt-in, obviously)</li>
                <li>Anything else I decide to add down the road</li>
                <li>Community Officers will receive free memberships for the duration of being an officer</li>
              </ul>
            </div>

            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                🆓 Free Membership
              </h4>
              <p className="mb-4">Dota is free to play. Discord is free to download. TCF should be free at its core. That's not changing.</p>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Play in Kernel Kup (just gotta grab a ticket)</li>
                <li>Create &amp; manage 1 KKUP team</li>
                <li>Join and participate in Guild Wars</li>
                <li>Enter giveaways</li>
                <li>Access to most bot commands</li>
                <li>Join the DEV TEAM and get GitHub access</li>
                <li>TCF Customer Portal access (powered by Stripe)</li>
              </ul>
            </div>

            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                🎫 Kernel Kup Tickets
              </h4>
              <p className="mb-4">Inspired by Battlecup. Yeah, I just straight up ripped off the format. It works.</p>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>$5 per ticket</li>
                <li>Buy up to 10 at once</li>
                <li>Buy 5, get $1 off</li>
                <li>Ticket Punchcard: every 10 tickets purchased = 1 free ticket</li>
                <li>No expiry, non-refundable</li>
                <li>You can use your tickets on other players in your team</li>
                <li>Unused tickets stay in your Ticket Wallet</li>
                <li>TCF+ members do not need tickets.</li>
              </ul>
            </div>

            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                💰 The 95/5 Rule
              </h4>
              <p className="mb-4">Simple, transparent, and honestly one of my favorite things about how this is set up. Here's how every dollar that comes into TCF gets handled:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Stripe takes ~$0.30 + 2.9% per transaction (that's just how it works)</li>
                <li>After fees: 95% goes straight to Kernel Kup prize pools. That money lives in Stripe.</li>
                <li>5% goes toward infrastructure: domain, APIs, dev tools, etc. That gets pulled out every 1-3 months as needed.</li>
              </ul>
              <p className="mt-4 italic">This applies to everything: memberships, tickets, donations, merch. I don't pocket prize pool money. Ever. But I will buy myself a redbull every now and then! Consider that infrastructure, lol.</p>
            </div>

            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                💸 Prize Pool Payouts — Stripe Connect
              </h4>
              <p>For the first time ever I can actually pay people without needing their Venmo or PayPal! And that really excites me. Stripe Connect handles all of it. It's the same system DoorDash uses to pay Dashers. It takes about 5-10 minutes to set up once, and then you're good forever. Covers most countries and banks. I'll be dropping a setup guide soon but as always, just hit me up on Discord or Steam if you get stuck.</p>
            </div>

            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                🛍️ Merch — Powered by Printful
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-4">
                <li>Print-on-demand: they handle production, shipping, and returns</li>
                <li>We charge $2.50 on top of their base cost per item</li>
                <li>That $2.50 is subject to the 95/5 rule</li>
                <li>Win a Kup? You can take your prize as cash or equivalent merch value</li>
                <li>Want to see a new product in the shop? Reach out to me and I'll work on it</li>
              </ul>
            </div>

            <div className="bg-muted/50 dark:bg-black/20 p-6 rounded-xl border border-border">
              <h4 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                ❤️ Donations
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-4">
                <li>Fully optional, always</li>
                <li>You can add a note for how you'd like it used and I'll do my best to honor it</li>
                <li>Subject to the 95/5 rule</li>
              </ul>
            </div>
          </div>

          <hr className="my-8 border-border" />

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-6 flex items-center gap-2">
            🏆 Kernel Kup — Season 4
          </h3>
          <p className="mb-6">I bet a lot of you didn't even know we did Kernel Kup in seasons. We do. Seasons 1-3 were 3 Kups each. Season 4 is going to cover Kups 10 and 11, and I have no current plans beyond that. Let's not get ahead of ourselves.<br/>The biggest changes this season are the ticketing system (covered above) and the Remote Production Booth, which I'll get to in a sec.</p>

          <div className="space-y-6 pl-2 border-l-2 border-primary/30 ml-2">
            <div>
              <h4 className="text-lg font-bold text-harvest mb-2">Format</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>8 teams, single elimination, 2-day event</li>
                <li>New rank limits: Herald 1 — Divine 1</li>
                <li>Day 1: Heaps n' Reaps 10v10 pre-show → Quarterfinals (Bo3) → Semifinals (Bo1)</li>
                <li>Day 2: Grand Finals (Bo5)</li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold text-harvest mb-2">Entry System</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Registration handled on the website during Registration Open phase</li>
                <li>TCF+ members get early KKUP registration during the Upcoming phase</li>
                <li>Players &amp; Coaches can both create teams to become a Team Captain</li>
                <li>Coaches are ineligible to play, however they are allowed in game and in discord.</li>
                <li>Each team needs 5 tickets applied to lock in (TCF+ members count as a ticket)</li>
                <li>First come, first served. First 8 teams to lock their rosters are in</li>
                <li>If teams drop out, registration can reopen</li>
                <li>Less than 8 teams = bracket byes</li>
                <li>Teams seeded by Team Rank (average of all player ranks on the roster, coaches included)</li>
                <li>Unranked players will be asked to provide an accurate estimated rank</li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold text-harvest mb-2">Tournament Phases</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li><strong>Upcoming</strong> — tournament scheduled, TCF+ early reg open, auto-transitions on set date</li>
                <li><strong>Registration Open</strong> — open to everyone until the Registration Closed date</li>
                <li><strong>Registration Closed</strong> — no new registrations, time to build your teams</li>
                <li><strong>Roster Lock</strong> — rosters are final, no more adding or dropping players</li>
                <li><strong>Live</strong> — games are happening, website shows live data with the same Dota TV delay set in lobby</li>
                <li><strong>Completed</strong> — all games done, match data under review, prizes distributing soon</li>
                <li><strong>Archived</strong> — everything verified, prizes out, Kup officially part of history</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-bold text-harvest mb-2">Base Prize Pool — $150</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>$50 → 1st Place</li>
                <li>$20 → 2nd Place (making it to the Grand Finals now results in automatic prize money!)</li>
                <li>$5 → Pop'd Kernel (highest KDA in the tournament)</li>
                <li>$20 → Match of the Night (Day 1 only, voted on by viewers in Discord)</li>
                <li>$50 → Staff Pay Pool (~$5 per staff member per day)</li>
                <li>$5 → Giveaway (you'll find this on the website's giveaway page)</li>
                <li className="italic text-muted-foreground mt-2">All of these scale proportionally with donations.</li>
                <li className="font-bold text-kernel-gold mt-2">💥 Rampage Bounty: first 5 rampages in a Kup = $1 each. Kernel's idea. Of course it was.</li>
              </ul>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-2">
            🎥 New Feature: Remote Production Booth (RPB)
          </h3>
          <p className="mb-4">This is probably the change I'm most excited about from a production standpoint. If you've ever casted a Kernel Kup, you know what it was like: you had to run the lobby, manage the stream, keep the bracket updated, do post-game interviews, AND actually cast the game. It was a lot. It was too much.<br/>The RPB fixes this. Each stream now gets a dedicated Producer who handles:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-4">
            <li>Lobby management</li>
            <li>Overlays and on-screen graphics</li>
            <li>Live data pulled from the website</li>
            <li>Stream coordination</li>
          </ul>
          <p className="mb-4 font-semibold text-kernel-gold">The goal is for casters to finally be able to just cast.</p>
          <p className="mb-6">You can sign up to be a Staff Member during the registration period of any tournament. Head to the tournament page, register as staff, and select your desired role. An officer will review and approve your application.</p>

          <h4 className="text-lg font-bold text-harvest mb-2">Tournament Roles &amp; Responsibilities</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-8">
            <li><strong>Player:</strong> Must be Divine 1 or lower. You're here to play.</li>
            <li><strong>Coach:</strong> Any rank, but you're not touching the keyboard in a match. Coaches are ineligible to play but can be in voice chat and in game with their team. Coach your heart out</li>
            <li><strong>Staff - Caster:</strong> The faces of the tournament. You know what to do.</li>
            <li><strong>Staff - Producer:</strong> In lobby with the casters, handling ticket management and running the on-stream graphics through the RPB. The unsung heroes.</li>
            <li><strong>Staff - Helper:</strong> Primary objective: do thy bidding of the other staff roles. Meant for folks who want to be involved in an indirect way</li>
            <li><strong>Staff - Tournament Director:</strong> Mavi and Kernel. The folks running the show.</li>
          </ul>

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-2">
            ⚔️ Guild Wars
          </h3>
          <p className="mb-4">Remember the guild's rank up/down/prestige system? The problem with it was always the 50-member cap, the manual rank updates, and the fact that there was no real way to show a leaderboard. Guild Wars fixes all of that by moving it to the website.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-4">
            <li>More than 50 people can participate now</li>
            <li>Submit MVPs via the website or with `/mvp` in Discord</li>
            <li>Discord roles sync automatically when you rank up or down</li>
            <li>Compete within your guild and against other guilds</li>
            <li>Not everyone fits in XLCOB and not everyone wants to be in it — Guild Wars is for everyone</li>
            <li>No more minimum party requirement for MVP submissions. You get an MVP, submit it!</li>
          </ul>
          <p className="mb-8">The guild rank system isn't going anywhere. Annual rule voting will continue. It's a tradition at this point. And I need to make a quick shoutout to Bojangles for coming up with the XLCOB guild tag in the first place, what an icon.</p>

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-2">
            🤖 New Discord Server + Bot
          </h3>
          <p className="mb-4">The old server is done. The new one is built from scratch with our custom bot baked in. Everything syncs to the website. Here's what the bot can do:</p>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-4">
            <li>Sync team voice channels to registered team names when a tournament enters the Roster Lock phase</li>
            <li>Sync your website and Discord roles automatically</li>
            <li>Sync Guild Wars rank to your Discord role for an in-server leaderboard</li>
            <li>Automated Kernel Kup bracket updates</li>
            <li>Automated DMs to players when they're about to play</li>
          </ul>
          <h4 className="text-lg font-bold text-harvest mb-2">Available commands:</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-4 font-mono text-xs sm:text-sm">
            <li><span className="text-kernel-gold">/help</span> – list of all commands</li>
            <li><span className="text-kernel-gold">/website</span> – quick link to kernelkup.com</li>
            <li><span className="text-kernel-gold">/createparty</span> – fun party creator, better way to ping people when you wanna run games</li>
            <li><span className="text-kernel-gold">/guildwars</span> – top guilds and players leaderboard</li>
            <li><span className="text-kernel-gold">/kkup</span> – look up archived Kernel Kup results</li>
            <li><span className="text-kernel-gold">/hof</span> – look up the most successful teams and players in Kernel Kup history</li>
            <li><span className="text-kernel-gold">/mvp</span> – use this to upload your MVP submissions</li>
            <li><span className="text-kernel-gold">/suggestion</span> – meant for sending suggestions directly to community officers</li>
            <li><span className="text-kernel-gold">/report</span> – meant for sending reports directly to community officers</li>
          </ul>
          <p className="mb-8">Also has a custom self-service role kiosk, which you'll find in the #select-ur-roles channel. It's real now, not a Zapier hack.</p>

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-2">
            🎮 Upcoming Events
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-8">
            <li><strong>Kernel Kup 10</strong> — Captains Mode (5v5) The big one.</li>
            <li><strong>Kernel Kup 11</strong> — Heaps n' Hooks (1v1) Our second ever 1v1 tournament!</li>
          </ul>

          <h4 className="text-xl font-bold text-foreground mb-4">Heaps n' Reaps Custom Game Update</h4>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-8">
            <li>Now 10v10 (was 5v5)</li>
            <li>Custom in-game UI to support up to 20 players</li>
            <li>Custom loading screen (never had one before)</li>
            <li>All spells modified, now includes phase shift</li>
            <li>First to 100 kills, or most kills after 10 minutes wins</li>
          </ul>

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-2">
            📺 New YouTube Videos — Dropping April 1st
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-8 font-semibold">
            <li>1:30pm EST — Discord Soundbite Clips</li>
            <li>1:45pm EST — TCF Valheim Day 1000 Slideshow</li>
            <li>2:00pm EST — Kernel Kup 9: Hooks n' Highlights</li>
            <li>3:00pm EST — Kernel Kup 9: Bojangles vs Mavi Highlights</li>
          </ul>

          <h3 className="text-2xl font-bold text-foreground mt-10 mb-4 flex items-center gap-2">
            🚧 Still Being Worked On
          </h3>
          <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base mb-8">
            <li>Website: Guild Wars, Kernel Kup Registration</li>
            <li>Stripe Connect Guide - How to setup prize payouts</li>
            <li>Remote Production Booth</li>
            <li>Twitch Bot/Extensions</li>
            <li>Discord bot functionality</li>
            <li>Updates to custom games: Hide &amp; Heap and Axe's Dunk Contest</li>
          </ul>

          <div className="mt-12 p-6 bg-kernel-gold/10 rounded-xl border border-kernel-gold/30 text-center">
            <p className="text-xl font-bold text-kernel-gold mb-2">The Corn Field isn't going away. It's finally becoming what it was always supposed to be.</p>
            <p className="text-lg text-foreground mb-4">Kernel Kup 10 is next.</p>
            <p className="text-2xl font-bold text-harvest uppercase tracking-wider">Let's run it back. 🌽</p>
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <div className={`mt-6 pt-4 flex justify-center ${!isExpanded ? 'border-t-0 relative' : 'border-t border-border'}`}>
        {!isExpanded && (
          <div className="absolute bottom-full left-0 w-full h-32 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-full transition-colors z-10"
        >
          {isExpanded ? (
            <>
              Show Less <ChevronUp className="w-5 h-5" />
            </>
          ) : (
            <>
              Read Full Announcement <ChevronDown className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
