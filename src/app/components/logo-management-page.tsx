import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Upload,
  Search,
  Save,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { toast } from "sonner";
import { TeamLogo } from "@/app/components/team-logo";

interface StorageFile {
  name: string;
  path: string;
  url: string;
  isFolder: boolean;
}

interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  kernel_kup_id: string;
  tournament: {
    id: string;
    name: string;
  };
}

interface LogoMapping {
  team_id: string;
  logo_path: string;
  logo_url: string;
}

export function LogoManagementPage() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [mappings, setMappings] = useState<Record<string, LogoMapping>>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchTeams();
    fetchFiles("");
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/all-teams`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch teams");
      }

      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (path: string) => {
    try {
      setLoadingFiles(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/storage/list?path=${encodeURIComponent(path)}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data.files || []);
      setCurrentPath(path);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load storage files");
    } finally {
      setLoadingFiles(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetchFiles(newPath);
  };

  const navigateUp = () => {
    const pathParts = currentPath.split("/");
    pathParts.pop();
    const newPath = pathParts.join("/");
    fetchFiles(newPath);
  };

  const assignLogoToTeam = (teamId: string, file: StorageFile) => {
    setMappings((prev) => ({
      ...prev,
      [teamId]: {
        team_id: teamId,
        logo_path: file.path,
        logo_url: file.url,
      },
    }));
    toast.success("Logo assigned! Click Save Changes to update.");
  };

  const removeLogoMapping = (teamId: string) => {
    setMappings((prev) => {
      const newMappings = { ...prev };
      delete newMappings[teamId];
      return newMappings;
    });
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("supabase_token");
      const mappingArray = Object.values(mappings);

      if (mappingArray.length === 0) {
        toast.error("No changes to save");
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/teams/update-logos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mappings: mappingArray }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update logos");
      }

      const data = await response.json();
      toast.success(`✅ ${data.message}`, {
        description: `Updated ${data.updated} team logos`,
      });

      // Clear mappings and refresh teams
      setMappings({});
      fetchTeams();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Group teams by tournament
  const teamsByTournament = teams.reduce((acc, team) => {
    const tournamentName = team.tournament?.name || "Unknown Tournament";
    if (!acc[tournamentName]) {
      acc[tournamentName] = [];
    }
    acc[tournamentName].push(team);
    return acc;
  }, {} as Record<string, Team[]>);

  // Filter teams by search term
  const filteredTeamsByTournament = Object.entries(teamsByTournament).reduce(
    (acc, [tournamentName, tournamentTeams]) => {
      const filtered = tournamentTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[tournamentName] = filtered;
      }
      return acc;
    },
    {} as Record<string, Team[]>
  );

  // Filter files by search term
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isOwner = currentUser?.role === "owner";

  if (!isOwner) {
    return (
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4 min-h-screen bg-[#fdf5e9]">
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[#f97316]" />
            <h1 className="text-2xl font-bold text-[#0f172a] mb-4">
              Access Denied
            </h1>
            <p className="text-[#0f172a]/60 mb-6">
              Only owners can access the logo management tool.
            </p>
            <Button
              onClick={() => (window.location.hash = "#kernel-kup")}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Kernel Kup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4 min-h-screen bg-[#fdf5e9]">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-[#f97316] animate-spin" />
        </div>
      </div>
    );
  }

  const hasUnsavedChanges = Object.keys(mappings).length > 0;

  return (
    <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4 min-h-screen bg-[#fdf5e9]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Button
            onClick={() => (window.location.hash = "#kernel-kup")}
            className="bg-white hover:bg-[#0f172a]/5 text-[#0f172a] border-2 border-[#0f172a]/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Kernel Kup
          </Button>

          <div className="bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-3xl p-8 sm:p-12">
            <div className="flex items-center gap-4 mb-4">
              <ImageIcon className="w-10 h-10 text-white" />
              <h1 className="text-4xl sm:text-5xl font-black text-white">
                Team Logo Management
              </h1>
            </div>
            <p className="text-white/90 text-lg">
              Browse uploaded logos in storage and assign them to teams
            </p>
          </div>
        </div>

        {/* Save Changes Bar */}
        {hasUnsavedChanges && (
          <div className="bg-[#10b981] rounded-xl p-4 border-2 border-[#10b981]/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-white" />
              <div>
                <p className="font-bold text-white">
                  {Object.keys(mappings).length} unsaved change
                  {Object.keys(mappings).length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-white/80">
                  Click Save Changes to update team logos
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setMappings({})}
                className="bg-white/20 hover:bg-white/30 text-white border-2 border-white/40"
              >
                Cancel
              </Button>
              <Button
                onClick={saveChanges}
                disabled={saving}
                className="bg-white text-[#10b981] hover:bg-white/90 font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-xl border-2 border-[#0f172a]/10 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0f172a]/40" />
            <input
              type="text"
              placeholder="Search teams or files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Storage Browser */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FolderOpen className="w-6 h-6 text-[#f97316]" />
                  <h2 className="text-2xl font-bold text-[#0f172a]">
                    Storage Browser
                  </h2>
                </div>
                {currentPath && (
                  <Button
                    size="sm"
                    onClick={navigateUp}
                    className="bg-[#0f172a]/5 hover:bg-[#0f172a]/10 text-[#0f172a] border-2 border-[#0f172a]/10"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Up
                  </Button>
                )}
              </div>

              {/* Current Path */}
              <div className="mb-4 p-3 bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10">
                <p className="text-sm font-semibold text-[#0f172a]/60">
                  Current Path:
                </p>
                <p className="text-[#0f172a] font-mono">
                  /{currentPath || "root"}
                </p>
              </div>

              {/* Files List */}
              {loadingFiles ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#f97316] animate-spin" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-[#0f172a]/20" />
                  <p className="text-[#0f172a]/60">
                    {searchTerm ? "No files match your search" : "No files in this folder"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredFiles.map((file) =>
                    file.isFolder ? (
                      <button
                        key={file.path}
                        onClick={() => navigateToFolder(file.name)}
                        className="w-full flex items-center gap-3 p-3 bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10 hover:border-[#f97316]/30 transition-all text-left"
                      >
                        <FolderOpen className="w-5 h-5 text-[#f97316]" />
                        <span className="font-semibold text-[#0f172a]">
                          {file.name}
                        </span>
                      </button>
                    ) : (
                      <div
                        key={file.path}
                        className="flex items-center gap-3 p-3 bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10"
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-12 h-12 rounded border-2 border-[#0f172a]/10 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#0f172a] text-sm truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-[#0f172a]/40 truncate">
                            {file.path}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Teams List */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
              <div className="flex items-center gap-3 mb-6">
                <ImageIcon className="w-6 h-6 text-[#f97316]" />
                <h2 className="text-2xl font-bold text-[#0f172a]">
                  Teams ({teams.length})
                </h2>
              </div>

              {Object.keys(filteredTeamsByTournament).length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[#0f172a]/20" />
                  <p className="text-[#0f172a]/60">
                    {searchTerm ? "No teams match your search" : "No teams found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[600px] overflow-y-auto">
                  {Object.entries(filteredTeamsByTournament).map(
                    ([tournamentName, tournamentTeams]) => (
                      <div key={tournamentName}>
                        <h3 className="text-lg font-bold text-[#0f172a] mb-3 sticky top-0 bg-white py-2">
                          {tournamentName}
                        </h3>
                        <div className="space-y-2">
                          {tournamentTeams.map((team) => {
                            const pendingMapping = mappings[team.id];
                            const displayLogoUrl =
                              pendingMapping?.logo_url || team.logo_url;

                            return (
                              <div
                                key={team.id}
                                className="p-4 bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10"
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <TeamLogo
                                    logoUrl={displayLogoUrl}
                                    teamName={team.name}
                                    size="md"
                                  />
                                  <div className="flex-1">
                                    <p className="font-bold text-[#0f172a]">
                                      {team.name}
                                    </p>
                                    {team.tag && (
                                      <p className="text-sm text-[#0f172a]/60">
                                        {team.tag}
                                      </p>
                                    )}
                                    {pendingMapping && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-[#10b981]" />
                                        <span className="text-xs font-semibold text-[#10b981]">
                                          New logo assigned
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* File Selector */}
                                <div className="space-y-2">
                                  <label className="block text-xs font-semibold text-[#0f172a]/60">
                                    Assign Logo:
                                  </label>
                                  <select
                                    onChange={(e) => {
                                      const selectedFile = files.find(
                                        (f) => f.path === e.target.value
                                      );
                                      if (selectedFile) {
                                        assignLogoToTeam(team.id, selectedFile);
                                      }
                                    }}
                                    value={pendingMapping?.logo_path || ""}
                                    className="w-full px-3 py-2 text-sm border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
                                  >
                                    <option value="">
                                      Select from current folder...
                                    </option>
                                    {files
                                      .filter((f) => !f.isFolder)
                                      .map((file) => (
                                        <option key={file.path} value={file.path}>
                                          {file.name}
                                        </option>
                                      ))}
                                  </select>

                                  {pendingMapping && (
                                    <Button
                                      size="sm"
                                      onClick={() => removeLogoMapping(team.id)}
                                      className="w-full bg-white hover:bg-[#0f172a]/5 text-[#0f172a] border-2 border-[#0f172a]/10"
                                    >
                                      Cancel Change
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-[#3b82f6]/10 border-2 border-[#3b82f6]/20 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-[#3b82f6] flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <p className="font-bold text-[#0f172a]">💡 How to use:</p>
              <ol className="text-sm text-[#0f172a]/80 space-y-1 list-decimal list-inside">
                <li>Navigate through folders in the Storage Browser to find your logos</li>
                <li>Use the dropdown on each team card to select a logo from the current folder</li>
                <li>You'll see a green checkmark when a new logo is assigned</li>
                <li>Click "Save Changes" at the top to update all teams at once</li>
              </ol>
              <p className="text-xs text-[#0f172a]/60 mt-3">
                Tip: Upload your files in the Supabase Storage dashboard organized by tournament (e.g., kkup4/, kkup5/)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
