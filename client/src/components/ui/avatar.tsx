import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

// Enhanced version that supports cache busting
interface EnhancedAvatarImageProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  cacheBuster?: boolean;
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  EnhancedAvatarImageProps
>(({ className, src, cacheBuster = true, onError, ...props }, ref) => {
  // Add a cache-busting parameter if the src is a string and cacheBuster is true
  const processedSrc = React.useMemo(() => {
    if (typeof src === 'string' && src && cacheBuster) {
      // If the URL already has query parameters, append the cache buster
      if (src.includes('?')) {
        return `${src}&v=${Date.now()}`;
      }
      // Otherwise add it as the first query parameter
      return `${src}?v=${Date.now()}`;
    }
    return src;
  }, [src, cacheBuster]);

  // Add logging to help debug image loading issues
  const handleError = React.useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error("Failed to load avatar image:", processedSrc);
    if (onError) onError(e);
  }, [processedSrc, onError]);

  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={processedSrc}
      className={cn("aspect-square h-full w-full", className)}
      onError={handleError}
      {...props}
    />
  );
})
AvatarImage.displayName = "EnhancedAvatarImage";

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  // Log when fallback is used to help debugging
  React.useEffect(() => {
    console.log("Using fallback, no profile picture available");
  }, []);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  );
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
