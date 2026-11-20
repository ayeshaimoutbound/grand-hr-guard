ALTER TYPE public.rank ADD VALUE IF NOT EXISTS 'Special';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pay_special numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_special numeric NOT NULL DEFAULT 0;

ALTER TABLE public.company_rate_history
  ADD COLUMN IF NOT EXISTS pay_special numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_special numeric NOT NULL DEFAULT 0;