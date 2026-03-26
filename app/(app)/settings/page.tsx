"use client";

import { useState, useEffect, useRef } from "react";
import { useViewer } from "@/lib/hooks/useViewer";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Loader2, Camera, ChevronDown } from "lucide-react";
import { COUNTRIES, countryCodeToFlag } from "@/lib/countries";
import { UserAvatar } from "@/lib/components/user-avatar";
import { validateAvatarFile, uploadAvatar, deleteAvatar, ACCEPTED_IMAGE_TYPES } from "@/lib/supabase/upload-avatar";

type EditingField = "firstName" | "lastName" | "username" | null;

export default function SettingsPage() {
  const { viewer, setViewer } = useViewer();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Debounced username for availability check.
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Profile picture upload state.
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce username input — only check after 400ms of no typing.
  useEffect(() => {
    if (editingField !== "username") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedUsername(editValue);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editValue, editingField]);

  // Check username availability.
  const shouldCheckUsername =
    editingField === "username" &&
    debouncedUsername.length >= 3 &&
    debouncedUsername !== viewer.username;

  const usernameCheck = useQuery({
    ...trpc.user.checkUsername.queryOptions({ username: debouncedUsername }),
    enabled: shouldCheckUsername,
  });

  const updateMutation = useMutation({
    ...trpc.user.updateProfile.mutationOptions(),
    onSuccess: (updatedUser) => {
      setViewer(updatedUser);
      // Update the profile page cache so navigating there shows fresh data.
      queryClient.setQueryData(
        trpc.user.getByUsername.queryKey({ username: updatedUser.username }),
        updatedUser,
      );
      setEditingField(null);
      setEditValue("");
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const startEditing = (field: EditingField) => {
    if (!field) return;
    setEditingField(field);
    setEditValue(viewer[field]);
    setError(null);
    setDebouncedUsername("");
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue("");
    setError(null);
    setDebouncedUsername("");
  };

  const saveField = () => {
    if (!editingField || editValue === viewer[editingField]) {
      cancelEditing();
      return;
    }
    // Don't save if username check is pending or username is taken.
    if (editingField === "username" && editValue !== viewer.username) {
      if (!usernameCheck.data || !usernameCheck.data.available) {
        return;
      }
    }
    updateMutation.mutate({ [editingField]: editValue });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveField();
    if (e.key === "Escape") cancelEditing();
  };

  const handlePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setPictureError(validationError);
      return;
    }

    setPictureError(null);
    setUploadingPicture(true);

    try {
      const profilePictureUrl = await uploadAvatar(file);
      const updatedUser = await updateMutation.mutateAsync({ profilePictureUrl });
      setViewer(updatedUser);
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPicture(false);
    }
  };

  const handlePictureDelete = async () => {
    setPictureError(null);
    setUploadingPicture(true);
    try {
      await deleteAvatar();
      const updatedUser = await updateMutation.mutateAsync({ profilePictureUrl: null });
      setViewer(updatedUser);
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setUploadingPicture(false);
    }
  };

  // Username validation state for the UI.
  const getUsernameStatus = () => {
    if (editingField !== "username") return null;
    if (editValue === viewer.username) return null;
    if (editValue.length < 3) return { valid: false, message: "Min 3 characters" };
    if (debouncedUsername !== editValue) return { valid: null, message: "Checking..." };
    if (usernameCheck.isLoading) return { valid: null, message: "Checking..." };
    if (usernameCheck.data?.available) return { valid: true, message: "Available" };
    if (usernameCheck.data && !usernameCheck.data.available) return { valid: false, message: "Already taken" };
    return null;
  };

  const usernameStatus = getUsernameStatus();

  const fields = [
    { key: "firstName" as const, label: "First name" },
    { key: "lastName" as const, label: "Last name" },
    { key: "username" as const, label: "Username", prefix: "@" },
  ];

  return (
    <div className="flex flex-1 flex-col p-8 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Profile section */}
      <section className="space-y-1 mb-8">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
          Profile
        </h2>

        {/* Profile picture */}
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPicture}
            className="relative group shrink-0"
          >
            <UserAvatar user={viewer} size="md" rounded="xl" />
            <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingPicture ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            className="hidden"
            onChange={handlePictureUpload}
          />
          <div>
            <p className="text-sm font-medium">Profile photo</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
            {viewer.profilePictureUrl && (
              <button
                className="text-xs text-red-500 hover:text-red-400 transition-colors mt-1"
                onClick={handlePictureDelete}
                disabled={uploadingPicture}
              >
                Remove photo
              </button>
            )}
            {pictureError && <p className="text-xs text-red-500 mt-1">{pictureError}</p>}
          </div>
        </div>

        {fields.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between py-3 border-b border-border"
          >
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">{field.label}</p>
              {editingField === field.key ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {field.prefix && (
                      <span className="text-muted-foreground text-sm">{field.prefix}</span>
                    )}
                    <input
                      className={`bg-muted rounded-md px-2 py-1 text-sm flex-1 border-2 transition-colors ${
                        field.key === "username" && usernameStatus
                          ? usernameStatus.valid === true
                            ? "border-green-500"
                            : usernameStatus.valid === false
                              ? "border-red-500"
                              : "border-yellow-500"
                          : "border-transparent"
                      }`}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                    <button
                      className="p-1 rounded-md hover:bg-primary/20 text-primary transition-colors disabled:opacity-40"
                      onClick={saveField}
                      disabled={
                        updateMutation.isPending ||
                        (field.key === "username" && usernameStatus?.valid !== true)
                      }
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                      onClick={cancelEditing}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {field.key === "username" && usernameStatus && (
                    <p className={`text-xs flex items-center gap-1 ${
                      usernameStatus.valid === true
                        ? "text-green-500"
                        : usernameStatus.valid === false
                          ? "text-red-500"
                          : "text-yellow-500"
                    }`}>
                      {usernameStatus.valid === null && <Loader2 className="w-3 h-3 animate-spin" />}
                      {usernameStatus.message}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {field.prefix && <span className="text-muted-foreground">{field.prefix}</span>}
                  {viewer[field.key]}
                </p>
              )}
            </div>
            {editingField !== field.key && (
              <button
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                onClick={() => startEditing(field.key)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Country / flag */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Country</p>
          </div>
          <select
            className="bg-muted rounded-md px-2 py-1 text-sm border border-border focus:outline-none"
            value={viewer.country ?? ""}
            onChange={async (e) => {
              const country = e.target.value || null;
              const updatedUser = await updateMutation.mutateAsync({ country });
              setViewer(updatedUser);
            }}
          >
            <option value="">None</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {countryCodeToFlag(c.code)} {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-500 pt-2">{error}</p>
        )}
      </section>
    </div>
  );
}
