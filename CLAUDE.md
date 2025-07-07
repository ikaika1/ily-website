# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a **static HTML website** for a Solana validator built using **Nicepage 7.4.4** framework. No build system or backend - direct file serving ready.

**Key Technologies:**
- Nicepage framework (nicepage.css/js - 2MB+ of framework code)
- jQuery for DOM manipulation
- Static HTML/CSS architecture with component-based styling
- International telephone input library (intlTelInput)

## File Structure & Organization

**Core Pages:**
- `index.html` - Main validator showcase (hardcoded validator address: ByszyWdqC3rV​​MWy8f6jwK5cmwkpwYdwsr7UL58xS5vnm)
- `Home.html` - Redirect file pointing to index
- `/blog/` - Static blog system with individual HTML files (post-1.html through post-5.html)

**Styling Architecture:**
- `nicepage.css` - Main framework styles (1.5MB)
- `index.css` - Homepage-specific styles
- `Blog-Template.css` / `Post-Template.css` - Blog-specific styling
- Uses utility-first CSS with "u-" prefixed classes

**Content Management:**
- All content is hardcoded in HTML files
- No CMS or dynamic content system
- `blog/blog.json` exists but is empty (incomplete feature)
- Images stored in `/images/` directory (anime/Milady-themed artwork)

## Development Workflow

**No Build Commands Required:**
- Pure static files - no compilation needed
- Direct file editing for content updates
- Ready for static hosting (Netlify, Vercel, GitHub Pages)

**Common Tasks:**
- **Content updates**: Edit HTML files directly
- **New blog posts**: Copy existing post template (e.g., `blog/post-1.html`) and modify
- **Styling changes**: Edit component-specific CSS files
- **Validator info updates**: Modify hardcoded values in `index.html`

## Responsive Design System

Uses Nicepage's responsive breakpoints:
- Desktop: 1200px+
- Tablet: 992px-1199px  
- Mobile: 768px-991px
- Small mobile: <575px

## Key Components

**Image Gallery**: Touch-enabled carousel with fade effects in main section
**Blog System**: Template-based with consistent navigation structure
**Social Links**: Direct links to GitHub (ikaika1), Discord (Milady Japan), Twitter

## Performance Notes

Framework files are large (nicepage.css: 1.5MB, nicepage.js: 400KB). Consider optimization if performance becomes an issue. Images could benefit from compression/optimization.
kousin
