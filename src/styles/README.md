# Global styles

`src/app/globals.css` is the single entry point and imports these files in cascade order.
Keep the import order stable unless a visual change is intentional.

- `tokens.css`: design tokens, theme values, reset, and document defaults
- `base.css`: shared primitives and reusable UI components
- `components/site-layout.css`: header, navigation, notifications, and footer
- `components/timeline.css`: timeline composer, posts, and post media
- `components/articles-editor.css`: article cards, reactions, forms, and editor
- `components/account-admin.css`: authentication, profile, security, and review UI
- `pages/public.css`: route composition and public-facing pages
- `responsive.css`: shared responsive and reduced-motion overrides
- `pages/donation.css`: donation flow
- `pages/legal.css`: legal pages and cookie consent

Add new rules to the narrowest matching file. Component-scoped styles that do not
need global class names should use a colocated CSS Module instead.
