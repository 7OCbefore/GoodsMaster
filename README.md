# GoodsMaster - Inventory Management System

GoodsMaster is a modern inventory management application built with Vue 3 and Vite. It provides a comprehensive solution for tracking inventory, managing purchases, and processing sales.

## Features

- **进货管理 (Purchase Management)**: Track incoming goods with batch processing
- **库存资产 (Inventory Assets)**: Real-time inventory tracking with cost calculations
- **销售开单 (Sales Processing)**: Point-of-sale system with automatic inventory adjustment
- **经营分析 (Business Analytics)**: Dashboard with sales statistics and trends
- **系统设置 (System Settings)**: Data backup and restore functionality

## Tech Stack

- **Frontend**: Vue 3, Vite, Tailwind CSS
- **State Management**: Pinia + TanStack Query (in progress)
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Deployment**: GitHub Pages
- **Icons**: Phosphor Icons

## Prerequisites

- Node.js 16+
- Supabase account (for backend services)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Supabase:
   - Create a Supabase project at https://supabase.com
   - Copy your project URL and anon key
   - Add them to `.env` file:
     ```
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Building for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

## Deployment

The application is configured for deployment to GitHub Pages. Simply push to the main branch to trigger the deployment workflow.

## Project Structure

```
goods-master/
├─ 📁.github/workflows    # GitHub Actions workflows
├─ 📁public               # Static assets
├─ 📁src                  # Source code
│  ├─ 📁assets           # Images and other assets
│  ├─ 📁components       # Vue components
│  ├─ 📁composables      # Vue composables
│  ├─ 📁lib              # Library files (Supabase client)
│  ├─ 📁services         # Service layer (API calls)
│  ├─ 📁views            # Page components
│  ├─ 📄App.vue          # Root component
│  ├─ 📄main.js          # Application entry point
│  └─ 📄style.css        # Global styles
├─ 📄.env                # Environment variables
├─ 📄.env.example        # Example environment variables
├─ 📄index.html          # HTML entry point
├─ 📄package.json        # Project dependencies
├─ 📄postcss.config.js   # PostCSS configuration
├─ 📄README.md           # This file
├─ 📄tailwind.config.js  # Tailwind CSS configuration
└─ 📄vite.config.js      # Vite configuration
```

## Optimization Roadmap

This project includes a comprehensive optimization roadmap with the following focus areas:

1. **Security & Data Integrity**: Supabase integration with authentication and row-level security
2. **Performance & User Experience**: Code splitting, lazy loading, and Core Web Vitals optimization
3. **Reliability & Maintainability**: State management with Pinia/TanStack Query and testing strategy
4. **Development & Deployment Workflow**: Enhanced CI/CD pipeline with quality gates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

MIT