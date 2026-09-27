'use client';

// SVG icons for the component board. Emojis rendered differently on each
// system, and recent ones (🪜 🪗 🪟 🫥 …) were blank with older emoji fonts.
import type { LucideIcon } from 'lucide-react';
import {
  AlignLeft, AppWindow, BadgeCheck, BadgeDollarSign, BellRing, Box,
  CalendarDays, ChartColumn, ChartLine, ChartNoAxesCombined, ChartPie, ChevronDown,
  ChevronsRight, ChevronsUpDown, CircleDot, CircleHelp, CircleUserRound, Clapperboard,
  ClipboardList, Cloud, Code, Columns2, Columns3, Compass,
  CreditCard, Ellipsis, FileText, Flag, Folders, FormInput,
  GalleryHorizontal, GalleryHorizontalEnd, GitCommitVertical, Grid3x3, Heading, Heading1,
  Heart, Image, Images, Inbox, Layers, LayoutDashboard,
  LayoutGrid, LayoutList, LayoutPanelTop, LayoutTemplate, LetterText, Link,
  List, ListChecks, ListOrdered, Loader, LoaderCircle, Map,
  Megaphone, Menu, MessageCircleMore, MessageSquare, MessageSquareHeart, MessageSquareMore,
  MessageSquareQuote, MessagesSquare, Minus, MousePointerClick, MoveVertical, Network,
  Newspaper, Package, Palette, PanelBottom, PanelBottomOpen, PanelLeft,
  PanelLeftOpen, PanelTop, PenLine, PenTool, Pilcrow, Quote,
  RectangleEllipsis, RectangleHorizontal, Rows3, ScrollText, Search, Shapes,
  Share2, ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, SquareCheck,
  SquareCode, SquareDashed, SquareKanban, Star, Store, Table,
  Table2, TableOfContents, Tag, TextCursorInput, TicketPercent, ToggleRight,
  TrendingUp, TriangleAlert, Type, Upload, Users, Video,
  Volume2, WandSparkles,
} from 'lucide-react';

const TYPE_ICONS: Record<string, LucideIcon> = {
  navbar: PanelTop, hero: Sparkles, footer: PanelBottom, sidebar: PanelLeft,
  header: Heading, section: Rows3, container: Box, grid: LayoutGrid,
  columns: Columns3, spacer: MoveVertical, wrapper: SquareDashed, split_pane: Columns2,
  masonry: LayoutDashboard, breadcrumb: ChevronsRight, tabs: Folders, pagination: Ellipsis,
  stepper: ListOrdered, menu: Menu, drawer: PanelLeftOpen, bottomnav: PanelBottomOpen,
  toc: TableOfContents, mega_menu: LayoutList, features: Star, cards: GalleryHorizontalEnd,
  testimonials: MessageSquareQuote, pricing: BadgeDollarSign, cta: Megaphone, faq: CircleHelp,
  timeline: GitCommitVertical, team: Users, stats: TrendingUp, newsletter: Newspaper,
  banner: Flag, logo_cloud: Cloud, blog_post: FileText, table: Table,
  list: List, accordion: ChevronsUpDown, tree: Network, description: AlignLeft,
  tag: Tag, tooltip: MessageCircleMore, popover: MessageSquare, kanban: SquareKanban,
  data_grid: Grid3x3, image: Image, gallery: Images, video: Video,
  carousel: GalleryHorizontal, audio: Volume2, map: Map, embed: Code,
  avatar: CircleUserRound, icon: Shapes, lottie: Clapperboard, '3d_model': Box,
  form: ClipboardList, input: TextCursorInput, textarea: LetterText, dropdown: ChevronDown,
  checkbox: SquareCheck, radio: CircleDot, toggle: ToggleRight, slider: SlidersHorizontal,
  datepicker: CalendarDays, fileupload: Upload, search: Search, rating: Star,
  colorpicker: Palette, rich_text: PenLine, autocomplete: WandSparkles, alert: TriangleAlert,
  toast: BellRing, modal: AppWindow, dialog: MessageSquareMore, progress: Loader,
  spinner: LoaderCircle, skeleton: RectangleEllipsis, empty_state: Inbox, product_card: ShoppingBag,
  cart: ShoppingCart, checkout: CreditCard, price_tag: BadgeDollarSign, review: MessageSquareHeart,
  wishlist: Heart, promo_code: TicketPercent, button: RectangleHorizontal, link: Link,
  badge: BadgeCheck, chip: Tag, heading: Heading1, paragraph: Pilcrow,
  divider: Minus, code_block: SquareCode, blockquote: Quote, scroll_area: ScrollText,
  social_share: Share2, comments: MessagesSquare, bar_chart: ChartColumn, line_chart: ChartLine,
  pie_chart: ChartPie, sketch: PenTool,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Basic Layout': LayoutTemplate,
  'Advanced Layout': Layers,
  'Navigation': Compass,
  'Typography': Type,
  'Content Sections': LayoutPanelTop,
  'Data Display': Table2,
  'Media': Image,
  'Forms & Inputs': FormInput,
  'Advanced Forms': ListChecks,
  'Interactive & Feedback': MousePointerClick,
  'Commerce': Store,
  'Social & Charts': ChartNoAxesCombined,
};

export function ComponentIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = TYPE_ICONS[type] ?? Package;  // agent-generated types may be unknown
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}

export function CategoryIcon({ label, size = 16 }: { label: string; size?: number }) {
  const Icon = CATEGORY_ICONS[label] ?? Package;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
