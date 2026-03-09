/**
 * RecipeDetailModal — Full recipe view in a bottom sheet
 *
 * Shows cover image, ingredients, numbered steps with optional photos,
 * favorite toggle, and author info. Author/officers get edit/delete.
 */

import { useState, useEffect } from 'react';
import {
  ChefHat, Clock, Flame, Heart, Users, Trash2, Edit3, Star, Loader2, Lightbulb, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { isOfficer } from '@/lib/roles';
import { projectId } from '/utils/supabase/info';
import type { RecipeFull } from '@/app/components/cooks-n-cobs-page';
import { timeAgo } from '@/lib/date-utils';

// ── Difficulty Config ──

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: 'Easy', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
  medium: { label: 'Medium', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  hard: { label: 'Hard', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10' },
};

interface RecipeDetailModalProps {
  recipeId: string;
  user: any;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function RecipeDetailModal({
  recipeId, user, isFavorited, onToggleFavorite, onClose, onDelete, onEdit,
}: RecipeDetailModalProps) {
  const [recipe, setRecipe] = useState<RecipeFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const token = localStorage.getItem('supabase_token') || '';
  const isAuthor = recipe?.author_id === user?.id;
  const isOff = isOfficer(user?.role);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes/${recipeId}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('Failed to fetch recipe');
        const data = await res.json();
        setRecipe(data.recipe);
      } catch (err) {
        console.error('Error fetching recipe:', err);
        toast.error('Failed to load recipe');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [recipeId, token]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes/${recipeId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Recipe deleted');
      onDelete();
    } catch (err) {
      console.error('Error deleting recipe:', err);
      toast.error('Failed to delete recipe');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleFeatureToggle = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes/${recipeId}/feature`,
        { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to toggle feature');
      const data = await res.json();
      setRecipe(prev => prev ? { ...prev, is_featured: data.is_featured } : prev);
      toast.success(data.is_featured ? 'Recipe featured!' : 'Recipe unfeatured');
    } catch (err) {
      toast.error('Failed to update featured status');
    }
  };

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const diff = recipe?.difficulty ? DIFFICULTY_CONFIG[recipe.difficulty] : null;
  const totalTime = (recipe?.prep_time_minutes || 0) + (recipe?.cook_time_minutes || 0);

  const getAvatarUrl = () => {
    if (!recipe?.users?.discord_avatar) return null;
    if (recipe.users.discord_avatar.startsWith('http')) return recipe.users.discord_avatar;
    return `https://cdn.discordapp.com/avatars/${recipe.users.discord_id}/${recipe.users.discord_avatar}.png?size=64`;
  };

  return (
    <>
      <BottomSheetModal onClose={onClose} maxWidth="max-w-3xl">
        <BottomSheetModal.Header
          gradient={recipe?.is_corn ? 'from-harvest/15 to-harvest/5' : 'from-[#10b981]/10 to-[#10b981]/5'}
          borderColor={recipe?.is_corn ? 'border-harvest/20' : 'border-[#10b981]/20'}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-harvest animate-spin" />
            </div>
          ) : recipe ? (
            <div className="space-y-3">
              {/* Featured badge + Corn badge */}
              <div className="flex items-center gap-2">
                {recipe.is_featured && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-harvest rounded-md">
                    <Star className="w-3 h-3 text-white fill-white" />
                    <span className="text-[10px] font-bold text-white uppercase">Featured</span>
                  </div>
                )}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                  recipe.is_corn ? 'bg-harvest/20 text-harvest' : 'bg-[#10b981]/20 text-[#10b981]'
                }`}>
                  <span className="text-[10px] font-bold uppercase">
                    {recipe.is_corn ? 'Corn Recipe' : 'Off the Cob'}
                  </span>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-foreground pr-8">
                {recipe.title}
              </h2>

              {recipe.description && (
                <p className="text-sm text-muted-foreground">{recipe.description}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-4 flex-wrap">
                {totalTime > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="font-semibold">{totalTime} min</span>
                    {recipe.prep_time_minutes && recipe.cook_time_minutes ? (
                      <span className="text-xs">({recipe.prep_time_minutes}m prep + {recipe.cook_time_minutes}m cook)</span>
                    ) : null}
                  </div>
                )}
                {diff && (
                  <div className={`flex items-center gap-1.5 text-sm font-bold ${diff.color}`}>
                    <Flame className="w-4 h-4" />
                    <span>{diff.label}</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="font-semibold">{recipe.servings}</span>
                  </div>
                )}
              </div>

              {/* Author + actions row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl()!} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-harvest/20 flex items-center justify-center">
                      <ChefHat className="w-3 h-3 text-harvest" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {recipe.users.discord_username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(recipe.created_at)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Favorite */}
                  <button
                    onClick={() => onToggleFavorite(recipe.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                      isFavorited
                        ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                        : 'bg-muted text-muted-foreground border border-border hover:border-red-500/30 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                    <span>{recipe.favorites_count}</span>
                  </button>

                  {/* Officer: Feature toggle */}
                  {isOff && (
                    <button
                      onClick={handleFeatureToggle}
                      className={`p-2 rounded-lg transition-all ${
                        recipe.is_featured
                          ? 'bg-harvest/20 text-harvest'
                          : 'bg-muted text-muted-foreground hover:text-harvest'
                      }`}
                      title={recipe.is_featured ? 'Unfeature' : 'Feature this recipe'}
                    >
                      <Star className={`w-4 h-4 ${recipe.is_featured ? 'fill-current' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </BottomSheetModal.Header>

        <BottomSheetModal.Body>
          {recipe && (
            <div className="space-y-8">
              {/* Cover Image */}
              {recipe.cover_image_url && (
                <div className="rounded-xl overflow-hidden border-2 border-border">
                  <img
                    src={recipe.cover_image_url}
                    alt={recipe.title}
                    className="w-full h-48 sm:h-64 object-cover"
                  />
                </div>
              )}

              {/* Ingredients */}
              {recipe.ingredients.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-harvest/10 flex items-center justify-center">
                      <ChefHat className="w-4 h-4 text-harvest" />
                    </span>
                    Ingredients
                  </h3>
                  <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                    {recipe.ingredients.map((ing, idx) => (
                      ing.is_section_header ? (
                        <div key={ing.id} className="pt-3 first:pt-0">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-1">
                            {ing.text}
                          </p>
                        </div>
                      ) : (
                        <button
                          key={ing.id}
                          onClick={() => toggleIngredient(idx)}
                          className="w-full flex items-center gap-3 text-left group"
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            checkedIngredients.has(idx)
                              ? 'bg-harvest border-harvest'
                              : 'border-border group-hover:border-harvest/50'
                          }`}>
                            {checkedIngredients.has(idx) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className={`text-sm transition-all ${
                            checkedIngredients.has(idx)
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
                          }`}>
                            {ing.text}
                          </span>
                        </button>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Steps */}
              {recipe.steps.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-harvest/10 flex items-center justify-center">
                      <span className="text-xs font-black text-harvest">1.</span>
                    </span>
                    Steps
                  </h3>
                  <div className="space-y-4">
                    {recipe.steps.map((step) => (
                      <div key={step.id} className="flex gap-3">
                        {/* Step number */}
                        <div className="w-8 h-8 rounded-full bg-harvest flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-black text-white">{step.step_number}</span>
                        </div>

                        <div className="flex-1 space-y-2">
                          <p className="text-sm text-foreground leading-relaxed">
                            {step.instruction}
                          </p>

                          {/* Step image */}
                          {step.image_url && (
                            <div className="rounded-lg overflow-hidden border-2 border-border">
                              <img
                                src={step.image_url}
                                alt={`Step ${step.step_number}`}
                                className="w-full h-32 sm:h-40 object-cover"
                              />
                            </div>
                          )}

                          {/* Pro tip */}
                          {step.tip && (
                            <div className="flex items-start gap-2 bg-harvest/5 border border-harvest/20 rounded-lg p-3">
                              <Lightbulb className="w-4 h-4 text-harvest flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-foreground/80 italic">{step.tip}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Author/Officer actions */}
              {(isAuthor || isOff) && (
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  {isAuthor && (
                    <button
                      onClick={onEdit}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-harvest/10 hover:text-harvest transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Recipe
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 font-semibold text-sm hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </BottomSheetModal.Body>
      </BottomSheetModal>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Recipe"
          message={`Are you sure you want to delete "${recipe?.title}"? This action cannot be undone.`}
          confirmText={deleting ? 'Deleting...' : 'Delete Recipe'}
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
