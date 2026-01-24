import { Footer } from '@/app/components/footer';

export function LeaderboardPage() {
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-4">Leaderboard</h2>
          <p className="text-[#0f172a]/70">
            Leaderboard coming soon! Here you'll see all guild members ranked by prestige and achievements.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}