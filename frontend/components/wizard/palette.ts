import type { ComponentData } from '@/store/projectStore';

export interface PaletteCategory {
  label: string;
  icon: string;
  items: ComponentData[];
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    label: 'Basic Layout', icon: '📐',
    items: [
      { id: 'p_container', name: 'Container', type: 'container', description: 'Content wrapper' },
      { id: 'p_section', name: 'Section', type: 'section', description: 'Generic page section' },
      { id: 'p_grid', name: 'Grid Layout', type: 'grid', description: 'Responsive grid container' },
      { id: 'p_cols', name: 'Columns', type: 'columns', description: 'Multi-column layout' },
      { id: 'p_spacer', name: 'Spacer', type: 'spacer', description: 'Vertical spacing element' },
      { id: 'p_div', name: 'Divider', type: 'divider', description: 'Visual horizontal rule' },
    ],
  },
  {
    label: 'Advanced Layout', icon: '🏗️',
    items: [
      { id: 'p_header', name: 'Page Header', type: 'header', description: 'Title area with breadcrumb' },
      { id: 'p_sidebar', name: 'Sidebar', type: 'sidebar', description: 'Side panel layout' },
      { id: 'p_drawer', name: 'Drawer', type: 'drawer', description: 'Slide-out side panel' },
      { id: 'p_split', name: 'Split Pane', type: 'split_pane', description: 'Resizable split layout' },
      { id: 'p_masonry', name: 'Masonry Grid', type: 'masonry', description: 'Staggered grid layout' },
      { id: 'p_scroll', name: 'Scroll Area', type: 'scroll_area', description: 'Scrollable content zone' },
    ],
  },
  {
    label: 'Navigation', icon: '🧭',
    items: [
      { id: 'p_nav', name: 'Navigation Bar', type: 'navbar', description: 'Top navigation with links and branding' },
      { id: 'p_foot', name: 'Footer', type: 'footer', description: 'Site footer with links' },
      { id: 'p_mega', name: 'Mega Menu', type: 'mega_menu', description: 'Large dropdown navigation' },
      { id: 'p_menu', name: 'Menu', type: 'menu', description: 'Dropdown menu items' },
      { id: 'p_tabs', name: 'Tabs', type: 'tabs', description: 'Tab navigation panel' },
      { id: 'p_bread', name: 'Breadcrumb', type: 'breadcrumb', description: 'Navigation breadcrumb trail' },
      { id: 'p_pagin', name: 'Pagination', type: 'pagination', description: 'Page number navigation' },
      { id: 'p_stepper', name: 'Stepper', type: 'stepper', description: 'Multi-step progress' },
      { id: 'p_bnav', name: 'Bottom Nav', type: 'bottomnav', description: 'Mobile bottom navigation' },
      { id: 'p_toc', name: 'Table of Contents', type: 'toc', description: 'Anchor link navigation' },
    ],
  },
  {
    label: 'Typography', icon: '✏️',
    items: [
      { id: 'p_h1', name: 'Heading', type: 'heading', description: 'Typography header (H1–H6)' },
      { id: 'p_p', name: 'Paragraph', type: 'paragraph', description: 'Text block content' },
      { id: 'p_link', name: 'Text Link', type: 'link', description: 'Hyperlink element' },
      { id: 'p_bq', name: 'Blockquote', type: 'blockquote', description: 'Quoted text block' },
      { id: 'p_code', name: 'Code Block', type: 'code_block', description: 'Syntax-highlighted code' },
    ],
  },
  {
    label: 'Content Sections', icon: '📰',
    items: [
      { id: 'p_hero', name: 'Hero Section', type: 'hero', description: 'Main banner with CTA' },
      { id: 'p_feat', name: 'Features Grid', type: 'features', description: 'Key features showcase' },
      { id: 'p_cards', name: 'Content Cards', type: 'cards', description: 'Information cards grid' },
      { id: 'p_test', name: 'Testimonials', type: 'testimonials', description: 'User reviews section' },
      { id: 'p_price', name: 'Pricing Table', type: 'pricing', description: 'Subscription tiers' },
      { id: 'p_cta', name: 'Call to Action', type: 'cta', description: 'Conversion CTA section' },
      { id: 'p_faq', name: 'FAQ Section', type: 'faq', description: 'Accordion Q&A list' },
      { id: 'p_tl', name: 'Timeline', type: 'timeline', description: 'Chronological events' },
      { id: 'p_team', name: 'Team Section', type: 'team', description: 'Team member profiles' },
      { id: 'p_stats', name: 'Stats Counter', type: 'stats', description: 'Animated stat numbers' },
      { id: 'p_news', name: 'Newsletter', type: 'newsletter', description: 'Email signup block' },
      { id: 'p_banner', name: 'Banner', type: 'banner', description: 'Promotional banner' },
      { id: 'p_logos', name: 'Logo Cloud', type: 'logo_cloud', description: 'Partner/client logos' },
      { id: 'p_blog', name: 'Blog Post', type: 'blog_post', description: 'Article layout block' },
    ],
  },
  {
    label: 'Data Display', icon: '📊',
    items: [
      { id: 'p_table', name: 'Data Table', type: 'table', description: 'Sortable data table' },
      { id: 'p_dgrid', name: 'Data Grid', type: 'data_grid', description: 'Advanced spreadsheet grid' },
      { id: 'p_list', name: 'List', type: 'list', description: 'Ordered/unordered list' },
      { id: 'p_kanban', name: 'Kanban Board', type: 'kanban', description: 'Drag-and-drop task board' },
      { id: 'p_tree', name: 'Tree View', type: 'tree', description: 'Hierarchical data view' },
      { id: 'p_desc', name: 'Description List', type: 'description', description: 'Key-value pairs' },
      { id: 'p_bdg', name: 'Badge', type: 'badge', description: 'Status indicator label' },
      { id: 'p_tag', name: 'Tag / Label', type: 'tag', description: 'Categorization tag' },
      { id: 'p_chip', name: 'Chip', type: 'chip', description: 'Filter/tag chip element' },
    ],
  },
  {
    label: 'Media', icon: '🎬',
    items: [
      { id: 'p_img', name: 'Image', type: 'image', description: 'Responsive image' },
      { id: 'p_gal', name: 'Gallery', type: 'gallery', description: 'Image gallery grid' },
      { id: 'p_vid', name: 'Video Player', type: 'video', description: 'Embedded video' },
      { id: 'p_caro', name: 'Carousel', type: 'carousel', description: 'Image/content slider' },
      { id: 'p_aud', name: 'Audio Player', type: 'audio', description: 'Audio playback widget' },
      { id: 'p_map', name: 'Map', type: 'map', description: 'Interactive map embed' },
      { id: 'p_embed', name: 'Embed / iFrame', type: 'embed', description: 'External content embed' },
      { id: 'p_ava', name: 'Avatar', type: 'avatar', description: 'Profile image circle' },
      { id: 'p_ico', name: 'Icon', type: 'icon', description: 'Vector icon graphic' },
      { id: 'p_lottie', name: 'Lottie Animation', type: 'lottie', description: 'Vector animation' },
      { id: 'p_3d', name: '3D Model', type: '3d_model', description: 'Interactive 3D viewer' },
    ],
  },
  {
    label: 'Forms & Inputs', icon: '📋',
    items: [
      { id: 'p_form', name: 'Form Container', type: 'form', description: 'Form wrapper with validation' },
      { id: 'p_inp', name: 'Text Input', type: 'input', description: 'Single-line text field' },
      { id: 'p_txta', name: 'Text Area', type: 'textarea', description: 'Multi-line input field' },
      { id: 'p_drop', name: 'Dropdown Select', type: 'dropdown', description: 'Selection dropdown menu' },
      { id: 'p_chk', name: 'Checkbox', type: 'checkbox', description: 'Boolean toggle check' },
      { id: 'p_rad', name: 'Radio Group', type: 'radio', description: 'Exclusive option selector' },
      { id: 'p_tog', name: 'Toggle Switch', type: 'toggle', description: 'On/off switch control' },
      { id: 'p_sld', name: 'Range Slider', type: 'slider', description: 'Value range control' },
      { id: 'p_srch', name: 'Search Bar', type: 'search', description: 'Search input with icon' },
    ],
  },
  {
    label: 'Advanced Forms', icon: '📝',
    items: [
      { id: 'p_date', name: 'Date Picker', type: 'datepicker', description: 'Calendar date selector' },
      { id: 'p_file', name: 'File Upload', type: 'fileupload', description: 'Drag-and-drop uploader' },
      { id: 'p_rate', name: 'Rating', type: 'rating', description: 'Star rating control' },
      { id: 'p_cpick', name: 'Color Picker', type: 'colorpicker', description: 'Color selection input' },
      { id: 'p_rich', name: 'Rich Text Editor', type: 'rich_text', description: 'WYSIWYG editor' },
      { id: 'p_auto', name: 'Autocomplete', type: 'autocomplete', description: 'Input with suggestions' },
    ],
  },
  {
    label: 'Interactive & Feedback', icon: '🔔',
    items: [
      { id: 'p_btn', name: 'Button', type: 'button', description: 'Action button' },
      { id: 'p_acc', name: 'Accordion', type: 'accordion', description: 'Collapsible panels' },
      { id: 'p_ttip', name: 'Tooltip', type: 'tooltip', description: 'Hover info tooltip' },
      { id: 'p_popv', name: 'Popover', type: 'popover', description: 'Click-triggered popup' },
      { id: 'p_alr', name: 'Alert', type: 'alert', description: 'Status notification bar' },
      { id: 'p_toast', name: 'Toast', type: 'toast', description: 'Temporary notification' },
      { id: 'p_modal', name: 'Modal Dialog', type: 'modal', description: 'Overlay dialog window' },
      { id: 'p_dlg', name: 'Confirm Dialog', type: 'dialog', description: 'Confirmation prompt' },
      { id: 'p_prog', name: 'Progress Bar', type: 'progress', description: 'Loading progress indicator' },
      { id: 'p_spn', name: 'Spinner', type: 'spinner', description: 'Loading spinner animation' },
      { id: 'p_skel', name: 'Skeleton', type: 'skeleton', description: 'Content loading placeholder' },
      { id: 'p_empty', name: 'Empty State', type: 'empty_state', description: 'No-data placeholder' },
    ],
  },
  {
    label: 'Commerce', icon: '🛒',
    items: [
      { id: 'p_prod', name: 'Product Card', type: 'product_card', description: 'E-commerce product tile' },
      { id: 'p_cart', name: 'Shopping Cart', type: 'cart', description: 'Cart summary panel' },
      { id: 'p_chkout', name: 'Checkout Form', type: 'checkout', description: 'Payment checkout flow' },
      { id: 'p_ptag', name: 'Price Tag', type: 'price_tag', description: 'Price display element' },
      { id: 'p_rev', name: 'Review Card', type: 'review', description: 'Product review block' },
      { id: 'p_wish', name: 'Wishlist Button', type: 'wishlist', description: 'Save to favorites' },
      { id: 'p_promo', name: 'Promo Code', type: 'promo_code', description: 'Discount code input' },
    ],
  },
  {
    label: 'Social & Charts', icon: '🌐',
    items: [
      { id: 'p_share', name: 'Social Share', type: 'social_share', description: 'Share buttons' },
      { id: 'p_comm', name: 'Comments', type: 'comments', description: 'User discussion thread' },
      { id: 'p_bar', name: 'Bar Chart', type: 'bar_chart', description: 'Data bar chart' },
      { id: 'p_line', name: 'Line Chart', type: 'line_chart', description: 'Data line chart' },
      { id: 'p_pie', name: 'Pie Chart', type: 'pie_chart', description: 'Data pie chart' },
    ],
  },
];
