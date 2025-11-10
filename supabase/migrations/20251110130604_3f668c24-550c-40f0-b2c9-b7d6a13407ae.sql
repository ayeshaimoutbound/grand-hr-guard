-- Add more roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';