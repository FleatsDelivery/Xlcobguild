/**
 * CreateRecipeModal — Single scrollable modal for creating a new recipe.
 *
 * Sections: Basics → Cover Photo → Ingredients → Steps → Publish
 * TCF+ members only (gate is in the parent page).
 */

import { useState, useRef } from 'react';
import {
  ChefHat, Plus, X, Trash2, Upload, Loader2, GripVertical, ArrowUp, ArrowDown,
  Wheat, UtensilsCrossed, Lightbulb, Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { projectId } from '/utils/supabase/info';

interface CreateRecipeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface IngredientItem {
  text: string;
  is_section_header: boolean;
}

interface StepItem {
  instruction: string;
  image_path: string | null;
  image_preview: string | null;
  tip: string;
}

export function CreateRecipeModal({ onClose, onSuccess }: CreateRecipeModalProps) {
  const token = localStorage.getItem('supabase_token') || '';

  // ── Form state ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCorn, setIsCorn] = useState(false);
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([{ text: '', is_section_header: false }]);
  const [steps, setSteps] = useState<StepItem[]>([{ instruction: '', image_path: null, image_preview: null, tip: '' }]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);

  // ── Image upload helper ──
  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large. Max 5MB.');
      return null;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes/upload-image`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      toast.error(err.error || 'Upload failed');
      return null;
    }

    const data = await res.json();
    return data.path;
  };

  // ── Cover image upload ──
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingCover(true);
    const path = await uploadImage(file, 'covers');
    if (path) {
      setCoverImagePath(path);
    } else {
      setCoverPreview(null);
    }
    setUploadingCover(false);
  };

  // ── Step image upload ──
  const handleStepImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, image_preview: ev.target?.result as string } : s));
    };
    reader.readAsDataURL(file);

    setUploadingStep(idx);
    const path = await uploadImage(file, 'steps');
    if (path) {
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, image_path: path } : s));
    } else {
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, image_preview: null } : s));
    }
    setUploadingStep(null);
  };

  // ── Ingredient helpers ──
  const addIngredient = (isSectionHeader = false) => {
    setIngredients(prev => [...prev, { text: '', is_section_header: isSectionHeader }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, text: string) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, text } : ing));
  };

  // ── Step helpers ──
  const addStep = () => {
    setSteps(prev => [...prev, { instruction: '', image_path: null, image_preview: null, tip: '' }]);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof StepItem, value: string | null) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const moveStep = (idx: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= steps.length) return;
    setSteps(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Recipe title is required');
      return;
    }

    const validIngredients = ingredients.filter(i => i.text.trim());
    if (validIngredients.length === 0) {
      toast.error('Add at least one ingredient');
      return;
    }

    const validSteps = steps.filter(s => s.instruction.trim());
    if (validSteps.length === 0) {
      toast.error('Add at least one step');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/recipes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            is_corn: isCorn,
            cover_image_path: coverImagePath,
            prep_time_minutes: prepTime ? parseInt(prepTime) : undefined,
            cook_time_minutes: cookTime ? parseInt(cookTime) : undefined,
            servings: servings.trim() || undefined,
            difficulty: difficulty || undefined,
            ingredients: validIngredients.map(i => ({
              text: i.text.trim(),
              is_section_header: i.is_section_header,
            })),
            steps: validSteps.map(s => ({
              instruction: s.instruction.trim(),
              image_path: s.image_path,
              tip: s.tip.trim() || undefined,
            })),
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create recipe' }));
        throw new Error(err.error);
      }

      toast.success('Recipe published!');
      onSuccess();
    } catch (err: any) {
      console.error('Error creating recipe:', err);
      toast.error(err.message || 'Failed to create recipe');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 border-border bg-input-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest/50 transition-colors text-sm font-semibold";

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-harvest/20 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-harvest" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground">New Recipe</h2>
            <p className="text-xs text-muted-foreground font-semibold">Share with the community</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        <div className="space-y-8">

          {/* ── Section 1: Basics ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-harvest/10 flex items-center justify-center text-harvest text-xs font-black">1</span>
              The Basics
            </h3>

            {/* Title */}
            <input
              type="text"
              placeholder="Recipe title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              maxLength={100}
            />

            {/* Description */}
            <textarea
              placeholder={"Short description (e.g. \"My grandma's famous corn chowder\")"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none h-20`}
              maxLength={300}
            />

            {/* Corn toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">Category:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCorn(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    isCorn
                      ? 'bg-harvest/10 border-harvest/40 text-harvest'
                      : 'bg-card border-border text-muted-foreground hover:border-harvest/20'
                  }`}
                >
                  <Wheat className="w-4 h-4" />
                  Corn
                </button>
                <button
                  onClick={() => setIsCorn(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    !isCorn
                      ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]'
                      : 'bg-card border-border text-muted-foreground hover:border-[#10b981]/20'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Other
                </button>
              </div>
            </div>

            {/* Time / Servings / Difficulty row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Prep (min)</label>
                <input
                  type="number"
                  placeholder="15"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className={inputClass}
                  min={0}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Cook (min)</label>
                <input
                  type="number"
                  placeholder="30"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  className={inputClass}
                  min={0}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Servings</label>
                <input
                  type="text"
                  placeholder="4-6"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className={inputClass}
                >
                  <option value="">--</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Cover Photo ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-harvest/10 flex items-center justify-center text-harvest text-xs font-black">2</span>
              Cover Photo
            </h3>

            {coverPreview ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-border">
                <img src={coverPreview} alt="Cover" className="w-full h-40 sm:h-48 object-cover" />
                {uploadingCover && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
                <button
                  onClick={() => { setCoverPreview(null); setCoverImagePath(null); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-all"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-harvest/50 hover:bg-harvest/5 transition-all">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-semibold text-muted-foreground">Click to upload cover photo</p>
                  <p className="text-xs text-muted-foreground mt-1">Optional — max 5MB</p>
                </div>
              </label>
            )}
          </div>

          {/* ── Section 3: Ingredients ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-harvest/10 flex items-center justify-center text-harvest text-xs font-black">3</span>
              Ingredients
            </h3>

            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {ing.is_section_header ? (
                    <input
                      type="text"
                      placeholder='Section header (e.g. "For the sauce")'
                      value={ing.text}
                      onChange={(e) => updateIngredient(idx, e.target.value)}
                      className={`${inputClass} font-bold italic`}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. 2 ears of fresh corn"
                      value={ing.text}
                      onChange={(e) => updateIngredient(idx, e.target.value)}
                      className={inputClass}
                    />
                  )}
                  <button
                    onClick={() => removeIngredient(idx)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => addIngredient(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-harvest/40 hover:text-harvest transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Ingredient
              </button>
              <button
                onClick={() => addIngredient(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-harvest/40 hover:text-harvest transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Section
              </button>
            </div>
          </div>

          {/* ── Section 4: Steps ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-harvest/10 flex items-center justify-center text-harvest text-xs font-black">4</span>
              Steps
            </h3>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="bg-muted/30 rounded-xl p-4 border-2 border-border space-y-3">
                  {/* Step header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-harvest flex items-center justify-center">
                        <span className="text-xs font-black text-white">{idx + 1}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">Step {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveStep(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveStep(idx, 'down')}
                        disabled={idx === steps.length - 1}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      {steps.length > 1 && (
                        <button
                          onClick={() => removeStep(idx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Instruction */}
                  <textarea
                    placeholder={`What do you do in step ${idx + 1}?`}
                    value={step.instruction}
                    onChange={(e) => updateStep(idx, 'instruction', e.target.value)}
                    className={`${inputClass} resize-none h-20`}
                  />

                  {/* Step image */}
                  {step.image_preview ? (
                    <div className="relative rounded-lg overflow-hidden border-2 border-border">
                      <img src={step.image_preview} alt="" className="w-full h-28 object-cover" />
                      {uploadingStep === idx && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                      <button
                        onClick={() => updateStep(idx, 'image_path', null) || updateStep(idx, 'image_preview', null)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleStepImageUpload(e, idx)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-harvest/40 hover:text-harvest transition-all">
                        <Camera className="w-3.5 h-3.5" />
                        Add photo (optional)
                      </div>
                    </label>
                  )}

                  {/* Pro tip */}
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-harvest mt-3 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Pro tip (optional)"
                      value={step.tip}
                      onChange={(e) => updateStep(idx, 'tip', e.target.value)}
                      className={`${inputClass} text-xs`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addStep}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-harvest/40 hover:text-harvest transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-border text-foreground font-bold text-sm hover:bg-muted transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-harvest text-white font-bold text-sm hover:bg-harvest/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Wheat className="w-4 h-4" />
                Publish Recipe
              </>
            )}
          </button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}