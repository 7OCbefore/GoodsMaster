# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GoodsMaster Pro is a Vue 3 single-page application for inventory and sales management, designed for mobile-first use with offline capability. It's built with Vite, uses Tailwind CSS for styling with an iOS-inspired design system, and includes Excel export functionality via the xlsx library.

## Common Development Commands

- **Development server**: `npm run dev` (Vite dev server)
- **Production build**: `npm run build` (outputs to `dist/`)
- **Preview production build**: `npm run preview`
- **CI/CD**: GitHub Actions workflow automatically deploys to GitHub Pages on push to `main` branch

**Note**: The production build uses base path `/GoodsMaster/` for GitHub Pages deployment, while development uses `./`.

## Architecture Overview

### Core Technology Stack
- **Frontend**: Vue 3 (Composition API with `<script setup>` syntax)
- **Build Tool**: Vite with Vue plugin
- **Styling**: Tailwind CSS with custom iOS-inspired color palette
- **Icons**: Phosphor Icons
- **Spreadsheet Export**: xlsx library for Excel file generation
- **State Persistence**: Browser localStorage (no backend dependency)

### Key Architectural Patterns

#### Centralized State Management (`src/composables/useStore.js`)
- **God Object Pattern**: Single `useStore.js` composable manages all business logic
- **Singleton Instance**: State variables defined outside function ensure shared reactive data across components
- **LocalStorage Persistence**: Deep watchers automatically sync core data arrays to localStorage
- **WAC Algorithm**: Weighted Average Cost method for inventory valuation
- **Date-Based Filtering**: `isSameDay` helper enables time-series analysis and daily statistics

#### Global UI State (`src/App.vue`)
- **Provide/Inject Pattern**: Global `showToast` and `showDialog` functions available to all components
- **Bottom Navigation**: Five main views (Dashboard, Inbox, Inventory, Sales, Settings) with `keep-alive`
- **Mobile-First Design**: Bottom tab bar with safe area insets and iOS-style interface

#### Data Models
- **Packages**: Purchase/incoming goods with verification status
- **Goods List**: Master product catalog
- **Sales History**: Completed orders with profit calculations
- **Sell Prices**: Custom pricing per product
- **Inventory List**: Computed from packages minus sales using WAC method

#### Excel Export System (`src/composables/useExport.js`)
- **Three-Sheet Structure**: Sales line items, order summary, and inventory snapshot
- **Chinese Localization**: Column headers and date formatting optimized for Chinese users
- **Formatted Output**: Proper currency formatting and column widths

### Important File Locations

- **Core Business Logic**: `src/composables/useStore.js` - All state management and inventory calculations
- **Application Root**: `src/App.vue` - Navigation, global UI providers, and layout
- **Main Views**:
  - `src/views/SalesView.vue` - POS interface with grid layout and shopping cart
  - `src/views/DashboardView.vue` - Analytics with date filtering and chart rendering
  - `src/views/InboxView.vue` - Purchase/incoming goods with scan functionality
  - `src/views/InventoryView.vue` - Stock management with search
  - `src/views/SettingsView.vue` - Data import/export operations
- **Build Configuration**:
  - `vite.config.js` - Base path settings for GitHub Pages deployment
  - `tailwind.config.js` - iOS-inspired color palette and design system
  - `postcss.config.js` - Tailwind and autoprefixer plugins
- **CI/CD Pipeline**: `.github/workflows/deploy.yml` - Automatic deployment to GitHub Pages

### Documentation

- **Technical Architecture**: `Documents/Code_Reviews.md` - Detailed code review and architectural decisions
- **UI Design Specifications**: `Documents/Design_Doc Sales UI Refactor.md` - Sales interface redesign plan
- **Development History**: `Documents/Chat Summary.md` - Conversation history and decision log
- **No Cursor/Copilot Rules**: No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` files exist

### Design System

- **iOS-Inspired Theme**: "Premium Dark" color palette mimicking Apple's design language
- **Glass Morphism**: Navigation bar with backdrop blur effects
- **Mobile Optimizations**: Safe area insets, scrollbar hiding, touch feedback animations
- **Chinese Language**: All UI text and date formatting in Chinese
- **Currency Formatting**: Chinese locale (`zh-CN`) with 2 decimal places

### Key Implementation Details

1. **Offline-First**: All data stored in localStorage with no external API dependencies
2. **Mobile-Optimized**: Bottom navigation, touch-friendly controls, responsive grid layouts
3. **Performance Considerations**:
   - Computed properties for inventory calculations
   - Watch handlers for localStorage synchronization
   - No pagination currently implemented for sales history
4. **Known Limitations**:
   - OCR functionality is placeholder only
   - No unit test framework configured
   - Performance may degrade with large sales history datasets

### Development Notes

- **Chinese Context**: The application is designed for Chinese users with RMB currency formatting
- **Vue 3 Best Practices**: Uses Composition API with `<script setup>` syntax throughout
- **Build Considerations**: Avoid arrow functions in computed properties to prevent JSX parsing issues in specific build environments
- **Component Structure**: Reusable components in `src/components/` (Dialog, Toast, HelloWorld)
- **Global Styles**: `src/style.css` contains Tailwind imports and custom animations

When making changes, ensure consistency with the existing iOS-inspired design language and maintain the offline-first, mobile-optimized approach.