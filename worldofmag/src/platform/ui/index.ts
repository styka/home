/**
 * 046 — `platform/ui` jest **re-eksportem, nie przenosinami**.
 *
 * Wspólne komponenty to zdolność platformy tak samo jak `auth` czy `db`, więc moduł ma je widzieć
 * pod adresem `@/platform/ui`. Fizycznie zostają jednak w `src/components/ui/`, i to świadomie:
 *
 * 1. Kontrakt widoku (045) jest wymuszany bramką `check:ui-contract`, która skanuje `src/components`.
 *    Przeniesienie plików wywróciłoby bramkę w tym samym commicie, w którym przenosimy granice —
 *    a zasada tej fazy mówi, że commit przenoszący zawiera WYŁĄCZNIE przenosiny.
 * 2. `components/ui` ma ~140 importujących. Przeniesienie ich razem z granicami modułów zrobiłoby
 *    z jednej fazy dwa nierozdzielne refaktory naraz.
 *
 * Dla modułu różnicy nie ma: `import { Button } from "@/platform/ui"` działa, a reguła granic
 * (T-14/T-15) widzi import platformy, nie cudzego wnętrza. Docelowe przeniesienie plików jest
 * osobnym, późniejszym zadaniem — do wykonania razem z aktualizacją bramki kontraktu widoku.
 */

export {
  Button,
  IconButton,
  Card,
  Surface,
  Badge,
  Modal,
  ConfirmDialog,
  Field,
  fieldControlStyle,
  ModuleView,
  ViewBar,
  ViewChromeProvider,
  useViewChrome,
  ViewEmpty,
  ViewLoading,
  ViewError,
  ViewNoAccess,
} from "@/components/ui";

export type {
  ButtonProps,
  IconButtonProps,
  SurfaceProps,
  BadgeProps,
  ModalProps,
  ConfirmDialogProps,
  FieldProps,
  FieldChildProps,
  ModuleViewProps,
  ViewBarProps,
  ViewChrome,
  ViewResource,
  ViewStateKind,
} from "@/components/ui";

export { useConfirm } from "@/components/ui/ConfirmProvider";
