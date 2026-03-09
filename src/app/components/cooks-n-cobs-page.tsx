/**
 * Cooks n Cobs — Community Recipe Page
 *
 * Two tabs: Corn Recipes / Off the Cob
 * All members can browse; TCF+ can create/edit/delete.
 * Officers can feature/remove recipes.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChefHat, Flame, Clock, Heart, Plus, Star, ArrowLeft, Loader2, Search,
  Wheat, UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';
import { RecipeDetailModal } from '@/app/components/recipe-detail-modal';
import { CreateRecipeModal } from '@/app/components/create-recipe-modal';
import { EditRecipeModal } from '@/app/components/edit-recipe-modal';
import { isOfficer } from '@/lib/roles';

// ── Types ──

export interface Recipe {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  is_corn: boolean;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: string | null;
  difficulty: string | null;
  favorites_count: number;
  is_featured: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  users: {
    discord_username: string;
    discord_avatar: string | null;
    discord_id: string;
  };
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  sort_order: number;
  text: string;
  is_section_header: boolean;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
  image_path: string | null;
  image_url: string | null;
  tip: string | null;
}

export interface RecipeFull extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

// ── Difficulty Config ──

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: 'Easy', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
  medium: { label: 'Medium', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  hard: { label: 'Hard', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10' },
};

// ── Tab config ──

type TabId = 'corn' | 'other';
const TABS: { id: TabId; label: string; icon: typeof Wheat }[] = [
  { id: 'corn', label: 'Corn Recipes', icon: Wheat },
  { id: 'other', label: 'Off the Cob', icon: UtensilsCrossed },
];

// ── Component ──

interface CooksNCobsPageProps {
  user: any;
}

export function CooksNCobsPage({ user }: CooksNCobsPageProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('corn');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editRecipeId, setEditRecipeId] = useState<string | null>(null);

  const token = localStorage.getItem('supabase_token') || '';
  const isTcfPlus = !!user?.tcf_plus_active;
  const isOff = isOfficer(user?.role);

  // ── Fetch recipes ──
  const fetchRecipes = useCallback(async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch recipes');
      const data = await res.json();
      setRecipes(data.recipes || []);
    } catch (err) {
      console.error('Error fetching recipes:', err);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── Fetch user favorites ──
  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes-my-favorites`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setFavoriteIds(new Set(data.recipe_ids || []));
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchRecipes();
    fetchFavorites();
  }, [fetchRecipes, fetchFavorites]);

  // ── Toggle favorite ──
  const handleToggleFavorite = async (recipeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes/${recipeId}/favorite`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to toggle favorite');
      const data = await res.json();

      // Update local state
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (data.favorited) next.add(recipeId);
        else next.delete(recipeId);
        return next;
      });

      // Update recipe favorites_count
      setRecipes(prev => prev.map(r =>
        r.id === recipeId ? { ...r, favorites_count: data.favorites_count } : r
      ));
    } catch (err) {
      console.error('Error toggling favorite:', err);
      toast.error('Failed to update favorite');
    }
  };

  // ── Filtered recipes ──
  const filteredRecipes = useMemo(() => {
    let filtered = recipes.filter(r => activeTab === 'corn' ? r.is_corn : !r.is_corn);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.users.discord_username.toLowerCase().includes(q)
      );
    }
    // Featured first, then by date
    return filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [recipes, activeTab, searchQuery]);

  const cornCount = useMemo(() => recipes.filter(r => r.is_corn).length, [recipes]);
  const otherCount = useMemo(() => recipes.filter(r => !r.is_corn).length, [recipes]);

  // ── Avatar URL helper ──
  const getAvatarUrl = (u: Recipe['users']) => {
    if (!u.discord_avatar) return null;
    if (u.discord_avatar.startsWith('http')) return u.discord_avatar;
    return `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=64`;
  };

  return (
    <div className="px-3 sm:px-4 py-4 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-harvest to-amber flex items-center justify-center shadow-lg">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Cooks n Cobs</h1>
              <p className="text-sm text-muted-foreground font-semibold">Community recipes from The Corn Field</p>
            </div>
          </div>

          {/* Add Recipe Button */}
          {isTcfPlus || isOff ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-harvest text-white rounded-xl font-bold text-sm hover:bg-harvest/90 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Add Recipe</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-5 py-3 bg-muted rounded-xl border-2 border-border">
              <Plus className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">
                Become a TCF+ member to share recipes
              </span>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count = tab.id === 'corn' ? cornCount : otherCount;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                  isActive
                    ? 'bg-harvest/10 border-harvest/40 text-harvest'
                    : 'bg-card border-border text-muted-foreground hover:border-harvest/20 hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-harvest/20 text-harvest' : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest/50 transition-colors text-sm font-semibold"
          />
        </div>

        {/* ── Recipe Grid ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-harvest animate-spin" />
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">
              {searchQuery ? 'No recipes match your search' : 'No recipes yet'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? 'Try a different search term'
                : activeTab === 'corn'
                  ? 'Be the first to share a corn recipe!'
                  : 'Be the first to share a recipe!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isFavorited={favoriteIds.has(recipe.id)}
                onToggleFavorite={handleToggleFavorite}
                onSelect={() => setSelectedRecipeId(recipe.id)}
                getAvatarUrl={getAvatarUrl}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* ── Recipe Detail Modal ── */}
      {selectedRecipeId && (
        <RecipeDetailModal
          recipeId={selectedRecipeId}
          user={user}
          isFavorited={favoriteIds.has(selectedRecipeId)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedRecipeId(null)}
          onDelete={() => {
            setSelectedRecipeId(null);
            fetchRecipes();
          }}
          onEdit={() => {
            const id = selectedRecipeId;
            setSelectedRecipeId(null);
            setEditRecipeId(id);
          }}
        />
      )}

      {/* ── Create Recipe Modal ── */}
      {showCreateModal && (
        <CreateRecipeModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRecipes();
          }}
        />
      )}

      {/* ── Edit Recipe Modal ── */}
      {editRecipeId && (
        <EditRecipeModal
          recipeId={editRecipeId}
          onClose={() => setEditRecipeId(null)}
          onSuccess={() => {
            setEditRecipeId(null);
            fetchRecipes();
          }}
        />
      )}
    </div>
  );
}

