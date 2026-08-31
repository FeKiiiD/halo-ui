// Shared table plumbing, exported so a project can build its own table shape on
// the same densities, popover and selection control.
export {
  MenuRow,
  Popover,
  SkeletonCell,
  TableCheckbox,
  densities,
  useMenuDismiss,
  type MenuAction,
  type PopoverProps,
  type TableCheckboxProps,
  type TableDensity,
} from "./table-primitives";

export {
  DataCell,
  type DataCellProps,
  type CellType,
  type CellRecord,
  type ColumnMeta,
} from "./data-cell";
export {
  DataTable,
  type DataTableProps,
  type Column,
  type Row,
  type SortState,
} from "./data-table";
export { SubTable, type SubTableProps } from "./sub-table";
export { TablePagination, type TablePaginationProps } from "./table-pagination";
export {
  TableToolbar,
  type TableToolbarProps,
  type ToolbarColumn,
  type ToolbarFilter,
} from "./table-toolbar";

export { FilterPanel, type FilterPanelProps } from "./filter-panel";
export { SortPanel, type SortPanelProps, type SortPreset } from "./sort-panel";
export { SavedViews, type SavedViewsProps } from "./saved-views";
export { KanbanBoard, type KanbanBoardProps, type KanbanCardFace, type KanbanColumn } from "./kanban-board";
export {
  DetailPanel,
  PanelField,
  PanelLayout,
  PanelSection,
  type DetailPanelProps,
  type DetailTab,
  type PanelFieldProps,
  type PanelSectionProps,
} from "./detail-panel";
