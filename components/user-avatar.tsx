/** a user's picture (google's, for now) w/ their initial as the fallback: while it loads, when there
 * is none, or when the image fails */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  image,
  size = "default",
  className,
}: {
  name: string;
  image?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {image && (
        // google's image host can refuse a request that says which page it came from
        <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className={cn("bg-primary text-primary-foreground font-medium")}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