// ── Recipe Card ──

interface RecipeCardProps {
  recipe: Recipe;
  isFavorited: boolean;
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
  onSelect: () => void;
  getAvatarUrl: (u: Recipe['users']) => string | null;
}

function RecipeCard({ recipe, isFavorited, onToggleFavorite, onSelect, getAvatarUrl }: RecipeCardProps) {
  const diff = recipe.difficulty ? DIFFICULTY_CONFIG[recipe.difficulty] : null;
  const avatarUrl = getAvatarUrl(recipe.users);
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <button
      onClick={onSelect}
      className="text-left bg-card rounded-2xl border-2 border-border hover:border-harvest/50 transition-all overflow-hidden group"
    >
      {/* Cover image or placeholder */}
      <div className="relative h-40 sm:h-48 bg-muted overflow-hidden">
        {recipe.cover_image_url ? (
          <img
            src={recipe.cover_image_url}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Featured badge */}
        {recipe.is_featured && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-harvest rounded-lg">
            <Star className="w-3 h-3 text-white fill-white" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wide">Featured</span>
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => onToggleFavorite(recipe.id, e)}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isFavorited
              ? 'bg-red-500 text-white shadow-lg'
              : 'bg-black/40 text-white/80 hover:bg-black/60'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-white' : ''}`} />
        </button>
      </div>

      {/* Card body */}
      <div className="p-4 sm:p-5 space-y-3">
        <h3 className="text-base font-bold text-foreground line-clamp-2 leading-tight">
          {recipe.title}
        </h3>

        {recipe.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {recipe.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {totalTime > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold">{totalTime}m</span>
            </div>
          )}
          {diff && (
            <div className={`flex items-center gap-1 text-xs font-bold ${diff.color}`}>
              <Flame className="w-3.5 h-3.5" />
              <span>{diff.label}</span>
            </div>
          )}
          {recipe.favorites_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="w-3.5 h-3.5" />
              <span className="font-semibold">{recipe.favorites_count}</span>
            </div>
          )}
        </div>

        {/* Author */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-harvest/20 flex items-center justify-center">
              <ChefHat className="w-3 h-3 text-harvest" />
            </div>
          )}
          <span className="text-xs font-semibold text-muted-foreground truncate">
            {recipe.users.discord_username}
          </span>
        </div>
      </div>
    </button>
  );
}