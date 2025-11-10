import { z } from "zod";

// Employee validation schema
export const employeeSchema = z.object({
  employee_id: z
    .string()
    .min(1, "Employee ID is required")
    .max(50, "Employee ID must be less than 50 characters")
    .regex(/^[A-Z0-9-]+$/, "Employee ID must contain only uppercase letters, numbers, and hyphens"),
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters")
    .trim(),
  nic: z
    .string()
    .regex(
      /^([0-9]{9}[vVxX]|[0-9]{12})$/,
      "NIC must be 9 digits followed by V/X or 12 digits"
    ),
  phone_number: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
  bank_name: z
    .string()
    .min(2, "Bank name must be at least 2 characters")
    .max(100, "Bank name must be less than 100 characters")
    .trim(),
  branch: z
    .string()
    .min(2, "Branch must be at least 2 characters")
    .max(100, "Branch must be less than 100 characters")
    .trim(),
  account_number: z
    .string()
    .min(5, "Account number must be at least 5 characters")
    .max(30, "Account number must be less than 30 characters")
    .regex(/^[0-9]+$/, "Account number must contain only numbers"),
});

// Company validation schema
export const companySchema = z.object({
  company_name: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(200, "Company name must be less than 200 characters")
    .trim(),
  location: z
    .string()
    .min(2, "Location must be at least 2 characters")
    .max(200, "Location must be less than 200 characters")
    .trim(),
  pay_oic: z
    .number()
    .positive("OIC pay must be a positive number")
    .max(1000000, "OIC pay must be less than 1,000,000")
    .refine((val) => !isNaN(val), "OIC pay must be a valid number"),
  pay_sso: z
    .number()
    .positive("SSO pay must be a positive number")
    .max(1000000, "SSO pay must be less than 1,000,000")
    .refine((val) => !isNaN(val), "SSO pay must be a valid number"),
  pay_jso: z
    .number()
    .positive("JSO pay must be a positive number")
    .max(1000000, "JSO pay must be less than 1,000,000")
    .refine((val) => !isNaN(val), "JSO pay must be a valid number"),
  pay_lso: z
    .number()
    .positive("LSO pay must be a positive number")
    .max(1000000, "LSO pay must be less than 1,000,000")
    .refine((val) => !isNaN(val), "LSO pay must be a valid number"),
});

// User validation schema
export const userSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  full_name: z
    .string()
    .max(100, "Full name must be less than 100 characters")
    .trim()
    .optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type CompanyFormData = z.infer<typeof companySchema>;
export type UserFormData = z.infer<typeof userSchema>;
