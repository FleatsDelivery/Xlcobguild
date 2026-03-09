/**
 * Merch Product Modal — variant selection + Stripe checkout for Printful products.
 *
 * Opens when a user clicks "View" on a product card. Lets them pick a variant
 * (size/color), set quantity, see the price, and proceed to Stripe Checkout
 * with shipping address collection.
 */

import { useState, useMemo } from 'react';
import { X, Minus, Plus, ShoppingCart, Loader2, Truck, Scale } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { createCheckoutSession } from '@/lib/stripe';
import { saveCheckoutContext, clearCheckoutContext } from '@/lib/checkout-context';

interface PrintfulVariant {
  id: number;
  name: string;
  retail_price: string;
  preview_url: string | null;
}

interface PrintfulProduct {
  id: number;
  name: string;
  thumbnail_url: string;
  variants: PrintfulVariant[];
  retail_price_range: { min: string; max: string };
}

interface MerchProductModalProps {
  product: PrintfulProduct;
  onClose: () => void;
}

/**
 * Try to extract a clean variant label from the full variant name.
 * Printful variants are typically named like "Product Name - Size / Color".
 * We want just "Size / Color" or "Size" etc.
 */
function getVariantLabel(variantName: string, productName: string): string {
  // Remove the product name prefix if present
  let label = variantName;
  if (label.startsWith(productName)) {
    label = label.slice(productName.length).replace(/^\s*[-–—]\s*/, '');
  }
  return label.trim() || variantName;
}

export function MerchProductModal({ product, onClose }: MerchProductModalProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<number>(
    product.variants[0]?.id ?? 0
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.id === selectedVariantId) || product.variants[0],
    [selectedVariantId, product.variants]
  );

  const price = selectedVariant ? parseFloat(selectedVariant.retail_price) : 0;
  const totalPrice = price * quantity;

  // Preview image: selected variant's preview, or product thumbnail
  const previewImage = selectedVariant?.preview_url || product.thumbnail_url;

  // Build variant labels
  const variantLabels = useMemo(
    () => product.variants.map((v) => ({
      id: v.id,
      label: getVariantLabel(v.name, product.name),
      price: parseFloat(v.retail_price),
    })),
    [product.variants, product.name]
  );

  const hasMultipleVariants = product.variants.length > 1;

  const handleBuy = async () => {
    if (!selectedVariant) return;

    setLoading(true);
    setError(null);

    try {
      // Save checkout context before redirecting
      saveCheckoutContext({
        type: 'merch',
        quantity,
        amount: totalPrice,
        productName: product.name,
      });

      const url = await createCheckoutSession({
        type: 'merch',
        quantity,
        merch_variant_id: selectedVariant.id,
        merch_product_name: product.name,
        merch_variant_name: getVariantLabel(selectedVariant.name, product.name),
        merch_price_cents: Math.round(price * 100),
        merch_image_url: previewImage || undefined,
      } as any);

      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to create merch checkout session:', err);
      setError(err.message || 'Something went wrong');
      clearCheckoutContext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border-2 border-border shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product image */}
        {previewImage && (
          <div className="w-full aspect-square bg-muted overflow-hidden rounded-t-2xl sm:rounded-t-2xl">
            <ImageWithFallback
              src={previewImage}
              alt={product.name}
              className="w-full h-full object-contain"
              width={500}
              height={500}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Product name + price */}
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground">{product.name}</h2>
            <p className="text-xl sm:text-2xl font-black text-harvest mt-1">
              ${price.toFixed(2)}
            </p>
          </div>

          {/* Variant selector */}
          {hasMultipleVariants && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                Select Option
              </label>
              <div className="flex flex-wrap gap-2">
                {variantLabels.map((v) => {
                  const isSelected = v.id === selectedVariantId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border-2 transition-all ${
                        isSelected
                          ? 'border-harvest bg-harvest/10 text-harvest'
                          : 'border-border bg-card text-muted-foreground hover:border-harvest/30 hover:text-foreground'
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity selector */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-2">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-muted rounded-xl px-1 py-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-foreground">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {quantity > 1 && (
                <span className="text-sm text-muted-foreground">
                  ${price.toFixed(2)} each
                </span>
              )}
            </div>
          </div>

          {/* Shipping note */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <Truck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Shipping address collected at checkout. Printed & shipped by Printful.
            </p>
          </div>

          {/* Transparency link */}
          <div className="flex items-center gap-1.5 px-1">
            <Scale className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
            <a
              href="#transparency"
              onClick={onClose}
              className="text-[10px] text-muted-foreground/60 hover:text-harvest transition-colors"
            >
              Where does this money go?
            </a>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/20">
              <p className="text-xs text-error font-medium">{error}</p>
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={loading || !selectedVariant}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm sm:text-base font-bold bg-harvest text-silk hover:bg-deep-corn transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Buy Now — ${totalPrice.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}