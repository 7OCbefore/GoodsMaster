-- ============================================================
-- 0. 变量定义 (请使用查找替换功能修改下面的 UUID)
-- GLOBAL_USER_ID: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
-- ============================================================

-- ============================================================
-- 1. 彻底清理 (Drop Everything)
-- ============================================================
DROP TABLE IF EXISTS public.packages CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- ============================================================
-- 2. 重建 Products 主表 (Master Data)
-- ============================================================
CREATE TABLE public.products (
    id uuid PRIMARY KEY, -- 前端生成的 UUID
    user_id uuid NOT NULL, -- 全局用户 ID
    name text NOT NULL,
    barcode text,
    price numeric DEFAULT 0,
    stock_warning integer DEFAULT 5,
    category text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false
);

-- 开启 RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX idx_products_user ON public.products(user_id);
CREATE INDEX idx_products_updated ON public.products(updated_at);

-- ============================================================
-- 3. 重建 Packages 表 (Transaction Data)
-- ============================================================
CREATE TABLE public.packages (
    -- [关键修改] ID 类型改为 numeric 以兼容 JS 的随机小数 ID
    id numeric PRIMARY KEY, 
    
    product_id uuid REFERENCES public.products(id), -- 关联主表
    
    -- 核心业务字段
    batch_id text,
    tracking text,
    content text, -- 快照: 商品名
    quantity integer DEFAULT 1,
    cost_price numeric DEFAULT 0,
    note text,
    verified boolean DEFAULT false,
    timestamp numeric NOT NULL, -- 同样改为 numeric
    
    -- 同步控制字段
    user_id uuid NOT NULL,
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false
);

-- 开启 RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX idx_packages_user ON public.packages(user_id);
CREATE INDEX idx_packages_updated ON public.packages(updated_at);

-- ============================================================
-- 4. 重建 Sales 表 (Transaction Data)
-- ============================================================
CREATE TABLE public.sales (
    -- [关键修改] ID 类型改为 numeric
    id numeric PRIMARY KEY,
    
    -- 核心业务字段
    customer text,
    total_amount numeric DEFAULT 0,
    total_profit numeric DEFAULT 0,
    items jsonb NOT NULL, -- 存储订单项详情
    status text DEFAULT 'completed',
    note text,
    timestamp numeric NOT NULL,
    
    -- 同步控制字段
    user_id uuid NOT NULL,
    updated_at timestamptz DEFAULT now(),
    is_deleted boolean DEFAULT false
);

-- 开启 RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- 创建索引
CREATE INDEX idx_sales_user ON public.sales(user_id);
CREATE INDEX idx_sales_updated ON public.sales(updated_at);

-- ============================================================
-- 5. 创建单租户安全策略 (Single-Tenant Policies)
-- ============================================================
-- [重要] 请确保这里的 UUID 与你 .env 文件一致

-- Products Policy
CREATE POLICY "Global User Access" ON public.products
FOR ALL TO anon
USING (user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
WITH CHECK (user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- Packages Policy
CREATE POLICY "Global User Access" ON public.packages
FOR ALL TO anon
USING (user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
WITH CHECK (user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- Sales Policy
CREATE POLICY "Global User Access" ON public.sales
FOR ALL TO anon
USING (user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
WITH CHECK (user_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

-- ============================================================
-- 6. 刷新 Schema 缓存
-- ============================================================
NOTIFY pgrst, 'reload schema';