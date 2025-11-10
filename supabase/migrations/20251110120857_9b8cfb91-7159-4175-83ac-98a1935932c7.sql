-- Add company_number column to companies table
ALTER TABLE public.companies
ADD COLUMN company_number text;

-- Add a unique constraint to ensure company numbers are unique
ALTER TABLE public.companies
ADD CONSTRAINT companies_company_number_key UNIQUE (company_number);