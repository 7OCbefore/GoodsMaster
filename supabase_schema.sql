-- Supabase 数据库表结构定义
-- 用于 GoodsMaster 云端同步架构

-- 启用 Row Level Security (RLS)
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- 创建 packages 表
CREATE TABLE IF NOT EXISTS public.packages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id TEXT,
  tracking TEXT,
  content TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2),
  note TEXT,
  verified BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 创建 sales 表
CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,  -- 使用与本地相同的字符串ID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL,  -- 存储订单项的JSON数组
  total_amount DECIMAL(10, 2) NOT NULL,
  total_profit DECIMAL(10, 2) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS packages_user_id_idx ON public.packages(user_id);
CREATE INDEX IF NOT EXISTS packages_updated_at_idx ON public.packages(updated_at);
CREATE INDEX IF NOT EXISTS packages_verified_idx ON public.packages(verified);
CREATE INDEX IF NOT EXISTS sales_user_id_idx ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS sales_updated_at_idx ON public.sales(updated_at);
CREATE INDEX IF NOT EXISTS sales_timestamp_idx ON public.sales(timestamp);

-- 创建 RLS 策略 - 用户只能访问自己的数据
CREATE POLICY "Users can view own packages" ON public.packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own packages" ON public.packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own packages" ON public.packages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own packages" ON public.packages
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sales" ON public.sales
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales" ON public.sales
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales" ON public.sales
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sales" ON public.sales
  FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表添加更新时间触发器
CREATE TRIGGER update_packages_updated_at 
    BEFORE UPDATE ON public.packages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at 
    BEFORE UPDATE ON public.sales 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();