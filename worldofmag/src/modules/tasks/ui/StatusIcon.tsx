"use client";

import {
  Circle,
  Clock,
  Eye,
  CheckCircle2,
  MinusCircle,
  AlertCircle,
  Star,
  Flag,
  Bookmark,
  PauseCircle,
  PlayCircle,
  Loader,
  type LucideIcon,
} from "lucide-react";

// Rejestr ikon dostępnych dla statusów (systemowych i własnych). Klucz zapisywany
// w konfiguracji listy (`CustomTaskStatus.icon` / `SystemTaskStatus.icon`).
const ICONS: Record<string, LucideIcon> = {
  circle: Circle,
  clock: Clock,
  eye: Eye,
  "check-circle": CheckCircle2,
  "minus-circle": MinusCircle,
  "alert-circle": AlertCircle,
  star: Star,
  flag: Flag,
  bookmark: Bookmark,
  "pause-circle": PauseCircle,
  "play-circle": PlayCircle,
  loader: Loader,
};

// Opcje do pickera ikon przy tworzeniu/edycji własnego statusu.
export const STATUS_ICON_OPTIONS = Object.keys(ICONS);

interface StatusIconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export function StatusIcon({ name, size = 16, color, className }: StatusIconProps) {
  const Icon = ICONS[name] ?? Circle;
  return <Icon size={size} style={color ? { color } : undefined} className={className} />;
}
