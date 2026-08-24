export { Button } from "./Button"
export type { ButtonProps } from "./Button"
export { IconButton } from "./IconButton"
export type { IconButtonProps } from "./IconButton"
export { Card } from "./Card"
export { Surface } from "./Surface"
export type { SurfaceProps } from "./Surface"
export { Badge } from "./Badge"
export type { BadgeProps } from "./Badge"
export { Modal } from "./Modal"
export type { ModalProps } from "./Modal"

// 045 — system komponentów
export { ConfirmDialog } from "./ConfirmDialog"
export type { ConfirmDialogProps } from "./ConfirmDialog"
export { Field, fieldControlStyle } from "./Field"
export type { FieldProps, FieldChildProps } from "./Field"

// 045 — kontrakt widoku (re-eksport, żeby moduły importowały z jednego miejsca)
export {
  ModuleView,
  ViewBar,
  ViewEmpty,
  ViewLoading,
  ViewError,
  ViewNoAccess,
} from "./view"
export type { ModuleViewProps, ViewBarProps, ViewResource, ViewStateKind } from "./view"
