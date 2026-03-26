// Shared avatar component that renders a user's profile picture or
// falls back to their first initial. Used in the sidebar, profile page,
// and settings — keeps avatar rendering consistent everywhere.
"use client";

interface UserAvatarProps {
  user: {
    profilePictureUrl: string | null;
    firstName: string;
    lastName: string;
    username: string;
  };
  size?: "sm" | "md" | "lg";
  rounded?: "full" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-16 h-16 text-xl",
  lg: "w-24 h-24 text-4xl",
};

// Scale border radius with avatar size so small avatars
// still look square-ish instead of nearly circular.
const roundedXlBySize = {
  sm: "rounded-md",
  md: "rounded-xl",
  lg: "rounded-xl",
};

export function UserAvatar({
  user,
  size = "md",
  rounded = "xl",
  className = "",
}: UserAvatarProps) {
  const roundedClass = rounded === "full" ? "rounded-full" : roundedXlBySize[size];

  return (
    <div
      className={`${sizeClasses[size]} ${roundedClass} bg-muted flex items-center justify-center font-bold overflow-hidden shrink-0 ${className}`}
    >
      {user.profilePictureUrl ? (
        <img
          src={user.profilePictureUrl}
          alt={user.username}
          className="w-full h-full object-cover"
        />
      ) : (
        `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      )}
    </div>
  );
}
