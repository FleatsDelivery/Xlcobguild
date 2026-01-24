export function HomePage({ user }: { user: any }) {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-4">
            Welcome, {user?.discord_username || 'Corny Friend'}!
          </h2>
          <p className="text-[#0f172a]/70">
            This is your guild home. Features coming soon!
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <h3 className="text-lg font-bold text-[#0f172a] mb-2">Your Progress</h3>
          <div className="space-y-2">
            <p className="text-[#0f172a]/70">
              <span className="font-medium">Rank:</span> {user?.ranks?.name || 'Earwig'}
            </p>
            <p className="text-[#0f172a]/70">
              <span className="font-medium">Prestige Level:</span> {user?.prestige_level || 0}
            </p>
            <p className="text-[#0f172a]/70">
              <span className="font-medium">Role:</span> {user?.role || 'guest'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
