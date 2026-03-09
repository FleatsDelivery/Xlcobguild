/**
 * Cooks n Cobs — Recipe System Routes
 *
 * Community recipe sharing for TCF members.
 * TCF+ members can create/edit/delete recipes.
 * All authenticated users can browse, view, and favorite.
 * Officers can feature/unfeature and remove any recipe.
 */

import { PREFIX, requireAuth } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import { createUserActivity, createAdminLog } from "./routes-notifications.ts";
import { DISCORD_WEBHOOKS } from "./discord-config.ts";
import { buildNewRecipeEmbed, sendWebhookEmbed } from "./discord-embeds.tsx";

// ── Types ──

interface RecipePayload {
  title: string;
  description?: string;
  is_corn: boolean;
  cover_image_path?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: string;
  difficulty?: string;
  ingredients: { text: string; is_section_header?: boolean }[];
  steps: { instruction: string; image_path?: string; tip?: string }[];
}

// ── Route Registration ──

export function registerCooksNCobsRoutes(app: any, supabase: any, anonSupabase: any) {

  // ════════════════════════════════════════════════════════
  // GET /recipes — List recipes with optional filters
  // ════════════════════════════════════════════════════════
  app.get(`${PREFIX}/recipes`, async (c: any) => {
    try {
      const url = new URL(c.req.url);
      const isCorn = url.searchParams.get('is_corn'); // 'true' | 'false' | null (all)
      const featured = url.searchParams.get('featured'); // 'true' | null
      const authorId = url.searchParams.get('author_id');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('cooks_n_cobs_recipes')
        .select('*, users!inner(discord_username, discord_avatar, discord_id)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (isCorn === 'true') query = query.eq('is_corn', true);
      if (isCorn === 'false') query = query.eq('is_corn', false);
      if (featured === 'true') query = query.eq('is_featured', true);
      if (authorId) query = query.eq('author_id', authorId);

      const { data: recipes, error, count } = await query;

      if (error) {
        console.error('Error fetching recipes:', error);
        return c.json({ error: `Failed to fetch recipes: ${error.message}` }, 500);
      }

      // Sign cover image URLs for the grid
      const recipesWithCovers = await Promise.all(
        (recipes || []).map(async (recipe: any) => ({
          ...recipe,
          cover_image_url: recipe.cover_image_path
            ? await signImageUrl(supabase, recipe.cover_image_path)
            : null,
        }))
      );

      return c.json({ recipes: recipesWithCovers, count: recipesWithCovers.length });
    } catch (err: any) {
      console.error('Unexpected error in GET /recipes:', err);
      return c.json({ error: `Unexpected error fetching recipes: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // GET /recipes/:id — Full recipe with ingredients + steps
  // ════════════════════════════════════════════════════════
  app.get(`${PREFIX}/recipes/:id`, async (c: any) => {
    try {
      const id = c.req.param('id');

      // Fetch recipe with author info
      const { data: recipe, error: recipeError } = await supabase
        .from('cooks_n_cobs_recipes')
        .select('*, users!inner(discord_username, discord_avatar, discord_id)')
        .eq('id', id)
        .single();

      if (recipeError || !recipe) {
        return c.json({ error: 'Recipe not found' }, 404);
      }

      // Fetch ingredients ordered by sort_order
      const { data: ingredients } = await supabase
        .from('cooks_n_cobs_ingredients')
        .select('*')
        .eq('recipe_id', id)
        .order('sort_order', { ascending: true });

      // Fetch steps ordered by step_number
      const { data: steps } = await supabase
        .from('cooks_n_cobs_steps')
        .select('*')
        .eq('recipe_id', id)
        .order('step_number', { ascending: true });

      // Sign any image URLs
      const signedCover = recipe.cover_image_path
        ? await signImageUrl(supabase, recipe.cover_image_path)
        : null;

      const signedSteps = await Promise.all(
        (steps || []).map(async (step: any) => ({
          ...step,
          image_url: step.image_path
            ? await signImageUrl(supabase, step.image_path)
            : null,
        }))
      );

      return c.json({
        recipe: {
          ...recipe,
          cover_image_url: signedCover,
          ingredients: ingredients || [],
          steps: signedSteps,
        },
      });
    } catch (err: any) {
      console.error('Unexpected error in GET /recipes/:id:', err);
      return c.json({ error: `Unexpected error fetching recipe: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // POST /recipes — Create a new recipe (TCF+ only)
  // ════════════════════════════════════════════════════════
  app.post(`${PREFIX}/recipes`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      // Check TCF+ or officer
      if (!auth.dbUser.tcf_plus_active && !isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'TCF+ membership required to create recipes' }, 403);
      }

      const body: RecipePayload = await c.req.json();

      if (!body.title?.trim()) {
        return c.json({ error: 'Recipe title is required' }, 400);
      }
      if (!body.ingredients?.length) {
        return c.json({ error: 'At least one ingredient is required' }, 400);
      }
      if (!body.steps?.length) {
        return c.json({ error: 'At least one step is required' }, 400);
      }

      // 1. Insert recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('cooks_n_cobs_recipes')
        .insert({
          author_id: auth.dbUser.id,
          title: body.title.trim(),
          description: body.description?.trim() || null,
          is_corn: body.is_corn ?? false,
          cover_image_path: body.cover_image_path || null,
          prep_time_minutes: body.prep_time_minutes || null,
          cook_time_minutes: body.cook_time_minutes || null,
          servings: body.servings?.trim() || null,
          difficulty: body.difficulty || null,
        })
        .select()
        .single();

      if (recipeError || !recipe) {
        console.error('Error creating recipe:', recipeError);
        return c.json({ error: `Failed to create recipe: ${recipeError?.message}` }, 500);
      }

      // 2. Insert ingredients
      if (body.ingredients.length > 0) {
        const ingredientRows = body.ingredients.map((ing, idx) => ({
          recipe_id: recipe.id,
          sort_order: idx,
          text: ing.text.trim(),
          is_section_header: ing.is_section_header || false,
        }));

        const { error: ingError } = await supabase
          .from('cooks_n_cobs_ingredients')
          .insert(ingredientRows);

        if (ingError) {
          console.error('Error inserting ingredients:', ingError);
          // Clean up the recipe if ingredients fail
          await supabase.from('cooks_n_cobs_recipes').delete().eq('id', recipe.id);
          return c.json({ error: `Failed to save ingredients: ${ingError.message}` }, 500);
        }
      }

      // 3. Insert steps
      if (body.steps.length > 0) {
        const stepRows = body.steps.map((step, idx) => ({
          recipe_id: recipe.id,
          step_number: idx + 1,
          instruction: step.instruction.trim(),
          image_path: step.image_path || null,
          tip: step.tip?.trim() || null,
        }));

        const { error: stepError } = await supabase
          .from('cooks_n_cobs_steps')
          .insert(stepRows);

        if (stepError) {
          console.error('Error inserting steps:', stepError);
          await supabase.from('cooks_n_cobs_recipes').delete().eq('id', recipe.id);
          return c.json({ error: `Failed to save steps: ${stepError.message}` }, 500);
        }
      }

      console.log(`🌽 Recipe created: "${recipe.title}" by ${auth.dbUser.discord_username} (${recipe.id})`);

      // Create user activity log
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'recipe_created',
          title: `Published "${recipe.title}"`,
          description: `You shared a new ${body.is_corn ? 'corn' : ''} recipe in Cooks n Cobs.`,
          related_id: recipe.id,
          related_url: '#cooks-n-cobs',
          actor_name: auth.dbUser.discord_username,
        });
      } catch (actErr) {
        console.error('Non-critical: recipe_created activity log failed:', actErr);
      }

      // Discord webhook: new recipe notification (non-critical)
      try {
        const { embed } = buildNewRecipeEmbed({
          recipeTitle: recipe.title, recipeId: recipe.id, isCorn: recipe.is_corn,
          authorUsername: auth.dbUser.discord_username, authorDiscordId: auth.dbUser.discord_id,
          authorAvatar: auth.dbUser.discord_avatar,
          prepTime: recipe.prep_time_minutes, cookTime: recipe.cook_time_minutes,
          servings: recipe.servings, ingredientCount: body.ingredients?.length || 0,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.NEW_RECIPE, embed);
      } catch (whErr) { console.error('Non-critical: new recipe webhook failed:', whErr); }

      return c.json({ recipe }, 201);
    } catch (err: any) {
      console.error('Unexpected error in POST /recipes:', err);
      return c.json({ error: `Unexpected error creating recipe: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // PUT /recipes/:id — Update a recipe (author or officer)
  // ════════════════════════════════════════════════════════
  app.put(`${PREFIX}/recipes/:id`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');
      const body: RecipePayload = await c.req.json();

      // Fetch existing recipe to check ownership
      const { data: existing } = await supabase
        .from('cooks_n_cobs_recipes')
        .select('author_id')
        .eq('id', id)
        .single();

      if (!existing) return c.json({ error: 'Recipe not found' }, 404);

      const isAuthor = existing.author_id === auth.dbUser.id;
      const isOff = isOfficer(auth.dbUser.role);
      if (!isAuthor && !isOff) {
        return c.json({ error: 'You can only edit your own recipes' }, 403);
      }

      // 1. Update recipe row
      const { error: updateError } = await supabase
        .from('cooks_n_cobs_recipes')
        .update({
          title: body.title.trim(),
          description: body.description?.trim() || null,
          is_corn: body.is_corn ?? false,
          cover_image_path: body.cover_image_path || null,
          prep_time_minutes: body.prep_time_minutes || null,
          cook_time_minutes: body.cook_time_minutes || null,
          servings: body.servings?.trim() || null,
          difficulty: body.difficulty || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        return c.json({ error: `Failed to update recipe: ${updateError.message}` }, 500);
      }

      // 2. Replace ingredients (delete + re-insert)
      await supabase.from('cooks_n_cobs_ingredients').delete().eq('recipe_id', id);
      if (body.ingredients?.length) {
        const ingredientRows = body.ingredients.map((ing, idx) => ({
          recipe_id: id,
          sort_order: idx,
          text: ing.text.trim(),
          is_section_header: ing.is_section_header || false,
        }));
        await supabase.from('cooks_n_cobs_ingredients').insert(ingredientRows);
      }

      // 3. Replace steps (delete + re-insert)
      await supabase.from('cooks_n_cobs_steps').delete().eq('recipe_id', id);
      if (body.steps?.length) {
        const stepRows = body.steps.map((step, idx) => ({
          recipe_id: id,
          step_number: idx + 1,
          instruction: step.instruction.trim(),
          image_path: step.image_path || null,
          tip: step.tip?.trim() || null,
        }));
        await supabase.from('cooks_n_cobs_steps').insert(stepRows);
      }

      console.log(`🌽 Recipe updated: "${body.title}" (${id}) by ${auth.dbUser.discord_username}`);

      // Create user activity log
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'recipe_updated',
          title: `Updated "${body.title}"`,
          description: `You updated your recipe in Cooks n Cobs.`,
          related_id: id,
          related_url: '#cooks-n-cobs',
          actor_name: auth.dbUser.discord_username,
        });
      } catch (actErr) {
        console.error('Non-critical: recipe_updated activity log failed:', actErr);
      }

      return c.json({ success: true });
    } catch (err: any) {
      console.error('Unexpected error in PUT /recipes/:id:', err);
      return c.json({ error: `Unexpected error updating recipe: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // DELETE /recipes/:id — Delete a recipe (author or officer)
  // ════════════════════════════════════════════════════════
  app.delete(`${PREFIX}/recipes/:id`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');

      const { data: existing } = await supabase
        .from('cooks_n_cobs_recipes')
        .select('author_id, title')
        .eq('id', id)
        .single();

      if (!existing) return c.json({ error: 'Recipe not found' }, 404);

      const isAuthor = existing.author_id === auth.dbUser.id;
      const isOff = isOfficer(auth.dbUser.role);
      if (!isAuthor && !isOff) {
        return c.json({ error: 'You can only delete your own recipes' }, 403);
      }

      // CASCADE handles ingredients + steps + favorites
      const { error } = await supabase
        .from('cooks_n_cobs_recipes')
        .delete()
        .eq('id', id);

      if (error) {
        return c.json({ error: `Failed to delete recipe: ${error.message}` }, 500);
      }

      // Clean up storage images (non-critical)
      try {
        const { data: files } = await supabase.storage
          .from('make-4789f4af-recipe-images')
          .list(id);
        if (files?.length) {
          const paths = files.map((f: any) => `${id}/${f.name}`);
          await supabase.storage.from('make-4789f4af-recipe-images').remove(paths);
        }
        // Also clean step images subfolder
        const { data: stepFiles } = await supabase.storage
          .from('make-4789f4af-recipe-images')
          .list(`${id}/steps`);
        if (stepFiles?.length) {
          const stepPaths = stepFiles.map((f: any) => `${id}/steps/${f.name}`);
          await supabase.storage.from('make-4789f4af-recipe-images').remove(stepPaths);
        }
      } catch (storageErr) {
        console.error('Non-critical: recipe image cleanup failed:', storageErr);
      }

      console.log(`🌽 Recipe deleted: "${existing.title}" (${id}) by ${auth.dbUser.discord_username}`);

      // Activity logging
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'recipe_deleted',
          title: `Deleted "${existing.title}"`,
          description: `You removed a recipe from Cooks n Cobs.`,
          related_url: '#cooks-n-cobs',
          actor_name: auth.dbUser.discord_username,
        });
        // If officer deleted someone else's recipe, also admin log
        if (!isAuthor && isOff) {
          await createAdminLog({
            type: 'recipe_deleted',
            action: `Deleted recipe "${existing.title}" (authored by someone else)`,
            actor_id: auth.dbUser.id,
            actor_name: auth.dbUser.discord_username,
            details: { recipe_id: id, recipe_title: existing.title },
          });
        }
      } catch (actErr) {
        console.error('Non-critical: recipe_deleted activity log failed:', actErr);
      }

      return c.json({ success: true });
    } catch (err: any) {
      console.error('Unexpected error in DELETE /recipes/:id:', err);
      return c.json({ error: `Unexpected error deleting recipe: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // POST /recipes/:id/favorite — Toggle favorite
  // ════════════════════════════════════════════════════════
  app.post(`${PREFIX}/recipes/:id/favorite`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const recipeId = c.req.param('id');
      const userId = auth.dbUser.id;

      // Check if already favorited
      const { data: existing } = await supabase
        .from('cooks_n_cobs_favorites')
        .select('user_id')
        .eq('user_id', userId)
        .eq('recipe_id', recipeId)
        .maybeSingle();

      if (existing) {
        // Un-favorite
        await supabase
          .from('cooks_n_cobs_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('recipe_id', recipeId);

        // Decrement count
        await supabase.rpc('decrement_favorites_count', { recipe_uuid: recipeId }).catch(() => {
          // Fallback: manual update
          supabase
            .from('cooks_n_cobs_recipes')
            .update({ favorites_count: Math.max(0, 0) }) // Will fix with actual count below
            .eq('id', recipeId);
        });

        // Get accurate count
        const { count } = await supabase
          .from('cooks_n_cobs_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('recipe_id', recipeId);

        await supabase
          .from('cooks_n_cobs_recipes')
          .update({ favorites_count: count || 0 })
          .eq('id', recipeId);

        return c.json({ favorited: false, favorites_count: count || 0 });
      } else {
        // Favorite
        const { error } = await supabase
          .from('cooks_n_cobs_favorites')
          .insert({ user_id: userId, recipe_id: recipeId });

        if (error) {
          return c.json({ error: `Failed to favorite recipe: ${error.message}` }, 500);
        }

        // Get accurate count
        const { count } = await supabase
          .from('cooks_n_cobs_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('recipe_id', recipeId);

        await supabase
          .from('cooks_n_cobs_recipes')
          .update({ favorites_count: count || 0 })
          .eq('id', recipeId);

        return c.json({ favorited: true, favorites_count: count || 0 });
      }
    } catch (err: any) {
      console.error('Unexpected error in POST /recipes/:id/favorite:', err);
      return c.json({ error: `Unexpected error toggling favorite: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // GET /recipes/my-favorites — Get user's favorited recipe IDs
  // ════════════════════════════════════════════════════════
  app.get(`${PREFIX}/recipes-my-favorites`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const { data: favorites } = await supabase
        .from('cooks_n_cobs_favorites')
        .select('recipe_id')
        .eq('user_id', auth.dbUser.id);

      return c.json({ recipe_ids: (favorites || []).map((f: any) => f.recipe_id) });
    } catch (err: any) {
      console.error('Unexpected error in GET /recipes-my-favorites:', err);
      return c.json({ error: `Unexpected error: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // PATCH /recipes/:id/feature — Toggle featured (officer only)
  // ════════════════════════════════════════════════════════
  app.patch(`${PREFIX}/recipes/:id/feature`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      if (!isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Officer access required' }, 403);
      }

      const id = c.req.param('id');

      const { data: recipe } = await supabase
        .from('cooks_n_cobs_recipes')
        .select('is_featured, title')
        .eq('id', id)
        .single();

      if (!recipe) return c.json({ error: 'Recipe not found' }, 404);

      const newFeatured = !recipe.is_featured;

      await supabase
        .from('cooks_n_cobs_recipes')
        .update({ is_featured: newFeatured, updated_at: new Date().toISOString() })
        .eq('id', id);

      console.log(`🌽 Recipe ${newFeatured ? 'featured' : 'unfeatured'}: "${recipe.title}" by ${auth.dbUser.discord_username}`);

      // Admin log for feature toggle
      try {
        await createAdminLog({
          type: 'recipe_featured',
          action: `${newFeatured ? 'Featured' : 'Unfeatured'} recipe "${recipe.title}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { recipe_id: id, is_featured: newFeatured },
        });
      } catch (actErr) {
        console.error('Non-critical: recipe_featured admin log failed:', actErr);
      }

      return c.json({ is_featured: newFeatured });
    } catch (err: any) {
      console.error('Unexpected error in PATCH /recipes/:id/feature:', err);
      return c.json({ error: `Unexpected error: ${err.message}` }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // POST /recipes/upload-image — Upload recipe image (TCF+ only)
  // ════════════════════════════════════════════════════════
  app.post(`${PREFIX}/recipes/upload-image`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      if (!auth.dbUser.tcf_plus_active && !isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'TCF+ membership required' }, 403);
      }

      const formData = await c.req.formData();
      const file = formData.get('file');
      const folder = formData.get('folder') || 'misc';

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file provided' }, 400);
      }

      // Validate size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        return c.json({ error: 'File too large. Maximum 5MB.' }, 400);
      }

      // Validate type
      if (!file.type.startsWith('image/')) {
        return c.json({ error: 'Only image files are allowed' }, 400);
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `${folder}/${filename}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('make-4789f4af-recipe-images')
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Recipe image upload error:', uploadError);
        return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
      }

      return c.json({ path: storagePath });
    } catch (err: any) {
      console.error('Unexpected error in POST /recipes/upload-image:', err);
      return c.json({ error: `Unexpected error: ${err.message}` }, 500);
    }
  });
}

// ── Helper: Sign a storage path into a temporary URL ──

async function signImageUrl(supabase: any, path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from('make-4789f4af-recipe-images')
      .createSignedUrl(path, 3600); // 1 hour
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}