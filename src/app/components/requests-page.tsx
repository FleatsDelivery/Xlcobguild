export function RequestsPage({ user }: { user: any }) {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-4">
            {user?.role === 'admin' || user?.role === 'owner' ? 'Admin Requests' : 'My Requests'}
          </h2>
          <p className="text-[#0f172a]/70">
            {user?.role === 'admin' || user?.role === 'owner' 
              ? 'View and manage all pending requests from guild members.' 
              : 'View your submitted requests and their status.'}
          </p>
        </div>
      </div>
    </div>
  );
}
