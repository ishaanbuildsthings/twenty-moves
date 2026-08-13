import { Users } from "lucide-react";

// Renders a club's photo, falling back to a Users icon. `className` controls
// the box size + rounding; `iconClassName` sizes the fallback icon.
export function ClubImage({
  imageUrl,
  name,
  className = "",
  iconClassName = "h-6 w-6",
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-muted ${className}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <Users className={`text-muted-foreground ${iconClassName}`} />
      )}
    </div>
  );
}
