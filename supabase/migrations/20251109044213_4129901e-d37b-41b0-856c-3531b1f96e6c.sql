-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (CRITICAL for security - roles must be in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
$$;

-- Helper function to check if user is admin or super admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_super_admin(auth.uid()));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_super_admin(auth.uid()));

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  nic TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  account_number TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view employees" ON public.employees
  FOR SELECT USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can add employees" ON public.employees
  FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can update employees" ON public.employees
  FOR UPDATE USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete employees" ON public.employees
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Create rank enum
CREATE TYPE public.rank AS ENUM ('OIC', 'SSO', 'JSO', 'LSO');

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  location TEXT NOT NULL,
  pay_oic DECIMAL(10,2) NOT NULL,
  pay_sso DECIMAL(10,2) NOT NULL,
  pay_jso DECIMAL(10,2) NOT NULL,
  pay_lso DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view companies" ON public.companies
  FOR SELECT USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can add companies" ON public.companies
  FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can update companies" ON public.companies
  FOR UPDATE USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete companies" ON public.companies
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Create shift type enum
CREATE TYPE public.shift_type AS ENUM ('Day', 'Night');

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  rank rank NOT NULL,
  shift_type shift_type NOT NULL,
  present BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, company_id, attendance_date, shift_type)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view attendance" ON public.attendance
  FOR SELECT USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can manage attendance" ON public.attendance
  FOR ALL USING (public.is_admin_or_super(auth.uid()));

-- Create salaries table
CREATE TABLE public.salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  salary_month DATE NOT NULL,
  basic_salary DECIMAL(10,2) DEFAULT 0,
  total_shifts INTEGER DEFAULT 0,
  pay_per_shift DECIMAL(10,2) DEFAULT 0,
  gross_shift_total DECIMAL(10,2) DEFAULT 0,
  salary_advance DECIMAL(10,2) DEFAULT 0,
  epf DECIMAL(10,2) DEFAULT 0,
  uniforms DECIMAL(10,2) DEFAULT 0,
  food DECIMAL(10,2) DEFAULT 0,
  transport DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  final_salary DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, company_id, salary_month)
);

ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view salaries" ON public.salaries
  FOR SELECT USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can add salaries" ON public.salaries
  FOR INSERT WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Super admins can update salaries" ON public.salaries
  FOR UPDATE USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete salaries" ON public.salaries
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON public.salaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();