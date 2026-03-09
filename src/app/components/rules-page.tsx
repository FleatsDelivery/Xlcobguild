import { Footer } from '@/app/components/footer';
import { BookOpen, Trophy, ArrowUp, ArrowDown, Sparkles, Users, Award, Shield, CheckCircle, XCircle } from 'lucide-react';

export function RulesPage() {
  return (
    <div className="min-h-screen bg-background px-3 sm:px-4 py-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Card */}
        <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-harvest/20">
          <div className="flex items-center gap-3 sm:gap-4 mb-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-harvest flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Guild Rules</h2>
              <p className="text-muted-foreground text-xs sm:text-sm">
                How The Corn Field ranks, prestige, and progression work 🌽
              </p>
            </div>
          </div>
        </div>

        {/* Rank System Overview */}
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-harvest" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">Rank System Overview</h3>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              The Corn Field features <span className="font-semibold text-harvest">11 ranks</span> that members progress through by earning MVPs in Dota 2 matches. The rank system is designed to reward consistent gameplay and team participation within The Corn Field community.
            </p>

            <div className="bg-harvest/5 rounded-xl p-4 border-2 border-harvest/20">
              <p className="text-sm font-semibold text-foreground mb-2">🌽 The 11 Ranks (in order):</p>
              <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                <li><span className="font-semibold">Earwig</span> 🐛</li>
                <li><span className="font-semibold">Ugandan Kob</span> 🦌</li>
                <li><span className="font-semibold">Private Maize</span> 🌽</li>
                <li><span className="font-semibold">Specialist Ingredient</span> 🥄</li>
                <li><span className="font-semibold">Corporal Corn Bread</span> 🍞</li>
                <li><span className="font-semibold">Sergeant Husk</span> 🌾</li>
                <li><span className="font-semibold">Sergeant Major Fields</span> 🌻</li>
                <li><span className="font-semibold">Captain Cornhole</span> 🎯</li>
                <li><span className="font-semibold">Major Cob</span> ⭐</li>
                <li><span className="font-semibold">Corn Star</span> 🌟</li>
                <li><span className="font-semibold">Pop'd Kernel</span> 💥 <span className="text-[#fbbf24] font-semibold">(Prestige 5 only)</span></li>
              </ol>
            </div>
          </div>
        </div>

        {/* How to Rank Up */}
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center">
              <ArrowUp className="w-5 h-5 text-[#10b981]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">How to Rank Up</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              To advance through the ranks, you must earn <span className="font-semibold text-harvest">MVP awards</span> by playing Dota 2 with your fellow kernels. Submit your MVP screenshots through the home page!
            </p>

            <div className="space-y-3">
              <div className="bg-[#10b981]/5 rounded-xl p-4 border-2 border-[#10b981]/20">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#10b981] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Valid MVP Submissions</h4>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li><span className="font-semibold text-[#10b981]">Standard MVP:</span> Win a Dota 2 match and earn MVP with <span className="font-semibold">the required amount of guild members</span> in your party.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-[#3b82f6]/5 rounded-xl p-4 border-2 border-[#3b82f6]/20">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Party Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      For standard MVP submissions, the current ruling is that you must have <span className="font-semibold text-harvest">at least 3 guild members</span> in your party (including yourself and your team's coach). This ruling is subject to change at any moment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-harvest/5 rounded-xl p-4 border-2 border-harvest/20">
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-harvest flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Screenshot Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      Submit a clear screenshot showing your MVP award, the match result (win), and the party members. Officers will review and approve valid submissions to rank you up! <span className="font-semibold text-harvest">Add the match ID</span> in your submission for further proof.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#fbbf24]/5 rounded-xl p-4 border-2 border-[#fbbf24]/20">
                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-[#fbbf24] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Additional Rank Up Methods</h4>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      <li><span className="font-semibold text-[#fbbf24]">Battle Cup:</span> Win a Battle Cup! No guild member party requirement.</li>
                      <li><span className="font-semibold text-[#fbbf24]">Kernel Kup:</span> Play in and win a Kernel Kup.</li>
                      <li><span className="font-semibold text-[#fbbf24]">Pop'd Kernel:</span> This is the MVP award for our Kernel Kup tournament. Win this for an additional rank up option.</li>
                      <li><span className="font-semibold text-[#fbbf24]">Guild Leader Rank Up:</span> When a guild member reaches rank Corn Star, they can decide to hand out rank ups (and de-ranks)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How De-Ranks Work */}
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
              <ArrowDown className="w-5 h-5 text-[#ef4444]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">How De-Ranks Work</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              De-ranks occur when a top ranked guild member earns an MVP and instead of prestiging, or ranking someone else up, they decide to rank someone else down! This is only available to the <span className="font-semibold text-harvest">Corn Star rank</span>.
            </p>

            <div className="bg-[#fbbf24]/5 rounded-xl p-4 border-2 border-[#fbbf24]/20">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">💡 Note:</span> De-ranks are reviewed on a case-by-case basis by officers and administrators. If you believe you were de-ranked unfairly, you can appeal to Kernel himself.
              </p>
            </div>
          </div>
        </div>

        {/* Prestige System */}
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#fbbf24]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#fbbf24]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">Prestige System</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Once you reach the maximum rank (Rank 10: Corn Star), you have the option to <span className="font-semibold text-[#fbbf24]">prestige</span>. Prestiging resets your rank back to Rank 1 but increases your prestige level, unlocking exclusive benefits and bragging rights!
            </p>

            <div className="bg-gradient-to-br from-[#fbbf24]/10 to-[#f59e0b]/10 rounded-xl p-4 border-2 border-[#fbbf24]/20">
              <h4 className="font-semibold text-foreground mb-3">✨ Prestige Levels (0-5)</h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⭐</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Prestige 0-4</p>
                    <p className="text-xs text-muted-foreground">Maximum Rank: 10 (Corn Star) 🌟</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#fbbf24]/10 rounded-lg p-3 border border-[#fbbf24]/30">
                  <span className="text-xl">💥</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#fbbf24]">Prestige 5 (MAX)</p>
                    <p className="text-xs text-muted-foreground">Unlocks Rank 11: Pop'd Kernel 💥</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The ultimate achievement! Only Prestige 5 members can reach the legendary Pop'd Kernel rank. Achieving this rank means you are <span className="font-semibold text-[#fbbf24]">protected</span>. You can no longer be de-ranked, in return, you may no longer de-rank anyone else.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#3b82f6]/5 rounded-xl p-4 border-2 border-[#3b82f6]/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">How Prestiging Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5 list-disc ml-4">
                    <li>Reach Rank 10 (Corn Star)</li>
                    <li>An officer or admin will prestige you upon your next MVP request (if you choose to prestige)</li>
                    <li>Your rank resets to Rank 1 (Earwig)</li>
                    <li>Your prestige level increases by 1</li>
                    <li>You keep all your history and achievements</li>
                    <li>You can begin climbing the ranks again!</li>
                    <li>Leaderboards are calculated by highest prestige level followed by highest rank</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rank Up & Rank Down Eligibility */}
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">Eligibility Rules</h3>
          </div>
          
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              {/* Can Be Ranked Up */}
              <div className="bg-[#10b981]/5 rounded-xl p-4 border-2 border-[#10b981]/20">
                <h4 className="font-semibold text-[#10b981] mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Can Be Ranked Up
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li>Members at Rank 1-9 (any prestige level)</li>
                  <li>At max rank (Rank 10, Prestige 0-4)</li>
                  <li>Valid MVP submission approved</li>
                </ul>
              </div>

              {/* Cannot Be Ranked Up */}
              <div className="bg-[#ef4444]/5 rounded-xl p-4 border-2 border-[#ef4444]/20">
                <h4 className="font-semibold text-[#ef4444] mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Cannot Be Ranked Up
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li>At max rank (Rank 11, Prestige 5)</li>
                  <li>Invalid MVP submission</li>
                </ul>
              </div>

              {/* Cannot Be Ranked Down */}
              <div className="bg-[#fbbf24]/5 rounded-xl p-4 border-2 border-[#fbbf24]/20">
                <h4 className="font-semibold text-[#fbbf24] mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Cannot Be Ranked Down
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li>At max rank (Rank 11, Prestige 5)</li>
                  <li>Members at Rank 1 (any prestige level)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Officer & Admin Information */}
        <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-[#3b82f6]/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">Officers & Admins</h3>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Guild officers and administrators are responsible for reviewing MVP submissions, managing ranks, and maintaining a positive guild environment.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 border-2 border-[#3b82f6]/20">
                <p className="font-semibold text-[#3b82f6] mb-2">👮 Officer Powers</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li>Review & approve MVP requests</li>
                  <li>Rank up/down members</li>
                  <li>Issue prestige to eligible members</li>
                  <li>Enforce guild rules</li>
                </ul>
              </div>

              <div className="bg-card rounded-xl p-4 border-2 border-harvest/20">
                <p className="font-semibold text-harvest mb-2">👑 Owner Powers</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                  <li>All officer powers</li>
                  <li>Manage user roles (Guest/Member/Admin)</li>
                  <li>Full guild management access</li>
                  <li>Final authority on appeals</li>
                </ul>
              </div>
            </div>

            <div className="bg-[#3b82f6]/5 rounded-xl p-3 border-2 border-[#3b82f6]/20">
              <p className="text-xs text-muted-foreground text-center">
                Questions about rules? Contact a guild officer or admin in The Corn Field Discord!
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
